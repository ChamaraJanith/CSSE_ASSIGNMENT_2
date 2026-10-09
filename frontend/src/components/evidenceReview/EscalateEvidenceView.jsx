import React from 'react';
import { AlertTriangle, Lock, ShieldAlert, Siren } from 'lucide-react';
import EvidenceImage from './EvidenceImage';
import { MetadataWarning } from './ClassifyEvidenceView';
import {
  CLASSIFICATIONS, ESCALATION_REASON_MAX_LENGTH, IMAGE_STATUS, formatDateTime, formatLocation, formatValue,
  getClassificationLabel,
} from './evidenceReviewUtils';

// Fixed routing values from the UC02 wireframe; not sent to or stored by the backend.
export const THREAT_PRIORITY = 'High';
export const RECIPIENT_TEAM = 'Ranger Team';

const REASON_ID = 'er-escalation-reason';
const REASON_COUNTER_ID = 'er-escalation-reason-counter';

function RequiredMark() {
  return <span className="er-required" aria-hidden="true">*</span>;
}

// Read-only field styled like the wireframe's selected value; the value cannot be changed here
function FixedField({ id, label, value, valueClassName, icon: Icon }) {
  return (
    <div className="er-field er-fixed-field">
      <label htmlFor={id}>{label} <RequiredMark /></label>
      <div className={Icon ? 'er-fixed-input er-fixed-input-with-icon' : 'er-fixed-input'}>
        {Icon && <Icon size={16} className="er-fixed-leading-icon" aria-hidden="true" />}
        <input id={id} type="text" value={value} readOnly className={valueClassName} />
        <Lock size={14} className="er-fixed-icon" aria-hidden="true" />
      </div>
    </div>
  );
}

function EscalationSummary({ evidence, onImageStatusChange, onBackToQueue }) {
  const { metadata = {}, cameraTrap } = evidence;
  const rows = [
    ['Evidence ID', formatValue(evidence.imageCode)],
    ['Camera ID', formatValue(cameraTrap?.trapCode)],
    ['Location', formatLocation(cameraTrap)],
    ['Captured', formatDateTime(metadata.capturedAt)],
  ];

  return (
    <section className="er-evidence-card er-escalate-card er-escalate-summary" aria-labelledby="er-escalate-summary-title">
      <h3 id="er-escalate-summary-title" className="er-section-title">Evidence Summary</h3>
      <div className="er-escalate-summary-body">
        <EvidenceImage
          key={evidence.id}
          src={evidence.imageUrl}
          alt={`Camera-trap evidence ${evidence.imageCode}`}
          onStatusChange={onImageStatusChange}
          onBackToQueue={onBackToQueue}
        />
        <dl className="er-summary">
          {rows.map(([label, value]) => (
            <div key={label} className="er-summary-row">
              <dt>{label}</dt>
              <dd>{value}</dd>
            </div>
          ))}
          <div className="er-summary-row">
            <dt>Classification</dt>
            <dd><span className="er-classification-tag">{getClassificationLabel(CLASSIFICATIONS.SUSPICIOUS_PERSON)}</span></dd>
          </div>
        </dl>
      </div>
    </section>
  );
}

export default function EscalateEvidenceView({
  evidence, justification, metadataAcknowledged, imageStatus, submitting, error,
  onJustificationChange, onMetadataAcknowledgedChange, onImageStatusChange, onCancel, onConfirm, onBackToQueue,
}) {
  const needsAcknowledgement = evidence.metadataIncomplete;
  const canConfirm = justification.trim() !== ''
    && (!needsAcknowledgement || metadataAcknowledged)
    && !submitting
    && imageStatus === IMAGE_STATUS.LOADED;

  return (
    <div className="panel-card er-panel er-escalate">
      <div className="panel-header">
        <h2 className="panel-title er-page-title">Escalate Suspicious Evidence</h2>
      </div>

      <div className="er-danger-banner" role="note" aria-label="Escalation warning">
        <AlertTriangle size={22} className="er-danger-banner-icon" aria-hidden="true" />
        <div>
          <strong>You are escalating this evidence.</strong>
          <span> Please confirm the details before creating a threat alert.</span>
          <p>Confirming will create a Threat Alert linked to the original camera-trap image.</p>
        </div>
      </div>

      <form
        className="er-escalate-form"
        onSubmit={(event) => {
          event.preventDefault();
          if (canConfirm) onConfirm();
        }}
      >
        <div className="er-escalate-grid">
          <EscalationSummary evidence={evidence} onImageStatusChange={onImageStatusChange} onBackToQueue={onBackToQueue} />

          <section className="er-evidence-card er-escalate-card er-escalate-details" aria-labelledby="er-escalate-details-title">
            <h3 id="er-escalate-details-title" className="er-section-title">Threat / Escalation Details</h3>
            <FixedField
              id="er-threat-priority"
              label="Threat Priority"
              value={THREAT_PRIORITY}
              valueClassName="er-priority-high"
              icon={ShieldAlert}
            />
            <FixedField id="er-recipient-team" label="Recipient / Team" value={RECIPIENT_TEAM} />

            {needsAcknowledgement && (
              <>
                <MetadataWarning missingFields={evidence.missingMetadataFields} />
                <label className="er-checkbox">
                  <input
                    type="checkbox"
                    checked={metadataAcknowledged}
                    onChange={(event) => onMetadataAcknowledgedChange(event.target.checked)}
                    disabled={submitting}
                  />
                  I have reviewed the incomplete metadata
                </label>
              </>
            )}
          </section>
        </div>

        <div className="er-field er-notes-field">
          <label htmlFor={REASON_ID}>Escalation Reason <RequiredMark /></label>
          <textarea
            id={REASON_ID}
            value={justification}
            onChange={(event) => onJustificationChange(event.target.value.slice(0, ESCALATION_REASON_MAX_LENGTH))}
            placeholder="Describe why this evidence is suspicious"
            rows={4}
            maxLength={ESCALATION_REASON_MAX_LENGTH}
            required
            aria-describedby={REASON_COUNTER_ID}
            disabled={submitting}
          />
          <span id={REASON_COUNTER_ID} className="er-char-counter">
            {justification.length} / {ESCALATION_REASON_MAX_LENGTH}
          </span>
        </div>

        {imageStatus === IMAGE_STATUS.ERROR && (
          <p className="er-inline-error">The image must load before evidence can be escalated.</p>
        )}
        {error && <p className="er-inline-error" role="alert">{error}</p>}

        <div className="er-actions er-escalate-actions">
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="submit" className="btn-tactical btn-tactical-danger" disabled={!canConfirm}>
            <Siren size={16} /> {submitting ? 'Escalating…' : 'Confirm Escalation'}
          </button>
        </div>
      </form>
    </div>
  );
}
