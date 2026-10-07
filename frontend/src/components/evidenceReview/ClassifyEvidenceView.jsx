import React from 'react';
import { ArrowLeft, AlertTriangle, History, Siren, CheckCircle2 } from 'lucide-react';
import EvidenceImage from './EvidenceImage';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  CLASSIFICATIONS, IMAGE_STATUS, REVIEW_STATUSES, formatDateTime, formatLocation, formatValue,
  getClassificationLabel, getMissingMetadataLabels,
} from './evidenceReviewUtils';

const CLASSIFICATION_OPTIONS = [
  { value: CLASSIFICATIONS.WILDLIFE_SPECIES, hint: 'Animal identified. Recorded as Reviewed, no alert.' },
  { value: CLASSIFICATIONS.SUSPICIOUS_PERSON, hint: 'Possible poaching activity. Requires escalation confirmation.' },
  { value: CLASSIFICATIONS.UNKNOWN, hint: 'Cannot be identified. Kept available for secondary review.' },
];

export function EvidenceSummary({ evidence }) {
  const { metadata = {}, cameraTrap } = evidence;
  const rows = [
    ['Evidence ID', evidence.imageCode],
    ['Camera ID', cameraTrap?.trapCode],
    ['Location', formatLocation(cameraTrap)],
    ['Captured', formatDateTime(metadata.capturedAt)],
    ['Latitude', formatValue(metadata.latitude)],
    ['Longitude', formatValue(metadata.longitude)],
    ['Camera Model', formatValue(metadata.cameraModel)],
    ['Trigger Type', formatValue(metadata.triggerType)],
    ['Ambient Temperature', formatValue(metadata.ambientTemperatureC, ' °C')],
  ];

  return (
    <dl className="er-summary">
      {rows.map(([label, value]) => (
        <div key={label} className="er-summary-row">
          <dt>{label}</dt>
          <dd>{formatValue(value)}</dd>
        </div>
      ))}
      <div className="er-summary-row">
        <dt>Review Status</dt>
        <dd><ReviewStatusBadge status={evidence.reviewStatus} /></dd>
      </div>
    </dl>
  );
}

export function MetadataWarning({ missingFields }) {
  return (
    <div className="er-warning" role="alert">
      <AlertTriangle size={18} className="er-warning-icon" />
      <div>
        <strong>Incomplete Metadata</strong>
        <ul>
          {getMissingMetadataLabels(missingFields).map((label) => <li key={label}>{label}</li>)}
        </ul>
        <span>You can still review this evidence.</span>
      </div>
    </div>
  );
}

function ReviewHistory({ reviews, threatAlerts }) {
  if (!reviews.length) return null;
  return (
    <div className="er-history">
      <h4><History size={16} /> Previous review{reviews.length > 1 ? 's' : ''}</h4>
      {reviews.map((review) => {
        const alert = threatAlerts.find((entry) => entry.evidenceReviewId === review.id);
        return (
          <div key={review.id} className="er-history-item">
            <div><strong>{getClassificationLabel(review.classification)}</strong> · {formatDateTime(review.createdAt)}</div>
            {review.notes && <div>Notes: {review.notes}</div>}
            {review.escalationJustification && <div>Escalation reason: {review.escalationJustification}</div>}
            {alert && <div className="er-history-alert"><Siren size={14} /> Threat Alert #{alert.id} ({alert.status})</div>}
          </div>
        );
      })}
    </div>
  );
}

export default function ClassifyEvidenceView({
  evidence, classification, notes, imageStatus, submitting, error,
  onClassificationChange, onNotesChange, onImageStatusChange, onCancel, onConfirm, onBackToQueue,
}) {
  const reviews = evidence.reviews || [];
  const threatAlerts = evidence.threatAlerts || [];
  const isSecondaryReview = evidence.reviewStatus === REVIEW_STATUSES.NEEDS_FURTHER_REVIEW;
  const imageReady = imageStatus === IMAGE_STATUS.LOADED;
  const canConfirm = Boolean(classification) && !submitting && imageReady;

  return (
    <div className="panel-card er-panel">
      <div className="panel-header">
        <div className="panel-title">{evidence.isReviewable ? 'Classify Evidence' : 'Evidence Details'}</div>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBackToQueue}>
          <ArrowLeft size={16} /> Back to Review Queue
        </button>
      </div>

      {isSecondaryReview && (
        <div className="er-notice" role="status">
          <History size={18} /> Secondary review: this evidence was previously classified as Unknown and needs further review.
        </div>
      )}

      <div className="er-detail-grid">
        <div>
          <EvidenceImage
            key={evidence.id}
            src={evidence.imageUrl}
            alt={`Camera-trap evidence ${evidence.imageCode}`}
            onStatusChange={onImageStatusChange}
            onBackToQueue={onBackToQueue}
          />
        </div>

        <div className="er-detail-side">
          <h3 className="er-section-title">Evidence Summary</h3>
          <EvidenceSummary evidence={evidence} />
          {evidence.metadataIncomplete && <MetadataWarning missingFields={evidence.missingMetadataFields} />}
          <ReviewHistory reviews={reviews} threatAlerts={threatAlerts} />
        </div>
      </div>

      {evidence.isReviewable ? (
        <form
          className="er-classify-form"
          onSubmit={(event) => {
            event.preventDefault();
            if (canConfirm) onConfirm();
          }}
        >
          <fieldset className="er-classification" disabled={submitting}>
            <legend>Classification</legend>
            {CLASSIFICATION_OPTIONS.map((option) => (
              <label key={option.value} className={`er-option ${classification === option.value ? 'selected' : ''}`}>
                <input
                  type="radio"
                  name="classification"
                  value={option.value}
                  checked={classification === option.value}
                  onChange={() => onClassificationChange(option.value)}
                />
                <span className="er-option-label">{getClassificationLabel(option.value)}</span>
                <span className="er-option-hint">{option.hint}</span>
              </label>
            ))}
          </fieldset>

          <label className="er-field">
            Notes (optional)
            <textarea
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Add any observations about this evidence"
              rows={3}
              disabled={submitting}
            />
          </label>

          {imageStatus === IMAGE_STATUS.ERROR && (
            <p className="er-inline-error">The image must load before this evidence can be reviewed.</p>
          )}
          {error && <p className="er-inline-error" role="alert">{error}</p>}

          <div className="er-actions er-actions-end">
            <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onCancel} disabled={submitting}>
              Cancel
            </button>
            <button type="submit" className="btn-tactical btn-tactical-primary" disabled={!canConfirm}>
              <CheckCircle2 size={16} /> {submitting ? 'Submitting…' : 'Confirm Review'}
            </button>
          </div>
        </form>
      ) : (
        <div className="er-notice" role="status">
          <CheckCircle2 size={18} /> This evidence has already been reviewed and is no longer in the review queue.
        </div>
      )}
    </div>
  );
}
