const express = require('express');
const router = express.Router();
const { createConflictReport, getReportByCode, getAllReports } = require('../controllers/reportController');

// Route for getting all reports
router.get('/conflict', getAllReports);

// Route for submitting conflict reports
router.post('/conflict', createConflictReport);

// Route for getting a report by its code
router.get('/conflict/:code', getReportByCode);

module.exports = router;
