const parkInfrastructureService = require('../services/parkInfrastructureService');
const { supabaseAdmin } = require('../supabaseClient');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn()
  }
}));

describe('Park Infrastructure Service', () => {
  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('getParkSettings', () => {
    test('should fetch park settings correctly', async () => {
      const mockSettings = { park_id: 1, acoustic_spike_threshold: 4 };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockSettings, error: null });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const result = await parkInfrastructureService.getParkSettings(1);
      expect(result).toEqual(mockSettings);
    });

    test('should return fallback default if error occurs', async () => {
      const mockSingle = jest.fn().mockResolvedValue({ data: null, error: { message: 'Not found' } });
      const mockEq = jest.fn().mockReturnValue({ single: mockSingle });
      const mockSelect = jest.fn().mockReturnValue({ eq: mockEq });

      supabaseAdmin.from.mockReturnValue({ select: mockSelect });

      const result = await parkInfrastructureService.getParkSettings(2);
      expect(result.park_id).toBe(2);
      expect(result.target_coverage_percent).toBe(90);
    });
  });

  describe('updateParkSettings', () => {
    test('should update park settings', async () => {
      const mockSettings = { acoustic_spike_threshold: 5 };
      const mockSingle = jest.fn().mockResolvedValue({ data: mockSettings, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockUpsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabaseAdmin.from.mockReturnValue({ upsert: mockUpsert });

      const result = await parkInfrastructureService.updateParkSettings(1, mockSettings);
      expect(result).toEqual(mockSettings);
    });
  });

  describe('createStagingPost', () => {
    test('should create a staging post successfully', async () => {
      const payload = { name: 'New Post', latitude: 6.4, longitude: 81.5 };
      const mockSingle = jest.fn().mockResolvedValue({ data: { id: 1, ...payload }, error: null });
      const mockSelect = jest.fn().mockReturnValue({ single: mockSingle });
      const mockInsert = jest.fn().mockReturnValue({ select: mockSelect });

      supabaseAdmin.from.mockReturnValue({ insert: mockInsert });

      const result = await parkInfrastructureService.createStagingPost(payload);
      expect(result.id).toBe(1);
    });

    test('should throw error if name or coords are missing', async () => {
      await expect(parkInfrastructureService.createStagingPost({})).rejects.toThrow('Outpost Name, Latitude, and Longitude are mandatory');
    });
  });

  describe('deleteStagingPost', () => {
    test('should delete a staging post successfully', async () => {
      const mockEq = jest.fn().mockResolvedValue({ data: null, error: null });
      const mockDelete = jest.fn().mockReturnValue({ eq: mockEq });

      supabaseAdmin.from.mockReturnValue({ delete: mockDelete });

      const result = await parkInfrastructureService.deleteStagingPost(1);
      expect(result.success).toBe(true);
      expect(result.id).toBe(1);
    });
  });

  describe('getStagingPosts', () => {
    test('should aggregate posts from rangers, staging_posts, routes, and fallbacks', async () => {
      const mockRangers = [{ base_location_name: 'Post A' }];
      const mockDbPosts = [{ id: 1, name: 'Post A', latitude: 1, longitude: 1 }];
      const mockRoutes = [{ route_name: 'Route 1', checkpoints: [{ name: 'CP1', lat: 2, lng: 2 }] }];
      
      const mockEqRangers = jest.fn().mockResolvedValue({ data: mockRangers, error: null });
      const mockSelectRangers = jest.fn().mockReturnValue({ eq: mockEqRangers });

      const mockOrderDbPosts = jest.fn().mockResolvedValue({ data: mockDbPosts, error: null });
      const mockEqDbPosts = jest.fn().mockReturnValue({ order: mockOrderDbPosts });
      const mockSelectDbPosts = jest.fn().mockReturnValue({ eq: mockEqDbPosts });

      const mockEqRoutes = jest.fn().mockResolvedValue({ data: mockRoutes, error: null });
      const mockSelectRoutes = jest.fn().mockReturnValue({ eq: mockEqRoutes });

      supabaseAdmin.from.mockImplementation((table) => {
        if (table === 'rangers') return { select: mockSelectRangers };
        if (table === 'staging_posts') return { select: mockSelectDbPosts };
        if (table === 'patrol_routes') return { select: mockSelectRoutes };
      });

      const result = await parkInfrastructureService.getStagingPosts(1);
      expect(result.length).toBeGreaterThan(0);
      const postA = result.find(p => p.name === 'Post A');
      expect(postA).toBeDefined();
      expect(postA.stationed_count).toBe(1);
    });
  });
});
