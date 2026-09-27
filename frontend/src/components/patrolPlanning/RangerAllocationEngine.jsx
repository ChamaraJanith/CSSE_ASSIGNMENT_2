import React, { useState } from 'react';
import { 
  Users, UserCheck, Shield, AlertTriangle, Lock, Clock, MapPin, 
  ChevronLeft, ChevronRight, CheckCircle2, Award, Info
} from 'lucide-react';

export default function RangerAllocationEngine({
  route,
  rangersData,
  selectedRanger,
  onSelectRanger,
  patrolDate,
  setPatrolDate,
  startTime,
  setStartTime,
  rangerOverrideReason,
  setRangerOverrideReason,
  onBack,
  onProceedToReview
}) {
  const rangers = rangersData?.rangers || [];
  const recommendedRanger = rangersData?.recommendedRanger;
  const activeRanger = selectedRanger || recommendedRanger;

  const isOverride = activeRanger?.id !== recommendedRanger?.id;
  const isConflictBlocked = activeRanger?.hasScheduleConflict && (!rangerOverrideReason || rangerOverrideReason.trim().length < 5);

  return (
    <div className="patrol-console-container">
      {/* Route Context Banner */}
      <div style={{
        background: 'rgba(2, 44, 34, 0.85)',
        border: '1px solid var(--tactical-border)',
        borderRadius: 12,
        padding: '14px 20px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        flexWrap: 'wrap',
        gap: 12
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#10b981', boxShadow: '0 0 10px #10b981' }}></div>
          <div>
            <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
              Target Patrol Deployment Sector
            </span>
            <div style={{ fontSize: '1.1rem', fontWeight: 800, color: '#fff' }}>
              {route?.route_name || 'Sector 7B - Northern River Basin'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 16, alignItems: 'center', fontSize: '0.85rem' }}>
          <div>
            <span style={{ color: '#94a3b8' }}>Distance:</span> <strong style={{ color: '#fff' }}>{route?.distance_km} km</strong>
          </div>
          <div>
            <span style={{ color: '#94a3b8' }}>Est. Duration:</span> <strong style={{ color: '#fff' }}>{route?.estimated_duration_hours} hrs</strong>
          </div>
          <div>
            <span className={`badge-risk ${(route?.base_risk_level || 'high').toLowerCase()}`}>
              {route?.base_risk_level || 'HIGH'} RISK
            </span>
          </div>
        </div>
      </div>

      {/* Deployment Schedule Inputs */}
      <div style={{
        background: 'var(--tactical-card-bg)',
        border: '1px solid var(--tactical-border)',
        borderRadius: 12,
        padding: '16px 20px',
        display: 'flex',
        alignItems: 'center',
        gap: 20,
        flexWrap: 'wrap'
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <Clock size={18} color="#34d399" />
          <span style={{ fontWeight: 600, fontSize: '0.9rem', color: '#fff' }}>Patrol Timing:</span>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Date:</label>
          <input 
            type="date" 
            value={patrolDate} 
            onChange={(e) => setPatrolDate(e.target.value)}
            style={{
              background: 'rgba(2, 44, 34, 0.9)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 12px',
              fontSize: '0.85rem'
            }}
          />
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ fontSize: '0.8rem', color: '#94a3b8' }}>Start Time:</label>
          <input 
            type="time" 
            value={startTime} 
            onChange={(e) => setStartTime(e.target.value)}
            style={{
              background: 'rgba(2, 44, 34, 0.9)',
              border: '1px solid rgba(52, 211, 153, 0.3)',
              borderRadius: 6,
              color: '#fff',
              padding: '6px 12px',
              fontSize: '0.85rem'
            }}
          />
        </div>
      </div>

      {/* Main 2-Column Split: Ranked Rangers List vs Allocation Detail */}
      <div className="console-split">
        {/* Left: Ranked Rangers List */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Users size={20} color="#34d399" />
              <span>Ranked Field Rangers ({rangers.length})</span>
            </div>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>Sorted by Heuristic Match</span>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
            {rangers.map((ranger) => {
              const isRec = ranger.id === recommendedRanger?.id;
              const isSel = ranger.id === activeRanger?.id;
              const isConflict = ranger.hasScheduleConflict;

              return (
                <div
                  key={ranger.id}
                  onClick={() => onSelectRanger(ranger)}
                  className={`ranger-card ${isSel ? 'selected' : ''} ${isConflict ? 'locked' : ''}`}
                  style={{
                    borderLeft: isSel ? '4px solid #10b981' : isConflict ? '4px solid #ef4444' : '1px solid rgba(255,255,255,0.08)'
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                      <div style={{
                        width: 40,
                        height: 40,
                        borderRadius: '50%',
                        background: isRec ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255,255,255,0.06)',
                        border: `1px solid ${isRec ? '#10b981' : 'rgba(255,255,255,0.1)'}`,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        fontWeight: 700,
                        color: isRec ? '#34d399' : '#fff'
                      }}>
                        {ranger.full_name?.split(' ').map(n => n[0]).join('')}
                      </div>

                      <div>
                        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ fontWeight: 700, color: '#fff', fontSize: '0.95rem' }}>{ranger.full_name}</span>
                          {isRec && (
                            <span style={{ background: '#10b981', color: '#fff', fontSize: '0.65rem', padding: '1px 6px', borderRadius: 4, fontWeight: 800 }}>
                              RECOMMENDED MATCH
                            </span>
                          )}
                        </div>
                        <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                          {ranger.callsign} • ID: {ranger.badge_number}
                        </span>
                      </div>
                    </div>

                    <div style={{ textAlign: 'right' }}>
                      <span style={{ 
                        fontFamily: 'monospace', 
                        fontWeight: 800, 
                        color: isConflict ? '#f87171' : '#34d399', 
                        fontSize: '1rem' 
                      }}>
                        {ranger.matchScorePercent}% Match
                      </span>
                      <div style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                        {ranger.calculatedDistanceKm} km away (ETA ~{ranger.estimatedEtaMinutes}m)
                      </div>
                    </div>
                  </div>

                  {/* Schedule Conflict Warning (Critique UC01-C04) */}
                  {isConflict && (
                    <div className="conflict-box" style={{ marginTop: 6 }}>
                      <AlertTriangle size={16} className="conflict-icon" />
                      <div>
                        <strong>Schedule Conflict Detected:</strong> {ranger.conflictDetails}
                        <div style={{ fontSize: '0.72rem', color: '#fca5a5', marginTop: 2 }}>
                          Requires mandatory supervisor override to reassign.
                        </div>
                      </div>
                    </div>
                  )}

                  {/* Workload Meter */}
                  <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', fontSize: '0.75rem', color: '#94a3b8' }}>
                    <span>Active Workload: <strong style={{ color: '#fff' }}>{ranger.active_assignments_count} / {ranger.max_active_assignments} tasks</strong></span>
                    <span style={{ color: ranger.current_status === 'AVAILABLE' ? '#34d399' : '#f59e0b' }}>
                      ● {ranger.current_status}
                    </span>
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Right: Allocation Analysis & Override Notes */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Selected Candidate Analysis</span>
              <div className="panel-title" style={{ marginTop: 2 }}>
                {activeRanger?.full_name}
              </div>
            </div>
            <div className="badge-defcon">
              {activeRanger?.callsign}
            </div>
          </div>

          {/* "Why this ranger?" Panel (Critique UC01-C02) */}
          <div className="explainable-card">
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, color: '#fff', fontWeight: 700, fontSize: '0.9rem' }}>
              <UserCheck size={18} color="#34d399" />
              <span>Why this Ranger Candidate?</span>
            </div>

            <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 8, fontSize: '0.82rem', color: '#cbd5e1' }}>
              {activeRanger?.recommendationRationale?.map((item, idx) => (
                <li key={idx}>{item}</li>
              ))}
            </ul>

            <div style={{ borderTop: '1px solid rgba(255,255,255,0.08)', paddingTop: 10, marginTop: 4 }}>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8', textTransform: 'uppercase' }}>Field Certifications:</span>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 6 }}>
                {activeRanger?.certifications?.map((c, i) => (
                  <span key={i} style={{ background: 'rgba(52, 211, 153, 0.15)', color: '#34d399', padding: '3px 8px', borderRadius: 4, fontSize: '0.72rem' }}>
                    ✓ {c}
                  </span>
                ))}
              </div>
            </div>
          </div>

          {/* Ranger Override Note Box (Critique BR-UC01-06) */}
          {isOverride && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fde68a', fontWeight: 600, fontSize: '0.8rem', marginBottom: 6 }}>
                <AlertTriangle size={14} />
                Ranger Override Notice (Selecting non-recommended candidate)
              </div>
              <textarea
                placeholder="State operational justification for selecting this ranger instead of top recommendation..."
                value={rangerOverrideReason}
                onChange={(e) => setRangerOverrideReason(e.target.value)}
                style={{
                  width: '100%',
                  background: 'rgba(0,0,0,0.4)',
                  border: '1px solid rgba(255,255,255,0.2)',
                  borderRadius: 6,
                  color: '#fff',
                  padding: 8,
                  fontSize: '0.8rem',
                  resize: 'vertical',
                  minHeight: '60px'
                }}
              />
            </div>
          )}

          {/* Navigation Controls */}
          <div style={{ display: 'flex', gap: 12, marginTop: 'auto' }}>
            <button
              onClick={onBack}
              className="btn-tactical btn-tactical-secondary"
              style={{ flex: 1 }}
            >
              <ChevronLeft size={16} /> Back
            </button>

            <button
              onClick={() => onProceedToReview(activeRanger)}
              disabled={isConflictBlocked}
              className="btn-tactical btn-tactical-primary"
              style={{ flex: 2 }}
            >
              <span>Proceed to Plan Review</span>
              <ChevronRight size={16} />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
