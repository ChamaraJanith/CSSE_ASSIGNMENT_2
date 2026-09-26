const { supabaseAdmin } = require('../supabaseClient');
const { createConflictReport, updateReportStatus } = require('../controllers/reportController');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn(),
  }
}));

describe('Report Controller - Create & Update', () => {
  let req, res;

  beforeEach(() => {
    req = {
      body: {},
      query: {},
      params: {},
    };
    res = {
      status: jest.fn().mockReturnThis(),
      json: jest.fn(),
    };
    jest.clearAllMocks();
  });

  describe('createConflictReport', () => {
    it('should create a new report successfully', async () => {
      req.body = {
        user_id: 'user123',
        incidentType: 'ELEPHANT_SIGHTING',
        area: 'Yala',
        landmark: 'Near gate',
        description: 'Saw an elephant',
        reportCode: 'REP-123456789'
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: [{ id: 1, report_code: 'REP-123456789' }],
        error: null
      });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      await createConflictReport(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('conflict_reports');
      expect(mockInsert).toHaveBeenCalledWith([expect.objectContaining({
        user_id: 'user123',
        incident_type: 'ELEPHANT_SIGHTING',
        status: 'NEW',
        report_code: 'REP-123456789'
      })]);
      expect(res.status).toHaveBeenCalledWith(201);
      expect(res.json).toHaveBeenCalledWith({
        message: 'Report submitted successfully',
        data: { id: 1, report_code: 'REP-123456789' }
      });
    });

    it('should handle error when inserting report', async () => {
      req.body = {
        user_id: 'user123'
      };

      const mockSelect = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Database error' }
      });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      await createConflictReport(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Database error' });
    });
  });

  describe('updateReportStatus', () => {
    it('should assign a ranger successfully', async () => {
      req.params = { code: 'REP-123' };
      req.body = {
        status: 'RANGER_ASSIGNED',
        priority: 'HIGH',
        assigned_ranger_id: 'ranger1'
      };

      // Mock update to conflict_reports
      const mockSelect = jest.fn().mockResolvedValue({ error: null, data: [{ report_code: 'REP-123' }] });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });
      
      // Mock insert to response_assignments
      const mockInsert = jest.fn().mockResolvedValue({ error: null });

      // Mock fetch
      const mockSingle = jest.fn().mockResolvedValue({ data: { report_code: 'REP-123' }, error: null });
      const mockEqSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectFetch = jest.fn().mockReturnValue({ eq: mockEqSelect });
      
      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'conflict_reports') return { update: mockUpdate, select: mockSelectFetch };
        if (table === 'response_assignments') return { insert: mockInsert };
      });

      await updateReportStatus(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('conflict_reports');
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'RANGER_ASSIGNED',
        priority: 'HIGH'
      });
      
      expect(supabaseAdmin.from).toHaveBeenCalledWith('response_assignments');
      expect(mockInsert).toHaveBeenCalledWith([{
        report_code: 'REP-123',
        ranger_id: 'ranger1',
        status: 'PENDING'
      }]);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ message: 'Report updated successfully', data: { report_code: 'REP-123' } });
    });
  });
});
