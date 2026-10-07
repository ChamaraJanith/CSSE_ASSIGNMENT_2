const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const evidenceReviewRules = require('../utils/evidenceReviewRules');

const { REVIEW_STATUSES } = evidenceReviewRules;

// UNKNOWN evidence (NEEDS_FURTHER_REVIEW) stays available for secondary review;
// REVIEWED and REVIEWED_ESCALATED evidence is final for the normal review flow.
const REVIEWABLE_STATUSES = Object.freeze([REVIEW_STATUSES.UNREVIEWED, REVIEW_STATUSES.NEEDS_FURTHER_REVIEW]);
const QUEUE_STATUS_ALL = 'ALL';
const INITIAL_ALERT_STATUS = 'OPEN';

const IMAGE_SELECT = `
    id, image_code, image_url, captured_at, latitude, longitude,
    camera_model, trigger_type, ambient_temperature_c, review_status, created_at, updated_at,
    camera_traps(id, trap_code, location_name, latitude, longitude, park_id, parks(id, name))
`;

const serviceError = (message, status) => {
    const err = new Error(message);
    err.status = status;
    return err;
};

const toEvidenceItem = (row) => {
    const trap = row.camera_traps || {};
    const missingMetadataFields = evidenceReviewRules.getMissingMetadataFields(row);
    return {
        id: row.id,
        imageCode: row.image_code,
        imageUrl: row.image_url,
        reviewStatus: row.review_status,
        isReviewable: REVIEWABLE_STATUSES.includes(row.review_status),
        cameraTrap: {
            id: trap.id ?? null,
            trapCode: trap.trap_code ?? null,
            locationName: trap.location_name ?? null,
            latitude: trap.latitude ?? null,
            longitude: trap.longitude ?? null,
            parkId: trap.park_id ?? null,
            parkName: trap.parks?.name ?? null
        },
        metadata: {
            capturedAt: row.captured_at ?? null,
            latitude: row.latitude ?? null,
            longitude: row.longitude ?? null,
            cameraModel: row.camera_model ?? null,
            triggerType: row.trigger_type ?? null,
            ambientTemperatureC: row.ambient_temperature_c ?? null
        },
        metadataIncomplete: missingMetadataFields.length > 0,
        missingMetadataFields,
        createdAt: row.created_at,
        updatedAt: row.updated_at
    };
};

const toReview = (row) => ({
    id: row.id,
    imageId: row.image_id,
    reviewedBy: row.reviewed_by,
    classification: row.classification,
    notes: row.notes,
    metadataIncompleteAcknowledged: row.metadata_incomplete_acknowledged,
    escalationConfirmed: row.escalation_confirmed,
    escalationJustification: row.escalation_justification,
    createdAt: row.created_at
});

const toThreatAlert = (row) => ({
    id: row.id,
    cameraTrapImageId: row.camera_trap_image_id,
    evidenceReviewId: row.evidence_review_id,
    createdBy: row.created_by,
    justification: row.justification,
    status: row.status,
    createdAt: row.created_at
});

const matchesSearch = (item, search) => {
    const term = search.toLowerCase();
    return [item.imageCode, item.cameraTrap.trapCode, item.cameraTrap.locationName, item.cameraTrap.parkName]
        .some((value) => typeof value === 'string' && value.toLowerCase().includes(term));
};

class EvidenceReviewService {
    async isWildlifeOfficer(userId) {
        const { data, error } = await supabaseAdmin
            .from('user_roles')
            .select('user_id, roles!inner(role_name)')
            .eq('user_id', userId)
            .eq('roles.role_name', 'wildlife_officer');

        if (error) throw error;
        return Array.isArray(data) && data.length > 0;
    }

    async getReviewQueue({ status, search } = {}) {
        const statusFilter = status || REVIEW_STATUSES.UNREVIEWED;
        const allowedFilters = [...Object.values(REVIEW_STATUSES), QUEUE_STATUS_ALL];
        if (!allowedFilters.includes(statusFilter)) {
            throw serviceError(`Invalid status filter "${statusFilter}". Allowed values: ${allowedFilters.join(', ')}.`, 400);
        }

        let query = supabaseAdmin
            .from('camera_trap_images')
            .select(IMAGE_SELECT)
            .order('captured_at', { ascending: true, nullsFirst: false });

        if (statusFilter !== QUEUE_STATUS_ALL) {
            query = query.eq('review_status', statusFilter);
        }

        const { data, error } = await query;
        if (error) throw error;

        const items = (data || []).map(toEvidenceItem);
        const searchTerm = typeof search === 'string' ? search.trim() : '';
        return searchTerm ? items.filter((item) => matchesSearch(item, searchTerm)) : items;
    }

    async getEvidenceDetail(imageId) {
        const { data: image, error } = await supabaseAdmin
            .from('camera_trap_images')
            .select(IMAGE_SELECT)
            .eq('id', imageId)
            .maybeSingle();

        if (error) throw error;
        if (!image) throw serviceError('Camera-trap evidence not found.', 404);

        const [reviewsResult, alertsResult] = await Promise.all([
            supabaseAdmin.from('evidence_reviews').select('*').eq('image_id', imageId).order('created_at', { ascending: true }),
            supabaseAdmin.from('threat_alerts').select('*').eq('camera_trap_image_id', imageId).order('created_at', { ascending: true })
        ]);
        if (reviewsResult.error) throw reviewsResult.error;
        if (alertsResult.error) throw alertsResult.error;

        return {
            ...toEvidenceItem(image),
            reviews: (reviewsResult.data || []).map(toReview),
            threatAlerts: (alertsResult.data || []).map(toThreatAlert)
        };
    }

    /**
     * Records a Wildlife Officer's review in a single PostgreSQL transaction:
     * lock image -> evaluate business rules -> insert review -> update status -> (optional) insert ThreatAlert.
     * Nothing is written when escalation of suspicious evidence is not yet confirmed.
     */
    async submitReview(imageId, reviewInput, reviewerId) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const image = await this.lockReviewableImage(client, imageId);
            const decision = evidenceReviewRules.evaluateReview({ ...reviewInput, image });

            if (!decision.reviewComplete) {
                await client.query('ROLLBACK');
                return this.buildReviewResult(image, decision, null, null);
            }

            const review = await this.insertReview(client, image.id, reviewerId, decision);
            await client.query(
                'UPDATE public.camera_trap_images SET review_status = $1, updated_at = NOW() WHERE id = $2',
                [decision.reviewStatus, image.id]
            );
            const threatAlert = decision.createThreatAlert
                ? await this.insertThreatAlert(client, image.id, review.id, reviewerId, decision.escalationJustification)
                : null;

            await client.query('COMMIT');
            return this.buildReviewResult(image, decision, review, threatAlert);
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            if (error.status) throw error;
            console.error('Evidence review transaction failed:', error.message);
            throw serviceError('Failed to record the evidence review. No changes were saved.', 500);
        } finally {
            client.release();
        }
    }

    async lockReviewableImage(client, imageId) {
        const { rows } = await client.query(
            `SELECT id, image_code, review_status, captured_at, latitude, longitude
             FROM public.camera_trap_images WHERE id = $1 FOR UPDATE`,
            [imageId]
        );
        const image = rows[0];
        if (!image) throw serviceError('Camera-trap evidence not found.', 404);
        if (!REVIEWABLE_STATUSES.includes(image.review_status)) {
            throw serviceError(`Evidence ${image.image_code} has already been reviewed (${image.review_status}) and cannot be reviewed again.`, 409);
        }
        return image;
    }

    async insertReview(client, imageId, reviewerId, decision) {
        const { rows } = await client.query(
            `INSERT INTO public.evidence_reviews
                (image_id, reviewed_by, classification, notes, metadata_incomplete_acknowledged,
                 escalation_confirmed, escalation_justification)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING *`,
            [
                imageId, reviewerId, decision.classification, decision.notes, decision.metadataIncomplete,
                decision.escalationConfirmed, decision.escalationJustification
            ]
        );
        return rows[0];
    }

    async insertThreatAlert(client, imageId, reviewId, reviewerId, justification) {
        const { rows } = await client.query(
            `INSERT INTO public.threat_alerts
                (camera_trap_image_id, evidence_review_id, created_by, justification, status)
             VALUES ($1, $2, $3, $4, $5)
             RETURNING *`,
            [imageId, reviewId, reviewerId, justification, INITIAL_ALERT_STATUS]
        );
        return rows[0];
    }

    buildReviewResult(image, decision, review, threatAlert) {
        return {
            imageId: image.id,
            imageCode: image.image_code,
            classification: decision.classification,
            reviewRecorded: review !== null,
            reviewStatus: review ? decision.reviewStatus : image.review_status,
            reviewComplete: decision.reviewComplete,
            escalationConfirmationRequired: decision.escalationConfirmationRequired,
            metadataIncomplete: decision.metadataIncomplete,
            missingMetadataFields: decision.missingMetadataFields,
            review: review ? toReview(review) : null,
            threatAlert: threatAlert ? toThreatAlert(threatAlert) : null
        };
    }
}

module.exports = new EvidenceReviewService();
