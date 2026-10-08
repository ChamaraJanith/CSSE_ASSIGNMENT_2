// ==============================================================================
// WildGuard - UC02 REAL Supabase integration verification (one-shot, writes data)
//
// NOT part of `npm test` (file name does not match *.test.js). Run explicitly from backend/:
//   npx jest --runInBand --testMatch "**/tests/integration/*.integration.js"
//
// Drives the real UC02 router -> authMiddleware -> requireWildlifeOfficer -> controller
// -> service -> pgPool transaction against the shared Supabase database.
//
// Safety:
// - A read-only preflight checks the expected starting state (image 1 REVIEWED with one
//   WILDLIFE_SPECIES review, images 2-6 UNREVIEWED with no reviews, no alerts). If it does
//   not match, every write scenario is skipped, so a second run cannot write anything.
// - Writes only images 5, 2 and 4. Images 1, 3 and 6 are only read.
// - Officer token: UC02_OFFICER_TOKEN env var if set, otherwise a session created through the
//   Supabase admin magic-link API (no email is sent). Tokens and keys are never printed.
// ==============================================================================

const express = require('express');
const request = require('supertest');
const { createClient } = require('@supabase/supabase-js');
const { supabaseAdmin } = require('../../supabaseClient');
const { getPool } = require('../../pgPool');
const evidenceReviewRoutes = require('../../routes/evidenceReviewRoutes');

jest.setTimeout(60000);

const app = express();
app.use(express.json());
app.use('/api/evidence-review', evidenceReviewRoutes);

const IMG = { WILDLIFE_DONE: 1, SUSPICIOUS: 2, LEOPARD_INCOMPLETE: 3, SUSPICIOUS_INCOMPLETE: 4, UNKNOWN: 5, BROKEN: 6 };
const JUSTIFICATION_2 = 'UC02 integration: human figure carrying a rifle-shaped object at night near the river crossing';
const JUSTIFICATION_4 = 'UC02 integration: person crouching at the boundary fence, metadata incomplete';

let officerId = null;
let authHeader = null;
let sessionClient = null;
let preflightOk = false;
let preflightProblems = [];

// ---------- read-only database helpers (service-role selects) ----------
const selectAll = async (table, columns, orderBy = 'id') => {
  const { data, error } = await supabaseAdmin.from(table).select(columns).order(orderBy);
  if (error) throw new Error(`Read of ${table} failed: ${error.message}`);
  return data;
};
const imageStatuses = async () =>
  Object.fromEntries((await selectAll('camera_trap_images', 'id, review_status')).map((r) => [r.id, r.review_status]));
const reviewsFor = async (imageId) => (await selectAll('evidence_reviews', '*')).filter((r) => r.image_id === imageId);
const alertsFor = async (imageId) => (await selectAll('threat_alerts', '*')).filter((a) => a.camera_trap_image_id === imageId);
const counts = async () => ({
  reviews: (await selectAll('evidence_reviews', 'id')).length,
  alerts: (await selectAll('threat_alerts', 'id')).length
});

const requirePreflight = () => {
  if (!preflightOk) {
    throw new Error(`Write skipped: preflight state did not match. ${preflightProblems.join('; ')}`);
  }
};

const api = () => request(app);
const review = (imageId, body) => api().post(`/api/evidence-review/${imageId}/review`).set(authHeader).send(body);

// ---------- officer session (no password, nothing printed) ----------
const resolveOfficerId = async () => {
  if (process.env.UC02_OFFICER_USER_ID) return process.env.UC02_OFFICER_USER_ID;
  const { data, error } = await supabaseAdmin
    .from('user_roles').select('user_id, roles!inner(role_name)').eq('roles.role_name', 'wildlife_officer');
  if (error) throw new Error(`Role lookup failed: ${error.message}`);
  if (data.length !== 1) throw new Error(`Expected exactly one wildlife_officer, found ${data.length}. Set UC02_OFFICER_USER_ID.`);
  return data[0].user_id;
};

const createOfficerToken = async (userId) => {
  if (process.env.UC02_OFFICER_TOKEN) return process.env.UC02_OFFICER_TOKEN;

  const { data: userData, error: userError } = await supabaseAdmin.auth.admin.getUserById(userId);
  if (userError) throw new Error(`Officer lookup failed: ${userError.message}`);

  const { data: link, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: 'magiclink', email: userData.user.email
  });
  if (linkError) throw new Error(`Magic-link generation failed: ${linkError.message}`);

  sessionClient = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_KEY, {
    auth: { persistSession: false, autoRefreshToken: false }
  });
  const { data: verified, error: verifyError } = await sessionClient.auth.verifyOtp({
    token_hash: link.properties.hashed_token, type: 'magiclink'
  });
  if (verifyError || !verified.session) throw new Error(`Session creation failed: ${verifyError ? verifyError.message : 'no session'}`);
  return verified.session.access_token;
};

beforeAll(async () => {
  officerId = await resolveOfficerId();
  authHeader = { Authorization: `Bearer ${await createOfficerToken(officerId)}` };

  // Read-only preflight of the expected starting state
  const statuses = await imageStatuses();
  const reviews = await selectAll('evidence_reviews', 'id, image_id, classification');
  const alerts = await selectAll('threat_alerts', 'id');
  const expectStatus = (id, status) => {
    if (statuses[id] !== status) preflightProblems.push(`image ${id} is ${statuses[id]}, expected ${status}`);
  };
  expectStatus(1, 'REVIEWED');
  [2, 3, 4, 5, 6].forEach((id) => expectStatus(id, 'UNREVIEWED'));
  const image1Reviews = reviews.filter((r) => r.image_id === 1);
  if (image1Reviews.length !== 1 || image1Reviews[0].classification !== 'WILDLIFE_SPECIES') {
    preflightProblems.push('image 1 should have exactly one WILDLIFE_SPECIES review');
  }
  if (reviews.some((r) => r.image_id !== 1)) preflightProblems.push('reviews already exist for images 2-6');
  if (alerts.length !== 0) preflightProblems.push(`${alerts.length} threat alert(s) already exist`);
  preflightOk = preflightProblems.length === 0;
});

afterAll(async () => {
  if (sessionClient) await sessionClient.auth.signOut().catch(() => {});
  await getPool().end().catch(() => {});
});

describe('UC02 real Supabase integration', () => {
  test('0. preflight: live data matches the expected starting state (otherwise all writes are skipped)', () => {
    expect(preflightProblems).toEqual([]);
  });

  describe('Authentication and read endpoints (read-only)', () => {
    test('unauthenticated request is rejected with 401', async () => {
      const res = await api().get('/api/evidence-review/queue');
      expect(res.status).toBe(401);
    });

    test('Wildlife Officer token is accepted and the UNREVIEWED queue excludes image 1', async () => {
      const res = await api().get('/api/evidence-review/queue').set(authHeader);
      expect(res.status).toBe(200);
      const ids = res.body.data.map((item) => item.id);
      expect(ids).not.toContain(IMG.WILDLIFE_DONE);
      expect(res.body.data.every((item) => item.reviewStatus === 'UNREVIEWED')).toBe(true);
    });

    test('evidence detail reports incomplete metadata for image 4 without blocking review', async () => {
      const res = await api().get(`/api/evidence-review/${IMG.SUSPICIOUS_INCOMPLETE}`).set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        metadataIncomplete: true, missingMetadataFields: ['captured_at', 'latitude', 'longitude']
      });
    });

    test('broken image 6 is returned with its stored URL', async () => {
      const res = await api().get(`/api/evidence-review/${IMG.BROKEN}`).set(authHeader);
      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toContain('.invalid/');
    });
  });

  describe('Scenario 1: already-reviewed evidence cannot be reviewed again (image 1)', () => {
    test('returns 409 and adds no EvidenceReview row', async () => {
      const before = await reviewsFor(IMG.WILDLIFE_DONE);
      const res = await review(IMG.WILDLIFE_DONE, { classification: 'UNKNOWN' });
      expect(res.status).toBe(409);
      expect(await reviewsFor(IMG.WILDLIFE_DONE)).toHaveLength(before.length);
      expect((await imageStatuses())[IMG.WILDLIFE_DONE]).toBe('REVIEWED');
    });
  });

  describe('Scenario 2: UNKNOWN classification (image 5)', () => {
    test('persists the review as NEEDS_FURTHER_REVIEW with no ThreatAlert', async () => {
      requirePreflight();
      const res = await review(IMG.UNKNOWN, { classification: 'UNKNOWN', notes: 'UC02 integration: indistinct shape behind foliage' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ classification: 'UNKNOWN', reviewStatus: 'NEEDS_FURTHER_REVIEW', threatAlert: null });

      const rows = await reviewsFor(IMG.UNKNOWN);
      expect(rows).toHaveLength(1);
      expect(rows[0]).toMatchObject({ classification: 'UNKNOWN', reviewed_by: officerId, escalation_confirmed: false });
      expect((await imageStatuses())[IMG.UNKNOWN]).toBe('NEEDS_FURTHER_REVIEW');
      expect(await alertsFor(IMG.UNKNOWN)).toHaveLength(0);
    });

    test('image 5 remains available in the NEEDS_FURTHER_REVIEW queue for secondary review', async () => {
      requirePreflight();
      const res = await api().get('/api/evidence-review/queue?status=NEEDS_FURTHER_REVIEW').set(authHeader);
      const item = res.body.data.find((i) => i.id === IMG.UNKNOWN);
      expect(item).toMatchObject({ isReviewable: true });
    });
  });

  describe('Scenario 3: SUSPICIOUS_PERSON without explicit confirmation (image 2)', () => {
    test('returns 200 confirmation-required and writes nothing', async () => {
      requirePreflight();
      const before = await counts();
      const res = await review(IMG.SUSPICIOUS, { classification: 'SUSPICIOUS_PERSON' });
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ reviewRecorded: false, escalationConfirmationRequired: true, threatAlert: null });
      expect(await counts()).toEqual(before);
      expect(await reviewsFor(IMG.SUSPICIOUS)).toHaveLength(0);
      expect((await imageStatuses())[IMG.SUSPICIOUS]).toBe('UNREVIEWED');
    });
  });

  describe('Scenario 4: confirmed SUSPICIOUS_PERSON with missing/blank justification (image 2)', () => {
    test.each([
      ['missing', {}],
      ['blank', { escalationJustification: '   ' }]
    ])('%s justification returns 400 and writes nothing', async (_label, extra) => {
      requirePreflight();
      const before = await counts();
      const res = await review(IMG.SUSPICIOUS, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, ...extra });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/escalation justification is required/);
      expect(await counts()).toEqual(before);
      expect((await imageStatuses())[IMG.SUSPICIOUS]).toBe('UNREVIEWED');
    });
  });

  describe('Scenario 7: invalid input validation (no writes)', () => {
    test.each([
      ['invalid classification', IMG.LEOPARD_INCOMPLETE, { classification: 'POACHER' }, /Invalid evidence classification/],
      ['non-boolean escalationConfirmed', IMG.LEOPARD_INCOMPLETE,
        { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: 'yes', escalationJustification: 'x' }, /must be a boolean/],
      ['missing classification', IMG.LEOPARD_INCOMPLETE, { notes: 'no classification' }, /classification is required/],
      ['malformed evidence ID', 'abc', { classification: 'UNKNOWN' }, /positive integer/]
    ])('%s returns 400', async (_label, imageId, body, message) => {
      const before = await counts();
      const res = await review(imageId, body);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(message);
      expect(await counts()).toEqual(before);
    });

    test('non-existent evidence returns 404 with no writes', async () => {
      const before = await counts();
      const res = await review(999999, { classification: 'UNKNOWN' });
      expect(res.status).toBe(404);
      expect(await counts()).toEqual(before);
    });
  });

  describe('Scenario 5: confirmed SUSPICIOUS_PERSON with valid justification (image 2)', () => {
    test('persists REVIEWED_ESCALATED review and exactly one linked OPEN ThreatAlert', async () => {
      requirePreflight();
      const res = await review(IMG.SUSPICIOUS, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: `  ${JUSTIFICATION_2}  `
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ classification: 'SUSPICIOUS_PERSON', reviewStatus: 'REVIEWED_ESCALATED' });

      const [savedReview, ...extraReviews] = await reviewsFor(IMG.SUSPICIOUS);
      expect(extraReviews).toHaveLength(0);
      expect(savedReview).toMatchObject({
        classification: 'SUSPICIOUS_PERSON', reviewed_by: officerId, escalation_confirmed: true,
        escalation_justification: JUSTIFICATION_2, metadata_incomplete_acknowledged: false
      });

      const alerts = await alertsFor(IMG.SUSPICIOUS);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        camera_trap_image_id: IMG.SUSPICIOUS, evidence_review_id: savedReview.id,
        created_by: officerId, status: 'OPEN', justification: JUSTIFICATION_2
      });
      expect(res.body.data.threatAlert).toMatchObject({ id: alerts[0].id, evidenceReviewId: savedReview.id });
      expect((await imageStatuses())[IMG.SUSPICIOUS]).toBe('REVIEWED_ESCALATED');
    });

    test('escalated image 2 cannot be reviewed again (409, no extra rows)', async () => {
      requirePreflight();
      const before = await counts();
      const res = await review(IMG.SUSPICIOUS, { classification: 'WILDLIFE_SPECIES' });
      expect(res.status).toBe(409);
      expect(await counts()).toEqual(before);
    });
  });

  describe('Scenario 6: incomplete metadata + confirmed suspicious escalation (image 4)', () => {
    test('review is allowed, acknowledged as incomplete and linked to an OPEN ThreatAlert for image 4', async () => {
      requirePreflight();
      const res = await review(IMG.SUSPICIOUS_INCOMPLETE, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: JUSTIFICATION_4
      });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        metadataIncomplete: true, reviewStatus: 'REVIEWED_ESCALATED', classification: 'SUSPICIOUS_PERSON'
      });

      const [savedReview, ...extraReviews] = await reviewsFor(IMG.SUSPICIOUS_INCOMPLETE);
      expect(extraReviews).toHaveLength(0);
      expect(savedReview).toMatchObject({
        classification: 'SUSPICIOUS_PERSON', metadata_incomplete_acknowledged: true,
        escalation_confirmed: true, escalation_justification: JUSTIFICATION_4, reviewed_by: officerId
      });

      const alerts = await alertsFor(IMG.SUSPICIOUS_INCOMPLETE);
      expect(alerts).toHaveLength(1);
      expect(alerts[0]).toMatchObject({
        camera_trap_image_id: IMG.SUSPICIOUS_INCOMPLETE, evidence_review_id: savedReview.id, status: 'OPEN', created_by: officerId
      });
    });
  });

  describe('Scenario 8: final database integrity (read-only)', () => {
    test('image statuses match the expected end state', async () => {
      expect(await imageStatuses()).toEqual({
        1: 'REVIEWED', 2: 'REVIEWED_ESCALATED', 3: 'UNREVIEWED',
        4: 'REVIEWED_ESCALATED', 5: 'NEEDS_FURTHER_REVIEW', 6: 'UNREVIEWED'
      });
    });

    test('EvidenceReview rows exist only for images 1, 2, 4 and 5 (one each)', async () => {
      const reviews = await selectAll('evidence_reviews', 'id, image_id');
      expect(reviews.map((r) => r.image_id).sort()).toEqual([1, 2, 4, 5]);
    });

    test('ThreatAlert rows exist only for images 2 and 4', async () => {
      const alerts = await selectAll('threat_alerts', 'id, camera_trap_image_id');
      expect(alerts.map((a) => a.camera_trap_image_id).sort()).toEqual([2, 4]);
    });

    test('every ThreatAlert points to the same image as its EvidenceReview, which is a confirmed SUSPICIOUS_PERSON review', async () => {
      const reviews = await selectAll('evidence_reviews', '*');
      const alerts = await selectAll('threat_alerts', '*');
      alerts.forEach((alert) => {
        const linkedReview = reviews.find((r) => r.id === alert.evidence_review_id);
        expect(linkedReview).toBeDefined();
        expect(alert.camera_trap_image_id).toBe(linkedReview.image_id);
        expect(linkedReview).toMatchObject({ classification: 'SUSPICIOUS_PERSON', escalation_confirmed: true });
        expect(alert.status).toBe('OPEN');
      });
    });

    test('no ThreatAlert exists for WILDLIFE_SPECIES, UNKNOWN or unconfirmed suspicious reviews', async () => {
      const reviews = await selectAll('evidence_reviews', '*');
      const alertedReviewIds = new Set((await selectAll('threat_alerts', 'evidence_review_id')).map((a) => a.evidence_review_id));
      const nonAlertable = reviews.filter((r) => r.classification !== 'SUSPICIOUS_PERSON' || !r.escalation_confirmed);
      expect(nonAlertable.length).toBeGreaterThan(0);
      nonAlertable.forEach((r) => expect(alertedReviewIds.has(r.id)).toBe(false));
    });
  });
});
