const patrolPlanningController = require('../controllers/patrolPlanningController');
const patrolPlanningService = require('../services/patrolPlanningService');
const rangerService = require('../services/rangerService');
const parkInfrastructureService = require('../services/parkInfrastructureService');

jest.mock('../services/patrolPlanningService');
jest.mock('../services/rangerService');
jest.mock('../services/parkInfrastructureService');

describe('Patrol Planning Controller', () => {
  let req, res;

  beforeEach(() => {
    req = { params: {}, query: {}, body: {}, user: { id: 'u1' } };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn()
    };
    jest.clearAllMocks();
  });

  describe('getDashboardData', () => {
    test('[POSITIVE CASE] should return 200 with dashboard data', async () => {
      req.params.parkId = '1';
      patrolPlanningService.getDashboardData.mockResolvedValue({ telemetry: {} });

      await patrolPlanningController.getDashboardData(req, res);
      
      expect(patrolPlanningService.getDashboardData).toHaveBeenCalledWith(1);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('[NEGATIVE CASE] should return 500 on error', async () => {
      patrolPlanningService.getDashboardData.mockRejectedValue(new Error('Dashboard DB error'));
      await patrolPlanningController.getDashboardData(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('getRangerRecommendations', () => {
    test('[POSITIVE CASE] should return 200 with recommendations', async () => {
      req.params.routeId = '1';
      req.query = { patrolDate: '2026-10-10', startTime: '09:00', durationHours: '4' };
      patrolPlanningService.getRangerRecommendations.mockResolvedValue({ recommendedRanger: { id: 10 } });

      await patrolPlanningController.getRangerRecommendations(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('[NEGATIVE CASE] should return 400 on error', async () => {
      patrolPlanningService.getRangerRecommendations.mockRejectedValue(new Error('Recommendation engine failed'));
      await patrolPlanningController.getRangerRecommendations(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('createPatrolPlan', () => {
    test('[POSITIVE CASE] should return 201 when plan is created', async () => {
      req.body = { saveAsDraft: true };
      patrolPlanningService.createPatrolPlan.mockResolvedValue({ id: 1, status: 'DRAFT' });

      await patrolPlanningController.createPatrolPlan(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });

    test('[ERROR CASE] should return 400 on error', async () => {
      patrolPlanningService.createPatrolPlan.mockRejectedValue(new Error('Missing mandatory fields'));
      await patrolPlanningController.createPatrolPlan(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('updatePlanStatus', () => {
    test('[POSITIVE CASE] should return 200 when plan is updated', async () => {
      req.params.id = '1';
      req.body = { status: 'ACKNOWLEDGED' };
      patrolPlanningService.updatePlanStatus.mockResolvedValue({ id: 1, status: 'ACKNOWLEDGED' });

      await patrolPlanningController.updatePlanStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('[NEGATIVE CASE] should return 400 on error', async () => {
      patrolPlanningService.updatePlanStatus.mockRejectedValue(new Error('Invalid status update'));
      await patrolPlanningController.updatePlanStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getAllPatrolPlans', () => {
    test('[POSITIVE CASE] should return 200 with plans list', async () => {
      patrolPlanningService.getAllPatrolPlans.mockResolvedValue([{ id: 1 }]);
      await patrolPlanningController.getAllPatrolPlans(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    test('[NEGATIVE CASE] should return 500 on db fetch failure', async () => {
      patrolPlanningService.getAllPatrolPlans.mockRejectedValue(new Error('Database timeout'));
      await patrolPlanningController.getAllPatrolPlans(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('deletePatrolPlan', () => {
    test('[POSITIVE CASE] should return 200 when plan is deleted', async () => {
      req.params.id = '1';
      patrolPlanningService.deletePatrolPlan.mockResolvedValue({ deleted: true });
      await patrolPlanningController.deletePatrolPlan(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[ERROR CASE] should return 400 on delete failure', async () => {
      patrolPlanningService.deletePatrolPlan.mockRejectedValue(new Error('Cannot delete active plan'));
      await patrolPlanningController.deletePatrolPlan(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getParkSettings', () => {
    test('[POSITIVE CASE] should return 200 with settings', async () => {
      parkInfrastructureService.getParkSettings.mockResolvedValue({ park_id: 1 });
      await patrolPlanningController.getParkSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[NEGATIVE CASE] should return 500 on error', async () => {
      parkInfrastructureService.getParkSettings.mockRejectedValue(new Error('Settings fetch failed'));
      await patrolPlanningController.getParkSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateParkSettings', () => {
    test('[POSITIVE CASE] should return 200 when updated', async () => {
      parkInfrastructureService.updateParkSettings.mockResolvedValue({ park_id: 1 });
      await patrolPlanningController.updateParkSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[ERROR CASE] should return 400 on error', async () => {
      parkInfrastructureService.updateParkSettings.mockRejectedValue(new Error('Invalid setting format'));
      await patrolPlanningController.updateParkSettings(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('registerRanger', () => {
    test('[POSITIVE CASE] should return 201 when ranger is registered', async () => {
      rangerService.registerRanger.mockResolvedValue({ id: 2 });
      await patrolPlanningController.registerRanger(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    test('[ERROR CASE] should return 400 on validation failure', async () => {
      rangerService.registerRanger.mockRejectedValue(new Error('Badge number already exists'));
      await patrolPlanningController.registerRanger(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getRangersByPark', () => {
    test('[POSITIVE CASE] should return 200 with rangers list', async () => {
      rangerService.getRangersByPark.mockResolvedValue([{ id: 2 }]);
      await patrolPlanningController.getRangersByPark(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[NEGATIVE CASE] should return 500 on db error', async () => {
      rangerService.getRangersByPark.mockRejectedValue(new Error('DB disconnect'));
      await patrolPlanningController.getRangersByPark(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('updateRangerStatus', () => {
    test('[POSITIVE CASE] should return 200 when updated', async () => {
      req.params.id = '2';
      rangerService.updateRangerStatus.mockResolvedValue({ id: 2 });
      await patrolPlanningController.updateRangerStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[ERROR CASE] should return 400 on bad status', async () => {
      rangerService.updateRangerStatus.mockRejectedValue(new Error('Invalid status state'));
      await patrolPlanningController.updateRangerStatus(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('getStagingPosts', () => {
    test('[POSITIVE CASE] should return 200 with staging posts list', async () => {
      parkInfrastructureService.getStagingPosts.mockResolvedValue([{ id: 1 }]);
      await patrolPlanningController.getStagingPosts(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[NEGATIVE CASE] should return 500 on db error', async () => {
      parkInfrastructureService.getStagingPosts.mockRejectedValue(new Error('Failed to load posts'));
      await patrolPlanningController.getStagingPosts(req, res);
      expect(res.status).toHaveBeenCalledWith(500);
    });
  });

  describe('createStagingPost', () => {
    test('[POSITIVE CASE] should return 201 when post is created', async () => {
      parkInfrastructureService.createStagingPost.mockResolvedValue({ id: 1 });
      await patrolPlanningController.createStagingPost(req, res);
      expect(res.status).toHaveBeenCalledWith(201);
    });
    
    test('[ERROR CASE] should return 400 on error', async () => {
      parkInfrastructureService.createStagingPost.mockRejectedValue(new Error('Invalid coordinates'));
      await patrolPlanningController.createStagingPost(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });

  describe('deleteStagingPost', () => {
    test('[POSITIVE CASE] should return 200 when post is deleted', async () => {
      req.params.id = '1';
      parkInfrastructureService.deleteStagingPost.mockResolvedValue({ success: true });
      await patrolPlanningController.deleteStagingPost(req, res);
      expect(res.status).toHaveBeenCalledWith(200);
    });
    
    test('[ERROR CASE] should return 400 on error', async () => {
      parkInfrastructureService.deleteStagingPost.mockRejectedValue(new Error('Cannot delete post in use'));
      await patrolPlanningController.deleteStagingPost(req, res);
      expect(res.status).toHaveBeenCalledWith(400);
    });
  });
});
