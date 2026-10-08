import React from 'react';
import { AlertTriangle } from 'lucide-react';
import RuleStatusBadge from './RuleStatusBadge';
import { getFieldLabel } from './monitoringRuleUtils';

const CONFLICT_TYPE_LABELS = { DUPLICATE: 'Duplicate', CONFLICT: 'Conflict' };

// Shows the backend's field errors and duplicate / conflict results. Messages are the backend's
// safe validation messages; no database detail ever reaches this component.
export default function RuleValidationErrors({ message, errors = [], conflicts = [] }) {
  if (!message && errors.length === 0 && conflicts.length === 0) return null;

  return (
    <div className="mr-validation" role="alert" tabIndex={-1}>
      <AlertTriangle size={18} className="mr-validation-icon" />
      <div className="mr-validation-body">
        <strong>{message || 'The monitoring rule could not be validated. Correct the configuration and submit it again.'}</strong>

        {errors.length > 0 && (
          <ul className="mr-validation-list" aria-label="Validation errors">
            {errors.map((error, index) => (
              <li key={`${error.field}-${error.code}-${index}`}>
                <span className="mr-validation-field">{getFieldLabel(error.field)}:</span> {error.message}
              </li>
            ))}
          </ul>
        )}

        {conflicts.length > 0 && (
          <ul className="mr-validation-list" aria-label="Conflicting rules">
            {conflicts.map((conflict) => (
              <li key={`${conflict.type}-${conflict.ruleId}`}>
                <span className="mr-validation-field">
                  {CONFLICT_TYPE_LABELS[conflict.type] || conflict.type} · Rule #{conflict.ruleId}
                </span>{' '}
                <RuleStatusBadge status={conflict.status} /> {conflict.message}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
