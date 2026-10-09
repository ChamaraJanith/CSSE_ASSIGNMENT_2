const express = require('express');
const request = require('supertest');
const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const monitoringRuleRoutes = require('../routes/monitoringRuleRoutes');
const monitoringRuleService = require('../services/monitoringRuleService');
const {
  MANAGER_ID, HAZARD, CREATED_AT, UPDATED_AT, yalaPark, zoneRow, ruleRow, ruleInput, createSupabaseFake, createRulePgFake
} = require('./helpers/monitoringRuleFakes');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: {
    from: jest.fn(),
    auth: { getUser: jest.fn() }
  }
}));
jest.mock('../pgPool', () => ({ getPool: jest.fn() }));

const app = express();
app.use(express.json());
app.use('/api/monitoring-rules', monitoringRuleRoutes);

const BASE = '/api/monitoring-rules';
const AUTH = { Authorization: 'Bearer valid-manager-token' };
const OTHER_USER_ID = 'dddddddd-0000-0000-0000-000000000005';
const MANAGER_ROLE = { user_roles: { data: [{ user_id: MANAGER_ID }], error: null } };
const GENERIC_500 = 'An unexpected error occurred while processing the monitoring rule request.';
const LEAK_PATTERN = /relation|duplicate key|ux_monitoring_rules|ECONNREFUSED|SELECT|INSERT|stack|permission denied/i;

const signInAs = (userId) => {
  supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: { id: userId } }, error: null });
};

// Signed-in Park Manager plus the Supabase tables a test needs
const asParkManager = (tables = {}) => createSupabaseFake(supabaseAdmin, { ...MANAGER_ROLE, ...tables });

const getReference = (query = '?parkId=1') => request(app).get(`${BASE}/reference${query}`).set(AUTH);
const getRules = (query = '?parkId=1') => request(app).get(`${BASE}${query}`).set(AUTH);
const validate = (body) => request(app).post(`${BASE}/validate`).set(AUTH).send(body);
const create = (body) => request(app).post(BASE).set(AUTH).send(body);

const expectNoLeak = (res) => expect(JSON.stringify(res.body)).not.toMatch(LEAK_PATTERN);

// Every UC04 endpoint, with the fakes needed for a successful Park Manager call
const ENDPOINTS = [
  {
    name: 'GET /reference',
    send: (headers) => request(app).get(`${BASE}/reference?parkId=1`).set(headers),
    arrange: () => asParkManager({ parks: { data: yalaPark, error: null }, risk_zones: { data: [zoneRow()], error: null } }),
    okStatus: 200
  },
  {
    name: 'GET /',
    send: (headers) => request(app).get(`${BASE}?parkId=1`).set(headers),
    arrange: () => asParkManager({ parks: { data: yalaPark, error: null }, monitoring_rules: { data: [], error: null } }),
    okStatus: 200
  },
  {
    name: 'POST /validate',
    send: (headers) => request(app).post(`${BASE}/validate`).set(headers).send(ruleInput()),
    arrange: () => { asParkManager(); createRulePgFake(getPool); },
    okStatus: 200
  },
  {
    name: 'POST /',
    send: (headers) => request(app).post(BASE).set(headers).send(ruleInput({ action: 'ACTIVATE' })),
    arrange: () => { asParkManager(); createRulePgFake(getPool); },
    okStatus: 201
  },
  {
    name: 'PUT /:id',
    send: (headers) => request(app).put(`${BASE}/10`).set(headers).send(ruleInput()),
    arrange: () => { asParkManager(); createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] }); },
    okStatus: 200
  },
  {
    name: 'POST /:id/activate',
    send: (headers) => request(app).post(`${BASE}/10/activate`).set(headers),
    arrange: () => { asParkManager(); createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] }); },
    okStatus: 200
  },
  {
    name: 'POST /:id/deactivate',
    send: (headers) => request(app).post(`${BASE}/12/deactivate`).set(headers),
    arrange: () => {
      asParkManager();
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT })] });
    },
    okStatus: 200
  }
];

describe('UC04: Monitoring Rules API (/api/monitoring-rules)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
    signInAs(MANAGER_ID);
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('Authorization (Park Manager only, on every endpoint)', () => {
    test.each(ENDPOINTS)('[NEGATIVE CASE] $name: unauthenticated request should be rejected with 401', async ({ send }) => {
      const res = await send({});
      expect(res.status).toBe(401);
      expect(res.body).toEqual({ error: 'Authentication required.' });
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
      expect(getPool).not.toHaveBeenCalled();
    });

    test.each(ENDPOINTS)('[NEGATIVE CASE] $name: an invalid or expired token should be rejected with 401', async ({ send }) => {
      supabaseAdmin.auth.getUser.mockResolvedValue({ data: { user: null }, error: new Error('invalid JWT') });
      const res = await send(AUTH);
      expect(res.status).toBe(401);
      expect(getPool).not.toHaveBeenCalled();
    });

    test.each(ENDPOINTS)('[NEGATIVE CASE] $name: an authenticated non-Park-Manager should get 403', async ({ send }) => {
      signInAs(OTHER_USER_ID);
      const builders = createSupabaseFake(supabaseAdmin, { user_roles: { data: [], error: null } });
      const res = await send(AUTH);
      expect(res.status).toBe(403);
      expect(res.body).toEqual({ error: 'Access denied: only Park Managers can configure monitoring rules.' });
      expect(builders.user_roles.eq).toHaveBeenCalledWith('user_id', OTHER_USER_ID);
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
      expect(getPool).not.toHaveBeenCalled();
    });

    test.each(ENDPOINTS)('[ERROR CASE] $name: a role lookup failure should return a safe 500', async ({ send }) => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: null, error: new Error('permission denied for table roles') } });
      const res = await send(AUTH);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: 'Unable to verify user role.' });
      expect(getPool).not.toHaveBeenCalled();
    });

    test.each(ENDPOINTS)('[POSITIVE CASE] $name: a Park Manager should be allowed', async ({ send, arrange, okStatus }) => {
      arrange();
      const res = await send(AUTH);
      expect(res.status).toBe(okStatus);
      expect(supabaseAdmin.auth.getUser).toHaveBeenCalledWith('valid-manager-token');
    });
  });

  describe('GET /reference', () => {
    test('[POSITIVE CASE] should return the selected park, its risk zones and the option lists', async () => {
      const builders = asParkManager({
        parks: { data: yalaPark, error: null },
        risk_zones: { data: [zoneRow({ id: 1, zone_code: 'RZ-YALA-01' }), zoneRow()], error: null }
      });
      const res = await getReference('?parkId=1');

      expect(res.status).toBe(200);
      expect(res.body.data.park).toEqual({ id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' });
      expect(res.body.data.riskZones.map((zone) => zone.zoneCode)).toEqual(['RZ-YALA-01', 'RZ-YALA-02']);
      expect(Object.keys(res.body.data.options).sort()).toEqual(['alertPriorities', 'hazardTypes', 'recipientRoles', 'responseBehaviours']);
      expect(res.body.data.options.hazardTypes[0]).toEqual({ value: HAZARD, label: expect.any(String) });
      expect(builders.parks.eq).toHaveBeenCalledWith('id', 1);
    });

    test('[POSITIVE CASE] each risk zone should carry its numeric centre (centerLat, centerLng) and radiusKm', async () => {
      asParkManager({
        parks: { data: yalaPark, error: null },
        risk_zones: {
          data: [
            zoneRow({ id: 1, zone_code: 'RZ-YALA-01', center_lat: '6.412800', center_lng: '81.534200', radius_km: '3.20' }),
            zoneRow({ radius_km: null })
          ],
          error: null
        }
      });
      const res = await getReference('?parkId=1');

      expect(res.status).toBe(200);
      expect(res.body.data.riskZones.map(({ zoneCode, centerLat, centerLng, radiusKm }) => ({ zoneCode, centerLat, centerLng, radiusKm })))
        .toEqual([
          { zoneCode: 'RZ-YALA-01', centerLat: 6.4128, centerLng: 81.5342, radiusKm: 3.2 },
          { zoneCode: 'RZ-YALA-02', centerLat: 6.3845, centerLng: 81.487, radiusKm: null }
        ]);
    });

    test('[EDGE CASE] a park with no risk zones should return an empty zone list', async () => {
      asParkManager({ parks: { data: yalaPark, error: null }, risk_zones: { data: [], error: null } });
      const res = await getReference();
      expect(res.status).toBe(200);
      expect(res.body.data.riskZones).toEqual([]);
    });

    test('[NEGATIVE CASE] a missing parkId should return 400', async () => {
      asParkManager();
      const res = await getReference('');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Park ID must be a positive integer.' });
    });

    test.each(['abc', '0', '-1', '1.5', '1&parkId=2'])('[NEGATIVE CASE] parkId=%s should return 400', async (value) => {
      asParkManager();
      const res = await getReference(`?parkId=${value}`);
      expect(res.status).toBe(400);
      expect(supabaseAdmin.from).toHaveBeenCalledTimes(1);
    });

    test('[NEGATIVE CASE] an unknown park should return 404', async () => {
      asParkManager({ parks: { data: null, error: null } });
      const res = await getReference('?parkId=99');
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Park not found.' });
    });

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      asParkManager({ parks: { data: yalaPark, error: null }, risk_zones: { data: null, error: new Error('relation "risk_zones" permission denied') } });
      const res = await getReference();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });

  describe('GET / (list rules)', () => {
    test('[POSITIVE CASE] should return the park rules', async () => {
      const builders = asParkManager({
        parks: { data: yalaPark, error: null },
        monitoring_rules: {
          data: [ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT, risk_zones: { id: 2, zone_code: 'RZ-YALA-02', zone_name: 'Katagamuwa Sanctuary Boundary' } })],
          error: null
        }
      });
      const res = await getRules('?parkId=1');

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual([expect.objectContaining({
        id: 12, parkId: 1, status: 'ACTIVE', activatedAt: CREATED_AT,
        riskZone: { id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary' }
      })]);
      expect(builders.monitoring_rules.eq).toHaveBeenCalledWith('park_id', 1);
    });

    test('[EDGE CASE] a park without rules should return an empty list', async () => {
      asParkManager({ parks: { data: yalaPark, error: null }, monitoring_rules: { data: [], error: null } });
      const res = await getRules();
      expect(res.status).toBe(200);
      expect(res.body).toEqual({ data: [] });
    });

    test('[NEGATIVE CASE] a missing parkId should return 400', async () => {
      asParkManager();
      const res = await getRules('');
      expect(res.status).toBe(400);
    });

    test.each(['x', '0', '-4'])('[NEGATIVE CASE] parkId=%s should return 400', async (value) => {
      asParkManager();
      const res = await getRules(`?parkId=${value}`);
      expect(res.status).toBe(400);
    });

    test('[NEGATIVE CASE] an unknown park should return 404', async () => {
      asParkManager({ parks: { data: null, error: null } });
      const res = await getRules('?parkId=77');
      expect(res.status).toBe(404);
    });

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      asParkManager({ parks: { data: yalaPark, error: null }, monitoring_rules: { data: null, error: new Error('relation "monitoring_rules" does not exist') } });
      const res = await getRules();
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });

  describe('POST /validate (dry run)', () => {
    let createSpy;

    beforeEach(() => {
      asParkManager();
      createSpy = jest.spyOn(monitoringRuleService, 'createRule');
    });

    afterEach(() => {
      // The dry-run endpoint must never reach the create path
      expect(createSpy).not.toHaveBeenCalled();
      createSpy.mockRestore();
    });

    test('[POSITIVE CASE] a valid configuration should return 200 with valid=true and the normalised rule', async () => {
      const db = createRulePgFake(getPool);
      const res = await validate(ruleInput());

      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        valid: true,
        errors: [],
        conflicts: [],
        rule: expect.objectContaining({
          parkId: 1, riskZoneId: 2, notificationRecipients: ['park_manager', 'wildlife_officer'], notes: 'Snare lines reported near the fence'
        })
      });
      db.statements.forEach(({ sql }) => expect(sql).not.toMatch(/^(INSERT|UPDATE|DELETE|BEGIN|COMMIT)|pg_advisory/));
    });

    test('[NEGATIVE CASE] a missing required field should return 200 with valid=false', async () => {
      createRulePgFake(getPool);
      const input = ruleInput();
      delete input.alertPriority;
      const res = await validate(input);
      expect(res.status).toBe(200);
      expect(res.body.data).toEqual({
        valid: false,
        errors: [expect.objectContaining({ field: 'alertPriority', code: 'REQUIRED' })],
        conflicts: [],
        rule: null
      });
    });

    test('[NEGATIVE CASE] multiple invalid fields should all be returned together', async () => {
      createRulePgFake(getPool);
      const res = await validate({ parkId: 'one', hazardType: 'NOPE', riskZoneId: -2, notificationRecipients: 'park_manager', notes: 3 });
      expect(res.status).toBe(200);
      expect(res.body.data.errors.map((e) => e.field)).toEqual([
        'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour', 'notes'
      ]);
    });

    test('[NEGATIVE CASE] a risk zone from another park should return 200 with a reference error', async () => {
      createRulePgFake(getPool, { zone: zoneRow({ id: 5, park_id: 2 }) });
      const res = await validate(ruleInput({ riskZoneId: 5 }));
      expect(res.status).toBe(200);
      expect(res.body.data.valid).toBe(false);
      expect(res.body.data.errors).toEqual([expect.objectContaining({ field: 'riskZoneId', code: 'ZONE_NOT_IN_PARK' })]);
    });

    test('[NEGATIVE CASE] an unknown park should return 200 with a NOT_FOUND reference error', async () => {
      createRulePgFake(getPool, { park: null });
      const res = await validate(ruleInput());
      expect(res.body.data.errors).toEqual([expect.objectContaining({ field: 'parkId', code: 'NOT_FOUND' })]);
    });

    test('[NEGATIVE CASE] DC1: a duplicate should return 200 with a DUPLICATE conflict', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 21, status: 'DRAFT' })] });
      const res = await validate(ruleInput());
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ valid: false, errors: [], rule: null });
      expect(res.body.data.conflicts).toEqual([expect.objectContaining({ type: 'DUPLICATE', ruleId: 21, status: 'DRAFT' })]);
    });

    test('[NEGATIVE CASE] DC2: an active conflict should return 200 with a CONFLICT', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 22, status: 'ACTIVE', alert_priority: 'CRITICAL', activated_at: CREATED_AT })] });
      const res = await validate(ruleInput());
      expect(res.status).toBe(200);
      expect(res.body.data.conflicts).toEqual([expect.objectContaining({ type: 'CONFLICT', ruleId: 22 })]);
    });

    test('[POSITIVE CASE] DC3: a DRAFT with a different configuration should still be valid', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ status: 'DRAFT', alert_priority: 'LOW' })] });
      const res = await validate(ruleInput());
      expect(res.body.data.valid).toBe(true);
    });

    test('[POSITIVE CASE] DC4: an INACTIVE rule should be ignored', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ status: 'INACTIVE' })] });
      const res = await validate(ruleInput());
      expect(res.body.data.valid).toBe(true);
    });

    test('[POSITIVE CASE] the action may be omitted at validation time', async () => {
      createRulePgFake(getPool);
      const res = await validate(ruleInput());
      expect(res.body.data.valid).toBe(true);
      expect(res.body.data.errors).toEqual([]);
    });

    test('[NEGATIVE CASE] an invalid action, when supplied, should be reported in the validation response', async () => {
      createRulePgFake(getPool);
      const res = await validate(ruleInput({ action: 'PUBLISH' }));
      expect(res.status).toBe(200);
      expect(res.body.data.errors).toEqual([expect.objectContaining({ field: 'action', code: 'INVALID_VALUE' })]);
    });

    test.each([['no body', undefined], ['an array body', [ruleInput()]]])(
      '[NEGATIVE CASE] %s should return 400 before touching the database',
      async (_label, body) => {
        const req = request(app).post(`${BASE}/validate`).set(AUTH);
        const res = await (body === undefined ? req : req.send(body));
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'A JSON monitoring rule request body is required.' });
        expect(getPool).not.toHaveBeenCalled();
      }
    );

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      createRulePgFake(getPool, { failOn: 'SELECT id, code, name FROM public.parks' });
      const res = await validate(ruleInput());
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });

  describe('POST / (create)', () => {
    beforeEach(() => asParkManager());

    test('[POSITIVE CASE] ACTIVATE should return 201 with an ACTIVE rule', async () => {
      const db = createRulePgFake(getPool);
      const res = await create(ruleInput({ action: 'ACTIVATE' }));

      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Monitoring rule activated successfully.');
      expect(res.body.data).toMatchObject({ id: 701, status: 'ACTIVE', activatedAt: CREATED_AT, parkId: 1, riskZoneId: 2 });
      expect(db.steps().at(-1)).toBe('COMMIT');
    });

    test('[POSITIVE CASE] SAVE_DRAFT should return 201 with a DRAFT rule', async () => {
      createRulePgFake(getPool);
      const res = await create(ruleInput({ action: 'SAVE_DRAFT' }));
      expect(res.status).toBe(201);
      expect(res.body.message).toBe('Monitoring rule saved as draft.');
      expect(res.body.data).toMatchObject({ status: 'DRAFT', activatedAt: null });
    });

    test('[POSITIVE CASE] created_by should come from the authenticated user, never from the body', async () => {
      const db = createRulePgFake(getPool);
      const res = await create(ruleInput({
        action: 'SAVE_DRAFT', createdBy: OTHER_USER_ID, created_by: OTHER_USER_ID, status: 'ACTIVE', activatedAt: CREATED_AT
      }));
      expect(res.status).toBe(201);
      expect(res.body.data).toMatchObject({ createdBy: MANAGER_ID, status: 'DRAFT', activatedAt: null });
      const params = db.find('INSERT INTO public.monitoring_rules')[0].params;
      expect(params[8]).toBe(MANAGER_ID);
    });

    test.each([
      ['missing', undefined, 'REQUIRED'],
      ['invalid', 'PUBLISH', 'INVALID_VALUE']
    ])('[NEGATIVE CASE] a %s action should return 400', async (_label, action, code) => {
      const db = createRulePgFake(getPool);
      const res = await create(ruleInput({ action }));
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([expect.objectContaining({ field: 'action', code })]);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] invalid fields should return 400 with every field error', async () => {
      const db = createRulePgFake(getPool);
      const res = await create({ parkId: 1, riskZoneId: 2, action: 'ACTIVATE' });
      expect(res.status).toBe(400);
      expect(res.body.error).toBe('The monitoring rule configuration is invalid. No changes were saved.');
      expect(res.body.errors.map((e) => e.field)).toEqual(['hazardType', 'alertPriority', 'notificationRecipients', 'responseBehaviour']);
      expect(res.body).not.toHaveProperty('conflicts');
      expect(db.steps()).toEqual(['BEGIN', 'ROLLBACK']);
    });

    test('[NEGATIVE CASE] DC1: a duplicate should return 409 with the conflict list', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 31, status: 'DRAFT' })] });
      const res = await create(ruleInput({ action: 'SAVE_DRAFT' }));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([expect.objectContaining({ type: 'DUPLICATE', ruleId: 31 })]);
      expect(res.body).not.toHaveProperty('errors');
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] DC2: an active conflict should return 409', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 32, status: 'ACTIVE', response_behaviour: 'OTHER', activated_at: CREATED_AT })] });
      const res = await create(ruleInput({ action: 'ACTIVATE' }));
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([expect.objectContaining({ type: 'CONFLICT', ruleId: 32 })]);
    });

    test('[NEGATIVE CASE] a reference failure should return 400', async () => {
      createRulePgFake(getPool, { zone: null });
      const res = await create(ruleInput({ action: 'ACTIVATE' }));
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([expect.objectContaining({ field: 'riskZoneId', code: 'NOT_FOUND' })]);
    });

    test('[ERROR CASE] a 23505 unique violation should return 409 without database details', async () => {
      const uniqueViolation = Object.assign(
        new Error('duplicate key value violates unique constraint "ux_monitoring_rules_active_scope"'),
        { code: '23505' }
      );
      createRulePgFake(getPool, { failOn: 'INSERT INTO public.monitoring_rules', failWith: uniqueViolation });
      const res = await create(ruleInput({ action: 'ACTIVATE' }));
      expect(res.status).toBe(409);
      expect(res.body).toEqual({
        error: 'An ACTIVE rule already exists for this park, hazard and risk zone. No changes were saved.',
        conflicts: []
      });
      expectNoLeak(res);
    });

    test('[ERROR CASE] an unexpected database error should return a safe 500 and commit nothing', async () => {
      const db = createRulePgFake(getPool, { failOn: 'INSERT INTO public.monitoring_rules' });
      const res = await create(ruleInput({ action: 'ACTIVATE' }));
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
      expect(db.steps()).not.toContain('COMMIT');
    });

    test('[ERROR CASE] a database connection failure should return a safe 500', async () => {
      getPool.mockReturnValue({ connect: jest.fn().mockRejectedValue(new Error('ECONNREFUSED 10.0.0.1:5432')) });
      const res = await create(ruleInput({ action: 'ACTIVATE' }));
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });

    test.each([['no body', undefined], ['an array body', [ruleInput({ action: 'ACTIVATE' })]]])(
      '[NEGATIVE CASE] %s should return 400 before touching the database',
      async (_label, body) => {
        const req = request(app).post(BASE).set(AUTH);
        const res = await (body === undefined ? req : req.send(body));
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'A JSON monitoring rule request body is required.' });
        expect(getPool).not.toHaveBeenCalled();
      }
    );

    test('[POSITIVE CASE] the trailing-slash path should reach the same create endpoint', async () => {
      createRulePgFake(getPool);
      const res = await request(app).post(`${BASE}/`).set(AUTH).send(ruleInput({ action: 'SAVE_DRAFT' }));
      expect(res.status).toBe(201);
    });
  });

  describe('POST /validate with a rule ID (editing a draft)', () => {
    beforeEach(() => asParkManager());

    test('[POSITIVE CASE] the edited draft should not be a duplicate of itself', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] });
      const res = await validate(ruleInput({ ruleId: 10 }));
      expect(res.status).toBe(200);
      expect(res.body.data).toMatchObject({ valid: true, conflicts: [] });
    });

    test('[NEGATIVE CASE] another identical draft is still reported', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 }), ruleRow({ id: 11 })] });
      const res = await validate(ruleInput({ ruleId: 10 }));
      expect(res.status).toBe(200);
      expect(res.body.data.conflicts).toEqual([expect.objectContaining({ type: 'DUPLICATE', ruleId: 11 })]);
    });

    test('[NEGATIVE CASE] an invalid rule ID should return 400', async () => {
      createRulePgFake(getPool);
      const res = await validate(ruleInput({ ruleId: 'abc' }));
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Rule ID must be a positive integer.' });
    });
  });

  describe('PUT /:id (update draft)', () => {
    const update = (id, body) => request(app).put(`${BASE}/${id}`).set(AUTH).send(body);

    beforeEach(() => asParkManager());

    test('[POSITIVE CASE] should return 200 with the same rule id, still DRAFT, and no new rule', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, alert_priority: 'LOW' })] });
      const res = await update(10, ruleInput({ alertPriority: 'CRITICAL', action: 'ACTIVATE' }));

      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Draft monitoring rule updated.');
      expect(res.body.data).toMatchObject({
        id: 10, status: 'DRAFT', alertPriority: 'CRITICAL', activatedAt: null, createdBy: MANAGER_ID, updatedAt: UPDATED_AT
      });
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] an unknown rule should return 404', async () => {
      createRulePgFake(getPool, { existingRules: [] });
      const res = await update(99, ruleInput());
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Monitoring rule not found.' });
    });

    test('[NEGATIVE CASE] an ACTIVE rule should return 409', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'ACTIVE', activated_at: CREATED_AT })] });
      const res = await update(10, ruleInput());
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Only DRAFT rules can be edited/);
    });

    test('[NEGATIVE CASE] a conflict with an ACTIVE rule should return 409 with conflicts', async () => {
      createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 10 }), ruleRow({ id: 12, status: 'ACTIVE', alert_priority: 'LOW', activated_at: CREATED_AT })]
      });
      const res = await update(10, ruleInput());
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([expect.objectContaining({ type: 'CONFLICT', ruleId: 12 })]);
    });

    test('[NEGATIVE CASE] invalid fields should return 400 with errors', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] });
      const res = await update(10, ruleInput({ hazardType: '' }));
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([expect.objectContaining({ field: 'hazardType', code: 'REQUIRED' })]);
    });

    test.each(['abc', '0', '1.5', '-2'])('[NEGATIVE CASE] rule id %p should return 400', async (id) => {
      createRulePgFake(getPool);
      const res = await update(id, ruleInput());
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Rule ID must be a positive integer.' });
    });

    test.each([['no body', undefined], ['an array body', [ruleInput()]]])(
      '[NEGATIVE CASE] %s should return 400 before touching the database',
      async (_label, body) => {
        const req = request(app).put(`${BASE}/10`).set(AUTH);
        const res = await (body === undefined ? req : req.send(body));
        expect(res.status).toBe(400);
        expect(res.body).toEqual({ error: 'A JSON monitoring rule request body is required.' });
        expect(getPool).not.toHaveBeenCalled();
      }
    );

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })], failOn: 'UPDATE public.monitoring_rules' });
      const res = await update(10, ruleInput());
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });

  describe('POST /:id/activate', () => {
    const activate = (id) => request(app).post(`${BASE}/${id}/activate`).set(AUTH);

    beforeEach(() => asParkManager());

    test('[POSITIVE CASE] a DRAFT should return 200 as ACTIVE with an activation time', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] });
      const res = await activate(10);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Monitoring rule activated successfully.');
      expect(res.body.data).toMatchObject({ id: 10, status: 'ACTIVE', activatedAt: UPDATED_AT, updatedAt: UPDATED_AT });
    });

    test('[NEGATIVE CASE] an unknown rule should return 404', async () => {
      createRulePgFake(getPool, { existingRules: [] });
      const res = await activate(10);
      expect(res.status).toBe(404);
      expect(res.body).toEqual({ error: 'Monitoring rule not found.' });
    });

    test.each(['ACTIVE', 'INACTIVE'])('[NEGATIVE CASE] an %s rule should return 409', async (status) => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status, activated_at: status === 'ACTIVE' ? CREATED_AT : null })] });
      const res = await activate(10);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Only DRAFT rules can be activated/);
    });

    test('[NEGATIVE CASE] an active conflict should return 409 with conflicts', async () => {
      createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 10 }), ruleRow({ id: 12, status: 'ACTIVE', alert_priority: 'LOW', activated_at: CREATED_AT })]
      });
      const res = await activate(10);
      expect(res.status).toBe(409);
      expect(res.body.conflicts).toEqual([expect.objectContaining({ type: 'CONFLICT', ruleId: 12 })]);
    });

    test('[NEGATIVE CASE] a draft that no longer passes validation should return 400 with errors', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })], zone: null });
      const res = await activate(10);
      expect(res.status).toBe(400);
      expect(res.body.errors).toEqual([expect.objectContaining({ field: 'riskZoneId', code: 'NOT_FOUND' })]);
    });

    test('[NEGATIVE CASE] an invalid rule id should return 400', async () => {
      createRulePgFake(getPool);
      const res = await activate('abc');
      expect(res.status).toBe(400);
      expect(res.body).toEqual({ error: 'Rule ID must be a positive integer.' });
    });

    test('[ERROR CASE] a concurrent activation (23505) should return 409 without database details', async () => {
      const uniqueViolation = Object.assign(
        new Error('duplicate key value violates unique constraint "ux_monitoring_rules_active_scope"'),
        { code: '23505' }
      );
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })], failOn: 'UPDATE public.monitoring_rules', failWith: uniqueViolation });
      const res = await activate(10);
      expect(res.status).toBe(409);
      expectNoLeak(res);
    });

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })], failOn: 'UPDATE public.monitoring_rules' });
      const res = await activate(10);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });

  describe('POST /:id/deactivate', () => {
    const deactivate = (id) => request(app).post(`${BASE}/${id}/deactivate`).set(AUTH);

    beforeEach(() => asParkManager());

    test('[POSITIVE CASE] an ACTIVE rule should return 200 as INACTIVE with activatedAt null', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT })] });
      const res = await deactivate(12);
      expect(res.status).toBe(200);
      expect(res.body.message).toBe('Monitoring rule deactivated.');
      expect(res.body.data).toMatchObject({ id: 12, status: 'INACTIVE', activatedAt: null, updatedAt: UPDATED_AT, alertPriority: 'HIGH' });
    });

    test.each(['DRAFT', 'INACTIVE'])('[NEGATIVE CASE] a %s rule should return 409', async (status) => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 12, status })] });
      const res = await deactivate(12);
      expect(res.status).toBe(409);
      expect(res.body.error).toMatch(/Only ACTIVE rules can be deactivated/);
    });

    test('[NEGATIVE CASE] an unknown rule should return 404', async () => {
      createRulePgFake(getPool, { existingRules: [] });
      const res = await deactivate(12);
      expect(res.status).toBe(404);
    });

    test('[NEGATIVE CASE] an invalid rule id should return 400', async () => {
      createRulePgFake(getPool);
      const res = await deactivate('12abc');
      expect(res.status).toBe(400);
    });

    test('[ERROR CASE] a database failure should return a safe 500', async () => {
      createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT })], failOn: 'SELECT id, park_id, hazard_type'
      });
      const res = await deactivate(12);
      expect(res.status).toBe(500);
      expect(res.body).toEqual({ error: GENERIC_500 });
      expectNoLeak(res);
    });
  });
});
