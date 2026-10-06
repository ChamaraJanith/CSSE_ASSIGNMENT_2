const patrolPlanningService = require('../services/patrolPlanningService');
const { supabaseAdmin } = require('../supabaseClient');
const heuristicsEngine = require('../utils/heuristicsEngine');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

describe('Patrol Planning Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getAllPatrolPlans', () => {
    test('should fetch and return all patrol plans successfully', async () => {
      const mockData = [{ id: 1, plan_code: 'PP-2026-123' }];
      const mockOrder = jest.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      
      supabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const result = await patrolPlanningService.getAllPatrolPlans(1);
      
      expect(supabaseAdmin.from).toHaveBeenCalledWith('patrol_plans');
      expect(mockSelect).toHaveBeenCalled();
      expect(result).toEqual(mockData);
    });

    test('should throw error when db fetch fails', async () => {
      const mockOrder = jest.fn().mockResolvedValue({ data: null, error: { message: 'DB fetch failed' } });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      
      supabaseAdmin.from.mockReturnValue({ select: mockSelect });

      await expect(patrolPlanningService.getAllPatrolPlans(1)).rejects.toThrow('Fetch plans error: DB fetch failed');
    });
  });

  describe('deletePatrolPlan', () => {
    test('should soft-cancel an active plan', async () => {
      const mockPlan = { id: 1, status: 'ASSIGNED', ranger_id: 10 };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockPlan, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });
      
      const mockUpdateSingle = jest.fn().mockResolvedValue({ data: { ...mockPlan, status: 'CANCELLED' }, error: null });
      const mockUpdateSelect = jest.fn().mockReturnValue({ single: mockUpdateSingle });
      const mockUpdateEq = jest.fn().mockReturnValue({ select: mockUpdateSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') {
          return { select: mockSelect, update: mockUpdate };
        }
        if (table === 'rangers') {
          return { select: mockSelect, update: mockUpdate };
        }
        if (table === 'patrol_plan_status_history') {
          return { insert: mockInsert };
        }
      });

      const result = await patrolPlanningService.deletePatrolPlan(1);
      expect(result.deleted).toBe(false);
      expect(result.type).toBe('CANCELLED');
    });

    test('should hard-delete a draft plan', async () => {
      const mockPlan = { id: 2, status: 'DRAFT', ranger_id: null };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockPlan, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      const mockDeleteEq = jest.fn().mockResolvedValue({ error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockDeleteEq });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') {
          return { select: mockSelect, delete: mockDelete };
        }
      });

      const result = await patrolPlanningService.deletePatrolPlan(2);
      expect(result.deleted).toBe(true);
      expect(result.type).toBe('HARD_DELETE');
    });
  });

  describe('updatePlanStatus', () => {
    test('should update status and auto-revert to PENDING_ASSIGNMENT if DECLINED', async () => {
      const mockPlan = { id: 1, status: 'ASSIGNED', ranger_id: 10 };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockPlan, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      const mockUpdateSingle = jest.fn().mockResolvedValue({ data: { ...mockPlan, status: 'PENDING_ASSIGNMENT' }, error: null });
      const mockUpdateSelect = jest.fn().mockReturnValue({ single: mockUpdateSingle });
      const mockUpdateEq = jest.fn().mockReturnValue({ select: mockUpdateSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') {
          return { select: mockSelect, update: mockUpdate };
        }
        if (table === 'rangers') {
          return { select: mockSelect, update: mockUpdate };
        }
        if (table === 'patrol_plan_status_history') {
          return { insert: mockInsert };
        }
      });

      const result = await patrolPlanningService.updatePlanStatus(1, 'DECLINED', 'Not available');
      expect(result.status).toBe('PENDING_ASSIGNMENT');
    });

    test('should update status to ACKNOWLEDGED', async () => {
      const mockPlan = { id: 1, status: 'ASSIGNED', ranger_id: 10 };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockPlan, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      const mockUpdateSingle = jest.fn().mockResolvedValue({ data: { ...mockPlan, status: 'ACKNOWLEDGED' }, error: null });
      const mockUpdateSelect = jest.fn().mockReturnValue({ single: mockUpdateSingle });
      const mockUpdateEq = jest.fn().mockReturnValue({ select: mockUpdateSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockUpdateEq });

      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') {
          return { select: mockSelect, update: mockUpdate };
        }
        if (table === 'patrol_plan_status_history') {
          return { insert: mockInsert };
        }
      });

      const result = await patrolPlanningService.updatePlanStatus(1, 'ACKNOWLEDGED', 'Will do');
      expect(result.status).toBe('ACKNOWLEDGED');
    });
  });

  describe('createPatrolPlan', () => {
    test('[POSITIVE CASE] should successfully create a drafted patrol plan', async () => {
      const mockPayload = {
        parkId: 1,
        routeId: 2,
        patrolDate: '2026-10-10',
        startTime: '08:00',
        priority: 'HIGH',
        saveAsDraft: true
      };
      
      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 100, ...mockPayload, status: 'DRAFT' }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      const mockHistoryInsert = jest.fn().mockResolvedValue({ error: null });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') return { insert: mockInsert };
        if (table === 'patrol_plan_status_history') return { insert: mockHistoryInsert };
      });

      const result = await patrolPlanningService.createPatrolPlan(mockPayload, 1);
      expect(result.status).toBe('DRAFT');
    });

    test('[ERROR CASE] should throw error if missing mandatory fields', async () => {
      await expect(patrolPlanningService.createPatrolPlan({}, 1)).rejects.toThrow('Mandatory patrol parameters missing');
    });

    test('[ERROR CASE] should throw error if route override lacks reason', async () => {
      const mockPayload = {
        parkId: 1, routeId: 2, patrolDate: '2026-10-10', startTime: '08:00', priority: 'HIGH',
        isRouteOverridden: true, routeOverrideReason: 'no'
      };
      await expect(patrolPlanningService.createPatrolPlan(mockPayload, 1)).rejects.toThrow('A recorded override reason is required');
    });

    test('[POSITIVE CASE] should assign plan and update ranger assignment count', async () => {
      const mockPayload = {
        parkId: 1, routeId: 2, patrolDate: '2026-10-10', startTime: '08:00', priority: 'HIGH',
        rangerId: 10
      };
      
      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 100, ...mockPayload, status: 'ASSIGNED' }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      const mockHistoryInsert = jest.fn().mockResolvedValue({ error: null });

      const mockRangerSingle = jest.fn().mockResolvedValue({ data: { active_assignments_count: 0 }, error: null });
      const mockRangerEq = jest.fn().mockReturnValue({ single: mockRangerSingle });
      const mockRangerSelect = jest.fn().mockReturnValue({ eq: mockRangerEq });
      
      const mockRangerUpdateEq = jest.fn().mockResolvedValue({ error: null });
      const mockRangerUpdate = jest.fn().mockReturnValue({ eq: mockRangerUpdateEq });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_plans') return { insert: mockInsert };
        if (table === 'patrol_plan_status_history') return { insert: mockHistoryInsert };
        if (table === 'rangers') return { select: mockRangerSelect, update: mockRangerUpdate };
        if (table === 'patrol_notification_logs') return { insert: mockHistoryInsert };
      });

      const result = await patrolPlanningService.createPatrolPlan(mockPayload, 1);
      expect(result.status).toBe('ASSIGNED');
    });
  });

  describe('getDashboardData', () => {
    test('should return dashboard telemetry, KPIs and routes', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 1, name: 'Yala' }, error: null });
      const mockEqSingle = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectSingle = jest.fn().mockReturnValue({ eq: mockEqSingle });

      const mockEqMultiple = jest.fn().mockResolvedValue({ data: [], error: null });
      const mockSelectMultiple = jest.fn().mockReturnValue({ eq: mockEqMultiple });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'parks') return { select: mockSelectSingle };
        if (table === 'patrol_routes' || table === 'risk_zones' || table === 'rangers') return { select: mockSelectMultiple };
      });

      const result = await patrolPlanningService.getDashboardData(1);
      expect(result.park.name).toBe('Yala');
      expect(result.telemetry).toBeDefined();
      expect(result.kpi).toBeDefined();
      expect(result.routes).toBeDefined();
    });
  });

  describe('getRangerRecommendations', () => {
    test('[POSITIVE CASE] should recommend the best ranger based on heuristics', async () => {
      const mockRoute = { id: 1, park_id: 1, checkpoints: [{ lat: 6.4, lng: 81.5 }] };
      const mockRangers = [
        { id: 10, current_status: 'AVAILABLE', active_assignments_count: 0, max_active_assignments: 5, is_rest_compliant: true, current_lat: 6.41, current_lng: 81.51 },
        { id: 11, current_status: 'ON_SHIFT', active_assignments_count: 2, max_active_assignments: 5, is_rest_compliant: true, current_lat: 6.5, current_lng: 81.6 }
      ];
      const mockExistingPlans = [];

      const mockRouteSingle = jest.fn().mockResolvedValue({ data: mockRoute, error: null });
      const mockRouteEq = jest.fn().mockReturnValue({ single: mockRouteSingle });
      const mockRouteSelect = jest.fn().mockReturnValue({ eq: mockRouteEq });

      const mockRangerEq = jest.fn().mockResolvedValue({ data: mockRangers, error: null });
      const mockRangerSelect = jest.fn().mockReturnValue({ eq: mockRangerEq });

      const mockPlanIn = jest.fn().mockResolvedValue({ data: mockExistingPlans, error: null });
      const mockPlanEq = jest.fn().mockReturnValue({ in: mockPlanIn });
      const mockPlanSelect = jest.fn().mockReturnValue({ eq: mockPlanEq });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_routes') return { select: mockRouteSelect };
        if (table === 'rangers') return { select: mockRangerSelect };
        if (table === 'patrol_plans') return { select: mockPlanSelect };
      });

      const result = await patrolPlanningService.getRangerRecommendations(1, '2026-10-10', '08:00', 4);
      expect(result.recommendedRanger.id).toBe(10);
      expect(result.rangers.length).toBe(2);
    });

    test('[EDGE CASE] should identify schedule conflicts exactly when times overlap', async () => {
      const mockRoute = { id: 1, park_id: 1, checkpoints: [{ lat: 6.4, lng: 81.5 }] };
      const mockRangers = [
        { id: 10, current_status: 'AVAILABLE', active_assignments_count: 0, max_active_assignments: 5, is_rest_compliant: true, current_lat: 6.41, current_lng: 81.51 }
      ];
      // Plan exists at 08:00 for 4 hours
      const mockExistingPlans = [
        { id: 1, ranger_id: 10, start_time: '08:00', estimated_duration_hours: 4, status: 'ASSIGNED' }
      ];

      const mockRouteSingle = jest.fn().mockResolvedValue({ data: mockRoute, error: null });
      const mockRouteEq = jest.fn().mockReturnValue({ single: mockRouteSingle });
      const mockRouteSelect = jest.fn().mockReturnValue({ eq: mockRouteEq });

      const mockRangerEq = jest.fn().mockResolvedValue({ data: mockRangers, error: null });
      const mockRangerSelect = jest.fn().mockReturnValue({ eq: mockRangerEq });

      const mockPlanIn = jest.fn().mockResolvedValue({ data: mockExistingPlans, error: null });
      const mockPlanEq = jest.fn().mockReturnValue({ in: mockPlanIn });
      const mockPlanSelect = jest.fn().mockReturnValue({ eq: mockPlanEq });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'patrol_routes') return { select: mockRouteSelect };
        if (table === 'rangers') return { select: mockRangerSelect };
        if (table === 'patrol_plans') return { select: mockPlanSelect };
      });

      // Querying for 09:00 for 4 hours -> overlaps!
      const result = await patrolPlanningService.getRangerRecommendations(1, '2026-10-10', '09:00', 4);
      expect(result.rangers[0].hasScheduleConflict).toBe(true);
      expect(result.recommendedRanger.isTopRecommendation).toBe(false);
    });
  });
});
