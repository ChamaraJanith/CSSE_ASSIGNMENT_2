import React from 'react';
import { ChevronRight } from 'lucide-react';
import { FORM_STEPS, REVIEW_STEP } from './monitoringRuleUtils';

// Shared stepper for the configuration steps and the review screen. The Review node is never a
// button: it is only reached through Submit for Validation, so validation cannot be bypassed.
export default function RuleStepper({ activeStep, canOpenStep, disabled, onStepChange }) {
  const onReview = activeStep === REVIEW_STEP.id;

  return (
    <nav className="command-stepper-bar" aria-label="Rule configuration steps">
      <div className="stepper-nav">
        {FORM_STEPS.map((entry, index) => (
          <React.Fragment key={entry.id}>
            {index > 0 && <ChevronRight size={14} color="#64748b" />}
            <button
              type="button"
              className={`step-node mr-step-button ${activeStep === entry.id ? 'active' : activeStep > entry.id ? 'completed' : ''}`}
              aria-current={activeStep === entry.id ? 'step' : undefined}
              disabled={disabled || !canOpenStep(entry.id)}
              onClick={() => onStepChange(entry.id)}
            >
              <span className="step-num">{entry.id}</span>
              <span>{entry.label}</span>
            </button>
          </React.Fragment>
        ))}
        <ChevronRight size={14} color="#64748b" />
        <span
          className={`step-node ${onReview ? 'active' : 'mr-step-pending'}`}
          aria-current={onReview ? 'step' : undefined}
          title={onReview ? undefined : 'Reached after the configuration passes validation'}
        >
          <span className="step-num">{REVIEW_STEP.id}</span>
          <span>{REVIEW_STEP.label}</span>
        </span>
      </div>
    </nav>
  );
}
