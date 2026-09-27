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
        throw new Error(data.error || 'API request failed');
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
}

export const apiService = new ApiService();
