import React, { useEffect, useRef } from 'react';
import { ArrowLeft, ArrowRight, CheckCircle2, Info, MapPin } from 'lucide-react';
import RiskZoneMap from './RiskZoneMap';
import RuleStepper from './RuleStepper';
import RuleValidationErrors from './RuleValidationErrors';
import {
  FORM_STEPS, LAST_STEP, TOTAL_STEPS, findZone, formatZone, getOptionLabel, groupErrorsByField,
  isStepComplete, orderPriorityOptions, toggleRecipient,
} from './monitoringRuleUtils';

function FieldError({ id, messages }) {
  if (!messages || messages.length === 0) return null;
  return <p id={id} className="mr-field-error">{messages.join(' ')}</p>;
}

const errorProps = (field, fieldErrors) => (fieldErrors[field]
  ? { 'aria-invalid': true, 'aria-describedby': `mr-error-${field}` }
  : {});

// "About this hazard": only data the system already holds. No hazard descriptions exist in the
// reference data, so the recorded primary threats of this park's risk zones are shown as context.
function HazardInfo({ hazardType, options, riskZones, parkName }) {
  if (!hazardType) {
    return <p className="mr-muted">Select a hazard or species to see its details.</p>;
  }
  const recordedThreats = riskZones.filter((zone) => zone.primaryThreat);

  return (
    <>
      <dl className="mr-info-list">
        <div><dt>Hazard / Species</dt><dd>{getOptionLabel(options?.hazardTypes, hazardType)}</dd></div>
        <div><dt>Reference code</dt><dd><span className="mr-code">{hazardType}</span></dd></div>
      </dl>
      <p className="mr-muted">No detailed description is recorded for this hazard yet.</p>
      {recordedThreats.length > 0 && (
        <div className="mr-info-threats">
          <span className="mr-info-subtitle">Primary threats recorded in {parkName}&apos;s risk zones</span>
          <ul>
            {recordedThreats.map((zone) => (
              <li key={zone.id}><span className="mr-code">{zone.zoneCode}</span> {zone.primaryThreat}</li>
            ))}
          </ul>
        </div>
      )}
    </>
  );
}

// "Zone Information": the selected zone's fields from the reference data
function ZoneInfo({ zone, parkName }) {
  if (!zone) {
    return <p className="mr-muted">Select a risk zone to see its details.</p>;
  }
  return (
    <dl className="mr-info-list">
      <div><dt>Zone</dt><dd>{formatZone(zone)}</dd></div>
      <div><dt>Park</dt><dd>{parkName}</dd></div>
      {zone.severityLevel && (
        <div>
          <dt>Severity</dt>
          <dd><span className={`badge-risk ${zone.severityLevel.toLowerCase()}`}>{zone.severityLevel}</span></dd>
        </div>
      )}
      {zone.primaryThreat && <div><dt>Primary threat</dt><dd>{zone.primaryThreat}</dd></div>}
    </dl>
  );
}

// The same flow configures a new rule and edits a saved draft; only the title differs
export default function RuleConfigurationForm({
  parkName, riskZones, options, form, step, errors, conflicts, message, submitting, focusKey,
  title = 'Create Monitoring Rule', onFieldChange, onStepChange, onSubmit, onCancel,
}) {
  const formRef = useRef(null);
  const fieldErrors = groupErrorsByField(errors);
  const stepComplete = isStepComplete(step, form);
  const canOpenStep = (stepId) => FORM_STEPS.filter((entry) => entry.id < stepId).every((entry) => isStepComplete(entry.id, form));
  const selectedZone = findZone(riskZones, form.riskZoneId);
  const hasZones = riskZones.length > 0;

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
        <div>
          <div className="panel-title">{title}</div>
          <span className="mr-step-indicator">Step {step} of {TOTAL_STEPS}</span>
        </div>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
          <ArrowLeft size={16} /> Back to Monitoring Rules
        </button>
      </div>

      <RuleStepper activeStep={step} canOpenStep={canOpenStep} disabled={submitting} onStepChange={onStepChange} />

      <form ref={formRef} className="mr-form" onSubmit={handleSubmit} noValidate>
        <RuleValidationErrors message={message} errors={errors} conflicts={conflicts} />
        {fieldErrors.parkId && <FieldError id="mr-error-parkId" messages={fieldErrors.parkId} />}

        <fieldset className="mr-form-body" disabled={submitting}>
          {step === 1 && (
            <section className="mr-step-section" aria-labelledby="mr-step1-title">
              <div className="mr-section-header">
                <h3 id="mr-step1-title" className="mr-section-title">Hazard and Risk Zone</h3>
                <span className="mr-park-chip"><MapPin size={14} /> {parkName}</span>
              </div>

              <div className="mr-step1-grid">
                <div className="mr-step1-column">
                  <div className="mr-field">
                    <label htmlFor="mr-hazard-type">Wildlife Hazard / Species <span className="mr-required">*</span></label>
                    <select
                      id="mr-hazard-type"
                      value={form.hazardType}
                      onChange={(event) => onFieldChange('hazardType', event.target.value)}
                      {...errorProps('hazardType', fieldErrors)}
                    >
                      <option value="">Select hazard / species</option>
                      {(options?.hazardTypes || []).map((option) => (
                        <option key={option.value} value={option.value}>{option.label}</option>
                      ))}
                    </select>
                    <FieldError id="mr-error-hazardType" messages={fieldErrors.hazardType} />
                  </div>

                  <div className="mr-info-card" aria-live="polite">
                    <h4><Info size={15} /> About this hazard</h4>
                    <HazardInfo hazardType={form.hazardType} options={options} riskZones={riskZones} parkName={parkName} />
                  </div>
                </div>

                <div className="mr-step1-column">
                  <div className="mr-field">
                    <label htmlFor="mr-risk-zone">Risk Zone <span className="mr-required">*</span></label>
                    <select
                      id="mr-risk-zone"
                      value={form.riskZoneId === '' ? '' : String(form.riskZoneId)}
                      onChange={(event) => onFieldChange('riskZoneId', event.target.value === '' ? '' : Number(event.target.value))}
                      disabled={!hasZones}
                      {...errorProps('riskZoneId', fieldErrors)}
                    >
                      <option value="">{hasZones ? 'Select risk zone' : 'No risk zones available'}</option>
                      {riskZones.map((zone) => (
                        <option key={zone.id} value={zone.id}>{formatZone(zone)}</option>
                      ))}
                    </select>
                    <FieldError id="mr-error-riskZoneId" messages={fieldErrors.riskZoneId} />
                  </div>

                  {hasZones ? (
                    <div className="mr-info-card" aria-live="polite">
                      <h4><Info size={15} /> Zone Information</h4>
                      <ZoneInfo zone={selectedZone} parkName={parkName} />
                    </div>
                  ) : (
                    <div className="mr-notice" role="status">
                      <Info size={18} /> No risk zones are registered for {parkName}, so a monitoring rule cannot be configured for this park.
                    </div>
                  )}
                </div>
              </div>

              <div className="mr-map-panel" role="region" aria-label="Park map and risk zone">
                <div className="mr-map-panel-header">
                  <MapPin size={16} /> Park Map / Risk Zone
                </div>
                {form.hazardType && selectedZone ? (
                  <RiskZoneMap selectedZone={selectedZone} riskZones={riskZones} parkName={parkName} />
                ) : (
                  <div className="mr-map-placeholder">
                    <strong>{parkName}</strong>
                    <span>Select a hazard and a risk zone to view it on the map.</span>
                  </div>
                )}
              </div>
            </section>
          )}

          {step === 2 && (
            <section className="mr-step-section" aria-labelledby="mr-step2-title">
              <div className="mr-section-header">
                <h3 id="mr-step2-title" className="mr-section-title">Priority &amp; Notifications</h3>
                <span className="mr-park-chip"><MapPin size={14} /> {parkName}</span>
              </div>

              <fieldset
                className="mr-choice-group"
                aria-describedby={fieldErrors.alertPriority ? 'mr-error-alertPriority' : undefined}
              >
                <legend>Alert Priority <span className="mr-required">*</span></legend>
                <div className="mr-choice-grid mr-priority-grid">
                  {orderPriorityOptions(options?.alertPriorities).map((option) => (
                    <label key={option.value} className={`mr-option mr-option-inline ${form.alertPriority === option.value ? 'selected' : ''}`}>
                      <input
                        type="radio"
                        name="alertPriority"
                        value={option.value}
                        checked={form.alertPriority === option.value}
                        onChange={() => onFieldChange('alertPriority', option.value)}
                        {...errorProps('alertPriority', fieldErrors)}
                      />
                      <span className={`badge-risk ${option.value.toLowerCase()}`}>{option.label}</span>
                    </label>
                  ))}
                </div>
                <FieldError id="mr-error-alertPriority" messages={fieldErrors.alertPriority} />
              </fieldset>

              <fieldset
                className="mr-choice-group"
                aria-describedby={fieldErrors.notificationRecipients ? 'mr-error-notificationRecipients' : undefined}
              >
                <legend>Notification Recipients <span className="mr-required">* (select at least one)</span></legend>
                <div className="mr-choice-grid">
                  {(options?.recipientRoles || []).map((option) => {
                    const checked = form.notificationRecipients.includes(option.value);
                    return (
                      <label key={option.value} className={`mr-option mr-option-inline ${checked ? 'selected' : ''}`}>
                        <input
                          type="checkbox"
                          value={option.value}
                          checked={checked}
                          onChange={() => onFieldChange('notificationRecipients', toggleRecipient(form.notificationRecipients, option.value))}
                          {...errorProps('notificationRecipients', fieldErrors)}
                        />
                        <span className="mr-option-label">{option.label}</span>
                      </label>
                    );
                  })}
                </div>
                <FieldError id="mr-error-notificationRecipients" messages={fieldErrors.notificationRecipients} />
              </fieldset>

              <div className="mr-field mr-field-narrow">
                <label htmlFor="mr-response-behaviour">Response Behaviour <span className="mr-required">*</span></label>
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

              <div className="mr-field">
                <label htmlFor="mr-notes">Additional Notes <span className="mr-required">(optional)</span></label>
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
            </section>
          )}
        </fieldset>

        <div className="mr-actions mr-actions-split">
          {step > 1 ? (
            <button type="button" className="btn-tactical btn-tactical-secondary" onClick={() => onStepChange(step - 1)} disabled={submitting}>
              <ArrowLeft size={16} /> Back
            </button>
          ) : (
            <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
          )}
          <div className="mr-actions">
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
        </div>
      </form>
    </div>
  );
}
