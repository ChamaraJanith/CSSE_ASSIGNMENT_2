import React, { useCallback, useRef } from 'react';
import { CheckCircle2, PowerOff, ShieldAlert } from 'lucide-react';
import RuleModal from './RuleModal';
import RuleValidationErrors from './RuleValidationErrors';
import { RuleSummary } from './RuleReviewView';
import { RULE_ROW_ACTIONS } from './monitoringRuleUtils';

const DIALOG_COPY = {
  [RULE_ROW_ACTIONS.ACTIVATE]: {
    title: 'Activate Monitoring Rule',
    explanation: 'The saved draft is validated again against the current park configuration and the existing rules. '
      + 'If it passes, it becomes the active monitoring rule for this hazard and risk zone.',
    confirm: 'Activate Rule',
    pending: 'Activating…',
    Icon: CheckCircle2,
    variant: 'btn-tactical-primary',
  },
  [RULE_ROW_ACTIONS.DEACTIVATE]: {
    title: 'Deactivate Monitoring Rule',
    explanation: 'The rule stops being active for this hazard and risk zone. Its configuration is kept, '
      + 'its activation time is cleared, and an inactive rule cannot be activated again.',
    confirm: 'Deactivate Rule',
    pending: 'Deactivating…',
    Icon: PowerOff,
    variant: 'btn-tactical-danger',
  },
};

/**
 * Confirmation for Activate (DRAFT) / Deactivate (ACTIVE). Nothing is sent until the Park Manager
 * confirms; a failed request keeps the dialog open with the backend's safe message and any
 * field errors or conflicting rules.
 */
export default function RuleActivationDialog({
  mode, rule, parkName, riskZones, options, pending, error, onCancel, onConfirm,
}) {
  const copy = DIALOG_COPY[mode];
  const cancelRef = useRef(null);
  const cancel = useCallback(() => {
    if (!pending) onCancel();
  }, [pending, onCancel]);

  if (!copy) return null;
  const { Icon } = copy;

  return (
    <RuleModal
      titleId="mr-status-dialog-title"
      title={<><Icon size={20} /> {copy.title}</>}
      closeDisabled={pending}
      initialFocusRef={cancelRef}
      onClose={cancel}
      footer={(
        <>
          <button ref={cancelRef} type="button" className="btn-tactical btn-tactical-secondary" onClick={cancel} disabled={pending}>
            Cancel
          </button>
          <button type="button" className={`btn-tactical ${copy.variant}`} onClick={onConfirm} disabled={pending}>
            <Icon size={16} /> {pending ? copy.pending : copy.confirm}
          </button>
        </>
      )}
    >
      <div className="mr-dialog-explanation">
        <ShieldAlert size={18} />
        <p>
          Rule <span className="mr-code">#{rule.id}</span>: {copy.explanation}
        </p>
      </div>

      <section className="mr-review-card" aria-labelledby="mr-status-dialog-rule-title">
        <div className="mr-review-card-header">
          <h3 id="mr-status-dialog-rule-title" className="mr-section-title">Rule Details</h3>
        </div>
        <RuleSummary rule={rule} parkName={parkName} riskZones={riskZones} options={options} hideEmptyNotes />
      </section>

      {error && <RuleValidationErrors message={error.message} errors={error.errors} conflicts={error.conflicts} />}
    </RuleModal>
  );
}
