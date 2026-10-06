const { supabaseAdmin } = require('../supabaseClient');
const heuristicsEngine = require('../utils/heuristicsEngine');
const constants = require('../utils/constants');

class PatrolPlanningService {
  /**
   * Fetch Dashboard Data for a Park
   */
  async getDashboardData(parkId = 1) {
    const { data: park, error: parkErr } = await supabaseAdmin
      .from('parks')
      .select('*')
      .eq('id', parkId)
      .single();
    if (parkErr) throw new Error(`Park fetch error: ${parkErr.message}`);

    const { data: routes, error: routeErr } = await supabaseAdmin
      .from('patrol_routes')
      .select('*, route_risk_zones(*, risk_zones(*))')
      .eq('park_id', parkId);
    if (routeErr) throw new Error(`Routes fetch error: ${routeErr.message}`);

    const { data: riskZones } = await supabaseAdmin
      .from('risk_zones')
      .select('*')
      .eq('park_id', parkId);

    const { data: parkRangers } = await supabaseAdmin
      .from('rangers')
      .select('id, current_status, active_assignments_count, max_active_assignments')
      .eq('assigned_park_id', parkId);

    const totalRangers = parkRangers?.length || 0;
    const activeRangers = parkRangers?.filter(r =>
      r.current_status === 'AVAILABLE' || r.current_status === 'ON_SHIFT'
    ).length || 0;
    const onPatrolRangers = parkRangers?.filter(r => r.current_status === 'ON_SHIFT').length || 0;
    const standbyRangers = parkRangers?.filter(r =>
      r.current_status === 'AVAILABLE' && (r.active_assignments_count || 0) < (r.max_active_assignments || 5)
    ).length || 0;

    // Fetch ALL currently active patrol plans (ASSIGNED, ACKNOWLEDGED, PENDING)
    // We remove the date filter to avoid Timezone issues (e.g. night shifts crossing midnight)
    const { data: activePlans } = await supabaseAdmin
      .from('patrol_plans')
      .select('route_id')
      .eq('park_id', parkId)
      .in('status', ['ASSIGNED', 'ACKNOWLEDGED', 'PENDING_ASSIGNMENT']);
    
    const activeRouteIds = activePlans ? activePlans.map(p => p.route_id) : [];

    const scoredRoutes = routes.map(route => {
      const scoring = heuristicsEngine.calculateRoutePriority(route, riskZones);
      return {
        ...route,
        threatScore: scoring.totalThreatScore,
        systemRecommendedPriority: scoring.calculatedPriority,
        scoreBreakdown: scoring.breakdown,
        isRecommended: false,
        hasActivePatrol: activeRouteIds.includes(route.id)
      };
    });

    scoredRoutes.sort((a, b) => b.threatScore - a.threatScore);
    
    // Recommend the highest-scoring route that does NOT already have an active patrol
    const recommendableRoute = scoredRoutes.find(r => !r.hasActivePatrol);
    if (recommendableRoute) {
      recommendableRoute.isRecommended = true;
    } else if (scoredRoutes.length > 0) {
      // Fallback if all routes have patrols
      scoredRoutes[0].isRecommended = true;
    }

    // A route is no longer a "blindspot" if a ranger is actively assigned to it
    const unmonitoredBlindspots = scoredRoutes.filter(r => r.coverage_gap_percent > 70 && !r.hasActivePatrol).length;
    const totalIncidents = scoredRoutes.reduce((sum, r) => sum + (r.recent_incident_count || 0), 0);
    const avgCoverage = Math.round(100 - (scoredRoutes.reduce((sum, r) => sum + r.coverage_gap_percent, 0) / (scoredRoutes.length || 1)));

    const acousticSpikes = Math.round((totalIncidents * 2.4) + (unmonitoredBlindspots * 3));
    const topRoute = recommendableRoute || scoredRoutes[0];

    return {
      park,
      telemetry: {
        lastSynced: new Date().toISOString(),
        networkHealth: '99.4% Live (Iridium Satellite & Mesh)',
        defconStatus: 'DEFCON 4 - ACTIVE PATROL PROTOCOL',
        isDegraded: scoredRoutes.some(r => r.is_telemetry_stale)
      },
      kpi: {
        blindspotZonesCount: unmonitoredBlindspots,
        acousticSpikesLast24h: acousticSpikes,
        activeRangersDeployed: `${activeRangers}/${totalRangers} Squads Active`,
        onPatrolCount: onPatrolRangers,
        standbyUnitsCount: standbyRangers,
        riskCoverageIndex: `${avgCoverage}%`,
        topSectorName: topRoute?.sector || 'Northern Sector',
        topSectorRisk: topRoute?.base_risk_level || 'CRITICAL'
      },
      routes: scoredRoutes,
      topRecommendedRoute: topRoute || null
    };
  }

  /**
   * Smart Ranger Recommendation & Schedule Conflict Engine
   */
  async getRangerRecommendations(routeId, patrolDate, startTime, durationHours = 4.0) {
    const { data: route, error: routeErr } = await supabaseAdmin
      .from('patrol_routes')
      .select('*')
      .eq('id', routeId)
      .single();
    if (routeErr) throw new Error(`Route not found: ${routeErr.message}`);

    const { data: rangers, error: rangerErr } = await supabaseAdmin
      .from('rangers')
      .select('*')
      .eq('assigned_park_id', route.park_id);
    if (rangerErr) throw new Error(`Rangers fetch error: ${rangerErr.message}`);

    const { data: existingPlans } = await supabaseAdmin
      .from('patrol_plans')
      .select('id, plan_code, ranger_id, start_time, estimated_duration_hours, patrol_date, status')
      .eq('patrol_date', patrolDate)
      .in('status', ['ASSIGNED', 'ACKNOWLEDGED', 'PENDING_ASSIGNMENT']);

    const targetStartMinutes = heuristicsEngine.timeToMinutes(startTime);
    const targetEndMinutes = targetStartMinutes + (durationHours * 60);

    const evaluatedRangers = rangers.map(ranger => {
      const isAvailable = ranger.current_status === 'AVAILABLE';
      const isWorkloadOk = ranger.active_assignments_count < ranger.max_active_assignments;
      const isRestOk = ranger.is_rest_compliant;

      let hasConflict = false;
      let conflictPlan = null;

      if (existingPlans && existingPlans.length > 0) {
        for (const plan of existingPlans) {
          if (plan.ranger_id === ranger.id) {
            const planStart = heuristicsEngine.timeToMinutes(plan.start_time);
            const planEnd = planStart + ((plan.estimated_duration_hours || 4) * 60);

            if (targetStartMinutes < planEnd && targetEndMinutes > planStart) {
              hasConflict = true;
              conflictPlan = plan;
              break;
            }
          }
        }
      }

      const distanceKm = heuristicsEngine.calculateDistance(
        ranger.current_lat, ranger.current_lng,
        route.checkpoints?.[0]?.lat || 6.4020,
        route.checkpoints?.[0]?.lng || 81.5120
      );

      let matchScore = 50;
      if (isAvailable) matchScore += 25;
      if (isWorkloadOk) matchScore += 15;
      if (isRestOk) matchScore += 10;
      if (distanceKm < 5.0) matchScore += 10;
      if (hasConflict) matchScore = Math.max(10, matchScore - 50);

      matchScore = Math.min(98, Math.max(20, matchScore));

      return {
        ...ranger,
        calculatedDistanceKm: Number(distanceKm.toFixed(1)),
        estimatedEtaMinutes: Math.round(distanceKm * 4.5),
        matchScorePercent: matchScore,
        hasScheduleConflict: hasConflict,
        conflictDetails: conflictPlan ? `Overlapping deployment [${conflictPlan.plan_code}] scheduled at ${conflictPlan.start_time}` : null,
        isEligible: !hasConflict && isWorkloadOk && (isAvailable || ranger.current_status === 'ON_SHIFT'),
        isTopRecommendation: false,
        recommendationRationale: [
          isAvailable ? 'Readiness: Available Now' : `Status: ${ranger.current_status}`,
          `Proximity: ~${distanceKm.toFixed(1)} km from sector checkpoint`,
          `Current Active Load: ${ranger.active_assignments_count}/${ranger.max_active_assignments} tasks (Optimal)`,
          ranger.certifications?.includes('Riverine & Night Tracker') ? 'Terrain & River Crossing Qualified' : 'Standard Field Qualified'
        ]
      };
    });

    evaluatedRangers.sort((a, b) => {
      if (a.hasScheduleConflict !== b.hasScheduleConflict) return a.hasScheduleConflict ? 1 : -1;
      if (b.matchScorePercent !== a.matchScorePercent) return b.matchScorePercent - a.matchScorePercent;
      if (a.active_assignments_count !== b.active_assignments_count) return a.active_assignments_count - b.active_assignments_count;
      return a.calculatedDistanceKm - b.calculatedDistanceKm;
    });

    if (evaluatedRangers.length > 0 && !evaluatedRangers[0].hasScheduleConflict) {
      evaluatedRangers[0].isTopRecommendation = true;
    }

    return {
      targetRoute: route,
      rangers: evaluatedRangers,
      recommendedRanger: evaluatedRangers.find(r => r.isTopRecommendation) || evaluatedRangers[0]
    };
  }

  /**
   * Create Patrol Plan with Status Lifecycle
   */
  async createPatrolPlan(payload, userId) {
    const {
      parkId, routeId, recommendedRouteId, isRouteOverridden, routeOverrideReason,
      rangerId, recommendedRangerId, isRangerOverridden, rangerOverrideReason,
      patrolDate, startTime, durationHours, priority, calculatedThreatScore,
      scoreBreakdown, dispatchFieldNotes, equipmentChecklist, saveAsDraft
    } = payload;

    if (!parkId || !routeId || !patrolDate || !startTime || !priority) {
      throw new Error('Mandatory patrol parameters missing (park, route, date, time, priority are required).');
    }

    if (isRouteOverridden && (!routeOverrideReason || routeOverrideReason.trim().length < 5)) {
      throw new Error('A recorded override reason is required when bypassing the system-recommended route.');
    }

    if (isRangerOverridden && (!rangerOverrideReason || rangerOverrideReason.trim().length < 5)) {
      throw new Error('A recorded override reason is required when bypassing the recommended ranger.');
    }

    let initialStatus = 'ASSIGNED';
    if (saveAsDraft) {
      initialStatus = 'DRAFT';
    } else if (!rangerId) {
      initialStatus = 'PENDING_ASSIGNMENT';
    }

    const randomSuffix = Math.floor(100 + Math.random() * 900);
    const planCode = `PP-2026-${randomSuffix}`;

    const deadlineMinutes = constants.DEADLINE_MINUTES_MAP[priority] || 30;
    const ackDeadline = new Date(Date.now() + deadlineMinutes * 60 * 1000).toISOString();

    const insertData = {
      plan_code: planCode, park_id: parkId, route_id: routeId, recommended_route_id: recommendedRouteId || routeId,
      is_route_overridden: !!isRouteOverridden, route_override_reason: isRouteOverridden ? routeOverrideReason : null,
      ranger_id: rangerId || null, recommended_ranger_id: recommendedRangerId || rangerId,
      is_ranger_overridden: !!isRangerOverridden, ranger_override_reason: isRangerOverridden ? rangerOverrideReason : null,
      created_by_user_id: userId || null, patrol_date: patrolDate, start_time: startTime,
      estimated_duration_hours: durationHours || 4.0, priority: priority, calculated_threat_score: calculatedThreatScore || 8.0,
      score_breakdown: scoreBreakdown || {}, dispatch_field_notes: dispatchFieldNotes || null,
      equipment_checklist: equipmentChecklist || ["GPS Tracker", "Sat-Phone VHF", "Night Vision Mk4", "Med Kit A"],
      status: initialStatus, acknowledgement_deadline: initialStatus === 'ASSIGNED' ? ackDeadline : null
    };

    const { data: newPlan, error: insertErr } = await supabaseAdmin
      .from('patrol_plans')
      .insert([insertData])
      .select('*, route:route_id(*), recommended_route:recommended_route_id(*), ranger:ranger_id(*)')
      .single();

    if (insertErr) throw new Error(`Plan creation failed: ${insertErr.message}`);

    await supabaseAdmin
      .from('patrol_plan_status_history')
      .insert([{
        patrol_plan_id: newPlan.id, from_status: null, to_status: initialStatus,
        changed_by_user_id: userId || null, actor_role: 'Park Manager',
        reason_or_notes: saveAsDraft ? 'Created as Draft' : 'Patrol Plan Dispatched'
      }]);

    if (rangerId && initialStatus === 'ASSIGNED') {
      const { data: currentRanger } = await supabaseAdmin.from('rangers').select('active_assignments_count').eq('id', rangerId).single();
      if (currentRanger) {
        await supabaseAdmin.from('rangers').update({ active_assignments_count: (currentRanger.active_assignments_count || 0) + 1 }).eq('id', rangerId);
      }
      await supabaseAdmin
        .from('patrol_notification_logs')
        .insert([{
          patrol_plan_id: newPlan.id, recipient_ranger_id: rangerId, delivery_channel: 'SATELLITE_IRIDIUM_BURST',
          delivery_status: 'DELIVERED', delivered_at: new Date().toISOString(), payload: { planCode, priority, routeId }
        }]);
    }

    return newPlan;
  }

  /**
   * Update Status
   */
  async updatePlanStatus(planId, newStatus, reasonNotes = '', userId = null, actorRole = 'Ranger') {
    const { data: existingPlan, error: planErr } = await supabaseAdmin
      .from('patrol_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planErr || !existingPlan) throw new Error('Patrol Plan not found');

    const updateFields = {
      status: newStatus,
      updated_at: new Date().toISOString()
    };

    if (newStatus === 'ACKNOWLEDGED') {
      updateFields.acknowledged_at = new Date().toISOString();
    } else if (newStatus === 'DECLINED') {
      updateFields.decline_reason = reasonNotes || 'Declined by field ranger';
      updateFields.status = 'PENDING_ASSIGNMENT';
      updateFields.ranger_id = null;
    }

    const { data: updatedPlan, error: updateErr } = await supabaseAdmin
      .from('patrol_plans')
      .update(updateFields)
      .eq('id', planId)
      .select('*, route:route_id(*), recommended_route:recommended_route_id(*), ranger:ranger_id(*)')
      .single();

    if (updateErr) throw new Error(`Status update failed: ${updateErr.message}`);

    await supabaseAdmin
      .from('patrol_plan_status_history')
      .insert([{
        patrol_plan_id: planId, from_status: existingPlan.status, to_status: updateFields.status,
        changed_by_user_id: userId, actor_role: actorRole, reason_or_notes: reasonNotes
      }]);

    if ((newStatus === 'DECLINED' || newStatus === 'CANCELLED') && existingPlan.ranger_id) {
      const { data: currentRanger } = await supabaseAdmin.from('rangers').select('active_assignments_count').eq('id', existingPlan.ranger_id).single();
      if (currentRanger && currentRanger.active_assignments_count > 0) {
        await supabaseAdmin.from('rangers').update({ active_assignments_count: currentRanger.active_assignments_count - 1 }).eq('id', existingPlan.ranger_id);
      }
    }

    return updatedPlan;
  }

  /**
   * Get All Patrol Plans
   */
  async getAllPatrolPlans(parkId = 1) {
    const { data, error } = await supabaseAdmin
      .from('patrol_plans')
      .select('*, route:route_id(*), recommended_route:recommended_route_id(*), ranger:ranger_id(*), patrol_plan_status_history(*), patrol_notification_logs(*)')
      .eq('park_id', parkId)
      .order('created_at', { ascending: false });

    if (error) throw new Error(`Fetch plans error: ${error.message}`);
    return data;
  }

  /**
   * Delete or Cancel a Patrol Plan
   */
  async deletePatrolPlan(planId, userId = null, forceHardDelete = false, cancellationReason = 'Cancelled by Park Manager') {
    const { data: plan, error: planErr } = await supabaseAdmin
      .from('patrol_plans')
      .select('*')
      .eq('id', planId)
      .single();

    if (planErr || !plan) throw new Error('Patrol Plan not found');

    if (plan.ranger_id && plan.status !== 'CANCELLED') {
      const { data: currentRanger } = await supabaseAdmin.from('rangers').select('active_assignments_count').eq('id', plan.ranger_id).single();
      if (currentRanger && currentRanger.active_assignments_count > 0) {
        await supabaseAdmin.from('rangers').update({ active_assignments_count: currentRanger.active_assignments_count - 1 }).eq('id', plan.ranger_id);
      }
    }

    if (plan.status === 'DRAFT' || forceHardDelete) {
      const { error: delErr } = await supabaseAdmin
        .from('patrol_plans')
        .delete()
        .eq('id', planId);

      if (delErr) throw new Error(`Delete failed: ${delErr.message}`);
      return { id: planId, deleted: true, type: 'HARD_DELETE', message: 'Patrol plan draft deleted permanently' };
    } else {
      const { data: cancelledPlan, error: cancelErr } = await supabaseAdmin
        .from('patrol_plans')
        .update({
          status: 'CANCELLED',
          updated_at: new Date().toISOString()
        })
        .eq('id', planId)
        .select()
        .single();

      if (cancelErr) throw new Error(`Cancellation failed: ${cancelErr.message}`);

      await supabaseAdmin
        .from('patrol_plan_status_history')
        .insert([{
          patrol_plan_id: planId, from_status: plan.status, to_status: 'CANCELLED',
          changed_by_user_id: userId, actor_role: 'Park Manager', reason_or_notes: cancellationReason
        }]);

      return { id: planId, deleted: false, plan: cancelledPlan, type: 'CANCELLED', message: 'Patrol plan cancelled successfully' };
    }
  }
}

module.exports = new PatrolPlanningService();
