// ==============================================================================
// WildGuard - UC01 Patrol Planning Routes
// ==============================================================================

const express = require('express');
const router = express.Router();
const authMiddleware = require('../middleware/authMiddleware');
const patrolPlanningController = require('../controllers/patrolPlanningController');

router.use(authMiddleware);

// 1. Dashboard summary, ranked routes & KPIs
router.get('/dashboard/:parkId', patrolPlanningController.getDashboardData);

// 2. Ranked Ranger recommendations with conflict checking for a route
router.get('/routes/:routeId/rangers', patrolPlanningController.getRangerRecommendations);

// 3. Create Patrol Plan (Draft or Assigned/Dispatched)
router.post('/plans', patrolPlanningController.createPatrolPlan);

// 4. Get all plans for park
router.get('/plans', patrolPlanningController.getAllPatrolPlans);

// 5. Update Status (Acknowledge, Decline, Cancel, Reassign)
router.patch('/plans/:id/status', patrolPlanningController.updatePlanStatus);

// 6. Delete or Cancel Plan (Hard delete for Drafts, Soft cancel for Active plans)
router.delete('/plans/:id', patrolPlanningController.deletePatrolPlan);

// 7. Park Configuration & Telemetry Thresholds
router.get('/settings/:parkId', patrolPlanningController.getParkSettings);
router.put('/settings/:parkId', patrolPlanningController.updateParkSettings);

// 8. Ranger Roster & Commissioning
router.get('/rangers/park/:parkId', patrolPlanningController.getRangersByPark);
router.post('/rangers', patrolPlanningController.registerRanger);
router.patch('/rangers/:id/status', patrolPlanningController.updateRangerStatus);

module.exports = router;
