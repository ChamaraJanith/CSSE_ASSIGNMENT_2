// ==============================================================================
// WildGuard - UC04 Configure Park-Specific Wildlife Monitoring Rules Routes
// ==============================================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const requireParkManager = require('../middleware/requireParkManager');
const { getReferenceData, listRules, validateRule, createRule } = require('../controllers/monitoringRuleController');

router.use(authMiddleware);
router.use(requireParkManager);

// 1. Create-form reference data: selected park, its risk zones and the configured options (?parkId=)
router.get('/reference', getReferenceData);

// 2. Monitoring rules of the selected park (?parkId=)
router.get('/', listRules);

// 3. Dry-run validation (mandatory fields, references, duplicate/conflict); never writes
router.post('/validate', validateRule);

// 4. Create the reviewed rule: action ACTIVATE -> ACTIVE, SAVE_DRAFT -> DRAFT (revalidated server-side)
router.post('/', createRule);

module.exports = router;
