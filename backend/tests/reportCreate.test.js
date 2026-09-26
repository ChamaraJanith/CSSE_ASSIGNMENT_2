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

    it('should update ranger assignment status and outcome', async () => {
      req.params = { code: 'REP-123' };
      req.body = {
        assignment_id: 'assign-1',
        ranger_status: 'RESOLVED',
        ranger_outcome: 'Chased away',
        ranger_outcome_image: 'http://img.url'
      };

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      const mockSingle = jest.fn().mockResolvedValue({ data: { report_code: 'REP-123' }, error: null });
      const mockEqSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectFetch = jest.fn().mockReturnValue({ eq: mockEqSelect });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'response_assignments') return { update: mockUpdate };
        if (table === 'conflict_reports') return { select: mockSelectFetch }; // For final fetch
      });

      await updateReportStatus(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('response_assignments');
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'RESOLVED',
        outcome: 'Chased away',
        outcome_image_url: 'http://img.url'
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'assign-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should update ranger assignment status and outcome without photo', async () => {
      req.params = { code: 'REP-123' };
      req.body = {
        assignment_id: 'assign-2',
        ranger_status: 'RESOLVED',
        ranger_outcome: 'Chased away safely'
        // no ranger_outcome_image provided
      };

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      const mockSingle = jest.fn().mockResolvedValue({ data: { report_code: 'REP-123' }, error: null });
      const mockEqSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectFetch = jest.fn().mockReturnValue({ eq: mockEqSelect });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'response_assignments') return { update: mockUpdate };
        if (table === 'conflict_reports') return { select: mockSelectFetch };
      });

      await updateReportStatus(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('response_assignments');
      expect(mockUpdate).toHaveBeenCalledWith({
        status: 'RESOLVED',
        outcome: 'Chased away safely'
        // should not include outcome_image_url since it was undefined
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'assign-2');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should request clarification', async () => {
      req.params = { code: 'REP-123' };
      req.body = {
        clarification_request: 'Need more details'
      };

      const mockInsert = jest.fn().mockResolvedValue({ error: null });
      
      const mockSingle = jest.fn().mockResolvedValue({ data: { report_code: 'REP-123' }, error: null });
      const mockEqSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectFetch = jest.fn().mockReturnValue({ eq: mockEqSelect });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'report_clarifications') return { insert: mockInsert };
        if (table === 'conflict_reports') return { select: mockSelectFetch };
      });

      await updateReportStatus(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('report_clarifications');
      expect(mockInsert).toHaveBeenCalledWith([{
        report_code: 'REP-123',
        officer_request: 'Need more details'
      }]);
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should reply to clarification', async () => {
      req.params = { code: 'REP-123' };
      req.body = {
        clarification_id: 'clar-1',
        clarification_reply: 'Here are details',
        clarification_evidence_url: 'http://evidence.url'
      };

      const mockEq = jest.fn().mockResolvedValue({ error: null });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      const mockSingle = jest.fn().mockResolvedValue({ data: { report_code: 'REP-123' }, error: null });
      const mockEqSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelectFetch = jest.fn().mockReturnValue({ eq: mockEqSelect });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'report_clarifications') return { update: mockUpdate };
        if (table === 'conflict_reports') return { select: mockSelectFetch };
      });

      await updateReportStatus(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('report_clarifications');
      expect(mockUpdate).toHaveBeenCalledWith({
        user_reply: 'Here are details',
        evidence_url: 'http://evidence.url'
      });
      expect(mockEq).toHaveBeenCalledWith('id', 'clar-1');
      expect(res.status).toHaveBeenCalledWith(200);
    });

    it('should block closing a report without a ranger outcome', async () => {
      req.params = { code: 'REP-123' };
      req.body = { status: 'CLOSED' };

      // Mock assignments check in updateReportDetails
      const mockAssignmentsSelect = jest.fn().mockResolvedValue({ 
        data: [{ outcome: null }, { outcome: '' }], // No valid outcome
        error: null 
      });
      const mockAssignmentsEq = jest.fn().mockReturnValue({ eq: mockAssignmentsSelect }); // select().eq() -> wait, no: from().select().eq()
      
      const mockSelect = jest.fn().mockReturnValue({ eq: mockAssignmentsSelect });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'response_assignments') return { select: mockSelect };
      });

      await updateReportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Cannot close report without a recorded ranger outcome.' });
    });

    it('should block unauthorized ranger from updating assignment', async () => {
      req.params = { code: 'REP-123' };
      req.user = { id: 'user-hacker' };
      req.body = {
        assignment_id: 'assign-1',
        ranger_status: 'OUTCOME_RECORDED'
      };

      // Mock assignment fetch returning a different ranger
      const mockAssignmentSingle = jest.fn().mockResolvedValue({ 
        data: { ranger_id: 'user-legit' }, 
        error: null 
      });
      const mockAssignmentEq = jest.fn().mockReturnValue({ single: mockAssignmentSingle });
      const mockAssignmentSelect = jest.fn().mockReturnValue({ eq: mockAssignmentEq });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'response_assignments') return { select: mockAssignmentSelect };
      });

      await updateReportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(403);
      expect(res.json).toHaveBeenCalledWith({ error: 'Unauthorized: You can only update your own assignments.' });
    });

    it('should return error if update fails', async () => {
      req.params = { code: 'REP-123' };
      req.body = { status: 'CLOSED' };

      supabaseAdmin.from.mockImplementation(() => {
        throw new Error('Update failed');
      });

      await updateReportStatus(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Update failed' });
    });
  });
});
