import React, { useState, useEffect } from 'react';
import { 
  ShieldAlert, Radio, AlertTriangle, TrendingUp, Users, Compass, 
  MapPin, Clock, CheckCircle2, ChevronRight, Filter, Eye, AlertCircle, RefreshCw
} from 'lucide-react';
import TacticalMap from './TacticalMap';

export default function PatrolPlanningDashboard({ 
  dashboardData, 
  onSelectRoute, 
  selectedRoute, 
  onProceedToRangers,
  overrideReason,
  setOverrideReason,
  onRefresh
}) {
  const [filterRisk, setFilterRisk] = useState('ALL');
  const [filterGap, setFilterGap] = useState(false);
  const [showDetailModal, setShowDetailModal] = useState(false);

  const park = dashboardData?.park;
  const telemetry = dashboardData?.telemetry;
  const kpi = dashboardData?.kpi;
  const routes = dashboardData?.routes || [];
  const topRecommended = dashboardData?.topRecommendedRoute;

  // Filter routes
  const filteredRoutes = routes.filter(r => {
    if (filterRisk !== 'ALL' && r.base_risk_level !== filterRisk) return false;
    if (filterGap && r.coverage_gap_percent < 50) return false;
    return true;
  });

  const activeRoute = selectedRoute || topRecommended;

  return (
    <div className="patrol-console-container">
      {/* 1. Top Telemetry & Network Status Ribbon */}
      <div className="telemetry-ribbon">
        <div className="telemetry-item">
          <div className={`pulse-indicator ${telemetry?.isDegraded ? 'warning' : ''}`}></div>
          <div>
            <span style={{ color: '#fff', fontWeight: 600, fontSize: '0.85rem' }}>AUTOMATED HEURISTICS ENGINE</span>
            <span style={{ color: '#94a3b8', marginLeft: 8, fontSize: '0.78rem' }}>GRID-{park?.code || 'YALA-NP'}</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 16 }}>
          <div className="telemetry-item" style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
            <Clock size={13} color="#34d399" />
            <span>Data Last Synced: <strong style={{ color: '#fff' }}>{telemetry?.lastSynced ? new Date(telemetry.lastSynced).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Live'}</strong></span>
          </div>
          <div className="telemetry-item" style={{ color: '#94a3b8', fontSize: '0.78rem' }}>
            <Radio size={14} color="#10b981" />
            <span>Telemetry: <strong style={{ color: '#34d399' }}>{telemetry?.networkHealth || '99.4% Live'}</strong></span>
          </div>
          <div className="badge-defcon">{telemetry?.defconStatus || 'DEFCON 4 - ACTIVE'}</div>
          <button 
            onClick={onRefresh}
            style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 4, fontSize: '0.75rem' }}
            title="Refresh Grid Telemetry"
          >
            <RefreshCw size={13} /> Refresh
          </button>
        </div>
      </div>

      {/* 2. KPI Summary Grid */}
      <div className="kpi-grid">
        <div className="kpi-card">
          <div className="kpi-card-header">
            <span>Critical Blindspots</span>
            <span style={{ color: '#ef4444', background: 'rgba(239, 68, 68, 0.15)', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>URGENT</span>
          </div>
          <div className="kpi-card-value">{kpi?.blindspotZonesCount || 1} Zones</div>
          <div className="kpi-card-sub" style={{ color: '#f87171' }}>
            <AlertCircle size={13} /> Unmonitored &gt; 72 hours
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span>Acoustic Tripwire Alerts</span>
            <span style={{ color: '#34d399', fontSize: '0.75rem' }}>24h Log</span>
          </div>
          <div className="kpi-card-value">{kpi?.acousticSpikesLast24h ?? 0} Spikes</div>
          <div className="kpi-card-sub">
            <TrendingUp size={13} /> Elevated Frequency in {kpi?.topSectorName || 'Priority Sector'}
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span>Rangers Deployed</span>
            <span style={{ color: '#34d399', background: 'rgba(16, 185, 129, 0.15)', padding: '2px 6px', borderRadius: 4, fontSize: '0.7rem' }}>ACTIVE</span>
          </div>
          <div className="kpi-card-value">{kpi?.activeRangersDeployed || '0/0 Active'}</div>
          <div className="kpi-card-sub">
            <Users size={13} /> {kpi?.standbyUnitsCount ?? 0} Unit{kpi?.standbyUnitsCount !== 1 ? 's' : ''} on Standby
          </div>
        </div>

        <div className="kpi-card">
          <div className="kpi-card-header">
            <span>Risk Coverage Index</span>
            <span style={{ color: '#94a3b8', fontSize: '0.75rem' }}>Target: 90%</span>
          </div>
          <div className="kpi-card-value">{kpi?.riskCoverageIndex || '48%'}</div>
          <div className="kpi-card-sub" style={{ color: '#f59e0b' }}>
            <AlertTriangle size={13} /> Severe Gap in River Corridor
          </div>
        </div>
      </div>

      {/* 3. Main Split Console: Routes Surveillance & Algorithmic Recommendation */}
      <div className="console-split">
        {/* Left Column: Routes List & Filters */}
        <div className="panel-card">
          <div className="panel-header">
            <div className="panel-title">
              <Compass size={20} color="#34d399" />
              <span>Active Surveillance Routes ({filteredRoutes.length})</span>
            </div>
            
            {/* Filter buttons */}
            <div style={{ display: 'flex', gap: 6 }}>
              <select 
                value={filterRisk} 
                onChange={(e) => setFilterRisk(e.target.value)}
                style={{ 
                  background: 'rgba(2, 44, 34, 0.8)', 
                  color: '#fff', 
                  border: '1px solid rgba(52, 211, 153, 0.3)', 
                  borderRadius: 6, 
                  padding: '4px 8px', 
                  fontSize: '0.75rem' 
                }}
              >
                <option value="ALL">All Risk Levels</option>
                <option value="CRITICAL">Critical</option>
                <option value="HIGH">High</option>
                <option value="MEDIUM">Medium</option>
                <option value="LOW">Low</option>
              </select>

              <button
                onClick={() => setFilterGap(!filterGap)}
                style={{
                  background: filterGap ? 'rgba(245, 158, 11, 0.25)' : 'rgba(2, 44, 34, 0.8)',
                  color: filterGap ? '#fde68a' : '#94a3b8',
                  border: '1px solid rgba(245, 158, 11, 0.3)',
                  borderRadius: 6,
                  padding: '4px 8px',
                  fontSize: '0.75rem',
                  cursor: 'pointer'
                }}
              >
                Gap &gt; 50%
              </button>
            </div>
          </div>

          {/* Routes Table */}
          <div style={{ overflowX: 'auto' }}>
            <table className="tactical-table">
              <thead>
                <tr>
                  <th>Route / Sector</th>
                  <th>Risk Level</th>
                  <th>Coverage Gap</th>
                  <th>Threat Score</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {filteredRoutes.map((route) => {
                  const isRec = route.id === topRecommended?.id;
                  const isSel = route.id === activeRoute?.id;
                  const riskClass = (route.base_risk_level || 'medium').toLowerCase();

                  return (
                    <tr 
                      key={route.id} 
                      className={`tactical-row ${isSel ? 'selected' : ''}`}
                      onClick={() => onSelectRoute(route)}
                    >
                      <td>
                        <div style={{ display: 'flex', flexDirection: 'column', gap: 2 }}>
                          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                            <span style={{ fontWeight: 700, color: '#fff' }}>{route.route_name}</span>
                            {isRec && (
                              <span style={{ 
                                background: 'rgba(16, 185, 129, 0.2)', 
                                color: '#34d399', 
                                border: '1px solid #10b981', 
                                borderRadius: 4, 
                                fontSize: '0.65rem', 
                                padding: '1px 5px',
                                fontWeight: 800
                              }}>
                                ★ RECOMMENDED
                              </span>
                            )}
                            {route.is_telemetry_stale && (
                              <span style={{ 
                                background: 'rgba(245, 158, 11, 0.15)', 
                                color: '#fde68a', 
                                border: '1px solid rgba(245, 158, 11, 0.4)', 
                                borderRadius: 4, 
                                fontSize: '0.62rem', 
                                padding: '1px 5px',
                                fontWeight: 700
                              }}>
                                ⚠ LIMITED CONFIDENCE
                              </span>
                            )}
                          </div>
                          <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                            {route.terrain_type} • {route.distance_km} km
                          </span>
                        </div>
                      </td>
                      <td>
                        <span className={`badge-risk ${riskClass}`}>
                          {route.base_risk_level}
                        </span>
                      </td>
                      <td style={{ width: '130px' }}>
                        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '0.72rem' }}>
                          <span style={{ color: route.coverage_gap_percent > 60 ? '#f87171' : '#34d399', fontWeight: 700 }}>
                            {route.coverage_gap_percent}% Deficit
                          </span>
                        </div>
                        <div className="progress-bar-container">
                          <div 
                            className="progress-bar-fill" 
                            style={{ 
                              width: `${route.coverage_gap_percent}%`,
                              background: route.coverage_gap_percent > 60 ? '#ef4444' : '#10b981'
                            }}
                          ></div>
                        </div>
                      </td>
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 800, color: '#34d399', fontSize: '0.95rem' }}>
                          {route.threatScore} / 10
                        </span>
                      </td>
                      <td>
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            onSelectRoute(route);
                            setShowDetailModal(true);
                          }}
                          style={{
                            background: isSel ? 'rgba(16, 185, 129, 0.25)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSel ? '#34d399' : '#fff',
                            border: `1px solid ${isSel ? '#10b981' : 'rgba(255, 255, 255, 0.1)'}`,
                            padding: '6px 12px',
                            borderRadius: 6,
                            fontSize: '0.75rem',
                            cursor: 'pointer',
                            fontWeight: 600
                          }}
                        >
                          View Detail
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </div>

        {/* Right Column: Priority Route Detail & Explainable AI Score ("Why this route?") */}
        <div className="panel-card">
          <div className="panel-header">
            <div>
              <span style={{ fontSize: '0.75rem', color: '#94a3b8', textTransform: 'uppercase', letterSpacing: '0.05em' }}>
                Algorithmic Evaluation
              </span>
              <div className="panel-title" style={{ marginTop: 2 }}>
                {activeRoute?.route_name || 'Select a Route'}
              </div>
            </div>
            
            <div style={{ textAlign: 'right' }}>
              <span className={`badge-risk ${(activeRoute?.base_risk_level || 'medium').toLowerCase()}`}>
                {activeRoute?.base_risk_level || 'MEDIUM'} PRIORITY
              </span>
              <div style={{ fontSize: '1.25rem', fontWeight: 900, color: '#34d399', fontFamily: 'monospace', marginTop: 4 }}>
                {activeRoute?.threatScore || 8.0} / 10
              </div>
            </div>
          </div>

          {/* Tactical Map Component */}
          <TacticalMap route={activeRoute} park={park} />

          {/* Limited Confidence Warning Banner (Stale Telemetry Notice) */}
          {activeRoute?.is_telemetry_stale && (
            <div style={{
              background: 'rgba(245, 158, 11, 0.12)',
              border: '1px solid #f59e0b',
              borderRadius: 8,
              padding: '10px 14px',
              display: 'flex',
              alignItems: 'center',
              gap: 10,
              color: '#fde68a',
              fontSize: '0.8rem',
              marginTop: 10
            }}>
              <AlertTriangle size={18} color="#f59e0b" style={{ flexShrink: 0 }} />
              <div>
                <strong>Limited Confidence Alert:</strong> Incident and sensor coverage telemetry for this sector is older than 48 hours. Field radio confirmation recommended before dispatch.
              </div>
            </div>
          )}

          {/* Explainable AI "Why this route?" Breakdown */}
          <div className="explainable-card">
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
              <span style={{ fontWeight: 700, fontSize: '0.88rem', color: '#fff', display: 'flex', alignItems: 'center', gap: 6 }}>
                <ShieldAlert size={16} color="#34d399" />
                Why was this route prioritized?
              </span>
              <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>Formula weights normalized</span>
            </div>

            <div className="score-metric-row">
              <span>Coverage Deficit Gap ({activeRoute?.coverage_gap_percent}%)</span>
              <span className="score-badge">+{activeRoute?.scoreBreakdown?.coverageGapContribution || '2.87'} pts</span>
            </div>

            <div className="score-metric-row">
              <span>Risk Zone Overlap Severity ({activeRoute?.base_risk_level})</span>
              <span className="score-badge">+{activeRoute?.scoreBreakdown?.riskZoneContribution || '2.50'} pts</span>
            </div>

            <div className="score-metric-row">
              <span>Recent Incidents ({activeRoute?.recent_incident_count} in last 30d)</span>
              <span className="score-badge">+{activeRoute?.scoreBreakdown?.recentIncidentsContribution || '0.90'} pts</span>
            </div>

            <div className="score-metric-row">
              <span>Days Unpatrolled ({activeRoute?.scoreBreakdown?.daysSinceLastPatrol || '3.1'} days)</span>
              <span className="score-badge">+{activeRoute?.scoreBreakdown?.daysSincePatrolContribution || '0.55'} pts</span>
            </div>
          </div>

          {/* Route Override Audit Input (Critique UC01-C06 / BR-UC01-04) */}
          {activeRoute?.id !== topRecommended?.id && (
            <div style={{ background: 'rgba(245, 158, 11, 0.1)', border: '1px solid #f59e0b', borderRadius: 8, padding: 12 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 6, color: '#fde68a', fontWeight: 600, fontSize: '0.8rem', marginBottom: 6 }}>
                <AlertTriangle size={14} />
                Route Override Detected (Bypassing Top Recommendation)
              </div>
              <textarea
                placeholder="Enter mandatory operational justification for overriding the system-recommended route (Required for audit)..."
                value={overrideReason}
                onChange={(e) => setOverrideReason(e.target.value)}
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

          {/* Action to proceed to Ranger Selection */}
          <button
            onClick={() => onProceedToRangers(activeRoute)}
            className="btn-tactical btn-tactical-primary"
            style={{ width: '100%', padding: '14px', fontSize: '0.95rem' }}
          >
            <span>Proceed to Ranger Allocation</span>
            <ChevronRight size={18} />
          </button>
        </div>
      </div>
    </div>
  );
}
