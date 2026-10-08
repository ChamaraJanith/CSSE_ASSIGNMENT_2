import { describe, test, expect, vi, beforeEach, afterEach } from 'vitest';
import { apiService } from '../api';
import { supabase } from '../../supabaseClient';

// UC02 client contract: request shape, Bearer token, and HTTP status kept on errors
// (the Evidence Review UI maps 401/403/404/409 from error.status).
vi.mock('../../supabaseClient', () => ({
  supabase: { auth: { getSession: vi.fn() } },
}));

const API = 'http://localhost:5000/api';

const respond = (status, body) => ({ ok: status >= 200 && status < 300, status, json: vi.fn().mockResolvedValue(body) });

beforeEach(() => {
  vi.spyOn(console, 'error').mockImplementation(() => {});
  supabase.auth.getSession.mockResolvedValue({ data: { session: { access_token: 'officer-token' } } });
  vi.stubGlobal('fetch', vi.fn().mockResolvedValue(respond(200, { data: [] })));
});

afterEach(() => {
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

describe('apiService - UC02 evidence review endpoints', () => {
  test('getEvidenceReviewQueue requests the status filter and search with the officer Bearer token', async () => {
    await apiService.getEvidenceReviewQueue('NEEDS_FURTHER_REVIEW', 'river basin');

    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${API}/evidence-review/queue?status=NEEDS_FURTHER_REVIEW&search=river+basin`);
    expect(options.headers.Authorization).toBe('Bearer officer-token');
  });

  test('getEvidenceReviewQueue defaults to ALL and omits an empty search', async () => {
    await apiService.getEvidenceReviewQueue();
    expect(fetch.mock.calls[0][0]).toBe(`${API}/evidence-review/queue?status=ALL`);
  });

  test('getEvidenceDetail URL-encodes the evidence ID', async () => {
    await apiService.getEvidenceDetail('1/review');
    expect(fetch.mock.calls[0][0]).toBe(`${API}/evidence-review/1%2Freview`);
  });

  test('submitEvidenceReview POSTs the review payload as JSON and returns the response body', async () => {
    const body = { message: 'Evidence review recorded successfully.', data: { reviewRecorded: true } };
    fetch.mockResolvedValueOnce(respond(201, body));
    const payload = { classification: 'SUSPICIOUS_PERSON', notes: '', escalationConfirmed: true, escalationJustification: 'Rifle visible' };

    await expect(apiService.submitEvidenceReview(5, payload)).resolves.toEqual(body);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe(`${API}/evidence-review/5/review`);
    expect(options.method).toBe('POST');
    expect(options.headers).toMatchObject({ 'Content-Type': 'application/json', Authorization: 'Bearer officer-token' });
    expect(JSON.parse(options.body)).toEqual(payload);
  });

  test('no Authorization header is sent when there is no session', async () => {
    supabase.auth.getSession.mockResolvedValueOnce({ data: { session: null } });
    await apiService.getEvidenceReviewQueue();
    expect(fetch.mock.calls[0][1].headers).not.toHaveProperty('Authorization');
  });

  test.each([
    [401, 'Authentication required.'],
    [403, 'Access denied: only Wildlife Officers can review camera-trap evidence.'],
    [404, 'Camera-trap evidence not found.'],
    [409, 'Evidence IMG-YALA01-0001 has already been reviewed (REVIEWED) and cannot be reviewed again.'],
  ])('a %i response rejects with the HTTP status and the backend message', async (status, message) => {
    fetch.mockResolvedValueOnce(respond(status, { error: message }));
    await expect(apiService.submitEvidenceReview(1, { classification: 'WILDLIFE_SPECIES' }))
      .rejects.toMatchObject({ status, message });
  });

  test('a network failure rejects without an HTTP status', async () => {
    fetch.mockRejectedValueOnce(new TypeError('Failed to fetch'));
    const error = await apiService.getEvidenceDetail(1).catch((err) => err);
    expect(error).toBeInstanceOf(TypeError);
    expect(error.status).toBeUndefined();
  });
});
