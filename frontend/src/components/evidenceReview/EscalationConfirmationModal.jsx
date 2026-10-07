import React from 'react';
import { ShieldAlert, Siren } from 'lucide-react';
import ReviewStatusBadge from './ReviewStatusBadge';
import { MetadataWarning } from './ClassifyEvidenceView';
import { formatDateTime, formatLocation, formatValue } from './evidenceReviewUtils';

// Display-only routing information from the UC02 wireframe; not sent to or stored by the backend.
export const THREAT_PRIORITY = 'HIGH';
export const RECIPIENT_TEAM = 'Park Anti-Poaching Response Team';

export default function EscalationConfirmationModal({
  evidence, justification, metadataAcknowledged, submitting, imageFailed, error,
  onJustificationChange, onMetadataAcknowledgedChange, onCancel, onConfirm,
}) {
  const needsAcknowledgement = evidence.metadataIncomplete;
  const canConfirm = justification.trim() !== ''
    && (!needsAcknowledgement || metadataAcknowledged)
    && !submitting
    && !imageFailed;

  return (
    <div className="er-modal-backdrop">
      <div className="er-modal panel-card" role="dialog" aria-modal="true" aria-labelledby="er-escalation-title">
        <div className="panel-header">
          <div className="panel-title" id="er-escalation-title"><Siren size={20} /> Escalate Suspicious Evidence</div>
        </div>

        <div className="conflict-box">
          <ShieldAlert size={18} className="conflict-icon" />
          <span>
            You are escalating this evidence as a <strong>Suspicious Person</strong>. Confirming will create a Threat Alert
            linked to the original camera-trap image.
          </span>
        </div>

        <dl className="er-summary">
          <div className="er-summary-row"><dt>Evidence ID</dt><dd>{evidence.imageCode}</dd></div>
          <div className="er-summary-row"><dt>Camera ID</dt><dd>{formatValue(evidence.cameraTrap?.trapCode)}</dd></div>
          <div className="er-summary-row"><dt>Location</dt><dd>{formatLocation(evidence.cameraTrap)}</dd></div>
          <div className="er-summary-row"><dt>Captured</dt><dd>{formatDateTime(evidence.metadata?.capturedAt)}</dd></div>
          <div className="er-summary-row"><dt>Review Status</dt><dd><ReviewStatusBadge status={evidence.reviewStatus} /></dd></div>
          <div className="er-summary-row"><dt>Threat Priority</dt><dd><span className="badge-risk high">{THREAT_PRIORITY}</span></dd></div>
          <div className="er-summary-row"><dt>Recipient / Team</dt><dd>{RECIPIENT_TEAM}</dd></div>
        </dl>
        <p className="er-muted">Threat priority and recipient are shown for information only and are not recorded with the alert.</p>

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

        <label className="er-field">
          Escalation Justification (required)
          <textarea
            value={justification}
            onChange={(event) => onJustificationChange(event.target.value)}
            placeholder="Describe why this evidence is suspicious"
            rows={4}
            disabled={submitting}
          />
        </label>

        {imageFailed && <p className="er-inline-error">The image must load before evidence can be escalated.</p>}
        {error && <p className="er-inline-error" role="alert">{error}</p>}

        <div className="er-actions er-actions-end">
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
            Cancel
          </button>
          <button type="button" className="btn-tactical btn-tactical-danger" onClick={onConfirm} disabled={!canConfirm}>
            <Siren size={16} /> {submitting ? 'Escalating…' : 'Confirm Escalation'}
          </button>
        </div>
      </div>
    </div>
  );
}
