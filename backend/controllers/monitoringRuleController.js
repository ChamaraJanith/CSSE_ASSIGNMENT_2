const monitoringRuleService = require('../services/monitoringRuleService');
const { RULE_STATUSES } = require('../utils/monitoringRuleConfig');

// Query strings and route params arrive as text: a plain digit string becomes a number, anything else is passed
// through unchanged so the service rejects it with its own 400 (validation stays in the service).
const toIdNumber = (raw) => (typeof raw === 'string' && /^\d+$/.test(raw) ? Number(raw) : raw);

const isJsonObject = (body) => Boolean(body) && typeof body === 'object' && !Array.isArray(body);

// Client errors keep their message and structured details; server errors are logged and never expose database details
const sendError = (res, error, context) => {
    const status = error.status || 500;
    console.error(`${context}:`, error.message);

    if (status >= 500) {
        return res.status(status).json({
            error: 'An unexpected error occurred while processing the monitoring rule request.'
        });
    }

    const body = { error: error.message };
    if (Array.isArray(error.errors)) body.errors = error.errors;
    if (Array.isArray(error.conflicts)) body.conflicts = error.conflicts;
    res.status(status).json(body);
};

const getReferenceData = async (req, res) => {
    try {
        const data = await monitoringRuleService.getReferenceData(toIdNumber(req.query.parkId));
        res.status(200).json({ data });
    } catch (error) {
        sendError(res, error, 'Get Monitoring Rule Reference Data Error');
    }
};

const listRules = async (req, res) => {
    try {
        const data = await monitoringRuleService.listRules(toIdNumber(req.query.parkId));
        res.status(200).json({ data });
    } catch (error) {
        sendError(res, error, 'List Monitoring Rules Error');
    }
};

// Dry run: an invalid or conflicting configuration is a normal 200 result, not an HTTP error
const validateRule = async (req, res) => {
    try {
        if (!isJsonObject(req.body)) {
            return res.status(400).json({ error: 'A JSON monitoring rule request body is required.' });
        }

        const data = await monitoringRuleService.validateRule(req.body);
        res.status(200).json({ data });
    } catch (error) {
        sendError(res, error, 'Validate Monitoring Rule Error');
    }
};

const createRule = async (req, res) => {
    try {
        if (!isJsonObject(req.body)) {
            return res.status(400).json({ error: 'A JSON monitoring rule request body is required.' });
        }

        const data = await monitoringRuleService.createRule(req.body, req.user.id);
        const message = data.status === RULE_STATUSES.ACTIVE
            ? 'Monitoring rule activated successfully.'
            : 'Monitoring rule saved as draft.';
        res.status(201).json({ message, data });
    } catch (error) {
        sendError(res, error, 'Create Monitoring Rule Error');
    }
};

// Saves changes to a DRAFT; the rule keeps its id and stays a DRAFT
const updateDraft = async (req, res) => {
    try {
        if (!isJsonObject(req.body)) {
            return res.status(400).json({ error: 'A JSON monitoring rule request body is required.' });
        }

        const data = await monitoringRuleService.updateDraft(toIdNumber(req.params.id), req.body, req.user.id);
        res.status(200).json({ message: 'Draft monitoring rule updated.', data });
    } catch (error) {
        sendError(res, error, 'Update Draft Monitoring Rule Error');
    }
};

const activateRule = async (req, res) => {
    try {
        const data = await monitoringRuleService.activateRule(toIdNumber(req.params.id), req.user.id);
        res.status(200).json({ message: 'Monitoring rule activated successfully.', data });
    } catch (error) {
        sendError(res, error, 'Activate Monitoring Rule Error');
    }
};

const deactivateRule = async (req, res) => {
    try {
        const data = await monitoringRuleService.deactivateRule(toIdNumber(req.params.id), req.user.id);
        res.status(200).json({ message: 'Monitoring rule deactivated.', data });
    } catch (error) {
        sendError(res, error, 'Deactivate Monitoring Rule Error');
    }
};

module.exports = {
    getReferenceData,
    listRules,
    validateRule,
    createRule,
    updateDraft,
    activateRule,
    deactivateRule
};
