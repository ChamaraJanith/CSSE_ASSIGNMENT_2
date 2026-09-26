const { supabaseAdmin } = require('../supabaseClient');
const { getRangers, getAllReports, createConflictReport, getConflictReportByCode } = require('../controllers/reportController');

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
  });
});
