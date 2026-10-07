import React from 'react';
import { ArrowLeft, CheckCircle2, Plus } from 'lucide-react';
import RuleStatusBadge from './RuleStatusBadge';
import { RuleSummary } from './RuleReviewView';
import { RULE_ACTIONS, RULE_STATUSES, formatDateTime } from './monitoringRuleUtils';

// The outcome text follows the status the backend actually stored, so a draft is never described as active
const OUTCOME_MESSAGES = {
  [RULE_STATUSES.ACTIVE]: 'The monitoring rule has been created and activated for this park.',
  [RULE_STATUSES.DRAFT]: 'The monitoring rule has been saved as a draft. It is not active.',
};

const ACTION_STATUS = {
  [RULE_ACTIONS.ACTIVATE]: RULE_STATUSES.ACTIVE,
  [RULE_ACTIONS.SAVE_DRAFT]: RULE_STATUSES.DRAFT,
};

export default function RuleResultView({ result, parkName, riskZones, options, onBackToList, onCreateAnother }) {
  const { rule, action } = result;
  const status = rule.status || ACTION_STATUS[action];
  const isActive = status === RULE_STATUSES.ACTIVE;

  return (
    <div className="panel-card mr-panel">
      <div className="mr-result-header" role="status">
        <CheckCircle2 size={34} />
        <div>
          <h2>Monitoring Rule Created Successfully</h2>
          <p>{OUTCOME_MESSAGES[status] || result.message}</p>
        </div>
      </div>

      <div className={`mr-result-status ${isActive ? 'is-active' : ''}`}>
        <div className="mr-result-status-main">
          <span className="mr-park-label">Rule Status</span>
          <RuleStatusBadge status={status} large />
        </div>
        <dl className="mr-result-meta">
          <div><dt>Created</dt><dd>{formatDateTime(rule.createdAt)}</dd></div>
          {isActive && rule.activatedAt && (
            <div><dt>Activated</dt><dd>{formatDateTime(rule.activatedAt)}</dd></div>
          )}
        </dl>
      </div>

      <section className="mr-review-card" aria-labelledby="mr-result-info-title">
        <div className="mr-review-card-header">
          <h3 id="mr-result-info-title" className="mr-section-title">Rule Information</h3>
        </div>
        <dl className="mr-summary">
          <div className="mr-summary-row"><dt>Rule ID</dt><dd><span className="mr-code">#{rule.id}</span></dd></div>
        </dl>
        <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} hideEmptyNotes />
      </section>

      <div className="mr-actions mr-actions-split">
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBackToList}>
          <ArrowLeft size={16} /> Back to Monitoring Rules
        </button>
        <button type="button" className="btn-tactical btn-tactical-primary" onClick={onCreateAnother}>
          <Plus size={16} /> Create Another Rule
        </button>
      </div>
    </div>
  );
}
