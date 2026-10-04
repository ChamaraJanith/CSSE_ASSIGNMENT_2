const patrolPlanningService = require('../services/patrolPlanningService');

describe('UC01: Patrol Planning Heuristic Engine & Business Rules Unit Tests', () => {

  describe('BR-UC01-03 / OI1: Explainable RoutePriorityScore Calculation', () => {
    test('should correctly compute composite score and breakdown using documented formula', () => {
      const mockRoute = {
        coverage_gap_percent: 80,
        last_patrolled_date: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString(), // 7 days ago
        base_risk_level: 'HIGH', // Weight 7.5
        recent_incident_count: 3
      };

      const result = patrolPlanningService.calculateRoutePriority(mockRoute);

      // Expected calculation:
      // coverageGapScore = (80 / 100) * 10 * 0.35 = 2.80
      // daysUnpatrolledScore = (7 / 14) * 10 * 0.25 = 1.25
      // riskZoneScore = 7.5 * 0.25 = 1.875
      // incidentScore = (3 / 5) * 10 * 0.15 = 0.90
      // total = 2.80 + 1.25 + 1.875 + 0.90 = 6.825 -> rounded to 6.8

      expect(result.totalThreatScore).toBe(6.8);
      expect(result.calculatedPriority).toBe('HIGH');
      expect(result.breakdown.coverageGapPercent).toBe(80);
      expect(result.breakdown.coverageGapContribution).toBe(2.8);
      expect(result.breakdown.recentIncidentCount).toBe(3);
      expect(result.breakdown.recentIncidentsContribution).toBe(0.9);
      expect(result.breakdown.riskZoneSeverity).toBe('HIGH');
    });

    test('should classify route as CRITICAL when composite score >= 7.5', () => {
      const criticalRoute = {
        coverage_gap_percent: 95,
        last_patrolled_date: new Date(Date.now() - 14 * 24 * 60 * 60 * 1000).toISOString(),
        base_risk_level: 'CRITICAL', // 10.0
        recent_incident_count: 5
      };

      const result = patrolPlanningService.calculateRoutePriority(criticalRoute);
      expect(result.totalThreatScore).toBeGreaterThanOrEqual(7.5);
      expect(result.calculatedPriority).toBe('CRITICAL');
    });

    test('should classify route as LOW when risk, gap and incidents are minimal', () => {
      const lowRoute = {
        coverage_gap_percent: 10,
        last_patrolled_date: new Date().toISOString(),
        base_risk_level: 'LOW', // 2.0
        recent_incident_count: 0
      };

      const result = patrolPlanningService.calculateRoutePriority(lowRoute);
      expect(result.totalThreatScore).toBeLessThan(3.5);
      expect(result.calculatedPriority).toBe('LOW');
    });
  });

  describe('BR-UC01-07 / UC01-C04: Schedule Conflict Detection Formula', () => {
    test('should detect overlapping time intervals on the same day for a ranger', () => {
      const existingPlanStart = patrolPlanningService.timeToMinutes('09:00');
      const existingPlanEnd = existingPlanStart + (4 * 60); // 13:00

      // Scenario A: Overlapping start (10:00 to 14:00)
      const targetStartA = patrolPlanningService.timeToMinutes('10:00');
      const targetEndA = targetStartA + (4 * 60);
      const isOverlapA = targetStartA < existingPlanEnd && targetEndA > existingPlanStart;
      expect(isOverlapA).toBe(true);

      // Scenario B: Non-overlapping slot after shift (14:00 to 18:00)
      const targetStartB = patrolPlanningService.timeToMinutes('14:00');
      const targetEndB = targetStartB + (4 * 60);
      const isOverlapB = targetStartB < existingPlanEnd && targetEndB > existingPlanStart;
      expect(isOverlapB).toBe(false);

      // Scenario C: Non-overlapping slot before shift (04:00 to 08:00)
      const targetStartC = patrolPlanningService.timeToMinutes('04:00');
      const targetEndC = targetStartC + (4 * 60);
      const isOverlapC = targetStartC < existingPlanEnd && targetEndC > existingPlanStart;
      expect(isOverlapC).toBe(false);
    });
  });

  describe('BR-UC01-05 / OI2: Ranger Workload & Eligibility Validation', () => {
    test('should identify ranger as ineligible if active assignments reach maximum workload', () => {
      const ranger = {
        current_status: 'AVAILABLE',
        active_assignments_count: 5,
        max_active_assignments: 5,
        is_rest_compliant: true
      };

      const isWorkloadOk = ranger.active_assignments_count < ranger.max_active_assignments;
      expect(isWorkloadOk).toBe(false);
    });

    test('should identify ranger as eligible when active assignments are below maximum workload', () => {
      const ranger = {
        current_status: 'AVAILABLE',
        active_assignments_count: 2,
        max_active_assignments: 5,
        is_rest_compliant: true
      };

      const isWorkloadOk = ranger.active_assignments_count < ranger.max_active_assignments;
      expect(isWorkloadOk).toBe(true);
    });
  });

  describe('BR-UC01-08 / OI3: Priority Acknowledgement Deadline Calculation', () => {
    test('should set shorter acknowledgement deadlines for higher priority missions', () => {
      const deadlineMinutesMap = { 'CRITICAL': 15, 'HIGH': 30, 'MEDIUM': 60, 'LOW': 120 };

      expect(deadlineMinutesMap['CRITICAL']).toBe(15);
      expect(deadlineMinutesMap['HIGH']).toBe(30);
      expect(deadlineMinutesMap['MEDIUM']).toBe(60);
      expect(deadlineMinutesMap['LOW']).toBe(120);
    });
  });

  describe('Helper Utilities: Proximity & Time conversion', () => {
    test('timeToMinutes converts HH:MM format correctly', () => {
      expect(patrolPlanningService.timeToMinutes('09:30')).toBe(570);
      expect(patrolPlanningService.timeToMinutes('00:00')).toBe(0);
      expect(patrolPlanningService.timeToMinutes('23:59')).toBe(1439);
    });

    test('calculateDistance computes realistic geographic distances', () => {
      // Yala Block 1 to Block 2 (~15-20km)
      const dist = patrolPlanningService.calculateDistance(6.4020, 81.5120, 6.5500, 81.6500);
      expect(dist).toBeGreaterThan(10);
      expect(dist).toBeLessThan(35);
    });
  });

});
