import { describe, test, expect } from 'vitest';
import {
  EMPTY_RULE_FORM, FORM_STEPS, LAST_STEP, LIST_TABS, NOT_RECORDED, REVIEW_STEP, TOTAL_STEPS,
  buildRulePayload, countByTab, describeApiError, filterByTab, findZone, firstStepWithError, formatRecipients,
  formatZone, getFieldLabel, getOptionLabel, getRuleZoneLabel, getStatusLabel, groupErrorsByField, isStepComplete,
  orderPriorityOptions, toZoneCircle, toggleRecipient,
} from '../monitoringRuleUtils';
import { EXISTING_RULES, OPTIONS, RISK_ZONES, WILPATTU_ZONES } from './fixtures';

describe('monitoringRuleUtils - steps', () => {
  test('the flow has two configuration steps followed by Review as step 3 of 3', () => {
    expect(FORM_STEPS.map((step) => step.label)).toEqual(['Hazard & Risk Zone', 'Priority & Notifications']);
    expect(LAST_STEP).toBe(2);
    expect(REVIEW_STEP).toEqual({ id: 3, label: 'Review' });
    expect(TOTAL_STEPS).toBe(3);
  });

  test('step 1 is complete only when both a hazard and a risk zone are chosen; step 2 never blocks submission', () => {
    expect(isStepComplete(1, EMPTY_RULE_FORM)).toBe(false);
    expect(isStepComplete(1, { ...EMPTY_RULE_FORM, hazardType: 'POACHING_SNARING' })).toBe(false);
    expect(isStepComplete(1, { ...EMPTY_RULE_FORM, riskZoneId: 2 })).toBe(false);
    expect(isStepComplete(1, { ...EMPTY_RULE_FORM, hazardType: 'POACHING_SNARING', riskZoneId: 2 })).toBe(true);
    expect(isStepComplete(2, EMPTY_RULE_FORM)).toBe(true);
  });

  test('backend field errors map to the first configuration step that owns them', () => {
    expect(firstStepWithError([{ field: 'notes' }, { field: 'riskZoneId' }])).toBe(1);
    expect(firstStepWithError([{ field: 'hazardType' }])).toBe(1);
    expect(firstStepWithError([{ field: 'notificationRecipients' }, { field: 'alertPriority' }])).toBe(2);
    expect(firstStepWithError([{ field: 'parkId' }])).toBeNull();
    expect(firstStepWithError(undefined)).toBeNull();
  });

  test('field errors are grouped by field and field names have readable labels', () => {
    expect(groupErrorsByField([
      { field: 'notes', message: 'a' }, { field: 'notes', message: 'b' }, { field: 'riskZoneId', message: 'c' },
    ])).toEqual({ notes: ['a', 'b'], riskZoneId: ['c'] });
    expect(groupErrorsByField(undefined)).toEqual({});
    expect(getFieldLabel('responseBehaviour')).toBe('Response Behaviour');
    expect(getFieldLabel('unknownField')).toBe('unknownField');
  });
});

describe('monitoringRuleUtils - payload', () => {
  test('builds the API payload with numeric ids and only the seven rule fields', () => {
    const form = {
      hazardType: 'POACHING_SNARING', riskZoneId: 2, alertPriority: 'MEDIUM',
      notificationRecipients: ['wildlife_officer'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: ' n ',
    };
    const payload = buildRulePayload(form, 1);
    expect(payload).toEqual({ parkId: 1, ...form });
    expect(payload).not.toHaveProperty('action');
    expect(payload).not.toHaveProperty('status');
    expect(payload.notificationRecipients).not.toBe(form.notificationRecipients);
  });

  test('an unselected risk zone is sent as null so the backend reports it as required', () => {
    expect(buildRulePayload(EMPTY_RULE_FORM, 3)).toEqual({
      parkId: 3, hazardType: '', riskZoneId: null, alertPriority: '', notificationRecipients: [],
      responseBehaviour: '', notes: '',
    });
  });

  test('toggling a recipient adds or removes it without mutating the current list', () => {
    const current = ['park_manager'];
    expect(toggleRecipient(current, 'wildlife_officer')).toEqual(['park_manager', 'wildlife_officer']);
    expect(toggleRecipient(current, 'park_manager')).toEqual([]);
    expect(current).toEqual(['park_manager']);
  });
});

describe('monitoringRuleUtils - display helpers', () => {
  test('priority options are shown Low to Critical with their backend values unchanged', () => {
    const ordered = orderPriorityOptions(OPTIONS.alertPriorities);
    expect(ordered.map((option) => option.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL']);
    expect(ordered.map((option) => option.label)).toEqual(['Low', 'Medium', 'High', 'Critical']);
    expect(OPTIONS.alertPriorities.map((option) => option.value)).toEqual(['CRITICAL', 'HIGH', 'MEDIUM', 'LOW']);
  });

  test('unknown priority values are kept after the known ones in their original order', () => {
    const ordered = orderPriorityOptions([{ value: 'X' }, ...OPTIONS.alertPriorities, { value: 'Y' }]);
    expect(ordered.map((option) => option.value)).toEqual(['LOW', 'MEDIUM', 'HIGH', 'CRITICAL', 'X', 'Y']);
    expect(orderPriorityOptions(undefined)).toEqual([]);
  });

  test('option values are shown with their reference labels, falling back to the raw value', () => {
    expect(getOptionLabel(OPTIONS.hazardTypes, 'POACHING_SNARING')).toBe('Poaching & Snaring');
    expect(getOptionLabel(OPTIONS.hazardTypes, 'NOT_IN_LIST')).toBe('NOT_IN_LIST');
    expect(getOptionLabel(null, 'HIGH')).toBe('HIGH');
    expect(getOptionLabel(OPTIONS.hazardTypes, '')).toBe(NOT_RECORDED);
    expect(formatRecipients(OPTIONS.recipientRoles, ['park_manager', 'community_liaison_officer']))
      .toBe('Park Manager, Community Liaison Officer');
    expect(formatRecipients(OPTIONS.recipientRoles, [])).toBe(NOT_RECORDED);
  });

  test('risk zones are shown as code and name, from the joined zone or the reference zones', () => {
    expect(formatZone(RISK_ZONES[1])).toBe('RZ-YALA-02 – Katagamuwa Sanctuary Boundary');
    expect(formatZone(null)).toBe(NOT_RECORDED);
    expect(findZone(RISK_ZONES, 1)).toBe(RISK_ZONES[0]);
    expect(findZone(RISK_ZONES, 99)).toBeNull();
    expect(getRuleZoneLabel({ riskZoneId: 1, riskZone: null }, RISK_ZONES)).toBe('RZ-YALA-01 – Northern River Basin Buffer');
    expect(getRuleZoneLabel(EXISTING_RULES[0], [])).toBe('RZ-YALA-01 – Northern River Basin Buffer');
  });

  test('statuses have readable labels and the list tabs filter and count by status', () => {
    expect(['DRAFT', 'ACTIVE', 'INACTIVE'].map(getStatusLabel)).toEqual(['Draft', 'Active', 'Inactive']);
    expect(filterByTab(EXISTING_RULES, LIST_TABS.ACTIVE).map((rule) => rule.id)).toEqual([12]);
    expect(filterByTab(EXISTING_RULES, LIST_TABS.DRAFT).map((rule) => rule.id)).toEqual([11]);
    expect(filterByTab(EXISTING_RULES, LIST_TABS.ALL)).toHaveLength(2);
    expect(countByTab(EXISTING_RULES)).toEqual({ ALL: 2, ACTIVE: 1, DRAFT: 1 });
  });

  test('API errors become safe, status-specific messages for the Park Manager', () => {
    expect(describeApiError({ status: 401 })).toMatch(/session has expired/);
    expect(describeApiError({ status: 403 })).toMatch(/only be configured by Park Managers/);
    expect(describeApiError({ status: 404 })).toMatch(/park could not be found/);
    expect(describeApiError(new TypeError('Failed to fetch'))).toMatch(/Unable to reach the monitoring rules service/);
    expect(describeApiError({ status: 409, message: 'Duplicate rule.' })).toBe('Duplicate rule.');
    expect(describeApiError({ status: 500 })).toMatch(/Something went wrong/);
  });
});

describe('monitoringRuleUtils - risk zone map geometry', () => {
  test('a zone with a stored centre and radius becomes a map circle at that centre', () => {
    expect(toZoneCircle(RISK_ZONES[0])).toEqual({ center: [6.4128, 81.5342], radiusMeters: 3200 });
    expect(toZoneCircle(WILPATTU_ZONES[0])).toEqual({ center: [8.492, 80.035], radiusMeters: 3500 });
  });

  test('the radius is converted from kilometres to metres', () => {
    expect(toZoneCircle({ centerLat: 6.44, centerLng: 80.89, radiusKm: 2.2 }).radiusMeters).toBeCloseTo(2200);
    expect(toZoneCircle({ centerLat: 6.44, centerLng: 80.89, radiusKm: '0.5' }).radiusMeters).toBe(500);
  });

  test('a missing zone or missing centre coordinate gives no circle', () => {
    expect(toZoneCircle(null)).toBeNull();
    expect(toZoneCircle(undefined)).toBeNull();
    expect(toZoneCircle({ centerLng: 81.5, radiusKm: 2 })).toBeNull();
    expect(toZoneCircle({ centerLat: 6.4, centerLng: null, radiusKm: 2 })).toBeNull();
    expect(toZoneCircle({ centerLat: '', centerLng: 81.5, radiusKm: 2 })).toBeNull();
  });

  test('invalid or out-of-range centre coordinates give no circle (never a 0,0 fallback)', () => {
    expect(toZoneCircle({ centerLat: 'abc', centerLng: 81.5, radiusKm: 2 })).toBeNull();
    expect(toZoneCircle({ centerLat: 6.4, centerLng: Number.NaN, radiusKm: 2 })).toBeNull();
    expect(toZoneCircle({ centerLat: 95, centerLng: 81.5, radiusKm: 2 })).toBeNull();
    expect(toZoneCircle({ centerLat: 6.4, centerLng: 181, radiusKm: 2 })).toBeNull();
  });

  test('a null, invalid or non-positive radius keeps the centre without inventing a radius', () => {
    [null, undefined, 'abc', 0, -1].forEach((radiusKm) => {
      expect(toZoneCircle({ centerLat: 6.4128, centerLng: 81.5342, radiusKm })).toEqual({ center: [6.4128, 81.5342], radiusMeters: null });
    });
  });

  test('the zone object is not mutated', () => {
    const zone = { ...RISK_ZONES[1] };
    toZoneCircle(zone);
    expect(zone).toEqual(RISK_ZONES[1]);
  });
});
