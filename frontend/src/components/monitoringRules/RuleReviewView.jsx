import React from 'react';
import { ArrowLeft, CheckCircle2, Save } from 'lucide-react';
import {
  NOT_RECORDED, REVIEW_STEP, RULE_ACTIONS, TOTAL_STEPS, findZone, formatRecipients, formatZone, getOptionLabel,
} from './monitoringRuleUtils';

export function RuleSummary({ rule, parkName, riskZones, options }) {
  const rows = [
    ['Park', parkName],
    ['Hazard / Species', getOptionLabel(options?.hazardTypes, rule.hazardType)],
    ['Risk Zone', formatZone(rule.riskZone || findZone(riskZones, rule.riskZoneId))],
    ['Alert Priority', getOptionLabel(options?.alertPriorities, rule.alertPriority)],
    ['Notification Recipients', formatRecipients(options?.recipientRoles, rule.notificationRecipients)],
    ['Response Behaviour', getOptionLabel(options?.responseBehaviours, rule.responseBehaviour)],
    ['Notes', rule.notes || NOT_RECORDED],
  ];

  return (
    <dl className="mr-summary">
      {rows.map(([label, value]) => (
        <div key={label} className="mr-summary-row">
          <dt>{label}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

// Nothing is saved until the Park Manager chooses Activate Rule or Save as Draft
export default function RuleReviewView({
  rule, parkName, riskZones, options, submittingAction, error, onBack, onCreate,
}) {
  const submitting = Boolean(submittingAction);

  return (
    <div className="panel-card mr-panel">
      <div className="panel-header mr-panel-header">
        <div>
          <div className="panel-title"><CheckCircle2 size={20} /> Review Monitoring Rule</div>
          <span className="mr-step-indicator">Step {REVIEW_STEP.id} of {TOTAL_STEPS}</span>
        </div>
      </div>

      <div className="mr-notice" role="status">
        <CheckCircle2 size={18} /> The configuration passed validation. Activate it now, or save it as a draft.
      </div>

      <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} />

      {error && <p className="mr-inline-error" role="alert">{error}</p>}

      <div className="mr-actions mr-actions-end">
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back to Edit
        </button>
        <button
          type="button"
          className="btn-tactical btn-tactical-secondary"
          onClick={() => onCreate(RULE_ACTIONS.SAVE_DRAFT)}
          disabled={submitting}
        >
          <Save size={16} /> {submittingAction === RULE_ACTIONS.SAVE_DRAFT ? 'Saving…' : 'Save as Draft'}
        </button>
        <button
          type="button"
          className="btn-tactical btn-tactical-primary"
          onClick={() => onCreate(RULE_ACTIONS.ACTIVATE)}
          disabled={submitting}
        >
          <CheckCircle2 size={16} /> {submittingAction === RULE_ACTIONS.ACTIVATE ? 'Activating…' : 'Activate Rule'}
        </button>
      </div>
    </div>
  );
}
