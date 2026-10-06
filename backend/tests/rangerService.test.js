const rangerService = require('../services/rangerService');
const { supabaseAdmin } = require('../supabaseClient');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: {
      admin: {
        createUser: jest.fn()
      }
    }
  }
}));

describe('Ranger Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getRangersByPark', () => {
    test('should fetch rangers for a park', async () => {
      const mockData = [{ id: 1, full_name: 'John Doe' }];
      const mockOrder = jest.fn().mockResolvedValue({ data: mockData, error: null });
      const mockEq = jest.fn().mockReturnValue({ order: mockOrder });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const result = await rangerService.getRangersByPark(1);
      expect(result).toEqual(mockData);
      expect(supabaseAdmin.from).toHaveBeenCalledWith('rangers');
    });
  });

  describe('updateRangerStatus', () => {
    test('should update the ranger status correctly', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 1, current_status: 'ON_SHIFT' }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockEq = jest.fn().mockReturnValue({ select: mockSelect });
      const mockUpdate = jest.fn().mockReturnValue({ eq: mockEq });

      supabaseAdmin.from.mockReturnValue({ update: mockUpdate });

      const result = await rangerService.updateRangerStatus(1, 'ON_SHIFT');
      expect(result.current_status).toBe('ON_SHIFT');
    });
  });

  describe('registerRanger', () => {
    test('should register a new ranger with generated coordinates', async () => {
      const payload = {
        fullName: 'Jane Doe',
        badgeNumber: 'B-100',
        callsign: 'Eagle',
        baseLocationName: 'Katagamuwa'
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 2, ...payload }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      const result = await rangerService.registerRanger(payload);
      expect(result.id).toBe(2);
      expect(mockInsert).toHaveBeenCalled();
    });

    test('should throw error if mandatory fields are missing', async () => {
      await expect(rangerService.registerRanger({})).rejects.toThrow('Full Name, Badge Number, and Callsign are mandatory');
    });

    test('should handle auth user creation if email and password provided', async () => {
      const payload = {
        fullName: 'Auth User',
        badgeNumber: 'B-101',
        callsign: 'Hawk',
        email: 'hawk@test.com',
        password: 'password123'
      };

      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 3 }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });
      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      supabaseAdmin.auth.admin.createUser.mockResolvedValue({ data: { user: { id: 'auth-1' } } });

      const result = await rangerService.registerRanger(payload);
      expect(supabaseAdmin.auth.admin.createUser).toHaveBeenCalled();
      expect(result.id).toBe(3);
    });
  });
});
