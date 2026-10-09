import React, { useRef } from 'react';
import RuleActionsMenu from './RuleActionsMenu';
import RuleModal from './RuleModal';
import RuleStatusBadge from './RuleStatusBadge';
import { RuleSummary, RuleZoneMapCard } from './RuleReviewView';
import { formatDateTime } from './monitoringRuleUtils';

// Status and timestamps of a saved rule. Activated only exists while a rule is ACTIVE.
export function RuleRecordMeta({ rule }) {
  return (
    <dl className="mr-summary">
      <div className="mr-summary-row"><dt>Status</dt><dd><RuleStatusBadge status={rule.status} /></dd></div>
      <div className="mr-summary-row"><dt>Created</dt><dd>{formatDateTime(rule.createdAt)}</dd></div>
      <div className="mr-summary-row"><dt>Updated</dt><dd>{formatDateTime(rule.updatedAt)}</dd></div>
      {rule.activatedAt && (
        <div className="mr-summary-row"><dt>Activated</dt><dd>{formatDateTime(rule.activatedAt)}</dd></div>
      )}
    </dl>
  );
}

/**
 * Details of one saved rule (any status), opened from the rules list, with the status actions
 * the rule supports. The rule is the list endpoint's copy; the zone's geometry and severity come
 * from the selected park's reference zones, so the map only ever shows that park's stored data.
 * RiskZoneMap creates its Leaflet map when the dialog opens and removes it when the dialog closes.
 */
export default function RuleDetailsView({
  rule, parkName, riskZones, options, actionsDisabled = false, onAction, onClose,
}) {
  const closeRef = useRef(null);

  return (
    <RuleModal
      titleId="mr-details-title"
      title={`Monitoring Rule #${rule.id}`}
      wide
      closeLabel="Close details"
      initialFocusRef={closeRef}
      onClose={onClose}
      footer={(
        <>
          <RuleActionsMenu rule={rule} disabled={actionsDisabled} onAction={onAction} />
          <button ref={closeRef} type="button" className="btn-tactical btn-tactical-secondary" onClick={onClose}>
            Close
          </button>
        </>
      )}
    >
      <section className="mr-review-card" aria-labelledby="mr-details-info-title">
        <div className="mr-review-card-header">
          <h3 id="mr-details-info-title" className="mr-section-title">Rule Information</h3>
        </div>
        <dl className="mr-summary">
          <div className="mr-summary-row"><dt>Rule ID</dt><dd><span className="mr-code">#{rule.id}</span></dd></div>
        </dl>
        <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} hideEmptyNotes showSeverity />
      </section>

      <RuleZoneMapCard titleId="mr-details-map-title" rule={rule} parkName={parkName} riskZones={riskZones} />

      <section className="mr-review-card" aria-labelledby="mr-details-record-title">
        <div className="mr-review-card-header">
          <h3 id="mr-details-record-title" className="mr-section-title">Status &amp; History</h3>
        </div>
        <RuleRecordMeta rule={rule} />
      </section>
    </RuleModal>
  );
}
