const constants = require('./constants');

class HeuristicsEngine {
  /**
   * Calculate Explainable Route Priority Score (Critique UC01-C01)
   * Formula:
   * Score = (0.35 * CoverageGap) + (0.25 * DaysUnpatrolled) + (0.25 * RiskZoneSeverity) + (0.15 * RecentIncidents)
   */
  static calculateRoutePriority(route, riskZones = []) {
    // 1. Coverage Gap (0 - 100%) -> Normalised 0 - 10
    const coverageGap = route.coverage_gap_percent || 0;
    const coverageGapScore = (coverageGap / 100) * 10 * 0.35;

    // 2. Days unpatrolled (Cap at 14 days) -> Normalised 0 - 10
    let daysUnpatrolled = 0;
    if (route.last_patrolled_date) {
      const diffMs = Date.now() - new Date(route.last_patrolled_date).getTime();
      daysUnpatrolled = Math.min(14, diffMs / (1000 * 60 * 60 * 24));
    } else {
      daysUnpatrolled = 14;
    }
    const daysUnpatrolledScore = (daysUnpatrolled / 14) * 10 * 0.25;

    // 3. Overlapping Risk Zone Severity Weight (Critique UC01-C08)
    let riskWeight = 4.0; // Default Medium
    if (route.base_risk_level && constants.SEVERITY_WEIGHT_MAP[route.base_risk_level]) {
      riskWeight = constants.SEVERITY_WEIGHT_MAP[route.base_risk_level];
    }
    const riskZoneScore = riskWeight * 0.25;

    // 4. Recent Incidents (Cap at 5 incidents in last 30 days) -> Normalised 0 - 10
    const incidents = Math.min(5, route.recent_incident_count || 0);
    const incidentScore = (incidents / 5) * 10 * 0.15;

    // Total Composite Threat Score (Scale: 0.0 - 10.0)
    const totalThreatScore = Number((coverageGapScore + daysUnpatrolledScore + riskZoneScore + incidentScore).toFixed(1));

    let calculatedPriority = 'LOW';
    if (totalThreatScore >= 7.5) calculatedPriority = 'CRITICAL';
    else if (totalThreatScore >= 5.5) calculatedPriority = 'HIGH';
    else if (totalThreatScore >= 3.5) calculatedPriority = 'MEDIUM';

    return {
      totalThreatScore,
      calculatedPriority,
      breakdown: {
        coverageGapPercent: coverageGap,
        coverageGapContribution: Number(coverageGapScore.toFixed(2)),
        daysSinceLastPatrol: Number(daysUnpatrolled.toFixed(1)),
        daysSincePatrolContribution: Number(daysUnpatrolledScore.toFixed(2)),
        riskZoneSeverity: route.base_risk_level || 'MEDIUM',
        riskZoneContribution: Number(riskZoneScore.toFixed(2)),
        recentIncidentCount: incidents,
        recentIncidentsContribution: Number(incidentScore.toFixed(2))
      }
    };
  }

  static timeToMinutes(timeStr) {
    if (!timeStr) return 0;
    const parts = timeStr.split(':');
    return (parseInt(parts[0], 10) * 60) + (parseInt(parts[1], 10) || 0);
  }

  static calculateDistance(lat1, lon1, lat2, lon2) {
    if (!lat1 || !lon1 || !lat2 || !lon2) return 3.4;
    const R = 6371; // Earth radius in km
    const dLat = (lat2 - lat1) * Math.PI / 180;
    const dLon = (lon2 - lon1) * Math.PI / 180;
    const a =
      Math.sin(dLat / 2) * Math.sin(dLat / 2) +
      Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
      Math.sin(dLon / 2) * Math.sin(dLon / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return R * c;
  }
}

module.exports = HeuristicsEngine;
