// ==============================================================================
// WildGuard - UC02 Review and Escalate Camera-Trap Evidence Routes
// ==============================================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireWildlifeOfficer = require('../middleware/requireWildlifeOfficer');
const { getReviewQueue, getEvidenceDetail, submitReview } = require('../controllers/evidenceReviewController');

router.use(authMiddleware);
router.use(requireWildlifeOfficer);

// 1. Evidence review queue (default: UNREVIEWED; ?status=<status>|ALL&search=<text>)
router.get('/queue', getReviewQueue);

// 2. Single evidence item with metadata completeness, review history and threat alerts
router.get('/:imageId', getEvidenceDetail);

// 3. Submit classification (and escalation for suspicious evidence)
router.post('/:imageId/review', submitReview);

module.exports = router;
