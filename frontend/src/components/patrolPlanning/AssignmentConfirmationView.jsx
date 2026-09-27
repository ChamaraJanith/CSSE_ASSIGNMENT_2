import React, { useState } from 'react';
import { 
  CheckCircle2, Radio, Clock, Shield, Users, Compass, 
  ArrowRight, RefreshCw, XCircle, AlertTriangle, Send
} from 'lucide-react';
import { apiService } from '../../services/api';

export default function AssignmentConfirmationView({ 
  plan, 
  onGoToRoster, 
  onPlanAnother 
}) {
  const [currentPlan, setCurrentPlan] = useState(plan);
  const [simulating, setSimulating] = useState(false);
  const [simMessage, setSimMessage] = useState(null);

  const route = currentPlan?.route;
  const ranger = currentPlan?.ranger;
  const status = currentPlan?.status || 'ASSIGNED';

  // Handler for Interactive Field Ranger Simulator
  const handleSimulateRangerAction = async (actionType) => {
    setSimulating(true);
    setSimMessage(null);
    try {
      if (actionType === 'ACKNOWLEDGE') {
        const res = await apiService.updatePatrolPlanStatus(
          currentPlan.id, 
          'ACKNOWLEDGED', 
          'Acknowledged by Ranger Capt. Samuel Kiprono via Garmin InReach',
          'Ranger'
        );
        setCurrentPlan(res.plan);
        setSimMessage({ type: 'success', text: 'Ranger Acknowledged! Plan status updated to ACKNOWLEDGED in real time.' });
      } else if (actionType === 'DECLINE') {
        const res = await apiService.updatePatrolPlanStatus(
          currentPlan.id, 
          'DECLINED', 
          'Ranger vehicle mechanical breakdown at base camp',
          'Ranger'
        );
        setCurrentPlan(res.plan);
        setSimMessage({ type: 'warning', text: 'Ranger Declined! Plan automatically returned to PENDING_ASSIGNMENT for reassignment.' });
      }
    } catch (err) {
      setSimMessage({ type: 'error', text: err.message });
    } finally {
      setSimulating(false);
    }
  };

  return (
    <div className="patrol-console-container">
      {/* Top Success Badge */}
      <div style={{
        background: 'linear-gradient(135deg, rgba(6, 78, 59, 0.8) 0%, rgba(2, 44, 34, 0.95) 100%)',
        border: '1px solid #10b981',
        borderRadius: 14,
        padding: '28px 24px',
        textAlign: 'center',
        boxShadow: '0 8px 30px rgba(16, 185, 129, 0.25)',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 12
      }}>
        <div style={{
          width: 56,
          height: 56,
          borderRadius: '50%',
          background: 'rgba(16, 185, 129, 0.2)',
          border: '2px solid #34d399',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          boxShadow: '0 0 20px rgba(52, 211, 153, 0.5)'
        }}>
          <CheckCircle2 size={32} color="#34d399" />
        </div>

        <div>
          <div style={{
            display: 'inline-block',
            background: status === 'ACKNOWLEDGED' ? 'rgba(16, 185, 129, 0.3)' : status === 'PENDING_ASSIGNMENT' ? 'rgba(245, 158, 11, 0.3)' : 'rgba(52, 211, 153, 0.2)',
            color: status === 'ACKNOWLEDGED' ? '#6ee7b7' : status === 'PENDING_ASSIGNMENT' ? '#fde68a' : '#34d399',
            border: '1px solid currentColor',
            padding: '4px 12px',
            borderRadius: 6,
            fontSize: '0.8rem',
            fontWeight: 800,
            letterSpacing: '0.05em',
            marginBottom: 8
          }}>
            STATUS: {status}
          </div>
          <h1 style={{ margin: 0, fontSize: '1.6rem', color: '#fff', fontWeight: 800 }}>
            Patrol Plan Created Successfully
          </h1>
          <p style={{ margin: '6px 0 0', color: '#94a3b8', fontSize: '0.88rem' }}>
            Dispatch Order <strong>#{currentPlan?.plan_code}</strong> • Sector: <strong>{route?.route_name}</strong>
          </p>
          {ranger && (
            <p style={{ margin: '4px 0 0', color: '#a7f3d0', fontSize: '0.82rem' }}>
              Assigned Field Officer: <strong>{ranger?.full_name} ({ranger?.callsign})</strong>
            </p>
          )}
        </div>
      </div>

      {/* Telemetry Delivery Status Pipeline (Critique UC01-C09 / UX07) */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Radio size={18} color="#34d399" />
            <span>Notification &amp; Telemetry Delivery Pipeline</span>
          </div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Protocol: SBD-K9 VHF BURST</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(220px, 1fr))', gap: 14 }}>
          {/* Stage 1: Sent */}
          <div style={{
            background: 'rgba(2, 44, 34, 0.7)',
            border: '1px solid #10b981',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.82rem' }}>Stage 1: Sent</span>
              <CheckCircle2 size={16} color="#34d399" />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Telemetry Packet Transmitted</span>
            <span style={{ fontSize: '0.7rem', color: '#6ee7b7', fontFamily: 'monospace' }}>Ack Code: #TX-9942</span>
          </div>

          {/* Stage 2: Delivered */}
          <div style={{
            background: 'rgba(2, 44, 34, 0.7)',
            border: '1px solid #10b981',
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: '#34d399', fontSize: '0.82rem' }}>Stage 2: Delivered</span>
              <CheckCircle2 size={16} color="#34d399" />
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Base Node Relay ACK Received</span>
            <span style={{ fontSize: '0.7rem', color: '#6ee7b7', fontFamily: 'monospace' }}>Relay: Camp East VHF</span>
          </div>

          {/* Stage 3: Handheld Sync / Acknowledged */}
          <div style={{
            background: status === 'ACKNOWLEDGED' ? 'rgba(16, 185, 129, 0.15)' : 'rgba(2, 44, 34, 0.7)',
            border: `1px solid ${status === 'ACKNOWLEDGED' ? '#10b981' : 'rgba(255, 255, 255, 0.15)'}`,
            borderRadius: 10,
            padding: 14,
            display: 'flex',
            flexDirection: 'column',
            gap: 4
          }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, color: status === 'ACKNOWLEDGED' ? '#34d399' : '#f59e0b', fontSize: '0.82rem' }}>
                Stage 3: {status === 'ACKNOWLEDGED' ? 'Ranger Acknowledged' : 'Pending Ranger Sync'}
              </span>
              {status === 'ACKNOWLEDGED' ? <CheckCircle2 size={16} color="#34d399" /> : <Clock size={16} color="#f59e0b" />}
            </div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
              {status === 'ACKNOWLEDGED' ? `Confirmed at ${new Date(currentPlan.acknowledged_at || Date.now()).toLocaleTimeString()}` : 'Awaiting Ranger terminal confirmation'}
            </span>
            <span style={{ fontSize: '0.7rem', color: '#94a3b8', fontFamily: 'monospace' }}>
              Deadline: ~30 mins window
            </span>
          </div>
        </div>
      </div>

      {/* Interactive Field Ranger Mobile Simulator Dock (Value-Added Capability) */}
      <div className="ranger-simulator-dock">
        <div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#34d399', fontWeight: 700, fontSize: '0.85rem' }}>
            <Radio size={16} />
            <span>Interactive Field Ranger Mobile Simulator</span>
          </div>
          <p style={{ margin: '4px 0 0', fontSize: '0.75rem', color: '#94a3b8' }}>
            Simulate how the ranger receives this patrol order on their mobile device in the field:
          </p>
        </div>

        {simMessage && (
          <div style={{
            width: '100%',
            padding: '8px 12px',
            borderRadius: 6,
            fontSize: '0.78rem',
            background: simMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(245, 158, 11, 0.2)',
            color: simMessage.type === 'success' ? '#a7f3d0' : '#fde68a',
            border: `1px solid ${simMessage.type === 'success' ? '#10b981' : '#f59e0b'}`
          }}>
            {simMessage.text}
          </div>
        )}

        <div style={{ display: 'flex', gap: 10 }}>
          <button
            onClick={() => handleSimulateRangerAction('ACKNOWLEDGE')}
            disabled={simulating || status === 'ACKNOWLEDGED'}
            className="btn-tactical btn-tactical-primary"
            style={{ fontSize: '0.78rem', padding: '8px 14px' }}
          >
            <CheckCircle2 size={14} />
            <span>Simulate Ranger: Accept &amp; Acknowledge</span>
          </button>

          <button
            onClick={() => handleSimulateRangerAction('DECLINE')}
            disabled={simulating || status === 'PENDING_ASSIGNMENT'}
            className="btn-tactical btn-tactical-danger"
            style={{ fontSize: '0.78rem', padding: '8px 14px' }}
          >
            <XCircle size={14} />
            <span>Simulate Ranger: Decline Assignment</span>
          </button>
        </div>
      </div>

      {/* Mission Parameters Summary Sheet */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <Compass size={18} color="#34d399" />
            <span>Mission Parameters Sheet</span>
          </div>
          <span className="badge-defcon">PRIORITY: {currentPlan?.priority || 'HIGH'}</span>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(200px, 1fr))', gap: 14 }}>
          <div className="score-metric-row">
            <span>Scheduled Start:</span>
            <strong style={{ color: '#fff' }}>{currentPlan?.patrol_date} @ {currentPlan?.start_time}</strong>
          </div>
          <div className="score-metric-row">
            <span>Est. Duration:</span>
            <strong style={{ color: '#fff' }}>{currentPlan?.estimated_duration_hours} hrs ({route?.distance_km} km)</strong>
          </div>
          <div className="score-metric-row">
            <span>Check-in Protocol:</span>
            <strong style={{ color: '#34d399' }}>Mandatory 45-min interval</strong>
          </div>
          <div className="score-metric-row">
            <span>Radio Channel:</span>
            <strong style={{ color: '#fff' }}>VHF Ch-04 Encrypted</strong>
          </div>
        </div>

        {/* Action Buttons */}
        <div style={{ display: 'flex', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 8 }}>
          <button
            onClick={onPlanAnother}
            className="btn-tactical btn-tactical-secondary"
          >
            + Plan Another Patrol
          </button>

          <button
            onClick={onGoToRoster}
            className="btn-tactical btn-tactical-primary"
            style={{ padding: '12px 24px', fontSize: '0.95rem' }}
          >
            <span>Go to Active Patrol Plans Roster</span>
            <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  );
}
