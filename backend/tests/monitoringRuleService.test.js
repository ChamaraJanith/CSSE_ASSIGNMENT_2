const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const monitoringRuleService = require('../services/monitoringRuleService');
const monitoringRuleConfig = require('../utils/monitoringRuleConfig');
const {
  MANAGER_ID, HAZARD, CREATED_AT, UPDATED_AT, yalaPark, zoneRow, ruleRow, ruleInput, createSupabaseFake, createRulePgFake
} = require('./helpers/monitoringRuleFakes');

jest.mock('../supabaseClient', () => ({
  supabaseAdmin: { from: jest.fn() }
}));
jest.mock('../pgPool', () => ({ getPool: jest.fn() }));

const WRITE_OR_TRANSACTION = /^(INSERT|UPDATE|DELETE|BEGIN|COMMIT|ROLLBACK)|pg_advisory/;
const VALIDATION_READS = ['SELECT_PARK', 'SELECT_ZONE', 'SELECT_SCOPE_RULES'];
const CREATE_STEPS = ['BEGIN', 'LOCK_SCOPE', ...VALIDATION_READS, 'INSERT_RULE', 'COMMIT'];

const uniqueViolation = () => Object.assign(
  new Error('duplicate key value violates unique constraint "ux_monitoring_rules_active_scope"'),
  { code: '23505' }
);

const insertParams = (db) => db.find('INSERT INTO public.monitoring_rules')[0].params;

describe('UC04: Monitoring Rule Service', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    jest.spyOn(console, 'error').mockImplementation(() => {});
  });

  afterEach(() => {
    console.error.mockRestore();
  });

  describe('isParkManager (existing user_roles / roles convention)', () => {
    test('[POSITIVE CASE] should return true when the user has the park_manager role', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { user_roles: { data: [{ user_id: MANAGER_ID }], error: null } });
      await expect(monitoringRuleService.isParkManager(MANAGER_ID)).resolves.toBe(true);
      expect(builders.user_roles.select).toHaveBeenCalledWith('user_id, roles!inner(role_name)');
      expect(builders.user_roles.eq).toHaveBeenCalledWith('user_id', MANAGER_ID);
      expect(builders.user_roles.eq).toHaveBeenCalledWith('roles.role_name', 'park_manager');
    });

    test('[NEGATIVE CASE] should return false when the user has no park_manager role', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: [], error: null } });
      await expect(monitoringRuleService.isParkManager(MANAGER_ID)).resolves.toBe(false);
    });

    test('[EDGE CASE] should return false when no role data is returned', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: null, error: null } });
      await expect(monitoringRuleService.isParkManager(MANAGER_ID)).resolves.toBe(false);
    });

    test('[ERROR CASE] should propagate a role lookup failure', async () => {
      createSupabaseFake(supabaseAdmin, { user_roles: { data: null, error: new Error('db down') } });
      await expect(monitoringRuleService.isParkManager(MANAGER_ID)).rejects.toThrow('db down');
    });
  });

  describe('getReferenceData', () => {
    test('[POSITIVE CASE] should return the selected park, its risk zones and the configured options', async () => {
      const builders = createSupabaseFake(supabaseAdmin, {
        parks: { data: yalaPark, error: null },
        risk_zones: {
          data: [
            zoneRow({
              id: 1, zone_code: 'RZ-YALA-01', zone_name: 'Northern River Basin Buffer', severity_level: 'CRITICAL',
              primary_threat: 'Poaching & Wire Snares near River Crossing', center_lat: 6.4128, center_lng: 81.5342, radius_km: 3.2
            }),
            zoneRow()
          ],
          error: null
        }
      });

      const result = await monitoringRuleService.getReferenceData(1);

      expect(result.park).toEqual({ id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' });
      expect(result.riskZones).toEqual([
        {
          id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer', severityLevel: 'CRITICAL',
          primaryThreat: 'Poaching & Wire Snares near River Crossing', centerLat: 6.4128, centerLng: 81.5342, radiusKm: 3.2
        },
        {
          id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary', severityLevel: 'HIGH',
          primaryThreat: 'Elephant Crop Raiding & Fence Breaches', centerLat: 6.3845, centerLng: 81.487, radiusKm: 2.8
        }
      ]);
      expect(result.options).toEqual({
        hazardTypes: monitoringRuleConfig.HAZARD_TYPES,
        alertPriorities: monitoringRuleConfig.ALERT_PRIORITIES,
        recipientRoles: monitoringRuleConfig.RECIPIENT_ROLES,
        responseBehaviours: monitoringRuleConfig.RESPONSE_BEHAVIOURS
      });
      expect(builders.parks.eq).toHaveBeenCalledWith('id', 1);
      expect(builders.risk_zones.eq).toHaveBeenCalledWith('park_id', 1);
      expect(builders.risk_zones.order).toHaveBeenCalledWith('zone_code', { ascending: true });
    });

    test('[POSITIVE CASE] should select the zone centre and radius columns', async () => {
      const builders = createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, risk_zones: { data: [zoneRow()], error: null } });
      await monitoringRuleService.getReferenceData(1);

      const columns = builders.risk_zones.select.mock.calls[0][0].split(',').map((column) => column.trim());
      expect(columns).toEqual(expect.arrayContaining(['center_lat', 'center_lng', 'radius_km']));
    });

    test('[POSITIVE CASE] NUMERIC coordinates returned as strings should be converted to numbers', async () => {
      createSupabaseFake(supabaseAdmin, {
        parks: { data: yalaPark, error: null },
        risk_zones: { data: [zoneRow({ center_lat: '8.492000', center_lng: '80.035000', radius_km: '3.50' })], error: null }
      });

      const { riskZones: [zone] } = await monitoringRuleService.getReferenceData(1);

      expect(zone).toMatchObject({ centerLat: 8.492, centerLng: 80.035, radiusKm: 3.5 });
    });

    test.each([
      ['null', null],
      ['missing', undefined],
      ['blank', '  '],
      ['non-numeric', 'abc']
    ])('[EDGE CASE] a %s radius should be returned as null, never invented or 0', async (_label, radius) => {
      createSupabaseFake(supabaseAdmin, {
        parks: { data: yalaPark, error: null },
        risk_zones: { data: [zoneRow({ radius_km: radius })], error: null }
      });

      const { riskZones: [zone] } = await monitoringRuleService.getReferenceData(1);

      expect(zone.radiusKm).toBeNull();
      expect(zone).toMatchObject({ centerLat: 6.3845, centerLng: 81.487 });
    });

    test('[EDGE CASE] missing or invalid centre coordinates should be returned as null', async () => {
      createSupabaseFake(supabaseAdmin, {
        parks: { data: yalaPark, error: null },
        risk_zones: { data: [zoneRow({ center_lat: null, center_lng: 'NaN' })], error: null }
      });

      const { riskZones: [zone] } = await monitoringRuleService.getReferenceData(1);

      expect(zone).toMatchObject({ centerLat: null, centerLng: null, radiusKm: 2.8 });
    });

    test('[EDGE CASE] a park with no risk zones should return an empty zone list', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, risk_zones: { data: [], error: null } });
      await expect(monitoringRuleService.getReferenceData(1)).resolves.toMatchObject({ riskZones: [] });
    });

    test('[EDGE CASE] a null zone result should be treated as no risk zones', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, risk_zones: { data: null, error: null } });
      await expect(monitoringRuleService.getReferenceData(1)).resolves.toMatchObject({ riskZones: [] });
    });

    test('[NEGATIVE CASE] an unknown park should be rejected with 404 before zones are read', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: null, error: null } });
      await expect(monitoringRuleService.getReferenceData(99)).rejects.toMatchObject({ status: 404, message: 'Park not found.' });
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith('risk_zones');
    });

    test.each([0, -1, 1.5, '1', undefined, null, NaN])('[NEGATIVE CASE] park id %p should be rejected with 400', async (parkId) => {
      await expect(monitoringRuleService.getReferenceData(parkId)).rejects.toMatchObject({ status: 400 });
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    test('[ERROR CASE] a park lookup failure should propagate', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: null, error: new Error('parks unavailable') } });
      await expect(monitoringRuleService.getReferenceData(1)).rejects.toThrow('parks unavailable');
    });

    test('[ERROR CASE] a risk zone lookup failure should propagate', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, risk_zones: { data: null, error: new Error('zones unavailable') } });
      await expect(monitoringRuleService.getReferenceData(1)).rejects.toThrow('zones unavailable');
    });
  });

  describe('listRules', () => {
    test('[POSITIVE CASE] should return the park rules mapped to camelCase, newest first', async () => {
      const builders = createSupabaseFake(supabaseAdmin, {
        parks: { data: yalaPark, error: null },
        monitoring_rules: {
          data: [
            ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT, risk_zones: { id: 2, zone_code: 'RZ-YALA-02', zone_name: 'Katagamuwa Sanctuary Boundary' } }),
            ruleRow({ id: 11, risk_zones: null })
          ],
          error: null
        }
      });

      const rules = await monitoringRuleService.listRules(1);

      expect(rules).toHaveLength(2);
      expect(rules[0]).toEqual({
        id: 12,
        parkId: 1,
        hazardType: HAZARD,
        riskZoneId: 2,
        riskZone: { id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary' },
        alertPriority: 'HIGH',
        notificationRecipients: ['park_manager', 'wildlife_officer'],
        responseBehaviour: expect.any(String),
        notes: null,
        status: 'ACTIVE',
        createdBy: MANAGER_ID,
        activatedAt: CREATED_AT,
        createdAt: CREATED_AT,
        updatedAt: CREATED_AT
      });
      expect(rules[1]).toMatchObject({ id: 11, status: 'DRAFT', riskZone: null, activatedAt: null });
      expect(builders.monitoring_rules.eq).toHaveBeenCalledWith('park_id', 1);
      expect(builders.monitoring_rules.order.mock.calls).toEqual([
        ['created_at', { ascending: false }],
        ['id', { ascending: false }]
      ]);
    });

    test.each([[[]], [null]])('[EDGE CASE] no rules (%p) should return an empty list', async (data) => {
      createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, monitoring_rules: { data, error: null } });
      await expect(monitoringRuleService.listRules(1)).resolves.toEqual([]);
    });

    test('[NEGATIVE CASE] an unknown park should be rejected with 404', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: null, error: null } });
      await expect(monitoringRuleService.listRules(42)).rejects.toMatchObject({ status: 404 });
      expect(supabaseAdmin.from).not.toHaveBeenCalledWith('monitoring_rules');
    });

    test.each([0, -2, 'abc', undefined])('[NEGATIVE CASE] park id %p should be rejected with 400', async (parkId) => {
      await expect(monitoringRuleService.listRules(parkId)).rejects.toMatchObject({ status: 400 });
      expect(supabaseAdmin.from).not.toHaveBeenCalled();
    });

    test('[ERROR CASE] a rule lookup failure should propagate', async () => {
      createSupabaseFake(supabaseAdmin, { parks: { data: yalaPark, error: null }, monitoring_rules: { data: null, error: new Error('rules unavailable') } });
      await expect(monitoringRuleService.listRules(1)).rejects.toThrow('rules unavailable');
    });
  });

  describe('validateRule (dry run)', () => {
    test('[POSITIVE CASE] a completely valid configuration should pass with the normalised rule', async () => {
      const db = createRulePgFake(getPool);
      const result = await monitoringRuleService.validateRule(ruleInput());

      expect(result).toEqual({
        valid: true,
        errors: [],
        conflicts: [],
        rule: {
          parkId: 1,
          hazardType: HAZARD,
          riskZoneId: 2,
          alertPriority: 'HIGH',
          notificationRecipients: ['park_manager', 'wildlife_officer'],
          responseBehaviour: expect.any(String),
          notes: 'Snare lines reported near the fence'
        }
      });
      expect(db.steps()).toEqual(VALIDATION_READS);
    });

    test('[POSITIVE CASE] should read only DRAFT and ACTIVE rules in the park + hazard + zone scope', async () => {
      const db = createRulePgFake(getPool);
      await monitoringRuleService.validateRule(ruleInput());
      expect(db.find('SELECT id, park_id, hazard_type')[0].params).toEqual([1, HAZARD, 2, ['DRAFT', 'ACTIVE']]);
    });

    test('[NEGATIVE CASE] a missing required field should return REQUIRED without any database read', async () => {
      const db = createRulePgFake(getPool);
      const input = ruleInput();
      delete input.hazardType;

      const result = await monitoringRuleService.validateRule(input);

      expect(result.valid).toBe(false);
      expect(result.rule).toBeNull();
      expect(result.errors).toEqual([expect.objectContaining({ field: 'hazardType', code: 'REQUIRED' })]);
      expect(db.statements).toHaveLength(0);
    });

    test('[NEGATIVE CASE] multiple invalid fields should be returned together', async () => {
      createRulePgFake(getPool);
      const result = await monitoringRuleService.validateRule({ parkId: '1', riskZoneId: 0, notificationRecipients: [] });
      expect(result.errors.map(({ field, code }) => ({ field, code }))).toEqual([
        { field: 'parkId', code: 'INVALID_TYPE' },
        { field: 'hazardType', code: 'REQUIRED' },
        { field: 'riskZoneId', code: 'INVALID_VALUE' },
        { field: 'alertPriority', code: 'REQUIRED' },
        { field: 'notificationRecipients', code: 'REQUIRED' },
        { field: 'responseBehaviour', code: 'REQUIRED' }
      ]);
    });

    test.each([
      ['hazardType', { hazardType: 'NOT_A_HAZARD' }],
      ['alertPriority', { alertPriority: 'URGENT' }],
      ['notificationRecipients', { notificationRecipients: ['park_manager', 'tourist'] }],
      ['responseBehaviour', { responseBehaviour: 'NOT_A_RESPONSE' }]
    ])('[NEGATIVE CASE] an invalid %s should return INVALID_VALUE', async (field, overrides) => {
      const db = createRulePgFake(getPool);
      const result = await monitoringRuleService.validateRule(ruleInput(overrides));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([expect.objectContaining({ field, code: 'INVALID_VALUE' })]);
      expect(db.statements).toHaveLength(0);
    });

    test('[NEGATIVE CASE] an unknown park should return NOT_FOUND and skip conflict detection', async () => {
      const db = createRulePgFake(getPool, { park: null });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([expect.objectContaining({ field: 'parkId', code: 'NOT_FOUND' })]);
      expect(db.steps()).toEqual(['SELECT_PARK', 'SELECT_ZONE']);
    });

    test('[NEGATIVE CASE] an unknown risk zone should return NOT_FOUND', async () => {
      createRulePgFake(getPool, { zone: null });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.errors).toEqual([expect.objectContaining({ field: 'riskZoneId', code: 'NOT_FOUND' })]);
    });

    test('[NEGATIVE CASE] a risk zone belonging to another park should return ZONE_NOT_IN_PARK', async () => {
      const db = createRulePgFake(getPool, { zone: zoneRow({ id: 5, park_id: 2, zone_code: 'RZ-WILP-01' }) });
      const result = await monitoringRuleService.validateRule(ruleInput({ riskZoneId: 5 }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([expect.objectContaining({ field: 'riskZoneId', code: 'ZONE_NOT_IN_PARK' })]);
      expect(db.steps()).not.toContain('SELECT_SCOPE_RULES');
    });

    test('[NEGATIVE CASE] DC1: an identical DRAFT rule should be reported as a DUPLICATE', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 31, status: 'DRAFT' })] });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.valid).toBe(false);
      expect(result.rule).toBeNull();
      expect(result.errors).toEqual([]);
      expect(result.conflicts).toEqual([expect.objectContaining({ type: 'DUPLICATE', ruleId: 31, status: 'DRAFT' })]);
    });

    test('[NEGATIVE CASE] DC2: an ACTIVE rule with a different configuration should be reported as a CONFLICT', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 32, status: 'ACTIVE', alert_priority: 'CRITICAL', activated_at: CREATED_AT })] });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.valid).toBe(false);
      expect(result.conflicts).toEqual([expect.objectContaining({ type: 'CONFLICT', ruleId: 32, status: 'ACTIVE' })]);
    });

    test('[POSITIVE CASE] DC3: a DRAFT rule with a different configuration should be allowed', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 33, status: 'DRAFT', alert_priority: 'LOW' })] });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.valid).toBe(true);
      expect(result.conflicts).toEqual([]);
    });

    test('[POSITIVE CASE] DC4: an INACTIVE rule should be ignored', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 34, status: 'INACTIVE' })] });
      const result = await monitoringRuleService.validateRule(ruleInput());
      expect(result.valid).toBe(true);
    });

    test('[POSITIVE CASE] dry run should never write, lock or open a transaction', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ status: 'ACTIVE', activated_at: CREATED_AT })] });
      await monitoringRuleService.validateRule(ruleInput());
      await monitoringRuleService.validateRule(ruleInput({ alertPriority: 'LOW' }));
      expect(db.statements.length).toBeGreaterThan(0);
      db.statements.forEach(({ sql }) => expect(sql).not.toMatch(WRITE_OR_TRANSACTION));
      expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('[EDGE CASE] the caller input should not be mutated', async () => {
      createRulePgFake(getPool);
      const input = ruleInput({ notificationRecipients: ['wildlife_officer', 'park_manager', 'wildlife_officer'] });
      const snapshot = JSON.parse(JSON.stringify(input));
      await monitoringRuleService.validateRule(input);
      expect(input).toEqual(snapshot);
    });

    test('[POSITIVE CASE] the final action is optional at validation time', async () => {
      createRulePgFake(getPool);
      await expect(monitoringRuleService.validateRule(ruleInput())).resolves.toMatchObject({ valid: true });
      await expect(monitoringRuleService.validateRule(ruleInput({ action: 'SAVE_DRAFT' }))).resolves.toMatchObject({ valid: true });
    });

    test('[NEGATIVE CASE] an invalid action, when sent, should be reported', async () => {
      createRulePgFake(getPool);
      const result = await monitoringRuleService.validateRule(ruleInput({ action: 'PUBLISH' }));
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([expect.objectContaining({ field: 'action', code: 'INVALID_VALUE' })]);
    });

    test.each([null, 'text'])('[EDGE CASE] non-object input %p should report the mandatory fields', async (input) => {
      createRulePgFake(getPool);
      const result = await monitoringRuleService.validateRule(input);
      expect(result.valid).toBe(false);
      expect(result.errors).toHaveLength(6);
    });

    test('[ERROR CASE] a database failure should return a safe 500 without internal details', async () => {
      createRulePgFake(getPool, { failOn: 'SELECT id, park_id, zone_code' });
      const promise = monitoringRuleService.validateRule(ruleInput());
      await expect(promise).rejects.toMatchObject({ status: 500, message: 'Failed to validate the monitoring rule.' });
      await expect(promise).rejects.not.toThrow(/relation/);
      expect(console.error).toHaveBeenCalled();
    });
  });

  describe('createRule transaction', () => {
    test('[POSITIVE CASE] ACTIVATE should create an ACTIVE rule with activated_at and commit', async () => {
      const db = createRulePgFake(getPool);

      const created = await monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);

      expect(db.steps()).toEqual(CREATE_STEPS);
      expect(created).toMatchObject({ id: 701, status: 'ACTIVE', activatedAt: CREATED_AT, createdBy: MANAGER_ID, parkId: 1, riskZoneId: 2 });
      const params = insertParams(db);
      expect(params[7]).toBe('ACTIVE');
      expect(params[9]).toBe(true);
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[POSITIVE CASE] SAVE_DRAFT should create a DRAFT rule with activated_at NULL and commit', async () => {
      const db = createRulePgFake(getPool);

      const created = await monitoringRuleService.createRule(ruleInput({ action: 'SAVE_DRAFT' }), MANAGER_ID);

      expect(db.steps()).toEqual(CREATE_STEPS);
      expect(created).toMatchObject({ status: 'DRAFT', activatedAt: null });
      const params = insertParams(db);
      expect(params[7]).toBe('DRAFT');
      expect(params[9]).toBe(false);
    });

    test('[POSITIVE CASE] should insert the normalised rule with created_by set to the authenticated user', async () => {
      const db = createRulePgFake(getPool);
      await monitoringRuleService.createRule(
        ruleInput({ action: 'SAVE_DRAFT', notificationRecipients: ['wildlife_officer', 'park_manager', 'wildlife_officer'] }),
        MANAGER_ID
      );
      expect(insertParams(db)).toEqual([
        1, HAZARD, 2, 'HIGH', JSON.stringify(['park_manager', 'wildlife_officer']), expect.any(String),
        'Snare lines reported near the fence', 'DRAFT', MANAGER_ID, false
      ]);
    });

    test('[POSITIVE CASE] DC3: a DRAFT with a different configuration in the same scope should not block creation', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ status: 'DRAFT', alert_priority: 'LOW' })] });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .resolves.toMatchObject({ status: 'ACTIVE' });
      expect(db.steps()).toEqual(CREATE_STEPS);
    });

    test('[POSITIVE CASE] DC4: an INACTIVE rule in the same scope should not block creation', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ status: 'INACTIVE' })] });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .resolves.toMatchObject({ status: 'ACTIVE' });
    });

    test('[POSITIVE CASE] the advisory lock should be taken for the park + hazard + zone scope', async () => {
      const db = createRulePgFake(getPool);
      await monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);
      expect(db.find('SELECT pg_advisory_xact_lock')).toEqual([
        { sql: 'SELECT pg_advisory_xact_lock(hashtext($1))', params: [`monitoring_rule:1:${HAZARD}:2`] }
      ]);
    });

    test('[NEGATIVE CASE] a missing authenticated user should be rejected before any database access', async () => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), null)).rejects.toMatchObject({ status: 401 });
      expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] invalid fields should roll back with 400 and all field errors, without locking', async () => {
      const db = createRulePgFake(getPool);
      const promise = monitoringRuleService.createRule({ parkId: 1, action: 'ACTIVATE' }, MANAGER_ID);
      await expect(promise).rejects.toMatchObject({ status: 400 });
      await promise.catch((err) => {
        expect(err.errors.map((e) => e.field)).toEqual(['hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour']);
      });
      expect(db.steps()).toEqual(['BEGIN', 'ROLLBACK']);
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['missing', undefined, 'REQUIRED'],
      ['unknown', 'PUBLISH', 'INVALID_VALUE']
    ])('[NEGATIVE CASE] a %s action should roll back with 400', async (_label, action, code) => {
      const db = createRulePgFake(getPool);
      const promise = monitoringRuleService.createRule(ruleInput({ action }), MANAGER_ID);
      await expect(promise).rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ field: 'action', code })] });
      expect(db.steps()).not.toContain('INSERT_RULE');
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[NEGATIVE CASE] DC1: a duplicate should roll back with 409 and never insert', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 41, status: 'ACTIVE', activated_at: CREATED_AT })] });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'SAVE_DRAFT' }), MANAGER_ID)).rejects.toMatchObject({
        status: 409,
        conflicts: [expect.objectContaining({ type: 'DUPLICATE', ruleId: 41 })]
      });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_SCOPE', ...VALIDATION_READS, 'ROLLBACK']);
    });

    test.each(['ACTIVATE', 'SAVE_DRAFT'])('[NEGATIVE CASE] DC2: an active conflict should block %s with 409', async (action) => {
      const db = createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 42, status: 'ACTIVE', response_behaviour: 'OTHER', activated_at: CREATED_AT })]
      });
      await expect(monitoringRuleService.createRule(ruleInput({ action }), MANAGER_ID)).rejects.toMatchObject({
        status: 409,
        conflicts: [expect.objectContaining({ type: 'CONFLICT', ruleId: 42 })]
      });
      expect(db.steps()).not.toContain('INSERT_RULE');
      expect(db.steps()).not.toContain('COMMIT');
    });

    test('[NEGATIVE CASE] a risk zone from another park should roll back with 400 before reading rules', async () => {
      const db = createRulePgFake(getPool, { zone: zoneRow({ id: 5, park_id: 2 }) });
      await expect(monitoringRuleService.createRule(ruleInput({ riskZoneId: 5, action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ code: 'ZONE_NOT_IN_PARK' })] });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_SCOPE', 'SELECT_PARK', 'SELECT_ZONE', 'ROLLBACK']);
    });

    test('[NEGATIVE CASE] an unknown park should roll back with 400 NOT_FOUND', async () => {
      const db = createRulePgFake(getPool, { park: null });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ field: 'parkId', code: 'NOT_FOUND' })] });
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[ERROR CASE] SQLSTATE 23505 from the active-scope index should roll back and become 409', async () => {
      const db = createRulePgFake(getPool, { failOn: 'INSERT INTO public.monitoring_rules', failWith: uniqueViolation() });
      const promise = monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);
      await expect(promise).rejects.toMatchObject({ status: 409, conflicts: [] });
      await expect(promise).rejects.not.toThrow(/ux_monitoring_rules_active_scope|duplicate key/);
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_SCOPE', ...VALIDATION_READS, 'INSERT_RULE', 'ROLLBACK']);
    });

    test('[ERROR CASE] an unexpected insert failure should roll back and return a safe 500', async () => {
      const db = createRulePgFake(getPool, { failOn: 'INSERT INTO public.monitoring_rules' });
      const promise = monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);
      await expect(promise).rejects.toMatchObject({ status: 500, message: 'Failed to save the monitoring rule. No changes were saved.' });
      await expect(promise).rejects.not.toThrow(/relation/);
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_SCOPE', ...VALIDATION_READS, 'INSERT_RULE', 'ROLLBACK']);
      expect(console.error).toHaveBeenCalled();
    });

    test.each([
      ['acquiring the lock', 'SELECT pg_advisory_xact_lock', ['BEGIN', 'LOCK_SCOPE', 'ROLLBACK']],
      ['reading existing rules', 'SELECT id, park_id, hazard_type', ['BEGIN', 'LOCK_SCOPE', ...VALIDATION_READS, 'ROLLBACK']],
      ['committing', 'COMMIT', [...CREATE_STEPS, 'ROLLBACK']]
    ])('[ERROR CASE] a failure while %s should roll back with a safe 500', async (_label, failOn, steps) => {
      const db = createRulePgFake(getPool, { failOn });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID)).rejects.toMatchObject({ status: 500 });
      expect(db.steps()).toEqual(steps);
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[ERROR CASE] should release the connection even when rollback itself fails', async () => {
      const db = createRulePgFake(getPool, { failOn: 'INSERT INTO public.monitoring_rules' });
      const originalQuery = db.client.query.getMockImplementation();
      db.client.query.mockImplementation(async (text, params) => {
        if (text.trim() === 'ROLLBACK') throw new Error('connection lost');
        return originalQuery(text, params);
      });
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID)).rejects.toMatchObject({ status: 500 });
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[EDGE CASE] the caller input should not be mutated', async () => {
      createRulePgFake(getPool);
      const input = ruleInput({ action: 'ACTIVATE' });
      const snapshot = JSON.parse(JSON.stringify(input));
      await monitoringRuleService.createRule(input, MANAGER_ID);
      expect(input).toEqual(snapshot);
    });
  });

  describe('Transaction and concurrency behaviour', () => {
    test('[EDGE CASE] a successful /validate is not trusted: a rule activated afterwards still blocks creation', async () => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.validateRule(ruleInput())).resolves.toMatchObject({ valid: true });

      // Another Park Manager activates a different configuration for the same scope in the meantime
      db.state.existingRules.push(ruleRow({ id: 50, status: 'ACTIVE', alert_priority: 'CRITICAL', activated_at: CREATED_AT }));

      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'CONFLICT', ruleId: 50 })] });
      expect(db.find('INSERT INTO public.monitoring_rules')).toHaveLength(0);
    });

    test('[EDGE CASE] a park or zone change after /validate is caught by the in-transaction re-check', async () => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.validateRule(ruleInput())).resolves.toMatchObject({ valid: true });
      db.state.zone = null;
      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ field: 'riskZoneId', code: 'NOT_FOUND' })] });
    });

    test('[POSITIVE CASE] all validation reads happen inside the transaction while the scope lock is held', async () => {
      const db = createRulePgFake(getPool);
      await monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);
      const steps = db.steps();
      const lockIndex = steps.indexOf('LOCK_SCOPE');
      expect(steps.indexOf('BEGIN')).toBe(0);
      expect(lockIndex).toBe(1);
      VALIDATION_READS.forEach((step) => expect(steps.indexOf(step)).toBeGreaterThan(lockIndex));
      expect(steps.indexOf('INSERT_RULE')).toBeGreaterThan(steps.indexOf('SELECT_SCOPE_RULES'));
      expect(steps.at(-1)).toBe('COMMIT');
    });

    test('[POSITIVE CASE] existing rules are re-read inside the transaction on every create', async () => {
      const db = createRulePgFake(getPool);
      await monitoringRuleService.validateRule(ruleInput());
      await monitoringRuleService.createRule(ruleInput({ action: 'SAVE_DRAFT' }), MANAGER_ID);
      expect(db.find('SELECT id, park_id, hazard_type')).toHaveLength(2);
      expect(db.steps().slice(3)).toEqual(CREATE_STEPS);
    });

    test('[EDGE CASE] a second identical create is blocked as a duplicate of the first', async () => {
      const db = createRulePgFake(getPool);
      const created = await monitoringRuleService.createRule(ruleInput({ action: 'SAVE_DRAFT' }), MANAGER_ID);
      db.state.existingRules.push(ruleRow({ id: created.id, status: 'DRAFT' }));

      await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'DUPLICATE', ruleId: 701 })] });
      expect(db.find('INSERT INTO public.monitoring_rules')).toHaveLength(1);
    });

    test('[POSITIVE CASE] failed transactions never commit and never leave a partial insert', async () => {
      const scenarios = [
        { existingRules: [ruleRow({ status: 'DRAFT' })] },
        { zone: zoneRow({ park_id: 3 }) },
        { failOn: 'INSERT INTO public.monitoring_rules' },
        { failOn: 'INSERT INTO public.monitoring_rules', failWith: uniqueViolation() }
      ];
      for (const options of scenarios) {
        const db = createRulePgFake(getPool, options);
        await expect(monitoringRuleService.createRule(ruleInput({ action: 'ACTIVATE' }), MANAGER_ID)).rejects.toBeDefined();
        expect(db.steps()).not.toContain('COMMIT');
        expect(db.steps().at(-1)).toBe('ROLLBACK');
        expect(db.client.release).toHaveBeenCalledTimes(1);
      }
    });
  });

  describe('validateRule with an optional rule ID (editing a saved draft)', () => {
    test('[POSITIVE CASE] the draft being edited should not be reported as a duplicate of itself', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      await expect(monitoringRuleService.validateRule(ruleInput({ ruleId: 10 })))
        .resolves.toMatchObject({ valid: true, conflicts: [] });
      expect(db.steps()).toEqual(VALIDATION_READS);
    });

    test('[NEGATIVE CASE] without the rule ID the same draft is a duplicate (self-exclusion only by id)', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      await expect(monitoringRuleService.validateRule(ruleInput()))
        .resolves.toMatchObject({ valid: false, conflicts: [expect.objectContaining({ type: 'DUPLICATE', ruleId: 10 })] });
    });

    test('[NEGATIVE CASE] other duplicates and active conflicts are still reported', async () => {
      createRulePgFake(getPool, {
        existingRules: [
          ruleRow({ id: 10, status: 'DRAFT' }),
          ruleRow({ id: 11, status: 'DRAFT' }),
          ruleRow({ id: 12, status: 'ACTIVE', alert_priority: 'LOW', activated_at: CREATED_AT })
        ]
      });
      const result = await monitoringRuleService.validateRule(ruleInput({ ruleId: 10 }));
      expect(result.valid).toBe(false);
      expect(result.conflicts.map((c) => [c.type, c.ruleId])).toEqual([['DUPLICATE', 11], ['CONFLICT', 12]]);
    });

    test('[EDGE CASE] a null rule ID should be treated as a new rule', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      await expect(monitoringRuleService.validateRule(ruleInput({ ruleId: null })))
        .resolves.toMatchObject({ valid: false, conflicts: [expect.objectContaining({ ruleId: 10 })] });
    });

    test.each(['10', 0, -3, 1.5, true, {}])('[NEGATIVE CASE] an invalid rule ID %p should be rejected with 400 before any read', async (ruleId) => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.validateRule(ruleInput({ ruleId })))
        .rejects.toMatchObject({ status: 400, message: 'Rule ID must be a positive integer.' });
      expect(db.statements).toHaveLength(0);
    });
  });

  describe('updateDraft (PUT /:id)', () => {
    const UPDATE_STEPS = ['BEGIN', 'LOCK_RULE', 'LOCK_SCOPE', ...VALIDATION_READS, 'UPDATE_CONFIGURATION', 'COMMIT'];
    const draft = (overrides = {}) => ruleRow({ id: 10, status: 'DRAFT', alert_priority: 'LOW', ...overrides });

    test('[POSITIVE CASE] should update the draft in place, keeping its id, creator, creation time and DRAFT status', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      const updated = await monitoringRuleService.updateDraft(10, ruleInput({ alertPriority: 'CRITICAL' }), MANAGER_ID);

      expect(updated).toMatchObject({
        id: 10, status: 'DRAFT', alertPriority: 'CRITICAL', activatedAt: null,
        createdBy: MANAGER_ID, createdAt: CREATED_AT, updatedAt: UPDATED_AT,
        notificationRecipients: ['park_manager', 'wildlife_officer'], notes: 'Snare lines reported near the fence'
      });
      expect(db.steps()).toEqual(UPDATE_STEPS);
      expect(db.find('INSERT')).toHaveLength(0);
      expect(db.state.existingRules).toHaveLength(1);
    });

    test('[POSITIVE CASE] the UPDATE only changes configuration columns and updated_at', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      await monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID);
      const [update] = db.find('UPDATE public.monitoring_rules');

      expect(update.sql).toMatch(/updated_at = NOW\(\)/);
      expect(update.sql).toMatch(/WHERE id = \$1/);
      const setClause = update.sql.split('RETURNING')[0];
      expect(setClause).not.toMatch(/created_by|created_at|park_id|status|activated_at/);
      expect(update.params).toEqual([
        10, HAZARD, 2, 'HIGH', JSON.stringify(['park_manager', 'wildlife_officer']), expect.any(String),
        'Snare lines reported near the fence'
      ]);
    });

    test('[POSITIVE CASE] the response behaviour of a draft can be changed and is stored', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft({ response_behaviour: 'NOTIFY_RECIPIENTS' })] });
      const updated = await monitoringRuleService.updateDraft(10, ruleInput({ responseBehaviour: 'NOTIFY_AND_ESCALATE' }), MANAGER_ID);

      expect(updated).toMatchObject({ id: 10, status: 'DRAFT', responseBehaviour: 'NOTIFY_AND_ESCALATE' });
      expect(db.find('UPDATE public.monitoring_rules')[0].params[5]).toBe('NOTIFY_AND_ESCALATE');
    });

    test('[POSITIVE CASE] a draft saved with the retired PLACEHOLDER_RESPONSE can be edited to a current behaviour', async () => {
      createRulePgFake(getPool, { existingRules: [draft({ response_behaviour: 'PLACEHOLDER_RESPONSE' })] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput({ responseBehaviour: 'PLACEHOLDER_RESPONSE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ field: 'responseBehaviour', code: 'INVALID_VALUE' })] });

      const updated = await monitoringRuleService.updateDraft(10, ruleInput({ responseBehaviour: 'CREATE_INCIDENT' }), MANAGER_ID);
      expect(updated.responseBehaviour).toBe('CREATE_INCIDENT');
    });

    test('[POSITIVE CASE] saving an unchanged draft should not conflict with itself', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID)).resolves.toMatchObject({ id: 10 });
    });

    test('[POSITIVE CASE] an edit by another Park Manager keeps the original creator', async () => {
      createRulePgFake(getPool, { existingRules: [draft()] });
      const updated = await monitoringRuleService.updateDraft(10, ruleInput(), 'dddddddd-0000-0000-0000-000000000005');
      expect(updated.createdBy).toBe(MANAGER_ID);
    });

    test('[EDGE CASE] an action in the body should be ignored: the rule stays a DRAFT', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      const updated = await monitoringRuleService.updateDraft(10, ruleInput({ action: 'ACTIVATE' }), MANAGER_ID);
      expect(updated).toMatchObject({ status: 'DRAFT', activatedAt: null });
      expect(db.steps()).not.toContain('UPDATE_STATUS');
    });

    test('[POSITIVE CASE] the scope lock should be taken for the new hazard after the row lock', async () => {
      const otherHazard = monitoringRuleConfig.HAZARD_TYPES[1].value;
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      await monitoringRuleService.updateDraft(10, ruleInput({ hazardType: otherHazard }), MANAGER_ID);
      expect(db.find('SELECT pg_advisory_xact_lock')[0].params).toEqual([`monitoring_rule:1:${otherHazard}:2`]);
      expect(db.steps().indexOf('LOCK_RULE')).toBeLessThan(db.steps().indexOf('LOCK_SCOPE'));
    });

    test('[NEGATIVE CASE] an unknown rule should return 404 and roll back', async () => {
      const db = createRulePgFake(getPool, { existingRules: [] });
      await expect(monitoringRuleService.updateDraft(99, ruleInput(), MANAGER_ID))
        .rejects.toMatchObject({ status: 404, message: 'Monitoring rule not found.' });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_RULE', 'ROLLBACK']);
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test.each([
      ['ACTIVE', { activated_at: CREATED_AT }],
      ['INACTIVE', {}]
    ])('[NEGATIVE CASE] an %s rule should not be editable (409)', async (status, extra) => {
      const db = createRulePgFake(getPool, { existingRules: [draft({ status, ...extra })] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID))
        .rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Only DRAFT rules can be edited/) });
      expect(db.find('UPDATE')).toHaveLength(0);
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[NEGATIVE CASE] invalid fields should return 400 with every error and no UPDATE', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      const promise = monitoringRuleService.updateDraft(10, ruleInput({ alertPriority: 'URGENT', notificationRecipients: [] }), MANAGER_ID);
      await expect(promise).rejects.toMatchObject({
        status: 400,
        errors: [
          expect.objectContaining({ field: 'alertPriority', code: 'INVALID_VALUE' }),
          expect.objectContaining({ field: 'notificationRecipients', code: 'REQUIRED' })
        ]
      });
      expect(db.find('UPDATE')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] moving a saved rule to another park should be rejected with 400', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput({ parkId: 2 }), MANAGER_ID))
        .rejects.toMatchObject({
          status: 400,
          errors: expect.arrayContaining([expect.objectContaining({ field: 'parkId', code: 'INVALID_VALUE' })])
        });
      expect(db.find('UPDATE')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] DC1: an identical other draft should block the edit with 409', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft(), ruleRow({ id: 11, status: 'DRAFT' })] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'DUPLICATE', ruleId: 11 })] });
      expect(db.find('UPDATE')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] DC2: an ACTIVE rule with a different configuration should block the edit with 409', async () => {
      createRulePgFake(getPool, {
        existingRules: [draft(), ruleRow({ id: 12, status: 'ACTIVE', alert_priority: 'MEDIUM', activated_at: CREATED_AT })]
      });
      await expect(monitoringRuleService.updateDraft(10, ruleInput({ alertPriority: 'CRITICAL' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'CONFLICT', ruleId: 12 })] });
    });

    test.each(['10', 0, -1, 2.5, null])('[NEGATIVE CASE] an invalid rule ID %p should return 400 without a transaction', async (ruleId) => {
      const db = createRulePgFake(getPool, { existingRules: [draft()] });
      await expect(monitoringRuleService.updateDraft(ruleId, ruleInput(), MANAGER_ID))
        .rejects.toMatchObject({ status: 400, message: 'Rule ID must be a positive integer.' });
      expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] a missing user should return 401', async () => {
      createRulePgFake(getPool, { existingRules: [draft()] });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), null)).rejects.toMatchObject({ status: 401 });
    });

    test('[ERROR CASE] a database failure should roll back and return a safe 500', async () => {
      const db = createRulePgFake(getPool, { existingRules: [draft()], failOn: 'UPDATE public.monitoring_rules' });
      const promise = monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID);
      await expect(promise).rejects.toMatchObject({ status: 500, message: 'Failed to update the draft monitoring rule. No changes were saved.' });
      await promise.catch((err) => expect(err.message).not.toMatch(/relation|internal/));
      expect(db.steps().at(-1)).toBe('ROLLBACK');
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });
  });

  describe('activateRule (POST /:id/activate)', () => {
    const ACTIVATE_STEPS = ['BEGIN', 'LOCK_RULE', 'LOCK_SCOPE', ...VALIDATION_READS, 'UPDATE_STATUS', 'COMMIT'];

    test('[POSITIVE CASE] a DRAFT should become ACTIVE in place with activated_at and updated_at set', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      const activated = await monitoringRuleService.activateRule(10, MANAGER_ID);

      expect(activated).toMatchObject({
        id: 10, status: 'ACTIVE', activatedAt: UPDATED_AT, updatedAt: UPDATED_AT, createdAt: CREATED_AT,
        createdBy: MANAGER_ID, alertPriority: 'HIGH'
      });
      expect(db.steps()).toEqual(ACTIVATE_STEPS);
      expect(db.find('UPDATE public.monitoring_rules')[0].params).toEqual([10, 'ACTIVE', true]);
      expect(db.find('INSERT')).toHaveLength(0);
    });

    test('[POSITIVE CASE] the stored configuration is revalidated, with the draft excluded from its own duplicate check', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });
      await monitoringRuleService.activateRule(10, MANAGER_ID);
      expect(db.find('SELECT id, code, name FROM public.parks')[0].params).toEqual([1]);
      expect(db.find('SELECT id, park_id, zone_code')[0].params).toEqual([2]);
      expect(db.find('SELECT pg_advisory_xact_lock')[0].params).toEqual([`monitoring_rule:1:${HAZARD}:2`]);
    });

    test('[NEGATIVE CASE] DC2: an ACTIVE rule with a different configuration should block activation with 409', async () => {
      const db = createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 10, status: 'DRAFT' }), ruleRow({ id: 12, status: 'ACTIVE', alert_priority: 'LOW', activated_at: CREATED_AT })]
      });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({
        status: 409,
        message: 'The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.',
        conflicts: [expect.objectContaining({ type: 'CONFLICT', ruleId: 12 })]
      });
      expect(db.find('UPDATE')).toHaveLength(0);
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[NEGATIVE CASE] DC1: an identical other DRAFT should block activation with 409', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' }), ruleRow({ id: 11, status: 'DRAFT' })] });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'DUPLICATE', ruleId: 11 })] });
    });

    test('[POSITIVE CASE] DC3/DC4: other drafts with a different configuration and INACTIVE rules do not block activation', async () => {
      createRulePgFake(getPool, {
        existingRules: [
          ruleRow({ id: 10, status: 'DRAFT' }),
          ruleRow({ id: 11, status: 'DRAFT', alert_priority: 'LOW' }),
          ruleRow({ id: 13, status: 'INACTIVE' })
        ]
      });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).resolves.toMatchObject({ status: 'ACTIVE' });
    });

    test.each([
      ['ACTIVE', { activated_at: CREATED_AT }, /Only DRAFT rules can be activated\. This rule is ACTIVE/],
      ['INACTIVE', {}, /Only DRAFT rules can be activated\. This rule is INACTIVE/]
    ])('[NEGATIVE CASE] an %s rule cannot be activated (409)', async (status, extra, message) => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status, ...extra })] });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({ status: 409, message: expect.stringMatching(message) });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_RULE', 'ROLLBACK']);
    });

    test('[NEGATIVE CASE] an unknown rule should return 404', async () => {
      createRulePgFake(getPool, { existingRules: [] });
      await expect(monitoringRuleService.activateRule(404, MANAGER_ID)).rejects.toMatchObject({ status: 404, message: 'Monitoring rule not found.' });
    });

    test('[NEGATIVE CASE] a stored value no longer configured should return 400 asking to edit the draft', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT', hazard_type: 'RETIRED_HAZARD' })] });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/no longer passes validation\. Edit the draft/),
        errors: [expect.objectContaining({ field: 'hazardType', code: 'INVALID_VALUE' })]
      });
      expect(db.find('UPDATE')).toHaveLength(0);
    });

    test('[POSITIVE CASE] activation keeps the selected response behaviour', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT', response_behaviour: 'NOTIFY_AND_CREATE_INCIDENT' })] });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID))
        .resolves.toMatchObject({ status: 'ACTIVE', responseBehaviour: 'NOTIFY_AND_CREATE_INCIDENT' });
    });

    test('[NEGATIVE CASE] a draft with the retired PLACEHOLDER_RESPONSE must be edited before activation', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT', response_behaviour: 'PLACEHOLDER_RESPONSE' })] });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({
        status: 400,
        message: expect.stringMatching(/Edit the draft before activating it/),
        errors: [expect.objectContaining({ field: 'responseBehaviour', code: 'INVALID_VALUE' })]
      });
      expect(db.find('UPDATE')).toHaveLength(0);
    });

    test('[NEGATIVE CASE] a risk zone that no longer belongs to the park should return 400', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })], zone: zoneRow({ park_id: 3 }) });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID))
        .rejects.toMatchObject({ status: 400, errors: [expect.objectContaining({ code: 'ZONE_NOT_IN_PARK' })] });
    });

    test.each(['10', 0, -1, 1.5])('[NEGATIVE CASE] an invalid rule ID %p should return 400 without a transaction', async (ruleId) => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.activateRule(ruleId, MANAGER_ID)).rejects.toMatchObject({ status: 400 });
      expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] a missing user should return 401', async () => {
      createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })] });
      await expect(monitoringRuleService.activateRule(10, undefined)).rejects.toMatchObject({ status: 401 });
    });

    test('[EDGE CASE] a concurrent activation caught by the unique index should return 409, not 500', async () => {
      const db = createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 10, status: 'DRAFT' })],
        failOn: 'UPDATE public.monitoring_rules',
        failWith: uniqueViolation()
      });
      const promise = monitoringRuleService.activateRule(10, MANAGER_ID);
      await expect(promise).rejects.toMatchObject({
        status: 409, message: 'An ACTIVE rule already exists for this park, hazard and risk zone. No changes were saved.', conflicts: []
      });
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[ERROR CASE] a database failure should roll back and return a safe 500', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10 })], failOn: 'SELECT id, park_id, hazard_type' });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID))
        .rejects.toMatchObject({ status: 500, message: 'Failed to activate the monitoring rule. No changes were saved.' });
      expect(db.steps()).not.toContain('COMMIT');
      expect(db.client.release).toHaveBeenCalledTimes(1);
    });

    test('[EDGE CASE] of two different drafts in one scope, only the first activation succeeds', async () => {
      createRulePgFake(getPool, {
        existingRules: [ruleRow({ id: 10, status: 'DRAFT' }), ruleRow({ id: 11, status: 'DRAFT', alert_priority: 'LOW' })]
      });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).resolves.toMatchObject({ status: 'ACTIVE' });
      await expect(monitoringRuleService.activateRule(11, MANAGER_ID))
        .rejects.toMatchObject({ status: 409, conflicts: [expect.objectContaining({ type: 'CONFLICT', ruleId: 10 })] });
    });
  });

  describe('deactivateRule (POST /:id/deactivate)', () => {
    const activeRule = (overrides = {}) => ruleRow({ id: 12, status: 'ACTIVE', activated_at: CREATED_AT, notes: 'Keep', ...overrides });

    test('[POSITIVE CASE] an ACTIVE rule should become INACTIVE with activated_at cleared and its configuration kept', async () => {
      const db = createRulePgFake(getPool, { existingRules: [activeRule()] });
      const deactivated = await monitoringRuleService.deactivateRule(12, MANAGER_ID);

      expect(deactivated).toMatchObject({
        id: 12, status: 'INACTIVE', activatedAt: null, updatedAt: UPDATED_AT, createdAt: CREATED_AT, createdBy: MANAGER_ID,
        hazardType: HAZARD, riskZoneId: 2, alertPriority: 'HIGH', notes: 'Keep',
        notificationRecipients: ['park_manager', 'wildlife_officer']
      });
      expect(db.steps()).toEqual(['BEGIN', 'LOCK_RULE', 'UPDATE_STATUS', 'COMMIT']);
      const [update] = db.find('UPDATE public.monitoring_rules');
      expect(update.params).toEqual([12, 'INACTIVE', false]);
      expect(update.sql).toMatch(/activated_at = CASE WHEN \$3::boolean THEN NOW\(\) ELSE NULL END, updated_at = NOW\(\)/);
    });

    test.each(['NOTIFY_AND_ESCALATE', 'PLACEHOLDER_RESPONSE'])(
      '[POSITIVE CASE] deactivation keeps the stored response behaviour %s', async (responseBehaviour) => {
        createRulePgFake(getPool, { existingRules: [activeRule({ response_behaviour: responseBehaviour })] });
        await expect(monitoringRuleService.deactivateRule(12, MANAGER_ID))
          .resolves.toMatchObject({ status: 'INACTIVE', responseBehaviour });
      }
    );

    test.each(['DRAFT', 'INACTIVE'])('[NEGATIVE CASE] a %s rule cannot be deactivated (409)', async (status) => {
      const db = createRulePgFake(getPool, { existingRules: [activeRule({ status, activated_at: null })] });
      await expect(monitoringRuleService.deactivateRule(12, MANAGER_ID))
        .rejects.toMatchObject({ status: 409, message: expect.stringMatching(/Only ACTIVE rules can be deactivated/) });
      expect(db.find('UPDATE')).toHaveLength(0);
      expect(db.steps().at(-1)).toBe('ROLLBACK');
    });

    test('[NEGATIVE CASE] an unknown rule should return 404', async () => {
      createRulePgFake(getPool, { existingRules: [] });
      await expect(monitoringRuleService.deactivateRule(12, MANAGER_ID)).rejects.toMatchObject({ status: 404 });
    });

    test.each(['12', 0, -12, 1.5])('[NEGATIVE CASE] an invalid rule ID %p should return 400', async (ruleId) => {
      const db = createRulePgFake(getPool);
      await expect(monitoringRuleService.deactivateRule(ruleId, MANAGER_ID)).rejects.toMatchObject({ status: 400 });
      expect(db.pool.connect).not.toHaveBeenCalled();
    });

    test('[NEGATIVE CASE] a missing user should return 401', async () => {
      createRulePgFake(getPool, { existingRules: [activeRule()] });
      await expect(monitoringRuleService.deactivateRule(12, null)).rejects.toMatchObject({ status: 401 });
    });

    test('[ERROR CASE] a database failure should roll back and return a safe 500', async () => {
      const db = createRulePgFake(getPool, { existingRules: [activeRule()], failOn: 'UPDATE public.monitoring_rules' });
      await expect(monitoringRuleService.deactivateRule(12, MANAGER_ID))
        .rejects.toMatchObject({ status: 500, message: 'Failed to deactivate the monitoring rule. No changes were saved.' });
      expect(db.steps().at(-1)).toBe('ROLLBACK');
      expect(db.state.existingRules[0].status).toBe('ACTIVE');
    });

    test('[POSITIVE CASE] deactivation frees the scope: a different configuration can then be activated', async () => {
      const db = createRulePgFake(getPool, { existingRules: [activeRule()] });
      await expect(monitoringRuleService.createRule(ruleInput({ alertPriority: 'LOW', action: 'ACTIVATE' }), MANAGER_ID))
        .rejects.toMatchObject({ status: 409 });

      await monitoringRuleService.deactivateRule(12, MANAGER_ID);
      await expect(monitoringRuleService.createRule(ruleInput({ alertPriority: 'LOW', action: 'ACTIVATE' }), MANAGER_ID))
        .resolves.toMatchObject({ status: 'ACTIVE' });
      expect(db.find('INSERT INTO public.monitoring_rules')).toHaveLength(1);
    });
  });

  describe('Saved rule lifecycle (DRAFT -> ACTIVE -> INACTIVE)', () => {
    test('[POSITIVE CASE] a draft can be edited, activated and deactivated, and nothing after that', async () => {
      const db = createRulePgFake(getPool, { existingRules: [ruleRow({ id: 10, status: 'DRAFT' })] });

      await expect(monitoringRuleService.updateDraft(10, ruleInput({ alertPriority: 'CRITICAL' }), MANAGER_ID))
        .resolves.toMatchObject({ id: 10, status: 'DRAFT', alertPriority: 'CRITICAL' });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).resolves.toMatchObject({ id: 10, status: 'ACTIVE' });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID)).rejects.toMatchObject({ status: 409 });
      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({ status: 409 });
      await expect(monitoringRuleService.deactivateRule(10, MANAGER_ID)).resolves.toMatchObject({ id: 10, status: 'INACTIVE', activatedAt: null });

      await expect(monitoringRuleService.activateRule(10, MANAGER_ID)).rejects.toMatchObject({ status: 409 });
      await expect(monitoringRuleService.updateDraft(10, ruleInput(), MANAGER_ID)).rejects.toMatchObject({ status: 409 });
      await expect(monitoringRuleService.deactivateRule(10, MANAGER_ID)).rejects.toMatchObject({ status: 409 });

      expect(db.state.existingRules).toEqual([expect.objectContaining({ id: 10, status: 'INACTIVE', alert_priority: 'CRITICAL' })]);
      expect(db.find('INSERT')).toHaveLength(0);
    });
  });
});
