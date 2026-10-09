import React from 'react';
import { ArrowLeft, CheckCircle2, Pencil, Save } from 'lucide-react';
import RiskZoneMap from './RiskZoneMap';
import RuleStepper from './RuleStepper';
import {
  NOT_RECORDED, REVIEW_STEP, RULE_ACTIONS, TOTAL_STEPS, findZone, formatRecipients, formatResponseBehaviour, formatZone,
  getOptionLabel,
} from './monitoringRuleUtils';

// The risk zone's severity from the park's reference zones, with the existing .badge-risk styling
function ZoneSeverity({ zone }) {
  if (!zone?.severityLevel) return NOT_RECORDED;
  return <span className={`badge-risk ${zone.severityLevel.toLowerCase()}`}>{zone.severityLevel}</span>;
}

// hideEmptyNotes: the review screen lists Notes only when the Park Manager entered some.
// showSeverity: the details dialog also lists the risk zone's severity.
export function RuleSummary({ rule, parkName, riskZones, options, hideEmptyNotes = false, showSeverity = false }) {
  const referenceZone = findZone(riskZones, rule.riskZoneId);
  const rows = [
    ['Park', parkName],
    ['Hazard / Species', getOptionLabel(options?.hazardTypes, rule.hazardType)],
    ['Risk Zone', formatZone(rule.riskZone || referenceZone)],
  ];
  if (showSeverity) rows.push(['Severity', <ZoneSeverity key="severity" zone={referenceZone} />]);
  rows.push(
    ['Alert Priority', getOptionLabel(options?.alertPriorities, rule.alertPriority)],
    ['Notification Recipients', formatRecipients(options?.recipientRoles, rule.notificationRecipients)],
    ['Response Behaviour', formatResponseBehaviour(options?.responseBehaviours, rule.responseBehaviour)],
  );
  if (rule.notes || !hideEmptyNotes) rows.push(['Notes', rule.notes || NOT_RECORDED]);

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

/**
 * "Risk Zone Map" card of the review screen and the details dialog. The zone's geometry comes
 * from the selected park's reference zones, so the map only ever shows that park's stored data.
 */
export function RuleZoneMapCard({ titleId, rule, parkName, riskZones }) {
  const zone = findZone(riskZones, rule.riskZoneId);

  return (
    <section className="mr-review-card" aria-labelledby={titleId}>
      <div className="mr-review-card-header">
        <h3 id={titleId} className="mr-section-title">Risk Zone Map</h3>
      </div>
      {zone ? (
        <RiskZoneMap selectedZone={zone} riskZones={riskZones} parkName={parkName} />
      ) : (
        <p className="mr-muted" role="status">
          The location of this risk zone is not available for {parkName}, so it cannot be shown on the map.
        </p>
      )}
    </section>
  );
}

/**
 * Step 3 of 3. Nothing is saved until the Park Manager chooses Activate Rule or Save as Draft.
 * Edit, Back and the stepper return to the configuration with every value kept; reaching this
 * screen again always requires a new Submit for Validation.
 * When a saved draft is being edited (`editing`), the only save is Save Draft Changes: the rule
 * keeps its ID and stays a draft, and activation is a separate action on the rules list.
 */
export default function RuleReviewView({
  rule, parkName, riskZones, options, submittingAction, error, editing = false,
  title = 'Create Monitoring Rule', onBack, onEdit, onCreate,
}) {
  const submitting = Boolean(submittingAction);

  return (
    <div className="panel-card mr-panel">
      <div className="panel-header mr-panel-header">
        <div>
          <div className="panel-title">{title}</div>
          <span className="mr-step-indicator">Step {REVIEW_STEP.id} of {TOTAL_STEPS}</span>
        </div>
      </div>

      <RuleStepper activeStep={REVIEW_STEP.id} canOpenStep={() => true} disabled={submitting} onStepChange={onEdit} />

      <p className="mr-review-intro">
        {editing
          ? 'Review the changes to this draft before saving them. The rule stays a draft until it is activated from the rules list.'
          : 'Review the details of this monitoring rule before saving or activating.'}
      </p>

      <div className="mr-notice" role="status">
        <CheckCircle2 size={18} /> The configuration passed validation.
      </div>

      <div className="mr-review-grid">
        <section className="mr-review-card" aria-labelledby="mr-review-details-title">
          <div className="mr-review-card-header">
            <h3 id="mr-review-details-title" className="mr-section-title">Rule Details</h3>
            <button
              type="button"
              className="btn-tactical btn-tactical-secondary mr-edit-button"
              onClick={() => onEdit(1)}
              disabled={submitting}
            >
              <Pencil size={15} /> Edit
            </button>
          </div>
          <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} hideEmptyNotes />
          <p className="mr-muted">Any change returns you to the configuration, and the rule is validated again before review.</p>
        </section>

        <RuleZoneMapCard titleId="mr-review-map-title" rule={rule} parkName={parkName} riskZones={riskZones} />
      </div>

      {error && <p className="mr-inline-error" role="alert">{error}</p>}

      <div className="mr-actions mr-actions-split">
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBack} disabled={submitting}>
          <ArrowLeft size={16} /> Back
        </button>
        {editing ? (
          <div className="mr-actions">
            <button
              type="button"
              className="btn-tactical btn-tactical-primary"
              onClick={() => onCreate(RULE_ACTIONS.SAVE_DRAFT)}
              disabled={submitting}
            >
              <Save size={16} /> {submitting ? 'Saving…' : 'Save Draft Changes'}
            </button>
          </div>
        ) : (
          <div className="mr-actions">
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
        )}
      </div>
    </div>
  );
}
