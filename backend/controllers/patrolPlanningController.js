// ==============================================================================
// WildGuard - UC01 Controller
// ==============================================================================

const patrolPlanningService = require('../services/patrolPlanningService');

exports.getDashboardData = async (req, res) => {
  try {
    const parkId = parseInt(req.params.parkId || req.query.parkId || 1, 10);
    const data = await patrolPlanningService.getDashboardData(parkId);
    res.status(200).json(data);
  } catch (error) {
    console.error('getDashboardData error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.getRangerRecommendations = async (req, res) => {
  try {
    const routeId = parseInt(req.params.routeId, 10);
    const { patrolDate, startTime, durationHours } = req.query;

    const data = await patrolPlanningService.getRangerRecommendations(
      routeId,
      patrolDate || new Date().toISOString().split('T')[0],
      startTime || '09:00',
      parseFloat(durationHours) || 4.0
    );
    res.status(200).json(data);
  } catch (error) {
    console.error('getRangerRecommendations error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.createPatrolPlan = async (req, res) => {
  try {
    const userId = req.user ? req.user.id : null;
    const plan = await patrolPlanningService.createPatrolPlan(req.body, userId);
    res.status(201).json({
      message: req.body.saveAsDraft ? 'Patrol plan saved as Draft successfully' : 'Patrol plan confirmed and dispatched successfully',
      plan
    });
  } catch (error) {
    console.error('createPatrolPlan error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.updatePlanStatus = async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const { status, reason, actorRole } = req.body;
    const userId = req.user ? req.user.id : null;

    const updated = await patrolPlanningService.updatePlanStatus(planId, status, reason, userId, actorRole || 'Park Manager');
    res.status(200).json({
      message: `Patrol plan status updated to ${updated.status}`,
      plan: updated
    });
  } catch (error) {
    console.error('updatePlanStatus error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getAllPatrolPlans = async (req, res) => {
  try {
    const parkId = parseInt(req.query.parkId || 1, 10);
    const plans = await patrolPlanningService.getAllPatrolPlans(parkId);
    res.status(200).json(plans);
  } catch (error) {
    console.error('getAllPatrolPlans error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.deletePatrolPlan = async (req, res) => {
  try {
    const planId = parseInt(req.params.id, 10);
    const { force, reason } = req.body || {};
    const userId = req.user ? req.user.id : null;

    const result = await patrolPlanningService.deletePatrolPlan(planId, userId, !!force, reason);
    res.status(200).json(result);
  } catch (error) {
    console.error('deletePatrolPlan error:', error);
    res.status(400).json({ error: error.message });
  }
};

