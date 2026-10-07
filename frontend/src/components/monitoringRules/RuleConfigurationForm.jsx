import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, ChevronRight, CheckCircle2, Info } from 'lucide-react';
import RuleValidationErrors from './RuleValidationErrors';
import {
  FORM_STEPS, LAST_STEP, groupErrorsByField, isStepComplete, toggleRecipient,
} from './monitoringRuleUtils';

function FieldError({ id, messages }) {
  if (!messages || messages.length === 0) return null;
  return <p id={id} className="mr-field-error">{messages.join(' ')}</p>;
}

const errorProps = (field, fieldErrors) => (fieldErrors[field]
  ? { 'aria-invalid': true, 'aria-describedby': `mr-error-${field}` }
  : {});

export default function RuleConfigurationForm({
  parkName, riskZones, options, form, step, errors, conflicts, message, submitting, focusKey,
  onFieldChange, onStepChange, onSubmit, onCancel,
}) {
  const formRef = useRef(null);
  const fieldErrors = groupErrorsByField(errors);
  const stepComplete = isStepComplete(step, form);
  const canOpenStep = (stepId) => FORM_STEPS.filter((entry) => entry.id < stepId).every((entry) => isStepComplete(entry.id, form));

  // After a failed validation, move focus to the first invalid field (or the error summary)
  useEffect(() => {
    if (!focusKey || !formRef.current) return;
    const target = formRef.current.querySelector('[aria-invalid="true"]') || formRef.current.querySelector('.mr-validation');
    if (target) target.focus();
  }, [focusKey]);

  const handleSubmit = (event) => {
    event.preventDefault();
    if (submitting) return;
    if (step < LAST_STEP) {
      if (stepComplete) onStepChange(step + 1);
      return;
    }
    onSubmit();
  };

  return (
    <div className="panel-card mr-panel">
      <div className="panel-header mr-panel-header">
        <div className="panel-title">Configure Monitoring Rule</div>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
          <ArrowLeft size={16} /> Back to Monitoring Rules
        </button>
      </div>

      <nav className="command-stepper-bar" aria-label="Rule configuration steps">
        <div className="stepper-nav">
          {FORM_STEPS.map((entry, index) => (
            <React.Fragment key={entry.id}>
              {index > 0 && <ChevronRight size={14} color="#64748b" />}
              <button
                type="button"
                className={`step-node mr-step-button ${step === entry.id ? 'active' : step > entry.id ? 'completed' : ''}`}
                aria-current={step === entry.id ? 'step' : undefined}
                disabled={submitting || !canOpenStep(entry.id)}
                onClick={() => onStepChange(entry.id)}
              >
                <span className="step-num">{entry.id}</span>
                <span>{entry.label}</span>
              </button>
            </React.Fragment>
          ))}
        </div>
      </nav>

      <form ref={formRef} className="mr-form" onSubmit={handleSubmit} noValidate>
        <RuleValidationErrors message={message} errors={errors} conflicts={conflicts} />
        {fieldErrors.parkId && <FieldError id="mr-error-parkId" messages={fieldErrors.parkId} />}

        <fieldset className="mr-form-body" disabled={submitting}>
          {step === 1 && (
            <fieldset className="mr-choice-group" aria-describedby={fieldErrors.hazardType ? 'mr-error-hazardType' : undefined}>
              <legend>Hazard / Species <span className="mr-required">(required)</span></legend>
              <div className="mr-choice-grid">
                {(options?.hazardTypes || []).map((option) => (
                  <label key={option.value} className={`mr-option ${form.hazardType === option.value ? 'selected' : ''}`}>
                    <input
                      type="radio"
                      name="hazardType"
                      value={option.value}
                      checked={form.hazardType === option.value}
                      onChange={() => onFieldChange('hazardType', option.value)}
                      {...errorProps('hazardType', fieldErrors)}
                    />
                    <span className="mr-option-label">{option.label}</span>
                  </label>
                ))}
              </div>
              <FieldError id="mr-error-hazardType" messages={fieldErrors.hazardType} />
            </fieldset>
          )}

          {step === 2 && (
            <fieldset className="mr-choice-group" aria-describedby={fieldErrors.riskZoneId ? 'mr-error-riskZoneId' : undefined}>
              <legend>Risk Zone in {parkName} <span className="mr-required">(required)</span></legend>
              {riskZones.length === 0 ? (
                <div className="mr-notice" role="status">
                  <Info size={18} /> No risk zones are registered for {parkName}, so a monitoring rule cannot be configured for this park.
                </div>
              ) : (
                <div className="mr-choice-grid">
                  {riskZones.map((zone) => (
                    <label key={zone.id} className={`mr-option ${form.riskZoneId === zone.id ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="riskZoneId"
                        value={zone.id}
                        checked={form.riskZoneId === zone.id}
                        onChange={() => onFieldChange('riskZoneId', zone.id)}
                        {...errorProps('riskZoneId', fieldErrors)}
                      />
                      <span className="mr-option-label">{zone.zoneCode} – {zone.zoneName}</span>
                      <span className="mr-option-meta">
                        {zone.severityLevel && (
                          <span className={`badge-risk ${zone.severityLevel.toLowerCase()}`}>{zone.severityLevel}</span>
                        )}
                        {zone.primaryThreat && <span className="mr-option-hint">{zone.primaryThreat}</span>}
                      </span>
                    </label>
                  ))}
                </div>
              )}
              <FieldError id="mr-error-riskZoneId" messages={fieldErrors.riskZoneId} />
            </fieldset>
          )}

          {step === 3 && (
            <div className="mr-field-grid">
              <div className="mr-field">
                <label htmlFor="mr-alert-priority">Alert Priority <span className="mr-required">(required)</span></label>
                <select
                  id="mr-alert-priority"
                  value={form.alertPriority}
                  onChange={(event) => onFieldChange('alertPriority', event.target.value)}
                  {...errorProps('alertPriority', fieldErrors)}
                >
                  <option value="">Select alert priority</option>
                  {(options?.alertPriorities || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <FieldError id="mr-error-alertPriority" messages={fieldErrors.alertPriority} />
              </div>

              <div className="mr-field">
                <label htmlFor="mr-response-behaviour">Response Behaviour <span className="mr-required">(required)</span></label>
                <select
                  id="mr-response-behaviour"
                  value={form.responseBehaviour}
                  onChange={(event) => onFieldChange('responseBehaviour', event.target.value)}
                  {...errorProps('responseBehaviour', fieldErrors)}
                >
                  <option value="">Select response behaviour</option>
                  {(options?.responseBehaviours || []).map((option) => (
                    <option key={option.value} value={option.value}>{option.label}</option>
                  ))}
                </select>
                <FieldError id="mr-error-responseBehaviour" messages={fieldErrors.responseBehaviour} />
              </div>

              <fieldset
                className="mr-choice-group mr-field-wide"
                aria-describedby={fieldErrors.notificationRecipients ? 'mr-error-notificationRecipients' : undefined}
              >
                <legend>Notification Recipients <span className="mr-required">(at least one)</span></legend>
                <div className="mr-checkbox-row">
                  {(options?.recipientRoles || []).map((option) => (
                    <label key={option.value} className="mr-checkbox">
                      <input
                        type="checkbox"
                        value={option.value}
                        checked={form.notificationRecipients.includes(option.value)}
                        onChange={() => onFieldChange('notificationRecipients', toggleRecipient(form.notificationRecipients, option.value))}
                        {...errorProps('notificationRecipients', fieldErrors)}
                      />
                      {option.label}
                    </label>
                  ))}
                </div>
                <FieldError id="mr-error-notificationRecipients" messages={fieldErrors.notificationRecipients} />
              </fieldset>

              <div className="mr-field mr-field-wide">
                <label htmlFor="mr-notes">Notes (optional)</label>
                <textarea
                  id="mr-notes"
                  rows={3}
                  value={form.notes}
                  onChange={(event) => onFieldChange('notes', event.target.value)}
                  placeholder="Add any context for this monitoring rule"
                  {...errorProps('notes', fieldErrors)}
                />
                <FieldError id="mr-error-notes" messages={fieldErrors.notes} />
              </div>
            </div>
          )}
        </fieldset>

        <div className="mr-actions mr-actions-end">
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          {step > 1 && (
            <button type="button" className="btn-tactical btn-tactical-secondary" onClick={() => onStepChange(step - 1)} disabled={submitting}>
              <ArrowLeft size={16} /> Back
            </button>
          )}
          {step < LAST_STEP ? (
            <button type="submit" className="btn-tactical btn-tactical-primary" disabled={!stepComplete || submitting}>
              Next <ArrowRight size={16} />
            </button>
          ) : (
            <button type="submit" className="btn-tactical btn-tactical-primary" disabled={submitting}>
              <CheckCircle2 size={16} /> {submitting ? 'Validating…' : 'Submit for Validation'}
            </button>
          )}
        </div>
      </form>
    </div>
  );
}
