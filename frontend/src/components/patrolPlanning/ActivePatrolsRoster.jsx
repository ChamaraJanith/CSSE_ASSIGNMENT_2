import React, { useState, useEffect } from 'react';
import { 
  ClipboardList, CheckCircle2, Clock, XCircle, Trash2, 
  RefreshCw, Plus, Eye, AlertTriangle, Shield, Compass, Users
} from 'lucide-react';
import { apiService } from '../../services/api';

export default function ActivePatrolsRoster({ onPlanNewPatrol, onSelectPlanToInspect, parkId = 1 }) {
  const [plans, setPlans] = useState([]);
  const [loading, setLoading] = useState(true);
  const [filterStatus, setFilterStatus] = useState('ALL');
  const [actionMessage, setActionMessage] = useState(null);

  const fetchPlans = async () => {
    setLoading(true);
    try {
      const data = await apiService.getAllPatrolPlans(parkId);
      setPlans(data);
    } catch (err) {
      console.error('Fetch plans error:', err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchPlans();
  }, [parkId]);

  const handleCancelPlan = async (planId) => {
    const reason = prompt('Please enter the cancellation justification (saved for audit trail):', 'Adverse weather conditions / road impassable');
    if (!reason) return;

    try {
      await apiService.deletePatrolPlan(planId, false, reason);
      setActionMessage({ type: 'success', text: `Patrol plan #${planId} cancelled and ranger workload released.` });
      fetchPlans();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const handleDeleteDraft = async (planId) => {
    if (!confirm('Are you sure you want to permanently delete this draft patrol plan?')) return;

    try {
      await apiService.deletePatrolPlan(planId, true);
      setActionMessage({ type: 'success', text: `Draft patrol plan #${planId} permanently deleted.` });
      fetchPlans();
    } catch (err) {
      setActionMessage({ type: 'error', text: err.message });
    }
  };

  const filteredPlans = plans.filter(p => {
    if (filterStatus === 'ALL') return true;
    return p.status === filterStatus;
  });

  return (
    <div className="patrol-console-container">
      {/* Header */}
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
          <ClipboardList size={22} color="#34d399" />
          <div>
            <h2 style={{ margin: 0, fontSize: '1.25rem', color: '#fff', fontWeight: 800 }}>
              Active Patrol Plans &amp; Deployment Roster
            </h2>
            <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
              Persistent Operational History • Patrol Command Centre
            </span>
          </div>
        </div>

        <div style={{ display: 'flex', gap: 12, alignItems: 'center' }}>
          <button
            onClick={fetchPlans}
            style={{ background: 'transparent', border: '1px solid rgba(255,255,255,0.15)', color: '#94a3b8', borderRadius: 6, padding: '6px 12px', fontSize: '0.75rem', cursor: 'pointer', display: 'flex', alignItems: 'center', gap: 6 }}
          >
            <RefreshCw size={13} /> Refresh Roster
          </button>

          <button
            onClick={onPlanNewPatrol}
            className="btn-tactical btn-tactical-primary"
            style={{ padding: '8px 16px', fontSize: '0.85rem' }}
          >
            <Plus size={16} /> Plan New Patrol
          </button>
        </div>
      </div>

      {actionMessage && (
        <div style={{
          padding: '10px 16px',
          borderRadius: 8,
          fontSize: '0.82rem',
          background: actionMessage.type === 'success' ? 'rgba(16, 185, 129, 0.2)' : 'rgba(239, 68, 68, 0.2)',
          color: actionMessage.type === 'success' ? '#a7f3d0' : '#fca5a5',
          border: `1px solid ${actionMessage.type === 'success' ? '#10b981' : '#ef4444'}`
        }}>
          {actionMessage.text}
        </div>
      )}

      {/* Filter Tabs */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', paddingBottom: 4 }}>
        {['ALL', 'ASSIGNED', 'ACKNOWLEDGED', 'PENDING_ASSIGNMENT', 'DRAFT', 'CANCELLED'].map((st) => (
          <button
            key={st}
            onClick={() => setFilterStatus(st)}
            style={{
              background: filterStatus === st ? 'rgba(16, 185, 129, 0.2)' : 'rgba(2, 44, 34, 0.7)',
              color: filterStatus === st ? '#34d399' : '#94a3b8',
              border: `1px solid ${filterStatus === st ? '#10b981' : 'rgba(255, 255, 255, 0.08)'}`,
              borderRadius: 8,
              padding: '6px 14px',
              fontSize: '0.78rem',
              fontWeight: 600,
              cursor: 'pointer'
            }}
          >
            {st.replace('_', ' ')} ({plans.filter(p => st === 'ALL' || p.status === st).length})
          </button>
        ))}
      </div>

      {/* Plans Table */}
      <div className="panel-card" style={{ padding: 0, overflow: 'hidden' }}>
        {loading ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <RefreshCw size={24} className="animate-spin" style={{ margin: '0 auto 10px' }} />
            <span>Loading active patrol roster...</span>
          </div>
        ) : filteredPlans.length === 0 ? (
          <div style={{ padding: 40, textAlign: 'center', color: '#94a3b8' }}>
            <ClipboardList size={36} color="rgba(255,255,255,0.2)" style={{ margin: '0 auto 12px' }} />
            <p style={{ margin: 0, fontSize: '0.95rem', color: '#fff' }}>No patrol plans found for filter "{filterStatus}".</p>
            <p style={{ margin: '6px 0 0', fontSize: '0.8rem' }}>Create a new risk-based patrol plan to get started.</p>
          </div>
        ) : (
          <div style={{ overflowX: 'auto' }}>
            <table className="tactical-table">
              <thead>
                <tr>
                  <th>Plan Code</th>
                  <th>Route / Sector</th>
                  <th>Assigned Ranger</th>
                  <th>Date &amp; Time</th>
                  <th>Priority</th>
                  <th>Status</th>
                  <th>Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPlans.map((plan) => {
                  const statusClass = plan.status.toLowerCase();
                  const priorityClass = (plan.priority || 'high').toLowerCase();

                  return (
                    <tr key={plan.id} className="tactical-row">
                      <td>
                        <span style={{ fontFamily: 'monospace', fontWeight: 700, color: '#34d399', fontSize: '0.88rem' }}>
                          #{plan.plan_code}
                        </span>
                      </td>
                      <td>
                        <div style={{ fontWeight: 600, color: '#fff' }}>
                          {plan.route?.route_name || 'Sector Route'}
                        </div>
                        <span style={{ fontSize: '0.72rem', color: '#94a3b8' }}>
                          {plan.route?.distance_km} km • {plan.route?.terrain_type}
                        </span>
                      </td>
                      <td>
                        {plan.ranger ? (
                          <div>
                            <div style={{ fontWeight: 600, color: '#fff' }}>{plan.ranger.full_name}</div>
                            <span style={{ fontSize: '0.72rem', color: '#34d399' }}>{plan.ranger.callsign}</span>
                          </div>
                        ) : (
                          <span style={{ color: '#f59e0b', fontSize: '0.75rem', fontWeight: 600 }}>Unassigned (Pending)</span>
                        )}
                      </td>
                      <td>
                        <div style={{ color: '#fff', fontSize: '0.82rem' }}>{plan.patrol_date}</div>
                        <span style={{ color: '#94a3b8', fontSize: '0.72rem' }}>{plan.start_time} ({plan.estimated_duration_hours}h)</span>
                      </td>
                      <td>
                        <span className={`badge-risk ${priorityClass}`}>
                          {plan.priority}
                        </span>
                      </td>
                      <td>
                        <span style={{
                          display: 'inline-block',
                          padding: '3px 8px',
                          borderRadius: 6,
                          fontSize: '0.72rem',
                          fontWeight: 700,
                          background: plan.status === 'ACKNOWLEDGED' ? 'rgba(16, 185, 129, 0.2)' : plan.status === 'CANCELLED' ? 'rgba(239, 68, 68, 0.2)' : plan.status === 'DRAFT' ? 'rgba(255, 255, 255, 0.08)' : 'rgba(245, 158, 11, 0.2)',
                          color: plan.status === 'ACKNOWLEDGED' ? '#6ee7b7' : plan.status === 'CANCELLED' ? '#fca5a5' : plan.status === 'DRAFT' ? '#cbd5e1' : '#fde68a',
                          border: `1px solid ${plan.status === 'ACKNOWLEDGED' ? '#10b981' : plan.status === 'CANCELLED' ? '#ef4444' : 'rgba(255,255,255,0.1)'}`
                        }}>
                          {plan.status}
                        </span>
                      </td>
                      <td>
                        <div style={{ display: 'flex', gap: 6 }}>
                          {plan.status === 'DRAFT' ? (
                            <button
                              onClick={() => handleDeleteDraft(plan.id)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.2)',
                                border: '1px solid #ef4444',
                                color: '#fca5a5',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                cursor: 'pointer',
                                display: 'flex',
                                alignItems: 'center',
                                gap: 4
                              }}
                              title="Delete Draft"
                            >
                              <Trash2 size={12} /> Delete
                            </button>
                          ) : plan.status !== 'CANCELLED' ? (
                            <button
                              onClick={() => handleCancelPlan(plan.id)}
                              style={{
                                background: 'rgba(239, 68, 68, 0.15)',
                                border: '1px solid rgba(239, 68, 68, 0.4)',
                                color: '#fca5a5',
                                borderRadius: 6,
                                padding: '4px 8px',
                                fontSize: '0.72rem',
                                cursor: 'pointer'
                              }}
                              title="Cancel Patrol & Free Ranger"
                            >
                              Cancel
                            </button>
                          ) : null}
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
