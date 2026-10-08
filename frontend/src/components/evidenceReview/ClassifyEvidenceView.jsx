import React from 'react';
import { ArrowLeft, AlertTriangle, History, Siren, CheckCircle2, PawPrint, User, HelpCircle } from 'lucide-react';
import EvidenceImage from './EvidenceImage';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  CLASSIFICATIONS, IMAGE_STATUS, NOTES_MAX_LENGTH, REVIEW_STATUSES, formatDateTime, formatLocation, formatValue,
  getClassificationLabel, getMissingMetadataLabels,
} from './evidenceReviewUtils';

const CLASSIFICATION_OPTIONS = [
  {
    value: CLASSIFICATIONS.WILDLIFE_SPECIES,
    icon: PawPrint,
    description: 'Evidence contains identifiable wildlife in its natural habitat.',
    outcome: 'Recorded as Reviewed. No alert.',
  },
  {
    value: CLASSIFICATIONS.SUSPICIOUS_PERSON,
    icon: User,
    description: 'Evidence of human presence that may indicate suspicious activity.',
    outcome: 'Requires escalation confirmation.',
  },
  {
    value: CLASSIFICATIONS.UNKNOWN,
    icon: HelpCircle,
    description: 'Unable to classify the evidence with confidence.',
    outcome: 'Kept for secondary review.',
  },
];

const NOTES_ID = 'er-review-notes';
const NOTES_COUNTER_ID = 'er-review-notes-counter';

// Key fields shown in the wireframe's Evidence Summary card
export function EvidenceSummary({ evidence }) {
  const { metadata = {}, cameraTrap } = evidence;
  const rows = [
    ['Evidence ID', evidence.imageCode],
    ['Camera ID', cameraTrap?.trapCode],
    ['Location', formatLocation(cameraTrap)],
    ['Captured', formatDateTime(metadata.capturedAt)],
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

// Remaining capture metadata, kept available as secondary information
function CaptureMetadata({ metadata = {} }) {
  const rows = [
    ['Latitude', formatValue(metadata.latitude)],
    ['Longitude', formatValue(metadata.longitude)],
    ['Camera Model', formatValue(metadata.cameraModel)],
    ['Trigger Type', formatValue(metadata.triggerType)],
    ['Ambient Temperature', formatValue(metadata.ambientTemperatureC, ' °C')],
  ];

  return (
    <div className="er-capture-metadata">
      <h4>Capture Metadata</h4>
      <dl>
        {rows.map(([label, value]) => (
          <div key={label}>
            <dt>{label}</dt>
            <dd>{value}</dd>
          </div>
        ))}
      </dl>
    </div>
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

function ClassificationCard({ option, selected, onSelect }) {
  const Icon = option.icon;
  const titleId = `er-class-${option.value}-title`;
  const descriptionId = `er-class-${option.value}-description`;
  return (
    <label className={`er-class-card ${selected ? 'selected' : ''}`}>
      <input
        type="radio"
        name="classification"
        value={option.value}
        checked={selected}
        onChange={() => onSelect(option.value)}
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      />
      <Icon size={30} className="er-class-card-icon" aria-hidden="true" />
      <span id={titleId} className="er-class-card-title">{getClassificationLabel(option.value)}</span>
      <span id={descriptionId} className="er-class-card-description">
        {option.description}
        <span className="er-class-card-outcome">{option.outcome}</span>
      </span>
    </label>
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
    <div className="panel-card er-panel er-classify">
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

      <section className="er-evidence-card" aria-labelledby="er-evidence-summary-title">
        <h3 id="er-evidence-summary-title" className="er-section-title">Evidence Summary</h3>
        <div className="er-evidence-card-body">
          <div className="er-evidence-media">
            <EvidenceImage
              key={evidence.id}
              src={evidence.imageUrl}
              alt={`Camera-trap evidence ${evidence.imageCode}`}
              onStatusChange={onImageStatusChange}
              onBackToQueue={onBackToQueue}
            />
          </div>
          <div className="er-evidence-info">
            <EvidenceSummary evidence={evidence} />
            <CaptureMetadata metadata={evidence.metadata} />
          </div>
        </div>
        {evidence.metadataIncomplete && <MetadataWarning missingFields={evidence.missingMetadataFields} />}
        <ReviewHistory reviews={reviews} threatAlerts={threatAlerts} />
      </section>

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
            <p className="er-muted">Select the most appropriate classification for this evidence.</p>
            <div className="er-class-cards">
              {CLASSIFICATION_OPTIONS.map((option) => (
                <ClassificationCard
                  key={option.value}
                  option={option}
                  selected={classification === option.value}
                  onSelect={onClassificationChange}
                />
              ))}
            </div>
          </fieldset>

          <div className="er-field er-notes-field">
            <label htmlFor={NOTES_ID}>
              Notes <span className="er-notes-optional">(optional)</span>
            </label>
            <textarea
              id={NOTES_ID}
              value={notes}
              onChange={(event) => onNotesChange(event.target.value)}
              placeholder="Add any observations about this evidence"
              rows={3}
              maxLength={NOTES_MAX_LENGTH}
              aria-describedby={NOTES_COUNTER_ID}
              disabled={submitting}
            />
            <span id={NOTES_COUNTER_ID} className="er-char-counter">{notes.length} / {NOTES_MAX_LENGTH}</span>
          </div>

          {imageStatus === IMAGE_STATUS.ERROR && (
            <p className="er-inline-error">The image must load before this evidence can be reviewed.</p>
          )}
          {error && <p className="er-inline-error" role="alert">{error}</p>}

          <div className="er-actions er-actions-end er-classify-actions">
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
