const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const { createIncident, getIncidents, updateIncident, deleteIncident } = require('../controllers/incidentController');

router.use(authMiddleware);

router.post('/', createIncident);
router.get('/', getIncidents);
router.put('/:id', updateIncident);
router.delete('/:id', deleteIncident);

module.exports = router;
