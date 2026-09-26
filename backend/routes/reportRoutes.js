const express = require('express');
const router = express.Router();
const { createConflictReport, getReportByCode, getAllReports, updateReportStatus } = require('../controllers/reportController');

// Route for getting all reports
router.get('/conflict', getAllReports);

// Route for submitting conflict reports
router.post('/conflict', createConflictReport);

// Route for getting a report by its code
router.get('/conflict/:code', getReportByCode);

// Route for updating report status
router.patch('/conflict/:code', updateReportStatus);

module.exports = router;
