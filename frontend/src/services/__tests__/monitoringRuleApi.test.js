import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiService } from '../api';
import { supabase } from '../../supabaseClient';

// UC04 client contract: request URL, method and body for each /api/monitoring-rules endpoint
// (backend/routes/monitoringRuleRoutes.js), the Bearer token, and the HTTP status, field errors and
// conflicts kept on errors (MonitoringRulesManager maps them from error.status / errors / conflicts).
vi.mock('../../supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

const API = 'http://localhost:5000/api';

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) });

const lastRequest = () => {
  const [url, options] = fetch.mock.calls[fetch.mock.calls.length - 1];
  return { url, options, body: options.body === undefined ? undefined : JSON.parse(options.body) };
};

// A rule as the form / review screen holds it (the shape buildRulePayload produces)
const RULE = {
  parkId: 1,
  hazardType: 'POACHING_SNARING',
  riskZoneId: 2,
  alertPriority: 'HIGH',
  notificationRecipients: ['park_manager', 'wildlife_officer'],
  responseBehaviour: 'NOTIFY_RECIPIENTS',
  notes: 'Dusk patrol',
};

// Backend-controlled fields a saved rule carries, which must never be sent back
const SAVED_RULE = {
  ...RULE,
  id: 11,
  status: 'DRAFT',
  createdBy: 'cccccccc-0000-0000-0000-000000000004',
  activatedAt: null,
  createdAt: '2026-10-08T02:00:00.000Z',
  updatedAt: '2026-10-08T02:00:00.000Z',
  riskZone: { id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary' },
};

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'manager-token' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { data: [] })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiService - UC04 monitoring rule requests', () => {
  test('getMonitoringRuleReference GETs the reference data for the park with the Park Manager token', async () => {
    const body = { data: { park: { id: 1 }, riskZones: [], options: {} } };
    fetch.mockResolvedValueOnce(respond(200, body));

    await expect(apiService.getMonitoringRuleReference(1)).resolves.toEqual(body);
    const { url, options } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules/reference?parkId=1`);
    expect(options.method).toBeUndefined();
    expect(options.body).toBeUndefined();
    expect(options.headers.Authorization).toBe('Bearer manager-token');
  });

  test('getMonitoringRules GETs the rules of the park and returns the response body unchanged', async () => {
    const body = { data: [SAVED_RULE] };
    fetch.mockResolvedValueOnce(respond(200, body));

    await expect(apiService.getMonitoringRules(2)).resolves.toEqual(body);
    const { url, options } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules?parkId=2`);
    expect(options.method).toBeUndefined();
  });

  test('validateMonitoringRule POSTs only the rule fields as JSON, without a rule ID or action', async () => {
    await apiService.validateMonitoringRule({ ...SAVED_RULE, action: 'ACTIVATE' });

    const { url, options, body } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules/validate`);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer manager-token' });
    expect(body).toEqual(RULE);
  });

  test('validateMonitoringRule adds ruleId when a saved draft is being edited', async () => {
    await apiService.validateMonitoringRule(RULE, 11);
    expect(lastRequest().body).toEqual({ ...RULE, ruleId: 11 });
  });

  test('validateMonitoringRule passes empty and invalid values through unchanged for the backend to report', async () => {
    const incomplete = { ...RULE, hazardType: '', riskZoneId: null, notificationRecipients: [], responseBehaviour: '', notes: '' };
    await apiService.validateMonitoringRule(incomplete);
    expect(lastRequest().body).toEqual(incomplete);

    await apiService.validateMonitoringRule({ ...RULE, riskZoneId: '2' });
    expect(lastRequest().body.riskZoneId).toBe('2');
  });

  test('validateMonitoringRule omits fields that are not present', async () => {
    await apiService.validateMonitoringRule({ parkId: 1, hazardType: 'POACHING_SNARING' });
    expect(lastRequest().body).toEqual({ parkId: 1, hazardType: 'POACHING_SNARING' });
  });

  test.each(['ACTIVATE', 'SAVE_DRAFT'])('createMonitoringRule POSTs the rule fields with action %s', async (action) => {
    const body = { message: 'Monitoring rule saved.', data: SAVED_RULE };
    fetch.mockResolvedValueOnce(respond(201, body));

    await expect(apiService.createMonitoringRule(SAVED_RULE, action)).resolves.toEqual(body);
    const { url, options, body: sent } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules`);
    expect(options.method).toBe('POST');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(sent).toEqual({ ...RULE, action });
  });

  test('updateMonitoringRule PUTs the rule fields to the draft, without status, action or other saved fields', async () => {
    await apiService.updateMonitoringRule(11, { ...SAVED_RULE, action: 'ACTIVATE' });

    const { url, options, body } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules/11`);
    expect(options.method).toBe('PUT');
    expect(options.headers['Content-Type']).toBe('application/json');
    expect(body).toEqual(RULE);
  });

  test.each([
    ['activateMonitoringRule', 'activate'],
    ['deactivateMonitoringRule', 'deactivate'],
  ])('%s POSTs to /:id/%s with no body', async (method, path) => {
    await apiService[method](11);

    const { url, options } = lastRequest();
    expect(url).toBe(`${API}/monitoring-rules/11/${path}`);
    expect(options.method).toBe('POST');
    expect(options.body).toBeUndefined();
    expect(options.headers.Authorization).toBe('Bearer manager-token');
  });

  test('rule IDs are URL-encoded in the path', async () => {
    await apiService.updateMonitoringRule('1/2', RULE);
    expect(lastRequest().url).toBe(`${API}/monitoring-rules/1%2F2`);
    await apiService.activateMonitoringRule('1?x');
    expect(lastRequest().url).toBe(`${API}/monitoring-rules/1%3Fx/activate`);
  });

  test('no Authorization header is sent when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await apiService.getMonitoringRules(1);
    expect(lastRequest().options.headers).not.toHaveProperty('Authorization');
  });
});

describe('apiService - UC04 error responses', () => {
  test('a 400 keeps the status, the backend message and the field errors', async () => {
    const errors = [{ field: 'riskZoneId', code: 'ZONE_NOT_IN_PARK', message: 'The selected risk zone does not belong to the selected park.' }];
    fetch.mockResolvedValueOnce(respond(400, { error: 'The monitoring rule configuration is invalid. No changes were saved.', errors }));

    const error = await apiService.createMonitoringRule(RULE, 'ACTIVATE').catch((err) => err);
    expect(error).toMatchObject({ status: 400, message: 'The monitoring rule configuration is invalid. No changes were saved.', errors });
    expect(error.conflicts).toBeUndefined();
  });

  test('a 409 keeps the conflicting rules', async () => {
    const conflicts = [{ type: 'CONFLICT', ruleId: 9, status: 'ACTIVE', message: 'An ACTIVE rule (#9) with a different configuration already exists for this hazard and risk zone.' }];
    fetch.mockResolvedValueOnce(respond(409, { error: 'The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', conflicts }));

    await expect(apiService.updateMonitoringRule(11, RULE)).rejects.toMatchObject({ status: 409, conflicts });
  });

  test.each([
    [401, 'Authentication required.'],
    [403, 'Access denied: only Park Managers can configure monitoring rules.'],
    [404, 'Monitoring rule not found.'],
    [500, 'An unexpected error occurred while processing the monitoring rule request.'],
  ])('a %i response rejects with the HTTP status and the backend message', async (status, message) => {
    fetch.mockResolvedValueOnce(respond(status, { error: message }));
    await expect(apiService.activateMonitoringRule(11)).rejects.toMatchObject({ status, message });
  });

  test('an error body without a message falls back to a generic message', async () => {
    fetch.mockResolvedValueOnce(respond(500, {}));
    await expect(apiService.getMonitoringRules(1)).rejects.toMatchObject({ status: 500, message: 'API request failed' });
  });

  test('a /validate result with valid: false is a normal 200 response, not an error', async () => {
    const body = { data: { valid: false, errors: [{ field: 'hazardType', code: 'REQUIRED', message: 'Hazard / species is required.' }], conflicts: [], rule: null } };
    fetch.mockResolvedValueOnce(respond(200, body));
    await expect(apiService.validateMonitoringRule(RULE)).resolves.toEqual(body);
  });

  test('a network failure rejects without an HTTP status', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await apiService.validateMonitoringRule(RULE).catch((err) => err);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.status).toBeUndefined();
  });
});

describe('apiService - UC04 non-JSON error responses', () => {
  // A response whose body cannot be parsed as JSON, as fetch reports it (e.g. an HTML error page)
  const respondNonJson = (status, parseError = new SyntaxError('Unexpected token \'<\', "<!DOCTYPE "... is not valid JSON')) => ({
    ok: false, status, json: vi.fn().mockRejectedValue(parseError),
  });
  const safeMessage = (status) => `The monitoring rules service returned an unexpected response (HTTP ${status}). Please try again.`;

  test.each([
    [400, 'createMonitoringRule', () => apiService.createMonitoringRule(RULE, 'ACTIVATE')],
    [404, 'getMonitoringRules', () => apiService.getMonitoringRules(1)],
    [413, 'updateMonitoringRule', () => apiService.updateMonitoringRule(11, RULE)],
    [500, 'activateMonitoringRule', () => apiService.activateMonitoringRule(11)],
    [502, 'validateMonitoringRule', () => apiService.validateMonitoringRule(RULE)],
    [503, 'getMonitoringRuleReference', () => apiService.getMonitoringRuleReference(1)],
    [504, 'deactivateMonitoringRule', () => apiService.deactivateMonitoringRule(11)],
  ])('an HTML %i from %s rejects with the HTTP status and a safe message, not the parse error', async (status, _method, call) => {
    fetch.mockResolvedValueOnce(respondNonJson(status));

    const error = await call().catch((err) => err);

    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(safeMessage(status));
    expect(error.message).not.toMatch(/JSON|DOCTYPE|token/);
    expect(error.errors).toBeUndefined();
    expect(error.conflicts).toBeUndefined();
  });

  test('an empty error body (502 with no content) is handled like any other non-JSON body', async () => {
    fetch.mockResolvedValueOnce(respondNonJson(502, new SyntaxError('Unexpected end of JSON input')));
    await expect(apiService.getMonitoringRules(1)).rejects.toMatchObject({ status: 502, message: safeMessage(502) });
  });

  test.each([
    ['null', null],
    ['a string', 'Bad Gateway'],
    ['a number', 502],
  ])('a JSON error body that is %s (not an object) gets the safe message', async (_label, body) => {
    fetch.mockResolvedValueOnce(respond(502, body));
    await expect(apiService.activateMonitoringRule(11)).rejects.toMatchObject({ status: 502, message: safeMessage(502) });
  });

  test('a non-JSON error still differs from a network failure: only the HTTP error has a status', async () => {
    fetch.mockResolvedValueOnce(respondNonJson(502));
    const httpError = await apiService.getMonitoringRules(1).catch((err) => err);
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const networkError = await apiService.getMonitoringRules(1).catch((err) => err);

    expect(httpError.status).toBe(502);
    expect(networkError).toBeInstanceOf(TypeError);
    expect(networkError.status).toBeUndefined();
  });

  test('JSON error bodies are unchanged: message, field errors and conflicts are kept', async () => {
    const errors = [{ field: 'alertPriority', code: 'REQUIRED', message: 'Alert priority is required.' }];
    const conflicts = [{ type: 'DUPLICATE', ruleId: 4, status: 'DRAFT', message: 'An identical DRAFT rule (#4) already exists for this hazard and risk zone.' }];
    fetch.mockResolvedValueOnce(respond(409, { error: 'Duplicate rule.', errors, conflicts }));

    await expect(apiService.createMonitoringRule(RULE, 'SAVE_DRAFT'))
      .rejects.toMatchObject({ status: 409, message: 'Duplicate rule.', errors, conflicts });
  });

  test('a successful response is read as JSON once and returned unchanged', async () => {
    const response = respond(200, { data: [SAVED_RULE] });
    fetch.mockResolvedValueOnce(response);

    await expect(apiService.getMonitoringRules(1)).resolves.toEqual({ data: [SAVED_RULE] });
    expect(response.json).toHaveBeenCalledTimes(1);
  });
});

describe('apiService - UC04 successful responses without a usable JSON body', () => {
  // A 2xx response whose body cannot be parsed as JSON, as fetch reports it
  const respondOkUnparsable = (status, parseError) => ({ ok: true, status, json: vi.fn().mockRejectedValue(parseError) });
  const HTML_ERROR = new SyntaxError('Unexpected token \'<\', "<!doctype "... is not valid JSON');
  const EMPTY_ERROR = new SyntaxError('Unexpected end of JSON input');
  const MALFORMED_ERROR = new SyntaxError('Expected \',\' or \'}\' after property value in JSON at position 12');

  const readMessage = (status) => `The monitoring rules service returned an unreadable response (HTTP ${status}). Please try again.`;
  const writeMessage = (status) => `The monitoring rules service returned an unreadable response (HTTP ${status}). `
    + 'The change may have been saved; refresh the monitoring rules list before trying again.';

  const expectSafeError = (error, status, message) => {
    expect(error).toBeInstanceOf(Error);
    expect(error).not.toBeInstanceOf(SyntaxError);
    expect(error.status).toBe(status);
    expect(error.message).toBe(message);
    expect(error.message).not.toMatch(/JSON|doctype|token|position/i);
    expect(error.errors).toBeUndefined();
    expect(error.conflicts).toBeUndefined();
  };

  test.each([
    ['an HTML page', HTML_ERROR],
    ['an empty body', EMPTY_ERROR],
    ['malformed JSON', MALFORMED_ERROR],
  ])('%s in a 200 from a read rejects with the status and a "try again" message', async (_label, parseError) => {
    fetch.mockResolvedValueOnce(respondOkUnparsable(200, parseError));
    expectSafeError(await apiService.getMonitoringRuleReference(1).catch((err) => err), 200, readMessage(200));

    fetch.mockResolvedValueOnce(respondOkUnparsable(200, parseError));
    expectSafeError(await apiService.getMonitoringRules(1).catch((err) => err), 200, readMessage(200));
  });

  test('the /validate dry run never stores anything, so it gets the "try again" message', async () => {
    fetch.mockResolvedValueOnce(respondOkUnparsable(200, MALFORMED_ERROR));
    expectSafeError(await apiService.validateMonitoringRule(RULE).catch((err) => err), 200, readMessage(200));
  });

  test.each([
    ['createMonitoringRule', 201, () => apiService.createMonitoringRule(RULE, 'ACTIVATE')],
    ['updateMonitoringRule', 200, () => apiService.updateMonitoringRule(11, RULE)],
    ['activateMonitoringRule', 200, () => apiService.activateMonitoringRule(11)],
    ['deactivateMonitoringRule', 200, () => apiService.deactivateMonitoringRule(11)],
  ])('an unreadable success from %s warns that the change may have been saved', async (_method, status, call) => {
    fetch.mockResolvedValueOnce(respondOkUnparsable(status, HTML_ERROR));
    expectSafeError(await call().catch((err) => err), status, writeMessage(status));
  });

  test.each([
    ['null', null],
    ['a string', 'OK'],
    ['a number', 1],
    ['a boolean', true],
  ])('a 200 whose JSON body is %s (not an object) is treated as unreadable', async (_label, body) => {
    fetch.mockResolvedValueOnce(respond(200, body));
    expectSafeError(await apiService.getMonitoringRules(1).catch((err) => err), 200, readMessage(200));
  });

  test('an unreadable success differs from a network failure: only the response has a status', async () => {
    fetch.mockResolvedValueOnce(respondOkUnparsable(200, EMPTY_ERROR));
    const responseError = await apiService.getMonitoringRules(1).catch((err) => err);
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const networkError = await apiService.getMonitoringRules(1).catch((err) => err);

    expect(responseError.status).toBe(200);
    expect(networkError).toBeInstanceOf(TypeError);
    expect(networkError.status).toBeUndefined();
  });

  test.each([
    ['getMonitoringRuleReference', 200, { data: { park: { id: 1 }, riskZones: [], options: {} } }, () => apiService.getMonitoringRuleReference(1)],
    ['validateMonitoringRule', 200, { data: { valid: true, errors: [], conflicts: [], rule: RULE } }, () => apiService.validateMonitoringRule(RULE)],
    ['createMonitoringRule', 201, { message: 'Monitoring rule activated successfully.', data: SAVED_RULE }, () => apiService.createMonitoringRule(RULE, 'ACTIVATE')],
    ['updateMonitoringRule', 200, { message: 'Draft monitoring rule updated.', data: SAVED_RULE }, () => apiService.updateMonitoringRule(11, RULE)],
    ['activateMonitoringRule', 200, { message: 'Monitoring rule activated successfully.', data: {} }, () => apiService.activateMonitoringRule(11)],
    ['deactivateMonitoringRule', 200, { message: 'Monitoring rule deactivated.', data: {} }, () => apiService.deactivateMonitoringRule(11)],
  ])('regression: a valid JSON success from %s is still returned unchanged', async (_method, status, body, call) => {
    fetch.mockResolvedValueOnce(respond(status, body));
    await expect(call()).resolves.toEqual(body);
  });

  test('regression: an empty JSON object and an empty list are valid successful bodies', async () => {
    fetch.mockResolvedValueOnce(respond(200, {}));
    await expect(apiService.getMonitoringRules(1)).resolves.toEqual({});
    fetch.mockResolvedValueOnce(respond(200, { data: [] }));
    await expect(apiService.getMonitoringRules(1)).resolves.toEqual({ data: [] });
  });
});
