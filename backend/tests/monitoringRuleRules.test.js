const monitoringRuleRules = require('../utils/monitoringRuleRules');
const monitoringRuleConfig = require('../utils/monitoringRuleConfig');

const { ERROR_CODES, CONFLICT_TYPES, ENFORCED_STATUSES } = monitoringRuleRules;
const {
  HAZARD_TYPES, RESPONSE_BEHAVIOURS, ALERT_PRIORITIES, RECIPIENT_ROLES, RULE_STATUSES, RULE_ACTIONS
} = monitoringRuleConfig;

// Option values are read from the config so these tests keep working when the
// UNCONFIRMED hazard / response placeholders are replaced with the Assignment 02 values.
const HAZARD = HAZARD_TYPES[0].value;
const RESPONSE = RESPONSE_BEHAVIOURS[0].value;
const OTHER_HAZARD = 'ANOTHER_HAZARD';
const OTHER_RESPONSE = 'ANOTHER_RESPONSE';

const validInput = (overrides = {}) => ({
  parkId: 1,
  hazardType: HAZARD,
  riskZoneId: 2,
  alertPriority: 'HIGH',
  notificationRecipients: ['wildlife_officer', 'park_manager'],
  responseBehaviour: RESPONSE,
  notes: 'Snare lines reported near the river crossing',
  ...overrides
});

// A field-valid, normalised candidate rule (the shape the service passes to findConflicts)
const candidateRule = (overrides = {}) => ({ ...monitoringRuleRules.validateFields(validInput()).rule, ...overrides });

// An existing rule in the camelCase shape the service maps database rows to
const existingRule = (overrides = {}) => ({
  id: 10,
  parkId: 1,
  hazardType: HAZARD,
  riskZoneId: 2,
  alertPriority: 'HIGH',
  notificationRecipients: ['park_manager', 'wildlife_officer'],
  responseBehaviour: RESPONSE,
  notes: null,
  status: RULE_STATUSES.DRAFT,
  ...overrides
});

const yalaPark = { id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' };
const yalaZone = { id: 2, park_id: 1, zone_code: 'RZ-YALA-02', zone_name: 'Katagamuwa Sanctuary Boundary' };
const wilpattuZone = { id: 5, park_id: 2, zone_code: 'RZ-WILP-01', zone_name: 'Kokmote Sandstone River Buffer' };

const expectFieldError = (input, field, code) => {
  const result = monitoringRuleRules.validateFields(input);
  expect(result.valid).toBe(false);
  expect(result.rule).toBeNull();
  expect(result.errors).toHaveLength(1);
  expect(result.errors[0]).toEqual({ field, code, message: expect.any(String) });
  return result.errors[0];
};

describe('UC04: Configure Park-Specific Wildlife Monitoring Rules - Business Rules Unit Tests', () => {
  describe('Configuration value sets (monitoringRuleConfig)', () => {
    test('[POSITIVE CASE] option lists should use the { value, label } convention', () => {
      [HAZARD_TYPES, RESPONSE_BEHAVIOURS, ALERT_PRIORITIES, RECIPIENT_ROLES].forEach((options) => {
        expect(options.length).toBeGreaterThan(0);
        options.forEach((option) => expect(option).toEqual({ value: expect.any(String), label: expect.any(String) }));
      });
    });

    test('[POSITIVE CASE] should reuse the existing priority vocabulary and role names', () => {
      expect(ALERT_PRIORITIES.map((o) => o.value)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
      expect(RECIPIENT_ROLES.map((o) => o.value)).toEqual(['park_manager', 'wildlife_officer', 'community_liaison_officer']);
      expect(RULE_STATUSES).toEqual({ DRAFT: 'DRAFT', ACTIVE: 'ACTIVE', INACTIVE: 'INACTIVE' });
      expect(RULE_ACTIONS).toEqual({ ACTIVATE: 'ACTIVATE', SAVE_DRAFT: 'SAVE_DRAFT' });
    });

    test('[EDGE CASE] exported value sets should be frozen against accidental mutation', () => {
      expect(Object.isFrozen(monitoringRuleConfig)).toBe(true);
      [HAZARD_TYPES, RESPONSE_BEHAVIOURS, ALERT_PRIORITIES, RECIPIENT_ROLES].forEach((options) => {
        expect(Object.isFrozen(options)).toBe(true);
        options.forEach((option) => expect(Object.isFrozen(option)).toBe(true));
      });
      expect(Object.isFrozen(RULE_STATUSES)).toBe(true);
      expect(Object.isFrozen(RULE_ACTIONS)).toBe(true);
      expect(Object.isFrozen(ENFORCED_STATUSES)).toBe(true);
    });
  });

  describe('validateFields: complete rule', () => {
    test('[POSITIVE CASE] a complete rule should be valid with no errors', () => {
      const result = monitoringRuleRules.validateFields(validInput());
      expect(result.valid).toBe(true);
      expect(result.errors).toEqual([]);
      expect(result.rule).toEqual({
        parkId: 1,
        hazardType: HAZARD,
        riskZoneId: 2,
        alertPriority: 'HIGH',
        notificationRecipients: ['park_manager', 'wildlife_officer'],
        responseBehaviour: RESPONSE,
        notes: 'Snare lines reported near the river crossing'
      });
    });

    test('[POSITIVE CASE] every configured option value should be accepted', () => {
      HAZARD_TYPES.forEach(({ value }) => expect(monitoringRuleRules.validateFields(validInput({ hazardType: value })).valid).toBe(true));
      ALERT_PRIORITIES.forEach(({ value }) => expect(monitoringRuleRules.validateFields(validInput({ alertPriority: value })).valid).toBe(true));
      RESPONSE_BEHAVIOURS.forEach(({ value }) => expect(monitoringRuleRules.validateFields(validInput({ responseBehaviour: value })).valid).toBe(true));
      RECIPIENT_ROLES.forEach(({ value }) =>
        expect(monitoringRuleRules.validateFields(validInput({ notificationRecipients: [value] })).valid).toBe(true));
    });

    test('[POSITIVE CASE] notes should be optional', () => {
      const input = validInput();
      delete input.notes;
      const result = monitoringRuleRules.validateFields(input);
      expect(result.valid).toBe(true);
      expect(result.rule.notes).toBeNull();
    });

    test('[EDGE CASE] unknown extra fields should not be copied into the normalised rule', () => {
      const result = monitoringRuleRules.validateFields(validInput({ status: 'ACTIVE', id: 99, createdBy: 'someone' }));
      expect(result.valid).toBe(true);
      expect(Object.keys(result.rule).sort()).toEqual([
        'alertPriority', 'hazardType', 'notes', 'notificationRecipients', 'parkId', 'responseBehaviour', 'riskZoneId'
      ]);
    });

    test('[EDGE CASE] the caller input should not be mutated', () => {
      const input = validInput({ notificationRecipients: ['wildlife_officer', 'park_manager', 'wildlife_officer'], notes: '  padded  ' });
      const snapshot = JSON.parse(JSON.stringify(input));
      monitoringRuleRules.validateFields(input);
      expect(input).toEqual(snapshot);
    });
  });

  describe('validateFields: mandatory fields', () => {
    test.each([
      'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour'
    ])('[NEGATIVE CASE] missing %s should return REQUIRED', (field) => {
      const input = validInput();
      delete input[field];
      expectFieldError(input, field, ERROR_CODES.REQUIRED);
    });

    test.each([
      'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour'
    ])('[NEGATIVE CASE] null %s should return REQUIRED', (field) => {
      expectFieldError(validInput({ [field]: null }), field, ERROR_CODES.REQUIRED);
    });

    test.each([
      'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour'
    ])('[EDGE CASE] whitespace-only %s should return REQUIRED', (field) => {
      expectFieldError(validInput({ [field]: '   ' }), field, ERROR_CODES.REQUIRED);
    });

    test('[NEGATIVE CASE] an empty recipients list should return REQUIRED', () => {
      const error = expectFieldError(validInput({ notificationRecipients: [] }), 'notificationRecipients', ERROR_CODES.REQUIRED);
      expect(error.message).toMatch(/At least one notification recipient/);
    });

    test.each([undefined, null, 'not-an-object', 42])(
      '[EDGE CASE] input %p should report every mandatory field as REQUIRED',
      (input) => {
        const result = monitoringRuleRules.validateFields(input);
        expect(result.valid).toBe(false);
        expect(result.rule).toBeNull();
        expect(result.errors.map((e) => e.field)).toEqual([
          'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour'
        ]);
        result.errors.forEach((e) => expect(e.code).toBe(ERROR_CODES.REQUIRED));
      }
    );
  });

  describe('validateFields: park and risk zone identifiers', () => {
    test.each(['parkId', 'riskZoneId'])('[NEGATIVE CASE] %s = 0 should return INVALID_VALUE', (field) => {
      const error = expectFieldError(validInput({ [field]: 0 }), field, ERROR_CODES.INVALID_VALUE);
      expect(error.message).toMatch(/positive integer/);
    });

    test.each(['parkId', 'riskZoneId'])('[NEGATIVE CASE] negative %s should return INVALID_VALUE', (field) => {
      expectFieldError(validInput({ [field]: -3 }), field, ERROR_CODES.INVALID_VALUE);
    });

    test.each(['parkId', 'riskZoneId'])('[NEGATIVE CASE] non-integer %s should return INVALID_VALUE', (field) => {
      expectFieldError(validInput({ [field]: 1.5 }), field, ERROR_CODES.INVALID_VALUE);
    });

    test.each([NaN, Infinity, Number.MAX_SAFE_INTEGER + 1])('[EDGE CASE] parkId %p should return INVALID_VALUE', (value) => {
      expectFieldError(validInput({ parkId: value }), 'parkId', ERROR_CODES.INVALID_VALUE);
    });

    test.each(['parkId', 'riskZoneId'])('[NEGATIVE CASE] non-number %s should return INVALID_TYPE', (field) => {
      const error = expectFieldError(validInput({ [field]: 'abc' }), field, ERROR_CODES.INVALID_TYPE);
      expect(error.message).toMatch(/must be a number/);
    });

    test.each([['numeric string', '1'], ['boolean', true], ['object', { id: 1 }], ['array', [1]]])(
      '[EDGE CASE] parkId given as %s should return INVALID_TYPE',
      (_label, value) => {
        expectFieldError(validInput({ parkId: value }), 'parkId', ERROR_CODES.INVALID_TYPE);
      }
    );
  });

  describe('validateFields: configured options', () => {
    test.each([
      ['hazardType', 'NOT_A_HAZARD'],
      ['alertPriority', 'URGENT'],
      ['responseBehaviour', 'NOT_A_RESPONSE']
    ])('[NEGATIVE CASE] invalid %s should return INVALID_VALUE listing the allowed values', (field, value) => {
      const error = expectFieldError(validInput({ [field]: value }), field, ERROR_CODES.INVALID_VALUE);
      expect(error.message).toContain(value);
      expect(error.message).toMatch(/Allowed values:/);
    });

    test('[EDGE CASE] option values are case-sensitive', () => {
      expectFieldError(validInput({ alertPriority: 'high' }), 'alertPriority', ERROR_CODES.INVALID_VALUE);
    });

    test('[EDGE CASE] option values are not trimmed (exact match only)', () => {
      expectFieldError(validInput({ alertPriority: ' HIGH ' }), 'alertPriority', ERROR_CODES.INVALID_VALUE);
    });

    test.each(['hazardType', 'alertPriority', 'responseBehaviour'])(
      '[NEGATIVE CASE] non-text %s should return INVALID_TYPE',
      (field) => {
        const error = expectFieldError(validInput({ [field]: 7 }), field, ERROR_CODES.INVALID_TYPE);
        expect(error.message).toMatch(/must be text/);
      }
    );
  });

  describe('validateFields: notification recipients', () => {
    test.each([['a string', 'park_manager'], ['an object', { role: 'park_manager' }], ['a number', 3]])(
      '[NEGATIVE CASE] recipients given as %s should return INVALID_TYPE',
      (_label, value) => {
        const error = expectFieldError(validInput({ notificationRecipients: value }), 'notificationRecipients', ERROR_CODES.INVALID_TYPE);
        expect(error.message).toMatch(/must be a list/);
      }
    );

    test('[NEGATIVE CASE] an unknown recipient should return INVALID_VALUE naming it', () => {
      const error = expectFieldError(
        validInput({ notificationRecipients: ['park_manager', 'tourist'] }),
        'notificationRecipients',
        ERROR_CODES.INVALID_VALUE
      );
      expect(error.message).toContain('tourist');
      expect(error.message).not.toMatch(/recipient\(s\): park_manager/);
    });

    test('[EDGE CASE] non-text recipient entries should return INVALID_VALUE', () => {
      const error = expectFieldError(
        validInput({ notificationRecipients: ['park_manager', null, 5] }),
        'notificationRecipients',
        ERROR_CODES.INVALID_VALUE
      );
      expect(error.message).toContain('null, 5');
    });
  });

  describe('validateFields: notes', () => {
    test.each([['a number', 12], ['an object', { text: 'x' }], ['a boolean', false]])(
      '[NEGATIVE CASE] notes given as %s should return INVALID_TYPE',
      (_label, value) => {
        expectFieldError(validInput({ notes: value }), 'notes', ERROR_CODES.INVALID_TYPE);
      }
    );

    test('[POSITIVE CASE] null notes should normalise to null', () => {
      expect(monitoringRuleRules.validateFields(validInput({ notes: null })).rule.notes).toBeNull();
    });

    test('[POSITIVE CASE] long notes should be accepted (no maximum length is defined)', () => {
      const notes = 'n'.repeat(5000);
      expect(monitoringRuleRules.validateFields(validInput({ notes })).rule.notes).toBe(notes);
    });
  });

  describe('validateFields: several invalid fields at once', () => {
    test('[NEGATIVE CASE] should return every field error together in field order', () => {
      const result = monitoringRuleRules.validateFields({
        parkId: 0,
        hazardType: '  ',
        riskZoneId: 'zone-2',
        alertPriority: 'URGENT',
        notificationRecipients: [],
        responseBehaviour: 99,
        notes: 5
      });
      expect(result.valid).toBe(false);
      expect(result.rule).toBeNull();
      expect(result.errors.map(({ field, code }) => ({ field, code }))).toEqual([
        { field: 'parkId', code: ERROR_CODES.INVALID_VALUE },
        { field: 'hazardType', code: ERROR_CODES.REQUIRED },
        { field: 'riskZoneId', code: ERROR_CODES.INVALID_TYPE },
        { field: 'alertPriority', code: ERROR_CODES.INVALID_VALUE },
        { field: 'notificationRecipients', code: ERROR_CODES.REQUIRED },
        { field: 'responseBehaviour', code: ERROR_CODES.INVALID_TYPE },
        { field: 'notes', code: ERROR_CODES.INVALID_TYPE }
      ]);
    });

    test('[NEGATIVE CASE] one invalid field among valid ones should report only that field', () => {
      const result = monitoringRuleRules.validateFields(validInput({ riskZoneId: -1 }));
      expect(result.errors.map((e) => e.field)).toEqual(['riskZoneId']);
    });
  });

  describe('validateFields: normalisation', () => {
    test('[POSITIVE CASE] notes should be trimmed', () => {
      const result = monitoringRuleRules.validateFields(validInput({ notes: '   Elephant herd crossing at dusk \n' }));
      expect(result.rule.notes).toBe('Elephant herd crossing at dusk');
    });

    test.each(['', '   ', '\n\t '])('[EDGE CASE] blank notes %p should become null', (notes) => {
      const result = monitoringRuleRules.validateFields(validInput({ notes }));
      expect(result.valid).toBe(true);
      expect(result.rule.notes).toBeNull();
    });

    test('[POSITIVE CASE] recipients should be de-duplicated and sorted', () => {
      const result = monitoringRuleRules.validateFields(validInput({
        notificationRecipients: ['wildlife_officer', 'community_liaison_officer', 'park_manager', 'wildlife_officer']
      }));
      expect(result.rule.notificationRecipients).toEqual(['community_liaison_officer', 'park_manager', 'wildlife_officer']);
    });

    test('[POSITIVE CASE] recipient order should not change the normalised list', () => {
      const a = monitoringRuleRules.validateFields(validInput({ notificationRecipients: ['park_manager', 'wildlife_officer'] }));
      const b = monitoringRuleRules.validateFields(validInput({ notificationRecipients: ['wildlife_officer', 'park_manager'] }));
      expect(a.rule.notificationRecipients).toEqual(b.rule.notificationRecipients);
    });

    test('[POSITIVE CASE] park and risk zone ids should remain numbers', () => {
      const result = monitoringRuleRules.validateFields(validInput({ parkId: 3, riskZoneId: 7 }));
      expect(result.rule.parkId).toBe(3);
      expect(result.rule.riskZoneId).toBe(7);
    });

    test('[POSITIVE CASE] valid option values should be preserved unchanged', () => {
      const result = monitoringRuleRules.validateFields(validInput({ alertPriority: 'CRITICAL' }));
      expect(result.rule.hazardType).toBe(HAZARD);
      expect(result.rule.alertPriority).toBe('CRITICAL');
      expect(result.rule.responseBehaviour).toBe(RESPONSE);
    });

    test('[EDGE CASE] normalizeRecipients should treat non-list input as an empty list', () => {
      expect(monitoringRuleRules.normalizeRecipients(undefined)).toEqual([]);
      expect(monitoringRuleRules.normalizeRecipients('park_manager')).toEqual([]);
    });
  });

  describe('validateAction', () => {
    test.each([RULE_ACTIONS.ACTIVATE, RULE_ACTIONS.SAVE_DRAFT])('[POSITIVE CASE] %s should be accepted', (action) => {
      expect(monitoringRuleRules.validateAction(action)).toEqual({ valid: true, errors: [], action });
    });

    test.each([undefined, null, '', '   '])('[NEGATIVE CASE] missing action %p should return REQUIRED', (action) => {
      const result = monitoringRuleRules.validateAction(action);
      expect(result.valid).toBe(false);
      expect(result.action).toBeNull();
      expect(result.errors).toEqual([{ field: 'action', code: ERROR_CODES.REQUIRED, message: 'Rule action is required.' }]);
    });

    test.each(['PUBLISH', 'activate', 'INACTIVE', 'DRAFT'])('[NEGATIVE CASE] unknown action %p should return INVALID_VALUE', (action) => {
      const result = monitoringRuleRules.validateAction(action);
      expect(result.valid).toBe(false);
      expect(result.errors[0]).toMatchObject({ field: 'action', code: ERROR_CODES.INVALID_VALUE });
      expect(result.errors[0].message).toMatch(/ACTIVATE, SAVE_DRAFT/);
    });

    test('[NEGATIVE CASE] non-text action should return INVALID_TYPE', () => {
      expect(monitoringRuleRules.validateAction(1).errors[0]).toMatchObject({ field: 'action', code: ERROR_CODES.INVALID_TYPE });
    });
  });

  describe('checkReferences', () => {
    test('[POSITIVE CASE] an existing park and a zone belonging to it should pass', () => {
      expect(monitoringRuleRules.checkReferences(candidateRule(), yalaPark, yalaZone)).toEqual({ valid: true, errors: [] });
    });

    test('[NEGATIVE CASE] a missing park should return NOT_FOUND on parkId', () => {
      const result = monitoringRuleRules.checkReferences(candidateRule(), null, yalaZone);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{ field: 'parkId', code: ERROR_CODES.NOT_FOUND, message: expect.any(String) }]);
    });

    test('[NEGATIVE CASE] a missing zone should return NOT_FOUND on riskZoneId', () => {
      const result = monitoringRuleRules.checkReferences(candidateRule(), yalaPark, undefined);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{ field: 'riskZoneId', code: ERROR_CODES.NOT_FOUND, message: expect.any(String) }]);
    });

    test('[NEGATIVE CASE] a zone belonging to another park should return ZONE_NOT_IN_PARK', () => {
      const result = monitoringRuleRules.checkReferences(candidateRule({ riskZoneId: 5 }), yalaPark, wilpattuZone);
      expect(result.valid).toBe(false);
      expect(result.errors).toEqual([{
        field: 'riskZoneId',
        code: ERROR_CODES.ZONE_NOT_IN_PARK,
        message: 'The selected risk zone does not belong to the selected park.'
      }]);
    });

    test('[EDGE CASE] missing park and zone should report both, without an ownership error', () => {
      const result = monitoringRuleRules.checkReferences(candidateRule(), null, null);
      expect(result.errors.map((e) => e.code)).toEqual([ERROR_CODES.NOT_FOUND, ERROR_CODES.NOT_FOUND]);
    });

    test('[EDGE CASE] a numeric-string park_id from the database should still match', () => {
      const result = monitoringRuleRules.checkReferences(candidateRule(), yalaPark, { ...yalaZone, park_id: '1' });
      expect(result.valid).toBe(true);
    });
  });

  describe('isSameConfiguration', () => {
    test('[POSITIVE CASE] identical configurations should match', () => {
      expect(monitoringRuleRules.isSameConfiguration(candidateRule(), existingRule())).toBe(true);
    });

    test('[NEGATIVE CASE] a different alert priority should not match', () => {
      expect(monitoringRuleRules.isSameConfiguration(candidateRule(), existingRule({ alertPriority: 'LOW' }))).toBe(false);
    });

    test('[NEGATIVE CASE] a different response behaviour should not match', () => {
      expect(monitoringRuleRules.isSameConfiguration(candidateRule(), existingRule({ responseBehaviour: OTHER_RESPONSE }))).toBe(false);
    });

    test('[NEGATIVE CASE] different recipients should not match', () => {
      expect(monitoringRuleRules.isSameConfiguration(
        candidateRule(), existingRule({ notificationRecipients: ['park_manager', 'community_liaison_officer'] })
      )).toBe(false);
    });

    test('[NEGATIVE CASE] a recipient subset should not match', () => {
      expect(monitoringRuleRules.isSameConfiguration(candidateRule(), existingRule({ notificationRecipients: ['park_manager'] }))).toBe(false);
    });

    test('[POSITIVE CASE] recipient order should not matter', () => {
      expect(monitoringRuleRules.isSameConfiguration(
        existingRule({ notificationRecipients: ['park_manager', 'wildlife_officer'] }),
        existingRule({ notificationRecipients: ['wildlife_officer', 'park_manager'] })
      )).toBe(true);
    });

    test('[POSITIVE CASE] different notes should still match', () => {
      expect(monitoringRuleRules.isSameConfiguration(candidateRule({ notes: 'A' }), existingRule({ notes: 'B' }))).toBe(true);
    });

    test('[POSITIVE CASE] different id, status and timestamps should still match', () => {
      expect(monitoringRuleRules.isSameConfiguration(
        existingRule({ id: 1, status: RULE_STATUSES.DRAFT, createdAt: '2026-10-01T00:00:00Z', activatedAt: null, createdBy: 'a' }),
        existingRule({ id: 2, status: RULE_STATUSES.ACTIVE, createdAt: '2026-10-07T00:00:00Z', activatedAt: '2026-10-07T00:00:00Z', createdBy: 'b' })
      )).toBe(true);
    });
  });

  describe('findConflicts', () => {
    test('[NEGATIVE CASE] DC1: same scope + same configuration + DRAFT should be a DUPLICATE', () => {
      const conflicts = monitoringRuleRules.findConflicts(candidateRule(), [existingRule({ id: 11, status: RULE_STATUSES.DRAFT })]);
      expect(conflicts).toEqual([{
        type: CONFLICT_TYPES.DUPLICATE,
        ruleId: 11,
        status: RULE_STATUSES.DRAFT,
        message: 'An identical DRAFT rule (#11) already exists for this hazard and risk zone.'
      }]);
    });

    test('[NEGATIVE CASE] DC1: same scope + same configuration + ACTIVE should be a DUPLICATE', () => {
      const conflicts = monitoringRuleRules.findConflicts(candidateRule(), [existingRule({ id: 12, status: RULE_STATUSES.ACTIVE })]);
      expect(conflicts).toEqual([expect.objectContaining({ type: CONFLICT_TYPES.DUPLICATE, ruleId: 12, status: RULE_STATUSES.ACTIVE })]);
    });

    test('[NEGATIVE CASE] DC2: same scope + different configuration + ACTIVE should be a CONFLICT', () => {
      const conflicts = monitoringRuleRules.findConflicts(
        candidateRule(), [existingRule({ id: 13, status: RULE_STATUSES.ACTIVE, alertPriority: 'CRITICAL' })]
      );
      expect(conflicts).toEqual([{
        type: CONFLICT_TYPES.CONFLICT,
        ruleId: 13,
        status: RULE_STATUSES.ACTIVE,
        message: 'An ACTIVE rule (#13) with a different configuration already exists for this hazard and risk zone.'
      }]);
    });

    test('[POSITIVE CASE] DC3: same scope + different configuration + DRAFT should not conflict', () => {
      expect(monitoringRuleRules.findConflicts(
        candidateRule(), [existingRule({ status: RULE_STATUSES.DRAFT, responseBehaviour: OTHER_RESPONSE })]
      )).toEqual([]);
    });

    test.each([
      ['the same', {}],
      ['a different', { alertPriority: 'LOW' }]
    ])('[POSITIVE CASE] DC4: same scope + %s configuration + INACTIVE should be ignored', (_label, overrides) => {
      expect(monitoringRuleRules.findConflicts(
        candidateRule(), [existingRule({ status: RULE_STATUSES.INACTIVE, ...overrides })]
      )).toEqual([]);
    });

    test.each([
      ['park', { parkId: 2 }],
      ['hazard', { hazardType: OTHER_HAZARD }],
      ['risk zone', { riskZoneId: 3 }]
    ])('[POSITIVE CASE] an ACTIVE rule for a different %s should not conflict', (_label, overrides) => {
      expect(monitoringRuleRules.findConflicts(
        candidateRule(), [existingRule({ status: RULE_STATUSES.ACTIVE, ...overrides })]
      )).toEqual([]);
    });

    test('[EDGE CASE] a rule should never conflict with itself (same id)', () => {
      expect(monitoringRuleRules.findConflicts(
        candidateRule({ id: 20 }), [existingRule({ id: 20, status: RULE_STATUSES.ACTIVE })]
      )).toEqual([]);
    });

    test('[EDGE CASE] a candidate with an id should still conflict with other rules', () => {
      const conflicts = monitoringRuleRules.findConflicts(
        candidateRule({ id: 20 }), [existingRule({ id: 21, status: RULE_STATUSES.ACTIVE })]
      );
      expect(conflicts.map((c) => c.ruleId)).toEqual([21]);
    });

    test('[NEGATIVE CASE] recipient order should not hide a duplicate', () => {
      const conflicts = monitoringRuleRules.findConflicts(
        candidateRule(), [existingRule({ notificationRecipients: ['wildlife_officer', 'park_manager'] })]
      );
      expect(conflicts[0].type).toBe(CONFLICT_TYPES.DUPLICATE);
    });

    test('[NEGATIVE CASE] different notes should not hide a duplicate', () => {
      const conflicts = monitoringRuleRules.findConflicts(
        candidateRule({ notes: 'New observation' }), [existingRule({ notes: 'Old observation' })]
      );
      expect(conflicts[0].type).toBe(CONFLICT_TYPES.DUPLICATE);
    });

    test('[EDGE CASE] numeric-string ids on existing rules should still be in scope', () => {
      const conflicts = monitoringRuleRules.findConflicts(candidateRule(), [existingRule({ parkId: '1', riskZoneId: '2' })]);
      expect(conflicts).toHaveLength(1);
    });

    test('[NEGATIVE CASE] should report every duplicate and conflict among several existing rules', () => {
      const conflicts = monitoringRuleRules.findConflicts(candidateRule(), [
        existingRule({ id: 1, status: RULE_STATUSES.DRAFT }),
        existingRule({ id: 2, status: RULE_STATUSES.DRAFT, alertPriority: 'LOW' }),
        existingRule({ id: 3, status: RULE_STATUSES.ACTIVE, alertPriority: 'CRITICAL' }),
        existingRule({ id: 4, status: RULE_STATUSES.INACTIVE }),
        existingRule({ id: 5, status: RULE_STATUSES.ACTIVE, riskZoneId: 9 })
      ]);
      expect(conflicts.map(({ type, ruleId }) => ({ type, ruleId }))).toEqual([
        { type: CONFLICT_TYPES.DUPLICATE, ruleId: 1 },
        { type: CONFLICT_TYPES.CONFLICT, ruleId: 3 }
      ]);
    });

    test.each([[[]], [undefined], [null]])('[EDGE CASE] no existing rules (%p) should give no conflicts', (existing) => {
      expect(monitoringRuleRules.findConflicts(candidateRule(), existing)).toEqual([]);
    });
  });

  describe('resolveCreateStatus', () => {
    test('[POSITIVE CASE] ACTIVATE should create an ACTIVE rule', () => {
      expect(monitoringRuleRules.resolveCreateStatus(RULE_ACTIONS.ACTIVATE)).toBe(RULE_STATUSES.ACTIVE);
    });

    test('[POSITIVE CASE] SAVE_DRAFT should create a DRAFT rule', () => {
      expect(monitoringRuleRules.resolveCreateStatus(RULE_ACTIONS.SAVE_DRAFT)).toBe(RULE_STATUSES.DRAFT);
    });

    test.each(['PUBLISH', undefined, null, 'toString', '__proto__', 3])(
      '[NEGATIVE CASE] unsupported action %p should throw a 400 error',
      (action) => {
        let thrown;
        try {
          monitoringRuleRules.resolveCreateStatus(action);
        } catch (err) {
          thrown = err;
        }
        expect(thrown).toBeInstanceOf(Error);
        expect(thrown.status).toBe(400);
        expect(thrown.message).toMatch(/Invalid rule action/);
      }
    );

    test('[EDGE CASE] creation should never produce the reserved INACTIVE status', () => {
      Object.values(RULE_ACTIONS).forEach((action) => {
        expect(monitoringRuleRules.resolveCreateStatus(action)).not.toBe(RULE_STATUSES.INACTIVE);
      });
    });
  });
});
