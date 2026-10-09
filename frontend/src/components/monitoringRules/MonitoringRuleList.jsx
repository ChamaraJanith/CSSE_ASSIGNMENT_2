import React from 'react';
import { Shield, Plus, RefreshCw, AlertTriangle, CheckCircle2, Eye } from 'lucide-react';
import RuleStatusBadge from './RuleStatusBadge';
import {
  LIST_TABS, countByTab, filterByTab, formatDateTime, formatRecipients, getOptionLabel, getRuleZoneLabel,
} from './monitoringRuleUtils';

const TABS = [
  { id: LIST_TABS.ALL, label: 'All' },
  { id: LIST_TABS.ACTIVE, label: 'Active' },
  { id: LIST_TABS.DRAFT, label: 'Draft' },
  { id: LIST_TABS.INACTIVE, label: 'Inactive' },
];

// The selected tab is owned by the manager so it survives rule actions, reloads and the edit flow.
// Every row offers View Details only; the status actions live in the details dialog.
export default function MonitoringRuleList({
  rules, loading, error, options, riskZones, canCreate, createHint, activeTab, notice,
  onTabChange, onRetry, onCreate, onViewDetails,
}) {
  const counts = countByTab(rules);
  const visibleRules = filterByTab(rules, activeTab);

  return (
    <div className="panel-card mr-panel">
      <div className="panel-header mr-panel-header">
        <div className="panel-title"><Shield size={20} /> Monitoring Rules</div>
        <div className="mr-actions">
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onRetry} disabled={loading}>
            <RefreshCw size={16} /> Refresh
          </button>
          <button type="button" className="btn-tactical btn-tactical-primary" onClick={onCreate} disabled={!canCreate}>
            <Plus size={16} /> Create New Rule
          </button>
        </div>
      </div>

      {createHint && <p className="mr-muted">{createHint}</p>}

      {notice && (
        <div className="mr-notice" role="status" aria-label="Rule update">
          <CheckCircle2 size={18} /> {notice}
        </div>
      )}

      <div className="mr-tabs" role="tablist" aria-label="Monitoring rule status tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`mr-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
          >
            {tab.label} <span className="mr-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      {loading && (
        <div className="mr-state" role="status"><RefreshCw size={22} className="mr-spin" /> Loading monitoring rules…</div>
      )}

      {!loading && error && (
        <div className="mr-state mr-state-error" role="alert">
          <AlertTriangle size={26} />
          <p>{error}</p>
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onRetry}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      )}

      {!loading && !error && visibleRules.length === 0 && (
        <div className="mr-state" role="status">
          <p>
            {rules.length === 0
              ? 'No monitoring rules have been configured for this park yet.'
              : 'No monitoring rules match this tab.'}
          </p>
        </div>
      )}

      {!loading && !error && visibleRules.length > 0 && (
        <div className="mr-table-wrapper">
          <table className="tactical-table mr-table">
            <thead>
              <tr>
                <th scope="col">Rule ID</th>
                <th scope="col">Hazard / Species</th>
                <th scope="col">Risk Zone</th>
                <th scope="col">Alert Priority</th>
                <th scope="col">Recipients</th>
                <th scope="col">Response Behaviour</th>
                <th scope="col">Status</th>
                <th scope="col">Created</th>
                <th scope="col">Actions</th>
              </tr>
            </thead>
            <tbody>
              {visibleRules.map((rule) => (
                <tr key={rule.id}>
                  <td><span className="mr-code">#{rule.id}</span></td>
                  <td>{getOptionLabel(options?.hazardTypes, rule.hazardType)}</td>
                  <td>{getRuleZoneLabel(rule, riskZones)}</td>
                  <td>
                    <span className={`badge-risk ${String(rule.alertPriority || '').toLowerCase()}`}>
                      {getOptionLabel(options?.alertPriorities, rule.alertPriority)}
                    </span>
                  </td>
                  <td>{formatRecipients(options?.recipientRoles, rule.notificationRecipients)}</td>
                  <td>{getOptionLabel(options?.responseBehaviours, rule.responseBehaviour)}</td>
                  <td><RuleStatusBadge status={rule.status} /></td>
                  <td>{formatDateTime(rule.createdAt)}</td>
                  <td>
                    <button
                      type="button"
                      className="btn-tactical btn-tactical-secondary mr-row-action"
                      onClick={() => onViewDetails(rule)}
                    >
                      <Eye size={14} /> View Details
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
