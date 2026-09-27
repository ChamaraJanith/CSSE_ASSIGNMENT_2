import React, { useState, useEffect } from 'react';
import { 
  Compass, Users, FileText, CheckCircle2, ClipboardList, 
  ChevronRight, RefreshCw, AlertCircle
} from 'lucide-react';
import { apiService } from '../../services/api';
import PatrolPlanningDashboard from './PatrolPlanningDashboard';
import RangerAllocationEngine from './RangerAllocationEngine';
import ConfirmPatrolPlanView from './ConfirmPatrolPlanView';
import AssignmentConfirmationView from './AssignmentConfirmationView';
import ActivePatrolsRoster from './ActivePatrolsRoster';
import '../../pages/PatrolPlanning.css';

export default function PatrolPlanningManager() {
  const [activeStep, setActiveStep] = useState(1); // 1: Routes/Dashboard, 2: Rangers, 3: Confirm, 4: Dispatched, 'ROSTER': Roster
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [actionLoading, setActionLoading] = useState(false);

  // Planning Data State
  const [dashboardData, setDashboardData] = useState(null);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [routeOverrideReason, setRouteOverrideReason] = useState('');

  const [patrolDate, setPatrolDate] = useState(new Date().toISOString().split('T')[0]);
  const [startTime, setStartTime] = useState('09:00');
  const [durationHours, setDurationHours] = useState(4.0);

  const [rangersData, setRangersData] = useState(null);
  const [selectedRanger, setSelectedRanger] = useState(null);
  const [rangerOverrideReason, setRangerOverrideReason] = useState('');

  const [confirmedPlan, setConfirmedPlan] = useState(null);

  // Fetch initial dashboard data
  const loadDashboard = async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiService.getPatrolDashboard(1);
      setDashboardData(data);
      if (data.topRecommendedRoute && !selectedRoute) {
        setSelectedRoute(data.topRecommendedRoute);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to patrol telemetry services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  // When progressing from Route selection to Ranger Allocation
  const handleProceedToRangers = async (route) => {
    setSelectedRoute(route);
    setActionLoading(true);
    try {
      const recs = await apiService.getRangerRecommendations(
        route.id,
        patrolDate,
        startTime,
        durationHours
      );
      setRangersData(recs);
      setSelectedRanger(recs.recommendedRanger);
      setActiveStep(2);
    } catch (err) {
      alert(`Error retrieving ranger availability: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // When progressing from Ranger selection to Review
  const handleProceedToReview = (ranger) => {
    setSelectedRanger(ranger);
    setActiveStep(3);
  };

  // Save Plan as Draft
  const handleSaveDraft = async (dispatchNotes, equipmentList) => {
    setActionLoading(true);
    try {
      const payload = {
        parkId: dashboardData.park.id,
        routeId: selectedRoute.id,
        recommendedRouteId: dashboardData.topRecommendedRoute?.id,
        isRouteOverridden: selectedRoute.id !== dashboardData.topRecommendedRoute?.id,
        routeOverrideReason: selectedRoute.id !== dashboardData.topRecommendedRoute?.id ? routeOverrideReason : null,
        rangerId: selectedRanger?.id || null,
        recommendedRangerId: rangersData?.recommendedRanger?.id,
        isRangerOverridden: selectedRanger?.id !== rangersData?.recommendedRanger?.id,
        rangerOverrideReason: selectedRanger?.id !== rangersData?.recommendedRanger?.id ? rangerOverrideReason : null,
        patrolDate,
        startTime,
        durationHours,
        priority: selectedRoute.systemRecommendedPriority || selectedRoute.base_risk_level,
        calculatedThreatScore: selectedRoute.threatScore,
        scoreBreakdown: selectedRoute.scoreBreakdown,
        dispatchFieldNotes: dispatchNotes,
        equipmentChecklist: equipmentList,
        saveAsDraft: true
      };

      const res = await apiService.createPatrolPlan(payload);
      setConfirmedPlan(res.plan);
      setActiveStep(4);
    } catch (err) {
      alert(`Save Draft Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  // Confirm and Dispatch Plan
  const handleConfirmDispatch = async (dispatchNotes, equipmentList) => {
    setActionLoading(true);
    try {
      const payload = {
        parkId: dashboardData.park.id,
        routeId: selectedRoute.id,
        recommendedRouteId: dashboardData.topRecommendedRoute?.id,
        isRouteOverridden: selectedRoute.id !== dashboardData.topRecommendedRoute?.id,
        routeOverrideReason: selectedRoute.id !== dashboardData.topRecommendedRoute?.id ? routeOverrideReason : null,
        rangerId: selectedRanger?.id,
        recommendedRangerId: rangersData?.recommendedRanger?.id,
        isRangerOverridden: selectedRanger?.id !== rangersData?.recommendedRanger?.id,
        rangerOverrideReason: selectedRanger?.id !== rangersData?.recommendedRanger?.id ? rangerOverrideReason : null,
        patrolDate,
        startTime,
        durationHours,
        priority: selectedRoute.systemRecommendedPriority || selectedRoute.base_risk_level,
        calculatedThreatScore: selectedRoute.threatScore,
        scoreBreakdown: selectedRoute.scoreBreakdown,
        dispatchFieldNotes: dispatchNotes,
        equipmentChecklist: equipmentList,
        saveAsDraft: false
      };

      const res = await apiService.createPatrolPlan(payload);
      setConfirmedPlan(res.plan);
      setActiveStep(4);
    } catch (err) {
      alert(`Dispatch Failed: ${err.message}`);
    } finally {
      setActionLoading(false);
    }
  };

  const handleStartNewPatrol = () => {
    setSelectedRoute(dashboardData?.topRecommendedRoute || null);
    setRouteOverrideReason('');
    setSelectedRanger(null);
    setRangerOverrideReason('');
    setConfirmedPlan(null);
    setActiveStep(1);
  };

  if (loading) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '400px', color: '#34d399', gap: 12 }}>
        <RefreshCw size={32} className="animate-spin" />
        <span style={{ fontWeight: 600 }}>Connecting to Tactical Conservation Grid...</span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 30, background: 'rgba(239, 68, 68, 0.1)', border: '1px solid #ef4444', borderRadius: 12, color: '#fca5a5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1.1rem' }}>
          <AlertCircle size={20} />
          Telemetry Link Offline
        </div>
        <p style={{ marginTop: 8 }}>{error}</p>
        <button onClick={loadDashboard} className="btn-tactical btn-tactical-primary" style={{ marginTop: 12 }}>
          Retry Connection
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      {/* Workflow Navigation Bar */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', flexWrap: 'wrap', gap: 12 }}>
        <div className="workflow-stepper">
          <div 
            className={`step-chip ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}`}
            onClick={() => setActiveStep(1)}
          >
            <span>Step 1: Route Heuristics</span>
          </div>

          <ChevronRight size={14} className="step-arrow" />

          <div 
            className={`step-chip ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}`}
            onClick={() => selectedRoute && setActiveStep(2)}
          >
            <span>Step 2: Ranger Allocation</span>
          </div>

          <ChevronRight size={14} className="step-arrow" />

          <div 
            className={`step-chip ${activeStep === 3 ? 'active' : activeStep > 3 ? 'completed' : ''}`}
            onClick={() => selectedRanger && setActiveStep(3)}
          >
            <span>Step 3: Review &amp; Confirm</span>
          </div>

          <ChevronRight size={14} className="step-arrow" />

          <div className={`step-chip ${activeStep === 4 ? 'active' : ''}`}>
            <span>Step 4: Dispatch Telemetry</span>
          </div>
        </div>

        {/* Quick toggle to Active Roster */}
        <div>
          <button
            onClick={() => setActiveStep(activeStep === 'ROSTER' ? 1 : 'ROSTER')}
            style={{
              background: activeStep === 'ROSTER' ? '#10b981' : 'rgba(2, 44, 34, 0.8)',
              color: '#fff',
              border: '1px solid rgba(52, 211, 153, 0.4)',
              borderRadius: 8,
              padding: '8px 14px',
              fontSize: '0.82rem',
              fontWeight: 600,
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              gap: 8
            }}
          >
            <ClipboardList size={16} />
            <span>{activeStep === 'ROSTER' ? 'Back to Planning Console' : 'View Active Patrols Roster'}</span>
          </button>
        </div>
      </div>

      {/* Screen Views */}
      {activeStep === 1 && (
        <PatrolPlanningDashboard
          dashboardData={dashboardData}
          selectedRoute={selectedRoute}
          onSelectRoute={setSelectedRoute}
          overrideReason={routeOverrideReason}
          setOverrideReason={setRouteOverrideReason}
          onProceedToRangers={handleProceedToRangers}
          onRefresh={loadDashboard}
        />
      )}

      {activeStep === 2 && (
        <RangerAllocationEngine
          route={selectedRoute}
          rangersData={rangersData}
          selectedRanger={selectedRanger}
          onSelectRanger={setSelectedRanger}
          patrolDate={patrolDate}
          setPatrolDate={setPatrolDate}
          startTime={startTime}
          setStartTime={setStartTime}
          rangerOverrideReason={rangerOverrideReason}
          setRangerOverrideReason={setRangerOverrideReason}
          onBack={() => setActiveStep(1)}
          onProceedToReview={handleProceedToReview}
        />
      )}

      {activeStep === 3 && (
        <ConfirmPatrolPlanView
          route={selectedRoute}
          ranger={selectedRanger}
          patrolDate={patrolDate}
          startTime={startTime}
          durationHours={durationHours}
          overrideReason={routeOverrideReason}
          rangerOverrideReason={rangerOverrideReason}
          onBack={() => setActiveStep(2)}
          onSaveDraft={handleSaveDraft}
          onConfirmDispatch={handleConfirmDispatch}
          loading={actionLoading}
        />
      )}

      {activeStep === 4 && (
        <AssignmentConfirmationView
          plan={confirmedPlan}
          onGoToRoster={() => setActiveStep('ROSTER')}
          onPlanAnother={handleStartNewPatrol}
        />
      )}

      {activeStep === 'ROSTER' && (
        <ActivePatrolsRoster
          onPlanNewPatrol={handleStartNewPatrol}
          onSelectPlanToInspect={(p) => {
            setConfirmedPlan(p);
            setActiveStep(4);
          }}
        />
      )}
    </div>
  );
}
