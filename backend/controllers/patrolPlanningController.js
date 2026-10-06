const patrolPlanningService = require('../services/patrolPlanningService');
const rangerService = require('../services/rangerService');
const parkInfrastructureService = require('../services/parkInfrastructureService');

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

exports.getParkSettings = async (req, res) => {
  try {
    const parkId = parseInt(req.params.parkId || 1, 10);
    const settings = await parkInfrastructureService.getParkSettings(parkId);
    res.status(200).json(settings);
  } catch (error) {
    console.error('getParkSettings error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateParkSettings = async (req, res) => {
  try {
    const parkId = parseInt(req.params.parkId || 1, 10);
    const updated = await parkInfrastructureService.updateParkSettings(parkId, req.body);
    res.status(200).json({ message: 'Park settings and telemetry thresholds updated successfully', settings: updated });
  } catch (error) {
    console.error('updateParkSettings error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.registerRanger = async (req, res) => {
  try {
    const ranger = await rangerService.registerRanger(req.body);
    res.status(201).json({ message: 'Ranger commissioned to active duty successfully', ranger });
  } catch (error) {
    console.error('registerRanger error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getRangersByPark = async (req, res) => {
  try {
    const parkId = parseInt(req.params.parkId || 1, 10);
    const rangers = await rangerService.getRangersByPark(parkId);
    res.status(200).json(rangers);
  } catch (error) {
    console.error('getRangersByPark error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.updateRangerStatus = async (req, res) => {
  try {
    const rangerId = parseInt(req.params.id, 10);
    const { status } = req.body;
    const updated = await rangerService.updateRangerStatus(rangerId, status);
    res.status(200).json({ message: 'Ranger status updated successfully', ranger: updated });
  } catch (error) {
    console.error('updateRangerStatus error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.getStagingPosts = async (req, res) => {
  try {
    const parkId = parseInt(req.params.parkId || 1, 10);
    const posts = await parkInfrastructureService.getStagingPosts(parkId);
    res.status(200).json(posts);
  } catch (error) {
    console.error('getStagingPosts error:', error);
    res.status(500).json({ error: error.message });
  }
};

exports.createStagingPost = async (req, res) => {
  try {
    const newPost = await parkInfrastructureService.createStagingPost(req.body);
    res.status(201).json({ message: 'Staging Outpost successfully commissioned', post: newPost });
  } catch (error) {
    console.error('createStagingPost error:', error);
    res.status(400).json({ error: error.message });
  }
};

exports.deleteStagingPost = async (req, res) => {
  try {
    const id = parseInt(req.params.id, 10);
    const result = await parkInfrastructureService.deleteStagingPost(id);
    res.status(200).json({ message: 'Staging Outpost decommissioned', result });
  } catch (error) {
    console.error('deleteStagingPost error:', error);
    res.status(400).json({ error: error.message });
  }
};
