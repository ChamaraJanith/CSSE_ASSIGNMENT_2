const evidenceReviewService = require('../services/evidenceReviewService');

const parseImageId = (rawId) => {
    const imageId = Number(rawId);
    if (!/^\d+$/.test(String(rawId)) || !Number.isSafeInteger(imageId) || imageId <= 0) {
        const err = new Error('Evidence ID must be a positive integer.');
        err.status = 400;
        throw err;
    }
    return imageId;
};

// Client errors keep their message; server errors are logged and never expose database details
const sendError = (res, error, context) => {
    const status = error.status || 500;
    console.error(`${context}:`, error.message);
    res.status(status).json({
        error: status >= 500 ? 'An unexpected error occurred while processing the evidence review request.' : error.message
    });
};

const getReviewQueue = async (req, res) => {
    try {
        const { status, search } = req.query;
        const data = await evidenceReviewService.getReviewQueue({ status, search });
        res.status(200).json({ data });
    } catch (error) {
        sendError(res, error, 'Get Evidence Review Queue Error');
    }
};

const getEvidenceDetail = async (req, res) => {
    try {
        const data = await evidenceReviewService.getEvidenceDetail(parseImageId(req.params.imageId));
        res.status(200).json({ data });
    } catch (error) {
        sendError(res, error, 'Get Evidence Detail Error');
    }
};

const submitReview = async (req, res) => {
    try {
        const imageId = parseImageId(req.params.imageId);
        if (!req.body || typeof req.body !== 'object' || Array.isArray(req.body)) {
            return res.status(400).json({ error: 'A JSON review request body is required.' });
        }

        const { classification, notes, escalationConfirmed, escalationJustification } = req.body;
        const data = await evidenceReviewService.submitReview(
            imageId,
            { classification, notes, escalationConfirmed, escalationJustification },
            req.user.id
        );

        if (!data.reviewRecorded) {
            return res.status(200).json({
                message: 'Explicit escalation confirmation is required before suspicious evidence can be escalated. No review was recorded.',
                data
            });
        }

        const message = data.threatAlert
            ? 'Evidence reviewed and escalated. Threat alert created.'
            : 'Evidence review recorded successfully.';
        res.status(201).json({ message, data });
    } catch (error) {
        sendError(res, error, 'Submit Evidence Review Error');
    }
};

module.exports = {
    getReviewQueue,
    getEvidenceDetail,
    submitReview
};
