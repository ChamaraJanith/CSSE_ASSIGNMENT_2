import { supabase } from '../supabaseClient';

const API_BASE_URL = 'http://localhost:5000/api';

// UC04: only these rule fields are sent; values are passed through unchanged (no type coercion)
const MONITORING_RULE_FIELDS = [
  'parkId', 'hazardType', 'riskZoneId', 'alertPriority', 'notificationRecipients', 'responseBehaviour', 'notes'
];

const toMonitoringRulePayload = (ruleData) => {
  const source = ruleData || {};
  return Object.fromEntries(MONITORING_RULE_FIELDS.filter((field) => field in source).map((field) => [field, source[field]]));
};

// An HTTP error carrying the status and, when the API sends them, the structured details
// (e.g. UC04 field errors / rule conflicts)
const toRequestError = (status, details, message) => {
  const requestError = new Error(message);
  requestError.status = status;
  if (Array.isArray(details.errors)) requestError.errors = details.errors;
  if (Array.isArray(details.conflicts)) requestError.conflicts = details.conflicts;
  return requestError;
};

// UC04: shown when an HTTP error has no JSON body (e.g. an HTML 502 page from a proxy)
const nonJsonErrorMessage = (status) =>
  `The monitoring rules service returned an unexpected response (HTTP ${status}). Please try again.`;

// UC04: shown when a successful (2xx) response has no usable JSON body. After a write (create, draft
// update, activate, deactivate) the change may already be stored, so the Park Manager is asked to
// check the list rather than simply retry. Reads and the /validate dry run never store anything.
const unreadableSuccessMessage = (status, mayHaveSaved) => (mayHaveSaved
  ? `The monitoring rules service returned an unreadable response (HTTP ${status}). `
    + 'The change may have been saved; refresh the monitoring rules list before trying again.'
  : `The monitoring rules service returned an unreadable response (HTTP ${status}). Please try again.`);

// Parsed JSON body, or null when the body is empty, HTML or malformed JSON
const readJsonBody = (response) => response.json().catch(() => null);

// UC04 responses are always JSON objects; null and primitives are treated as unreadable
const isJsonObject = (data) => data !== null && typeof data === 'object';

class ApiService {
  async withAuthHeaders(options) {
    const { data: { session } } = await supabase.auth.getSession();
    const headers = { ...options.headers };

    if (session?.access_token) {
      headers['Authorization'] = `Bearer ${session.access_token}`;
    }

    return { ...options, headers };
  }

  async fetchWithHandleError(url, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, await this.withAuthHeaders(options));
      const data = await response.json();

      if (!response.ok) {
        throw toRequestError(response.status, data, data.error || 'API request failed');
      }
      return data;
    } catch (error) {
      console.error(`API Error on ${url}:`, error);
      throw error;
    }
  }

  // UC04 requests: as fetchWithHandleError, but a response whose body is not a JSON object (empty,
  // HTML or malformed JSON) rejects with its HTTP status and a safe message instead of a JSON parse
  // error, so it is never mistaken for a network failure (which rejects without a status).
  // `mayHaveSaved` marks the write requests (see unreadableSuccessMessage).
  async fetchMonitoringRules(url, options = {}, { mayHaveSaved = false } = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, await this.withAuthHeaders(options));
      const data = await readJsonBody(response);

      if (response.ok) {
        if (!isJsonObject(data)) {
          throw toRequestError(response.status, {}, unreadableSuccessMessage(response.status, mayHaveSaved));
        }
        return data;
      }

      if (!isJsonObject(data)) {
        throw toRequestError(response.status, {}, nonJsonErrorMessage(response.status));
      }
      throw toRequestError(response.status, data, data.error || 'API request failed');
    } catch (error) {
      console.error(`API Error on ${url}:`, error);
      throw error;
    }
  }

  // --- Reports APIs ---
  
  async submitReport(payload) {
    return this.fetchWithHandleError('/reports/conflict', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async getAllReports(userId = null, rangerId = null) {
    let url = '/reports/conflict';
    const params = new URLSearchParams();
    if (userId) params.append('userId', userId);
    if (rangerId) params.append('rangerId', rangerId);
    
    if (params.toString()) {
      url += `?${params.toString()}`;
    }
    return this.fetchWithHandleError(url);
  }

  async getReportDetails(reportCode) {
    return this.fetchWithHandleError(`/reports/conflict/${reportCode}`);
  }

  async updateReport(reportCode, payload) {
    return this.fetchWithHandleError(`/reports/conflict/${reportCode}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async postLocationUpdate(assignmentId, latitude, longitude) {
    return this.fetchWithHandleError(`/reports/assignments/${assignmentId}/location`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ latitude, longitude })
    });
  }

  // --- Rangers APIs ---
  async getRangers() {
    return this.fetchWithHandleError('/reports/rangers');
  }

  // --- Patrol Planning APIs (UC01) ---
  async getPatrolDashboard(parkId = 1) {
    return this.fetchWithHandleError(`/patrol-planning/dashboard/${parkId}`);
  }

  async getRangerRecommendations(routeId, patrolDate, startTime, durationHours = 4.0) {
    const params = new URLSearchParams({
      patrolDate: patrolDate || '',
      startTime: startTime || '',
      durationHours: durationHours.toString()
    });
    return this.fetchWithHandleError(`/patrol-planning/routes/${routeId}/rangers?${params.toString()}`);
  }

  async createPatrolPlan(payload) {
    return this.fetchWithHandleError('/patrol-planning/plans', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async getAllPatrolPlans(parkId = 1) {
    return this.fetchWithHandleError(`/patrol-planning/plans?parkId=${parkId}`);
  }

  async updatePatrolPlanStatus(planId, status, reason = '', actorRole = 'Park Manager') {
    return this.fetchWithHandleError(`/patrol-planning/plans/${planId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, reason, actorRole })
    });
  }

  async deletePatrolPlan(planId, force = false, reason = '') {
    return this.fetchWithHandleError(`/patrol-planning/plans/${planId}`, {
      method: 'DELETE',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ force, reason })
    });
  }

  // --- Park Settings & Thresholds ---
  async getParkSettings(parkId = 1) {
    return this.fetchWithHandleError(`/patrol-planning/settings/${parkId}`);
  }

  async updateParkSettings(parkId, settings) {
    return this.fetchWithHandleError(`/patrol-planning/settings/${parkId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(settings)
    });
  }

  // --- Ranger Management ---
  async getRangersByPark(parkId = 1) {
    return this.fetchWithHandleError(`/patrol-planning/rangers/park/${parkId}`);
  }

  async registerRanger(payload) {
    return this.fetchWithHandleError('/patrol-planning/rangers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async updateRangerStatus(rangerId, status) {
    return this.fetchWithHandleError(`/patrol-planning/rangers/${rangerId}/status`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status })
    });
  }

  // --- Dynamic Staging Posts & Checkpoints ---
  async getStagingPosts(parkId = 1) {
    return this.fetchWithHandleError(`/patrol-planning/staging-posts/${parkId}`);
  }

  async createStagingPost(payload) {
    return this.fetchWithHandleError('/patrol-planning/staging-posts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async deleteStagingPost(id) {
    return this.fetchWithHandleError(`/patrol-planning/staging-posts/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Evidence Review APIs (UC02) ---
  async getEvidenceReviewQueue(status = 'ALL', search = '') {
    const params = new URLSearchParams({ status });
    if (search) params.append('search', search);
    return this.fetchWithHandleError(`/evidence-review/queue?${params.toString()}`);
  }

  async getEvidenceDetail(imageId) {
    return this.fetchWithHandleError(`/evidence-review/${encodeURIComponent(imageId)}`);
  }

  async submitEvidenceReview(imageId, payload) {
    return this.fetchWithHandleError(`/evidence-review/${encodeURIComponent(imageId)}/review`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  // --- Incidents APIs ---
  async getIncidents() {
    return this.fetchWithHandleError('/incidents');
  }

  async createIncident(payload) {
    return this.fetchWithHandleError('/incidents', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async updateIncident(id, payload) {
    return this.fetchWithHandleError(`/incidents/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
  }

  async deleteIncident(id) {
    return this.fetchWithHandleError(`/incidents/${id}`, {
      method: 'DELETE'
    });
  }

  // --- Monitoring Rules APIs (UC04) ---
  async getMonitoringRuleReference(parkId) {
    const params = new URLSearchParams({ parkId: String(parkId) });
    return this.fetchMonitoringRules(`/monitoring-rules/reference?${params.toString()}`);
  }

  async getMonitoringRules(parkId) {
    const params = new URLSearchParams({ parkId: String(parkId) });
    return this.fetchMonitoringRules(`/monitoring-rules?${params.toString()}`);
  }

  // Dry run: sends only the rule configuration; the final action is chosen later on the review screen.
  // ruleId (editing a saved draft) excludes that rule from its own duplicate detection.
  async validateMonitoringRule(ruleData, ruleId = null) {
    const payload = toMonitoringRulePayload(ruleData);
    return this.fetchMonitoringRules('/monitoring-rules/validate', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(ruleId === null ? payload : { ...payload, ruleId })
    });
  }

  // Saves changes to a DRAFT rule: same rule ID, still a DRAFT
  async updateMonitoringRule(ruleId, ruleData) {
    return this.fetchMonitoringRules(`/monitoring-rules/${encodeURIComponent(ruleId)}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(toMonitoringRulePayload(ruleData))
    }, { mayHaveSaved: true });
  }

  // DRAFT -> ACTIVE; the backend revalidates the stored rule
  async activateMonitoringRule(ruleId) {
    return this.fetchMonitoringRules(`/monitoring-rules/${encodeURIComponent(ruleId)}/activate`, { method: 'POST' }, { mayHaveSaved: true });
  }

  // ACTIVE -> INACTIVE
  async deactivateMonitoringRule(ruleId) {
    return this.fetchMonitoringRules(`/monitoring-rules/${encodeURIComponent(ruleId)}/deactivate`, { method: 'POST' }, { mayHaveSaved: true });
  }

  // action: 'ACTIVATE' | 'SAVE_DRAFT'. Status, creator and activation time are set by the backend.
  async createMonitoringRule(ruleData, action) {
    return this.fetchMonitoringRules('/monitoring-rules', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ...toMonitoringRulePayload(ruleData), action })
    }, { mayHaveSaved: true });
  }
}

export const apiService = new ApiService();

