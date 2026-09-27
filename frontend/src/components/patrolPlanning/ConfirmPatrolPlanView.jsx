import React, { useState } from 'react';
import { 
  ShieldCheck, MapPin, Users, Radio, Clock, CheckSquare, 
  ChevronLeft, Send, Save, AlertCircle, FileText, Compass
} from 'lucide-react';

export default function ConfirmPatrolPlanView({
  route,
  ranger,
  patrolDate,
  startTime,
  durationHours,
  overrideReason,
  rangerOverrideReason,
  onBack,
  onSaveDraft,
  onConfirmDispatch,
  loading
}) {
  const [dispatchNotes, setDispatchNotes] = useState(
    'Field unit advised to verify waterhole crossing depth before entering Waypoint Alpha-2 due to recent acoustic spike.'
  );
  const [equipment, setEquipment] = useState([
    { name: 'GPS Tracker Unit (Garmin InReach)', checked: true },
    { name: 'Encrypted Sat-Phone VHF Ch-04', checked: true },
    { name: 'Night Vision Goggles Mk4', checked: true },
    { name: 'Standard Field Medical Kit A', checked: true },
    { name: 'Tranquilizer & Flare Gun Kit', checked: false }
  ]);

  const toggleEquipment = (index) => {
    const updated = [...equipment];
    updated[index].checked = !updated[index].checked;
    setEquipment(updated);
  };

  return (
    <div className="patrol-console-container">
      {/* Header Banner */}
      <div style={{
        background: 'var(--tactical-card-bg)',
        border: '1px solid var(--tactical-border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div>
          <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>
            Mission Pre-Flight Authorization
          </span>
          <h2 style={{ margin: '4px 0 0', fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>
            Review &amp; Confirm Patrol Plan
          </h2>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div className="badge-defcon">READY FOR DISPATCH</div>
          <span style={{ fontSize: '0.8rem', color: '#94a3b8' }}>
            Security: <strong>SHA-256 ENCRYPTED</strong>
          </span>
        </div>
      </div>

      {/* 2-Column Summary Cards: Route & Ranger */}
      <div className="console-split">
        {/* Left: Selected Route Summary */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Compass size={18} color="#34d399" />
              <span>Selected Route Summary</span>
            </div>
            <span className={`badge-risk ${(route?.base_risk_level || 'high').toLowerCase()}`}>
              {route?.base_risk_level} Risk
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="score-metric-row">
              <span>Route Sector:</span>
              <strong style={{ color: '#fff' }}>{route?.route_name}</strong>
            </div>
            <div className="score-metric-row">
              <span>Distance:</span>
              <strong style={{ color: '#fff' }}>{route?.distance_km} km</strong>
            </div>
            <div className="score-metric-row">
              <span>Coverage Deficit:</span>
              <strong style={{ color: '#f87171' }}>{route?.coverage_gap_percent}% unmonitored</strong>
            </div>
            <div className="score-metric-row">
              <span>Est. Duration:</span>
              <strong style={{ color: '#fff' }}>{route?.estimated_duration_hours || durationHours} Hours</strong>
            </div>
            <div className="score-metric-row">
              <span>Checkpoints:</span>
              <strong style={{ color: '#fff' }}>{route?.waypoints_count || 14} Waypoints</strong>
            </div>
            <div className="score-metric-row">
              <span>Terrain Profile:</span>
              <strong style={{ color: '#fff' }}>{route?.terrain_type}</strong>
            </div>
          </div>

          {/* Elevation / Waypoints mini list */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Waypoint Trajectory</span>
            <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginTop: 8, paddingBottom: 4 }}>
              {route?.checkpoints?.map((wp, i) => (
                <div key={i} style={{ background: 'rgba(16, 185, 129, 0.1)', border: '1px solid #10b981', borderRadius: 6, padding: '4px 8px', fontSize: '0.72rem', whiteSpace: 'nowrap', color: '#a7f3d0' }}>
                  {wp.name}
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right: Selected Ranger Summary */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Users size={18} color="#34d399" />
              <span>Assigned Tactical Lead</span>
            </div>
            <span className="badge-defcon">
              {ranger?.callsign}
            </span>
          </div>

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
            <div className="score-metric-row">
              <span>Lead Officer:</span>
              <strong style={{ color: '#fff' }}>{ranger?.full_name}</strong>
            </div>
            <div className="score-metric-row">
              <span>Badge / ID:</span>
              <strong style={{ color: '#34d399' }}>{ranger?.badge_number}</strong>
            </div>
            <div className="score-metric-row">
              <span>Staging Post:</span>
              <strong style={{ color: '#fff' }}>{ranger?.base_location_name}</strong>
            </div>
            <div className="score-metric-row">
              <span>Current Workload:</span>
              <strong style={{ color: '#fff' }}>{ranger?.active_assignments_count} of 5 assignments</strong>
            </div>
            <div className="score-metric-row">
              <span>Comms Link:</span>
              <strong style={{ color: '#fff' }}>VHF Ch-04 / Iridium Burst</strong>
            </div>
            <div className="score-metric-row">
              <span>Scheduled Slot:</span>
              <strong style={{ color: '#34d399' }}>{patrolDate} @ {startTime}</strong>
            </div>
          </div>

          {/* Equipment Checklist */}
          <div style={{ background: 'rgba(0,0,0,0.3)', borderRadius: 8, padding: 12, border: '1px solid rgba(255,255,255,0.06)' }}>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Mandatory Gear Checklist</span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 8 }}>
              {equipment.map((item, idx) => (
                <label key={idx} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: '0.8rem', color: item.checked ? '#fff' : '#94a3b8', cursor: 'pointer' }}>
                  <input
                    type="checkbox"
                    checked={item.checked}
                    onChange={() => toggleEquipment(idx)}
                    style={{ accentColor: '#10b981' }}
                  />
                  <span>{item.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Logged Override Reasons & Field Notes */}
      <div className="panel-card">
        <div className="panel-header">
          <div className="panel-title">
            <FileText size={18} color="#34d399" />
            <span>Logged Audit Overrides &amp; Dispatch Field Notes</span>
          </div>
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
          {/* Overrides audit summary */}
          <div style={{ background: 'rgba(2, 44, 34, 0.6)', border: '1px solid rgba(255,255,255,0.08)', borderRadius: 8, padding: 12, fontSize: '0.82rem' }}>
            <div style={{ color: '#94a3b8', marginBottom: 4 }}>Route Override Status:</div>
            <div style={{ color: overrideReason ? '#fde68a' : '#a7f3d0', fontWeight: 600 }}>
              {overrideReason ? `Manual Override: "${overrideReason}"` : 'None (System Recommended Route Adopted)'}
            </div>

            <div style={{ color: '#94a3b8', marginTop: 10, marginBottom: 4 }}>Ranger Override Status:</div>
            <div style={{ color: rangerOverrideReason ? '#fde68a' : '#a7f3d0', fontWeight: 600 }}>
              {rangerOverrideReason ? `Manual Override: "${rangerOverrideReason}"` : 'None (System Optimal Candidate Adopted)'}
            </div>
          </div>

          {/* Dispatch Field Notes Textarea */}
          <div>
            <label style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', marginBottom: 4, display: 'block' }}>
              Dispatcher Tactical Instructions:
            </label>
            <textarea
              rows={3}
              value={dispatchNotes}
              onChange={(e) => setDispatchNotes(e.target.value)}
              style={{
                width: '100%',
                background: 'rgba(0,0,0,0.4)',
                border: '1px solid rgba(255,255,255,0.2)',
                borderRadius: 8,
                color: '#fff',
                padding: 10,
                fontSize: '0.82rem'
              }}
            />
          </div>
        </div>

        {/* Buttons Row */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 16, marginTop: 8 }}>
          <button
            onClick={onBack}
            className="btn-tactical btn-tactical-secondary"
          >
            <ChevronLeft size={16} /> Edit Parameters
          </button>

          <div style={{ display: 'flex', gap: 12 }}>
            <button
              onClick={() => onSaveDraft(dispatchNotes, equipment.filter(e => e.checked).map(e => e.name))}
              disabled={loading}
              className="btn-tactical btn-tactical-secondary"
              style={{ border: '1px solid var(--tactical-amber)', color: '#fde68a' }}
            >
              <Save size={16} /> Save as Draft
            </button>

            <button
              onClick={() => onConfirmDispatch(dispatchNotes, equipment.filter(e => e.checked).map(e => e.name))}
              disabled={loading}
              className="btn-tactical btn-tactical-primary"
              style={{ padding: '12px 24px', fontSize: '0.95rem' }}
            >
              <Send size={16} />
              <span>{loading ? 'Transmitting Dispatch...' : 'Confirm Patrol Plan & Dispatch'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
