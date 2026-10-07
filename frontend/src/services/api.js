import { supabase } from '../supabaseClient';

const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
  async fetchWithHandleError(url, options = {}) {
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers = { ...options.headers };
      
      if (session?.access_token) {
        headers['Authorization'] = `Bearer ${session.access_token}`;
      }
      
      const updatedOptions = { ...options, headers };

      const response = await fetch(`${API_BASE_URL}${url}`, updatedOptions);
      const data = await response.json();
      
      if (!response.ok) {
        const requestError = new Error(data.error || 'API request failed');
        requestError.status = response.status;
        throw requestError;
      }
      return data;
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
}

export const apiService = new ApiService();

