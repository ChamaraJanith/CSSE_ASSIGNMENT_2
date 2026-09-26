const API_BASE_URL = 'http://localhost:5000/api';

class ApiService {
  async fetchWithHandleError(url, options = {}) {
    try {
      const response = await fetch(`${API_BASE_URL}${url}`, options);
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

  // --- Rangers APIs ---
  async getRangers() {
    return this.fetchWithHandleError('/reports/rangers');
  }
}

export const apiService = new ApiService();
