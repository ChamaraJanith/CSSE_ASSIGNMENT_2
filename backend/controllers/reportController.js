const reportService = require('../services/reportService');

const getRangers = async (req, res) => {
    try {
        const rangers = await reportService.getRangers();
        res.status(200).json({ data: rangers });
    } catch (error) {
        console.error('Get Rangers Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const createConflictReport = async (req, res) => {
    try {
        const data = await reportService.createReport(req.body);
        res.status(201).json({ message: 'Report submitted successfully', data });
    } catch (error) {
        console.error('Submit Report Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getReportByCode = async (req, res) => {
    try {
        const data = await reportService.getReportByCode(req.params.code);
        res.status(200).json({ data });
    } catch (error) {
        console.error('Get Report Error:', error.message);
        const status = error.status || 400;
        res.status(status).json({ error: error.message });
    }
};

const getAllReports = async (req, res) => {
    try {
        const { userId, rangerId } = req.query;
        const data = await reportService.getAllReports(userId, rangerId);
        res.status(200).json({ data });
    } catch (error) {
        console.error('Get All Reports Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const updateReportStatus = async (req, res) => {
    try {
        const { code } = req.params;
        const { 
            status, priority, 
            clarification_request, clarification_reply, clarification_evidence_url, clarification_id, 
            assigned_ranger_id, 
            assignment_id, ranger_status, ranger_outcome, ranger_outcome_image
        } = req.body;
        
        const requesting_user_id = req.user ? req.user.id : null;
        
        // 1. Update main report details
        const payload = {};
        if (status) payload.status = status;
        if (priority) payload.priority = priority;
        await reportService.updateReportDetails(code, payload);

        // 2. Handle Ranger Assignment
        if (assigned_ranger_id) {
            await reportService.assignRanger(code, assigned_ranger_id);
        }

        // 3. Handle Ranger Outcome/Status update
        if (assignment_id && ranger_status) {
            await reportService.updateRangerAssignment(assignment_id, ranger_status, ranger_outcome, ranger_outcome_image, requesting_user_id);
        }

        // 4. Handle Clarifications
        if (clarification_request) {
            await reportService.requestClarification(code, clarification_request);
        }
        if (clarification_reply && clarification_id) {
            await reportService.replyClarification(clarification_id, clarification_reply, clarification_evidence_url);
        }
        
        // Fetch updated data
        const data = await reportService.getReportByCode(code);
        res.status(200).json({ message: 'Report updated successfully', data });
    } catch (error) {
        console.error('Update Status Error:', error.message);
        const status = error.status || 400;
        res.status(status).json({ error: error.message });
    }
};

module.exports = {
    createConflictReport,
    getReportByCode,
    getAllReports,
    updateReportStatus,
    getRangers
};
