import React from 'react';
import { ArrowLeft, CheckCircle2 } from 'lucide-react';
import RuleStatusBadge from './RuleStatusBadge';
import { RuleSummary } from './RuleReviewView';
import { RULE_ACTIONS, formatDateTime } from './monitoringRuleUtils';

const ACTION_LABELS = {
  [RULE_ACTIONS.ACTIVATE]: 'Rule activated',
  [RULE_ACTIONS.SAVE_DRAFT]: 'Rule saved as draft',
};

export default function RuleResultView({ result, parkName, riskZones, options, onBackToList }) {
  const { rule, action, message } = result;

  return (
    <div className="panel-card mr-panel">
      <div className="mr-result-header">
        <CheckCircle2 size={34} />
        <div>
          <h2>{ACTION_LABELS[action] || 'Monitoring rule saved'}</h2>
          <p>{message}</p>
        </div>
      </div>

      <h3 className="mr-section-title">Saved Rule</h3>
      <dl className="mr-summary">
        <div className="mr-summary-row"><dt>Rule ID</dt><dd><span className="mr-code">#{rule.id}</span></dd></div>
        <div className="mr-summary-row"><dt>Status</dt><dd><RuleStatusBadge status={rule.status} /></dd></div>
        {rule.activatedAt && (
          <div className="mr-summary-row"><dt>Activated</dt><dd>{formatDateTime(rule.activatedAt)}</dd></div>
        )}
        <div className="mr-summary-row"><dt>Created</dt><dd>{formatDateTime(rule.createdAt)}</dd></div>
      </dl>
      <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} />

      <div className="mr-actions mr-actions-end">
        <button type="button" className="btn-tactical btn-tactical-primary" onClick={onBackToList}>
          <ArrowLeft size={16} /> Back to Monitoring Rules
        </button>
      </div>
    </div>
  );
}
