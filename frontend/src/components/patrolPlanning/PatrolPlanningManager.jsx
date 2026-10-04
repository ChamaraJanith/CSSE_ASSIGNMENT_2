import React, { useState, useEffect } from 'react';
import { 
  Compass, Users, FileText, CheckCircle2, ClipboardList, 
  ChevronRight, RefreshCw, AlertCircle, Plus, Shield
} from 'lucide-react';
import { apiService } from '../../services/api';
import PatrolPlanningDashboard from './PatrolPlanningDashboard';
import RangerAllocationEngine from './RangerAllocationEngine';
import ConfirmPatrolPlanView from './ConfirmPatrolPlanView';
import AssignmentConfirmationView from './AssignmentConfirmationView';
import ActivePatrolsRoster from './ActivePatrolsRoster';
import '../../pages/PatrolPlanning.css';

export default function PatrolPlanningManager({ parkId = 1 }) {
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
      const data = await apiService.getPatrolDashboard(parkId);
      setDashboardData(data);
      if (data.topRecommendedRoute) {
        setSelectedRoute(data.topRecommendedRoute);
      }
    } catch (err) {
      setError(err.message || 'Failed to connect to patrol telemetry services');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    setSelectedRoute(null);
    setSelectedRanger(null);
    setConfirmedPlan(null);
    setActiveStep(1);
    loadDashboard();
  }, [parkId]);

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
      <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', height: '420px', color: '#34d399', gap: 14 }}>
        <RefreshCw size={36} className="animate-spin" />
        <span style={{ fontWeight: 600, fontSize: '0.95rem', letterSpacing: '0.02em' }}>
          Establishing Uplink with Tactical Conservation Grid...
        </span>
      </div>
    );
  }

  if (error) {
    return (
      <div style={{ padding: 28, background: 'rgba(239, 68, 68, 0.12)', border: '1px solid #ef4444', borderRadius: 12, color: '#fca5a5' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontWeight: 700, fontSize: '1.05rem' }}>
          <AlertCircle size={20} />
          Telemetry Connection Failed
        </div>
        <p style={{ marginTop: 8, fontSize: '0.88rem' }}>{error}</p>
        <button onClick={loadDashboard} className="btn-tactical btn-tactical-primary" style={{ marginTop: 12 }}>
          Retry Uplink
        </button>
      </div>
    );
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 18 }}>
      {/* Integrated Stepper & Mode Switch Header */}
      <div className="command-stepper-bar">
        {activeStep !== 'ROSTER' ? (
          <div className="stepper-nav">
            <div 
              className={`step-node ${activeStep === 1 ? 'active' : activeStep > 1 ? 'completed' : ''}`}
              onClick={() => setActiveStep(1)}
            >
              <span className="step-num">1</span>
              <span>Route &amp; Risk Heuristics</span>
            </div>

            <ChevronRight size={14} color="#64748b" />

            <div 
              className={`step-node ${activeStep === 2 ? 'active' : activeStep > 2 ? 'completed' : ''}`}
              onClick={() => selectedRoute && setActiveStep(2)}
            >
              <span className="step-num">2</span>
              <span>Tactical Ranger Allocation</span>
            </div>

            <ChevronRight size={14} color="#64748b" />

            <div 
              className={`step-node ${activeStep === 3 ? 'active' : activeStep > 3 ? 'completed' : ''}`}
              onClick={() => selectedRanger && setActiveStep(3)}
            >
              <span className="step-num">3</span>
              <span>Mission Authorization</span>
            </div>

            <ChevronRight size={14} color="#64748b" />

            <div className={`step-node ${activeStep === 4 ? 'active' : ''}`}>
              <span className="step-num">4</span>
              <span>Dispatch Telemetry</span>
            </div>
          </div>
        ) : (
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <ClipboardList size={20} color="#34d399" />
            <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>
              Active Patrol Deployments &amp; Operational Roster
            </span>
          </div>
        )}

        {/* Action Toggle (Roster vs New Plan) */}
        <div>
          {activeStep === 'ROSTER' ? (
            <button
              onClick={handleStartNewPatrol}
              className="btn-tactical btn-tactical-primary"
              style={{ padding: '8px 16px', fontSize: '0.82rem' }}
            >
              <Plus size={15} />
              <span>Plan New Patrol</span>
            </button>
          ) : (
            <button
              onClick={() => setActiveStep('ROSTER')}
              style={{
                background: 'rgba(255, 255, 255, 0.05)',
                color: '#cbd5e1',
                border: '1px solid rgba(255, 255, 255, 0.12)',
                borderRadius: 8,
                padding: '7px 14px',
                fontSize: '0.8rem',
                fontWeight: 600,
                cursor: 'pointer',
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                transition: 'all 0.2s ease'
              }}
              onMouseEnter={(e) => { e.currentTarget.style.borderColor = '#10b981'; e.currentTarget.style.color = '#34d399'; }}
              onMouseLeave={(e) => { e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.12)'; e.currentTarget.style.color = '#cbd5e1'; }}
            >
              <ClipboardList size={15} color="#34d399" />
              <span>View Active Deployments</span>
            </button>
          )}
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
          parkId={parkId}
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
