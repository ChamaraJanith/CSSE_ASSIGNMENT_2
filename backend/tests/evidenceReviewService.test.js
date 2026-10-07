const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const evidenceReviewService = require('../services/evidenceReviewService');
const {
  OFFICER_ID, imageRow, incompleteImageRow, lockedImage, createSupabaseFake, createPgFake
} = require('./helpers/evidenceReviewFakes');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: { from: jest.fn() }
}));
jest.mock('../pgPool', () => ({ getPool: jest.fn() }));

const justification = 'Human figure carrying a rifle-shaped object at the fence';

describe('UC02: Evidence Review Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('isWildlifeOfficer (existing user_roles / roles convention)', () => {
    test('[POSITIVE CASE] should return true when the user has the wildlife_officer role', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { user_roles: { data: [{ user_id: OFFICER_ID }], error: null } });
      await expect(evidenceReviewService.isWildlifeOfficer(OFFICER_ID)).resolves.toBe(true);
      expect(builders.user_roles.select).toHaveBeenCalledWith('user_id, roles!inner(role_name)');
      expect(builders.user_roles.eq).toHaveBeenCalledWith('user_id', OFFICER_ID);
      expect(builders.user_roles.eq).toHaveBeenCalledWith('roles.role_name', 'wildlife_officer');
    });

    test('[NEGATIVE CASE] should return false when the user has no wildlife_officer role', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: [], error: null } });
      await expect(evidenceReviewService.isWildlifeOfficer('other-user')).resolves.toBe(false);
    });

    test('[ERROR CASE] should propagate a role lookup failure', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: null, error: new Error('db down') } });
      await expect(evidenceReviewService.isWildlifeOfficer(OFFICER_ID)).rejects.toThrow('db down');
    });
  });

  describe('getReviewQueue', () => {
    test('[POSITIVE CASE] should default to UNREVIEWED evidence ordered by capture time', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { camera_trap_images: { data: [imageRow()], error: null } });
      const items = await evidenceReviewService.getReviewQueue();
      expect(builders.camera_trap_images.eq).toHaveBeenCalledWith('review_status', 'UNREVIEWED');
      expect(builders.camera_trap_images.order).toHaveBeenCalledWith('captured_at', { ascending: true, nullsFirst: false });
      expect(items).toHaveLength(1);
    });

    test('[POSITIVE CASE] should map rows to queue items with camera, location, metadata and reviewability', async () => {
      createSupabaseFake(supabaseAdmin, { camera_trap_images: { data: [incompleteImageRow()], error: null } });
      const [item] = await evidenceReviewService.getReviewQueue();
      expect(item).toMatchObject({
        id: 4,
        imageCode: 'IMG-YALA02-0002',
        reviewStatus: 'UNREVIEWED',
        isReviewable: true,
        cameraTrap: { trapCode: 'CT-YALA-01', locationName: 'Northern River Basin Crossing (Sector 7B)', parkName: 'Yala National Park (Ruhuna)' },
        metadata: { capturedAt: null, latitude: null, longitude: null, cameraModel: 'Browning Recon Force Elite HP5', triggerType: 'HEAT' },
        metadataIncomplete: true,
        missingMetadataFields: ['captured_at', 'latitude', 'longitude']
      });
    });

    test('[EDGE CASE] status ALL should not apply a review_status filter', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { camera_trap_images: { data: [], error: null } });
      await evidenceReviewService.getReviewQueue({ status: 'ALL' });
      expect(builders.camera_trap_images.eq).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] should reject an unknown status filter with 400', async () => {
      await expect(evidenceReviewService.getReviewQueue({ status: 'DONE' })).rejects.toMatchObject({ status: 400 });
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    test('[EDGE CASE] whitespace-only search should return all items unfiltered', async () => {
      createSupabaseFake(supabaseAdmin, { camera_trap_images: { data: [imageRow(), incompleteImageRow()], error: null } });
      await expect(evidenceReviewService.getReviewQueue({ search: '   ' })).resolves.toHaveLength(2);
    });
  });

  describe('submitReview transaction', () => {
    test('[POSITIVE CASE] should lock the image, insert the review, update status and commit in order', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      await evidenceReviewService.submitReview(1, { classification: 'WILDLIFE_SPECIES' }, OFFICER_ID);
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'INSERT_REVIEW', 'UPDATE_STATUS', 'COMMIT']);
      expect(db.find('SELECT')[0].sql).toMatch(/FOR UPDATE$/);
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[POSITIVE CASE] confirmed escalation should insert the alert inside the same transaction before commit', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      await evidenceReviewService.submitReview(1, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification
      }, OFFICER_ID);
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'INSERT_REVIEW', 'UPDATE_STATUS', 'INSERT_ALERT', 'COMMIT']);
    });

    test('[POSITIVE CASE] should persist the review values decided by the business rules', async () => {
      const db = createPgFake(getPool, { image: lockedImage(incompleteImageRow()) });
      await evidenceReviewService.submitReview(4, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true,
        escalationJustification: `  ${justification}  `, notes: '  Second figure in background '
      }, OFFICER_ID);
      expect(db.find('INSERT INTO public.evidence_reviews')[0].params).toEqual([
        4, OFFICER_ID, 'SUSPICIOUS_PERSON', 'Second figure in background', true, true, justification
      ]);
      expect(db.find('UPDATE public.camera_trap_images')[0].params).toEqual(['REVIEWED_ESCALATED', 4]);
      expect(db.find('INSERT INTO public.threat_alerts')[0].params).toEqual([4, 501, OFFICER_ID, justification, 'OPEN']);
    });

    test('[NEGATIVE CASE] unconfirmed suspicious evidence should roll back without writing anything', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      const result = await evidenceReviewService.submitReview(1, { classification: 'SUSPICIOUS_PERSON' }, OFFICER_ID);
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'ROLLBACK']);
      expect(result).toMatchObject({ reviewRecorded: false, reviewStatus: 'UNREVIEWED', escalationConfirmationRequired: true, threatAlert: null });
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[NEGATIVE CASE] a business-rule violation should roll back and keep its 400 status', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()) });
      await expect(evidenceReviewService.submitReview(1, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: '   '
      }, OFFICER_ID)).rejects.toMatchObject({ status: 400 });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'ROLLBACK']);
    });

    test('[ERROR CASE] alert creation failure should roll back the review and status update', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()), failOn: 'INSERT INTO public.threat_alerts' });
      await expect(evidenceReviewService.submitReview(1, {
        classification: 'SUSPICIOUS_PERSON', escalationConfirmed: true, escalationJustification: justification
      }, OFFICER_ID)).rejects.toMatchObject({ status: 500, message: 'Failed to record the evidence review. No changes were saved.' });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'INSERT_REVIEW', 'UPDATE_STATUS', 'INSERT_ALERT', 'ROLLBACK']);
      expect(db.steps()).not.toContain('COMMIT');
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[ERROR CASE] review insert failure should roll back and never update the image status', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()), failOn: 'INSERT INTO public.evidence_reviews' });
      await expect(evidenceReviewService.submitReview(1, { classification: 'UNKNOWN' }, OFFICER_ID))
        .rejects.toMatchObject({ status: 500 });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'INSERT_REVIEW', 'ROLLBACK']);
    });

    test('[ERROR CASE] should release the connection even when rollback itself fails', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow()), failOn: 'INSERT INTO public.evidence_reviews' });
      const originalQuery = db.client.query.getMockImplementation();
      db.client.query.mockImplementation(async (text, params) => {
        if (text.trim() === 'ROLLBACK') throw new Error('connection lost');
        return originalQuery(text, params);
      });
      await expect(evidenceReviewService.submitReview(1, { classification: 'UNKNOWN' }, OFFICER_ID))
        .rejects.toMatchObject({ status: 500 });
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[EDGE CASE] eligibility is checked against the locked row, preventing concurrent duplicate reviews', async () => {
      const db = createPgFake(getPool, { image: lockedImage(imageRow({ review_status: 'REVIEWED' })) });
      await expect(evidenceReviewService.submitReview(1, { classification: 'WILDLIFE_SPECIES' }, OFFICER_ID))
        .rejects.toMatchObject({ status: 409 });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_IMAGE', 'ROLLBACK']);
    });
  });
});
