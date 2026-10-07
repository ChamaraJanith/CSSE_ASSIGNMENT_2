const express = require('express');
const request = require('supertest');
const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const evidenceReviewRoutes = require('../routes/evidenceReviewRoutes');
const {
  OFFICER_ID, imageRow, incompleteImageRow, brokenImageRow, lockedImage, createSupabaseFake, createPgFake
} = require('./helpers/evidenceReviewFakes');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: { getUser: jest.fn() }
  }
}));
jest.mock('../pgPool', () => ({ getPool: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/evidence-review', evidenceReviewRoutes);

const AUTH = { Authorization: 'Bearer valid-officer-token' };
const OFFICER_ROLE = { user_roles: { data: [{ user_id: OFFICER_ID }], error: null } };
const justification = 'Human figure carrying a rifle-shaped object near the river crossing';

const signInAs = (userId) => {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
};

const submit = (imageId, body) => request(app).post(`/api/evidence-review/${imageId}/review`).set(AUTH).send(body);

describe('UC02: Evidence Review API (/api/evidence-review)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    signInAs(OFFICER_ID);
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('Authorization (Wildlife Officer only)', () => {
    test('[NEGATIVE CASE] unauthenticated request should be rejected with 401', async () => {
      const res = await request(app).get('/api/evidence-review/queue');
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required.' });
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] an invalid or expired token should be rejected with 401', async () => {
      supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid JWT') });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(401);
    });

    test('[NEGATIVE CASE] authenticated user without the wildlife_officer role should get 403', async () => {
      signInAs('bbbbbbbb-0000-0000-0000-000000000002');
      createSupabaseFake(supabaseAdmin, { user_roles: { data: [], error: null } });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(403);
      expect(res.body.error).toMatch(/only Wildlife Officers/);
    });

    test('[NEGATIVE CASE] a non-officer cannot submit a review and nothing is written', async () => {
      signInAs('bbbbbbbb-0000-0000-0000-000000000002');
      createSupabaseFake(supabaseAdmin, { user_roles: { data: [], error: null } });
      const res = await submit(1, { classification: 'WILDLIFE_SPECIES' });
      expect(res.status).toBe(403);
      expect(getPool).not.toHaveBeenCalled();
    });

    test('[POSITIVE CASE] authenticated Wildlife Officer should be allowed', async () => {
      createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: [], error: null } });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(200);
      expect(supabaseAdmin.auth.getUser).toHaveBeenCalledWith('valid-officer-token');
    });

    test('[ERROR CASE] role lookup failure should return a safe 500', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: null, error: new Error('permission denied for table roles') } });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Unable to verify user role.' });
    });
  });

  describe('GET /queue', () => {
    test('[POSITIVE CASE] should return unreviewed evidence by default', async () => {
      const builders = createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE, camera_trap_images: { data: [imageRow(), incompleteImageRow()], error: null }
      });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(200);
      expect(builders.camera_trap_images.eq).toHaveBeenCalledWith('review_status', 'UNREVIEWED');
      expect(res.body.data.map((item) => item.imageCode)).toEqual(['IMG-YALA01-0001', 'IMG-YALA02-0002']);
    });

    test('[POSITIVE CASE] queue items should include the fields required by the Review Queue UI', async () => {
      createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: [imageRow()], error: null } });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      const [item] = res.body.data;
      expect(item).toMatchObject({
        id: 1,
        imageCode: 'IMG-YALA01-0001',
        imageUrl: expect.stringContaining('/camera-traps/CT-YALA-01/IMG-YALA01-0001.jpg'),
        reviewStatus: 'UNREVIEWED',
        isReviewable: true,
        cameraTrap: { trapCode: 'CT-YALA-01', locationName: 'Northern River Basin Crossing (Sector 7B)', parkName: 'Yala National Park (Ruhuna)' },
        metadata: { capturedAt: '2026-10-01T00:42:00+00:00', cameraModel: 'Browning Recon Force Elite HP5', triggerType: 'MOTION' },
        metadataIncomplete: false
      });
    });

    test('[POSITIVE CASE] should filter by NEEDS_FURTHER_REVIEW for secondary review', async () => {
      const builders = createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE, camera_trap_images: { data: [imageRow({ review_status: 'NEEDS_FURTHER_REVIEW' })], error: null }
      });
      const res = await request(app).get('/api/evidence-review/queue?status=NEEDS_FURTHER_REVIEW').set(AUTH);
      expect(res.status).toBe(200);
      expect(builders.camera_trap_images.eq).toHaveBeenCalledWith('review_status', 'NEEDS_FURTHER_REVIEW');
      expect(res.body.data[0].isReviewable).toBe(true);
    });

    test('[POSITIVE CASE] status=ALL should return evidence of every status, marking completed items not reviewable', async () => {
      const builders = createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE,
        camera_trap_images: { data: [imageRow(), imageRow({ id: 2, image_code: 'IMG-YALA01-0002', review_status: 'REVIEWED_ESCALATED' })], error: null }
      });
      const res = await request(app).get('/api/evidence-review/queue?status=ALL').set(AUTH);
      expect(builders.camera_trap_images.eq).not.toHaveBeenCalled();
      expect(res.body.data.map((item) => item.isReviewable)).toEqual([true, false]);
    });

    test('[POSITIVE CASE] search should match trap code, location or image code case-insensitively', async () => {
      createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE, camera_trap_images: { data: [imageRow(), brokenImageRow()], error: null }
      });
      const byTrap = await request(app).get('/api/evidence-review/queue?status=ALL&search=ct-wilp').set(AUTH);
      expect(byTrap.body.data.map((item) => item.imageCode)).toEqual(['IMG-WILP01-0002']);
      const byLocation = await request(app).get('/api/evidence-review/queue?status=ALL&search=river%20basin').set(AUTH);
      expect(byLocation.body.data.map((item) => item.imageCode)).toEqual(['IMG-YALA01-0001']);
    });

    test('[NEGATIVE CASE] an invalid status filter should return 400', async () => {
      createSupabaseFake(supabaseAdmin, OFFICER_ROLE);
      const res = await request(app).get('/api/evidence-review/queue?status=FINISHED').set(AUTH);
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid status filter "FINISHED"/);
    });

    test('[ERROR CASE] a database failure should return a safe 500 without raw details', async () => {
      createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE, camera_trap_images: { data: null, error: { message: 'relation "camera_trap_images" secret detail' } }
      });
      const res = await request(app).get('/api/evidence-review/queue').set(AUTH);
      expect(res.status).toBe(500);
      expect(JSON.stringify(res.body)).not.toMatch(/secret detail/);
    });
  });

  describe('GET /:imageId', () => {
    test('[POSITIVE CASE] should return evidence with complete metadata, camera trap and location', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: imageRow(), error: null } });
      const res = await request(app).get('/api/evidence-review/1').set(AUTH);
      expect(res.status).toBe(200);
      expect(builders.camera_trap_images.eq).toHaveBeenCalledWith('id', 1);
      expect(res.body.data).toMatchObject({
        id: 1,
        metadata: {
          capturedAt: '2026-10-01T00:42:00+00:00', latitude: '6.412850', longitude: '81.534180',
          cameraModel: 'Browning Recon Force Elite HP5', triggerType: 'MOTION', ambientTemperatureC: '27.5'
        },
        metadataIncomplete: false,
        missingMetadataFields: [],
        reviews: [],
        threatAlerts: []
      });
    });

    test('[EDGE CASE] incomplete metadata should be reported but the evidence stays reviewable', async () => {
      createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: incompleteImageRow(), error: null } });
      const res = await request(app).get('/api/evidence-review/4').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({
        metadataIncomplete: true,
        missingMetadataFields: ['captured_at', 'latitude', 'longitude'],
        isReviewable: true,
        metadata: { cameraModel: 'Browning Recon Force Elite HP5', triggerType: 'HEAT' }
      });
    });

    test('[POSITIVE CASE] should include existing review history and linked threat alerts', async () => {
      createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE,
        camera_trap_images: { data: imageRow({ review_status: 'REVIEWED_ESCALATED' }), error: null },
        evidence_reviews: { data: [{ id: 501, image_id: 1, reviewed_by: OFFICER_ID, classification: 'SUSPICIOUS_PERSON', escalation_confirmed: true }], error: null },
        threat_alerts: { data: [{ id: 901, camera_trap_image_id: 1, evidence_review_id: 501, created_by: OFFICER_ID, status: 'OPEN' }], error: null }
      });
      const res = await request(app).get('/api/evidence-review/1').set(AUTH);
      expect(res.body.data.isReviewable).toBe(false);
      expect(res.body.data.reviews[0]).toMatchObject({ id: 501, classification: 'SUSPICIOUS_PERSON', reviewedBy: OFFICER_ID });
      expect(res.body.data.threatAlerts[0]).toMatchObject({ id: 901, cameraTrapImageId: 1, evidenceReviewId: 501, status: 'OPEN' });
    });

    test('[NEGATIVE CASE] missing evidence should return 404', async () => {
      createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: null, error: null } });
      const res = await request(app).get('/api/evidence-review/999').set(AUTH);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Camera-trap evidence not found.' });
    });

    test.each(['abc', '0', '-3', '1.5', '1e3'])('[NEGATIVE CASE] malformed evidence ID "%s" should return 400', async (badId) => {
      createSupabaseFake(supabaseAdmin, OFFICER_ROLE);
      const res = await request(app).get(`/api/evidence-review/${badId}`).set(AUTH);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Evidence ID must be a positive integer.');
    });

    test('[EDGE CASE] a broken image URL is returned as stored without any server-side image fetch', async () => {
      const fetchSpy = jest.spyOn(global, 'fetch');
      createSupabaseFake(supabaseAdmin, { ...OFFICER_ROLE, camera_trap_images: { data: brokenImageRow(), error: null } });
      const res = await request(app).get('/api/evidence-review/6').set(AUTH);
      expect(res.status).toBe(200);
      expect(res.body.data.imageUrl).toBe('https://camera-trap-feed.invalid/CT-WILP-01/IMG-WILP01-0002.jpg');
      expect(res.body.data.reviewStatus).toBe('UNREVIEWED');
      expect(fetchSpy).not.toHaveBeenCalled();
      fetchSpy.mockRestore();
    });

    test('[ERROR CASE] a database failure loading review history should return a safe 500', async () => {
      createSupabaseFake(supabaseAdmin, {
        ...OFFICER_ROLE,
        camera_trap_images: { data: imageRow(), error: null },
        evidence_reviews: { data: null, error: { message: 'timeout reading evidence_reviews' } }
      });
      const res = await request(app).get('/api/evidence-review/1').set(AUTH);
      expect(res.status).toBe(500);
      expect(res.body.error).not.toMatch(/timeout/);
    });
  });

  describe('POST /:imageId/review', () => {
    beforeEach(() => {
      createSupabaseFake(supabaseAdmin, OFFICER_ROLE);
    });

    test('[POSITIVE CASE] WILDLIFE_SPECIES should be recorded as REVIEWED with no ThreatAlert', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'WILDLIFE_SPECIES' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ reviewRecorded: true, reviewStatus: 'REVIEWED', classification: 'WILDLIFE_SPECIES', threatAlert: null });
      expect(db.find('UPDATE public.camera_trap_images')[0].params).toEqual(['REVIEWED', 1]);
      expect(db.find('INSERT INTO public.threat_alerts')).toHaveLength(0);
    });

    test('[POSITIVE CASE] UNKNOWN should be recorded as NEEDS_FURTHER_REVIEW with no ThreatAlert', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'UNKNOWN' });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ reviewStatus: 'NEEDS_FURTHER_REVIEW', threatAlert: null });
      expect(db.find('UPDATE public.camera_trap_images')[0].params).toEqual(['NEEDS_FURTHER_REVIEW', 1]);
      expect(db.find('INSERT INTO public.threat_alerts')).toHaveLength(0);
    });

    test('[POSITIVE CASE] NEEDS_FURTHER_REVIEW evidence should accept a secondary review', async () => {
      createPgFake(getPool, { image: lockedImage(imageRow({ review_status: 'NEEDS_FURTHER_REVIEW' })) });
      const res = await submit(1, { classification: 'WILDLIFE_SPECIES' });
      expect(res.status).toBe(201);
      expect(res.body.data.reviewStatus).toBe('REVIEWED');
    });

    test('[NEGATIVE CASE] SUSPICIOUS_PERSON without confirmation should persist nothing and ask for confirmation', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', notes: 'Person near the fence' });
      expect(res.status).toBe(200);
      expect(res.body.message).toMatch(/Explicit escalation confirmation is required/);
      expect(res.body.data).toMatchObject({
        reviewRecorded: false, reviewComplete: false, escalationConfirmationRequired: true,
        reviewStatus: 'UNREVIEWED', review: null, threatAlert: null
      });
      expect(db.find('INSERT')).toHaveLength(0);
      expect(db.find('UPDATE')).toHaveLength(0);
      expect(db.steps()).toContain('ROLLBACK');
    });

    test('[NEGATIVE CASE] SUSPICIOUS_PERSON declined (escalationConfirmed=false) should not create a ThreatAlert', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: false, escalationJustification: justification });
      expect(res.status).toBe(200);
      expect(res.body.data.reviewRecorded).toBe(false);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] confirmed SUSPICIOUS_PERSON without a justification should return 400 and write nothing', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: '  ' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/escalation justification is required/);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[POSITIVE CASE] confirmed SUSPICIOUS_PERSON should be REVIEWED_ESCALATED with a linked OPEN ThreatAlert', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification });
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Evidence reviewed and escalated. Threat alert created.');
      expect(res.body.data).toMatchObject({
        reviewRecorded: true,
        reviewStatus: 'REVIEWED_ESCALATED',
        review: { id: 501, imageId: 1, reviewedBy: OFFICER_ID, escalationConfirmed: true, escalationJustification: justification },
        threatAlert: { id: 901, cameraTrapImageId: 1, evidenceReviewId: 501, createdBy: OFFICER_ID, status: 'OPEN', justification }
      });
      expect(db.find('INSERT INTO public.threat_alerts')).toHaveLength(1);
    });

    test('[EDGE CASE] incomplete metadata should not block a valid escalation and is recorded as acknowledged', async () => {
      const db = createPgFake(getPool, { image: lockedImage(incompleteImageRow()) });
      const res = await submit(4, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification });
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({
        metadataIncomplete: true, missingMetadataFields: ['captured_at', 'latitude', 'longitude'],
        reviewStatus: 'REVIEWED_ESCALATED', threatAlert: { cameraTrapImageId: 4 }
      });
      expect(res.body.data.review.metadataIncompleteAcknowledged).toBe(true);
      expect(db.find('INSERT INTO public.threat_alerts')).toHaveLength(1);
    });

    test('[POSITIVE CASE] notes are optional and stored as null when omitted', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'UNKNOWN' });
      expect(res.status).toBe(201);
      expect(db.find('INSERT INTO public.evidence_reviews')[0].params[3]).toBeNull();
    });

    test('[POSITIVE CASE] notes should be preserved (trimmed) on the saved review', async () => {
      createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'WILDLIFE_SPECIES', notes: '  Herd of 5 elephants, 2 calves  ' });
      expect(res.body.data.review.notes).toBe('Herd of 5 elephants, 2 calves');
    });

    test('[EDGE CASE] reviewer identity comes from the auth token, never from the request body', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      await submit(1, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification,
        reviewedBy: 'cccccccc-0000-0000-0000-000000000003', createdBy: 'cccccccc-0000-0000-0000-000000000003'
      });
      expect(db.find('INSERT INTO public.evidence_reviews')[0].params[1]).toBe(OFFICER_ID);
      expect(db.find('INSERT INTO public.threat_alerts')[0].params[2]).toBe(OFFICER_ID);
    });

    test.each(['REVIEWED', 'REVIEWED_ESCALATED'])('[NEGATIVE CASE] duplicate review of %s evidence should return 409', async (status) => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow({ review_status: status })) });
      const res = await submit(1, { classification: 'WILDLIFE_SPECIES' });
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/already been reviewed/);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] review of missing evidence should return 404', async () => {
      createPgFake(getPool, { image: null });
      const res = await submit(999, { classification: 'UNKNOWN' });
      expect(res.status).toBe(404);
    });

    test('[NEGATIVE CASE] invalid classification should return 400', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'POACHER' });
      expect(res.status).toBe(400);
      expect(res.body.error).toMatch(/Invalid evidence classification "POACHER"/);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] missing classification should return 400', async () => {
      createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { notes: 'forgot to classify' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('Evidence classification is required.');
    });

    test('[NEGATIVE CASE] non-boolean escalation confirmation should return 400', async () => {
      createPgFake(getPool, { image: lockedImage(imageRow()) });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: 'yes', escalationJustification: justification });
      expect(res.status).toBe(400);
    });

    test('[NEGATIVE CASE] a request without a body should return 400 before touching the database', async () => {
      const res = await request(app).post('/api/evidence-review/1/review').set(AUTH);
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('A JSON review request body is required.');
      expect(getPool).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] malformed evidence ID should return 400 before touching the database', async () => {
      const res = await submit('abc', { classification: 'UNKNOWN' });
      expect(res.status).toBe(400);
      expect(getPool).not.toHaveBeenCalled();
    });

    test('[ERROR CASE] alert creation failure should return a safe 500 and commit nothing', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()), failOn: 'INSERT INTO public.threat_alerts' });
      const res = await submit(1, { classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification });
      expect(res.status).toBe(500);
      expect(res.body.error).toBe('An unexpected error occurred while processing the evidence review request.');
      expect(db.steps()).not.toContain('COMMIT');
      expect(db.steps()).toContain('ROLLBACK');
    });

    test('[ERROR CASE] database connection failure should return a safe 500', async () => {
      getPool.mockReturnValue({ connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:5432')) });
      const res = await submit(1, { classification: 'UNKNOWN' });
      expect(res.status).toBe(500);
      expect(res.body.error).not.toMatch(/ECONNREFUSED/);
    });
  });
});
