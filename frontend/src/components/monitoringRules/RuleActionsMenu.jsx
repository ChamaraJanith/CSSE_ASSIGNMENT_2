import React from 'react';
import { CheckCircle2, Pencil, PowerOff } from 'lucide-react';
import { RULE_ROW_ACTIONS, getRuleActions, getStatusLabel } from './monitoringRuleUtils';

const ACTION_BUTTONS = {
  [RULE_ROW_ACTIONS.EDIT]: { label: 'Edit', Icon: Pencil, variant: 'btn-tactical-secondary' },
  [RULE_ROW_ACTIONS.ACTIVATE]: { label: 'Activate', Icon: CheckCircle2, variant: 'btn-tactical-primary' },
  [RULE_ROW_ACTIONS.DEACTIVATE]: { label: 'Deactivate', Icon: PowerOff, variant: 'btn-tactical-danger' },
};

/**
 * The status actions of one saved rule, shown in its details dialog. Only the actions the rule's
 * status supports are rendered; an INACTIVE rule gets an explanation instead of any button.
 */
export default function RuleActionsMenu({ rule, disabled = false, onAction }) {
  const actions = getRuleActions(rule.status);

  if (actions.length === 0) {
    return <p className="mr-muted">No actions are available for {getStatusLabel(rule.status).toLowerCase()} rules.</p>;
  }

  return (
    <div className="mr-row-actions" role="group" aria-label={`Actions for rule #${rule.id}`}>
      {actions.map((action) => {
        const { label, Icon, variant } = ACTION_BUTTONS[action];
        return (
          <button
            key={action}
            type="button"
            className={`btn-tactical ${variant}`}
            onClick={() => onAction(action, rule)}
            disabled={disabled}
          >
            <Icon size={16} /> {label}
          </button>
        );
      })}
    </div>
  );
}
