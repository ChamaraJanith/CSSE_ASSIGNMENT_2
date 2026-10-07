const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const monitoringRuleService = require('../services/monitoringRuleService');
const monitoringRuleConfig = require('../utils/monitoringRuleConfig');
const {
  MANAGER_ID, HAZARD, CREATED_AT, yalaPark, zoneRow, ruleRow, ruleInput, createSupabaseFake, createRulePgFake
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
            zoneRow({ id: 1, zone_code: 'RZ-YALA-01', zone_name: 'Northern River Basin Buffer', severity_level: 'CRITICAL', primary_threat: 'Poaching & Wire Snares near River Crossing' }),
            zoneRow()
          ],
          error: null
        }
      });

      const result = await monitoringRuleService.getReferenceData(1);

      expect(result.park).toEqual({ id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' });
      expect(result.riskZones).toEqual([
        { id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer', severityLevel: 'CRITICAL', primaryThreat: 'Poaching & Wire Snares near River Crossing' },
        { id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary', severityLevel: 'HIGH', primaryThreat: 'Elephant Crop Raiding & Fence Breaches' }
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
});
