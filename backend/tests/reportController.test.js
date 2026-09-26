const { supabaseAdmin } = require('../supabaseClient');
const { getRangers, getAllReports, createConflictReport, getReportByCode } = require('../controllers/reportController');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        listUsers: jest.fn(),
      }
    }
  }
}));

describe('Report Controller', () => {
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

  describe('getRangers', () => {
    it('should fetch wildlife officers and attach their emails', async () => {
      // Mock supabase user_roles fetch
      const mockRolesSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({
          data: [{ user_id: 'user1' }, { user_id: 'user2' }],
          error: null
        })
      });
      supabaseAdmin.from.mockReturnValue({ select: mockRolesSelect });

      // Mock listUsers
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user1', email: 'ranger1@test.com' }] },
        error: null
      });

      await getRangers(req, res);

      expect(supabaseAdmin.from).toHaveBeenCalledWith('user_roles');
      expect(supabaseAdmin.auth.admin.listUsers).toHaveBeenCalled();
      
      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: [
          { id: 'user1', name: 'ranger1@test.com' },
          { id: 'user2', name: 'Ranger (user2)' } // user2 email not found
        ]
      });
    });

    it('should return error if fetching roles fails', async () => {
      const mockRolesSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: null, error: { message: 'DB Error' } })
      });
      supabaseAdmin.from.mockReturnValue({ select: mockRolesSelect });

      await getRangers(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'DB Error' });
    });

    it('should return dummy rangers if empty', async () => {
      const mockRolesSelect = jest.fn().mockReturnValue({
        eq: jest.fn().mockResolvedValue({ data: [], error: null })
      });
      supabaseAdmin.from.mockReturnValue({ select: mockRolesSelect });

      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

      await getRangers(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({
        data: [
          { id: '11111111-1111-1111-1111-111111111111', name: 'dummy1@wildguard.com' },
          { id: '22222222-2222-2222-2222-222222222222', name: 'dummy2@wildguard.com' }
        ]
      });
    });
  });

  describe('getAllReports', () => {
    it('should fetch reports, sort clarifications and assignments, and attach ranger emails', async () => {
      req.query = { rangerId: 'user1' }; // Filter by rangerId

      // Mock reports query
      const mockReports = [
        {
          report_code: 'REP-1',
          report_clarifications: [{ created_at: '2023-01-02' }, { created_at: '2023-01-01' }],
          response_assignments: [{ ranger_id: 'user1', created_at: '2023-01-01' }]
        },
        {
          report_code: 'REP-2',
          response_assignments: [{ ranger_id: 'user2', created_at: '2023-01-01' }]
        }
      ];

      const mockQueryEq = jest.fn().mockResolvedValue({ data: mockReports, error: null });
      const mockQueryOrder = jest.fn().mockReturnValue({ eq: mockQueryEq, then: (cb) => cb({ data: mockReports, error: null }) }); // for await
      const mockQuerySelect = jest.fn().mockReturnValue({ order: mockQueryOrder });
      
      // Because we chain let query = ...order(); query = query.eq()
      // Let's just mock the resolved value of the query object directly.
      const mockPromise = Promise.resolve({ data: mockReports, error: null });
      const mockQueryObject = {
        order: jest.fn().mockReturnValue(mockPromise)
      };
      
      // Let's refine the mock to match the code exactly
      const queryObj = {
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve({ data: mockReports, error: null }))
      };
      const orderObj = {
        order: jest.fn().mockReturnValue(queryObj)
      };
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue(orderObj)
      });

      // Mock listUsers
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [{ id: 'user1', email: 'ranger1@test.com' }] },
        error: null
      });

      await getAllReports(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      // It should filter out REP-2 because rangerId = 'user1'
      expect(res.json).toHaveBeenCalledWith({
        data: [
          {
            report_code: 'REP-1',
            report_clarifications: [{ created_at: '2023-01-01' }, { created_at: '2023-01-02' }], // Sorted
            response_assignments: [{ ranger_id: 'user1', created_at: '2023-01-01', ranger_email: 'ranger1@test.com' }]
          }
        ]
      });
    });

    it('should apply userId filter when userId is passed', async () => {
      req.query = { userId: 'userA' };
      const mockReports = [];
      const queryObj = {
        eq: jest.fn().mockReturnThis(),
        then: jest.fn((resolve) => resolve({ data: mockReports, error: null }))
      };
      const orderObj = {
        order: jest.fn().mockReturnValue(queryObj)
      };
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue(orderObj)
      });
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({ data: { users: [] }, error: null });

      await getAllReports(req, res);

      expect(queryObj.eq).toHaveBeenCalledWith('user_id', 'userA');
      expect(res.status).toHaveBeenCalledWith(200);
    });
    it('should handle errors in getAllReports', async () => {
      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          order: jest.fn().mockReturnValue({
            then: jest.fn((resolve, reject) => reject(new Error('Fetch failed')))
          })
        })
      });

      await getAllReports(req, res);

      expect(res.status).toHaveBeenCalledWith(400);
      expect(res.json).toHaveBeenCalledWith({ error: 'Fetch failed' });
    });
  });

  describe('getReportByCode', () => {
    it('should fetch a single report successfully and sort clarifications', async () => {
      req.params = { code: 'REP-123' };

      const mockSingle = jest.fn().mockResolvedValue({
        data: { 
          report_code: 'REP-123',
          report_clarifications: [{ created_at: '2023-01-02' }, { created_at: '2023-01-01' }]
        },
        error: null
      });

      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      // Mock listUsers since the service fetches users to attach emails
      supabaseAdmin.auth.admin.listUsers.mockResolvedValue({
        data: { users: [] },
        error: null
      });

      await getReportByCode(req, res);

      expect(res.status).toHaveBeenCalledWith(200);
      expect(res.json).toHaveBeenCalledWith({ data: { 
        report_code: 'REP-123',
        report_clarifications: [{ created_at: '2023-01-01' }, { created_at: '2023-01-02' }]
      } });
    });

    it('should handle PGRST116 (not found) error explicitly', async () => {
      req.params = { code: 'REP-123' };

      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'JSON object requested, multiple (or no) rows returned', code: 'PGRST116' }
      });

      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      await getReportByCode(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Report not found' });
    });

    it('should return error if getReportByCode fails', async () => {
      req.params = { code: 'REP-123' };

      const mockSingle = jest.fn().mockResolvedValue({
        data: null,
        error: { message: 'Not found', status: 404 }
      });

      supabaseAdmin.from.mockReturnValue({
        select: jest.fn().mockReturnValue({
          eq: jest.fn().mockReturnValue({
            single: mockSingle
          })
        })
      });

      await getReportByCode(req, res);

      expect(res.status).toHaveBeenCalledWith(404);
      expect(res.json).toHaveBeenCalledWith({ error: 'Not found' });
    });
  });
});
