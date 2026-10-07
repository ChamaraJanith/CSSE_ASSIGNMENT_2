import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, Siren, Link2, X } from 'lucide-react';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  REVIEW_STATUSES, formatDateTime, formatLocation, formatValue, getClassificationLabel,
} from './evidenceReviewUtils';

const OUTCOME_MESSAGES = {
  [REVIEW_STATUSES.REVIEWED]: 'The evidence was recorded as wildlife. No threat alert was created.',
  [REVIEW_STATUSES.NEEDS_FURTHER_REVIEW]: 'The evidence remains in the review queue for secondary review. No threat alert was created.',
  [REVIEW_STATUSES.REVIEWED_ESCALATED]: 'The evidence was escalated and a Threat Alert was created and linked to the original camera-trap image.',
};

function AlertDetails({ alert, imageCode, onClose }) {
  return (
    <div className="er-alert-details" role="region" aria-label="Threat alert details">
      <div className="er-alert-details-header">
        <strong><Siren size={16} /> Threat Alert #{alert.id}</strong>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onClose} aria-label="Close alert details">
          <X size={14} />
        </button>
      </div>
      <dl className="er-summary">
        <div className="er-summary-row"><dt>Alert Status</dt><dd>{alert.status}</dd></div>
        <div className="er-summary-row"><dt>Linked Image</dt><dd>{imageCode} (image #{alert.cameraTrapImageId})</dd></div>
        <div className="er-summary-row"><dt>Evidence Review</dt><dd>#{alert.evidenceReviewId}</dd></div>
        <div className="er-summary-row"><dt>Justification</dt><dd>{formatValue(alert.justification)}</dd></div>
        <div className="er-summary-row"><dt>Created</dt><dd>{formatDateTime(alert.createdAt)}</dd></div>
      </dl>
    </div>
  );
}

export default function ReviewResultView({ result, evidence, onBackToQueue }) {
  const [showAlert, setShowAlert] = useState(false);
  const alert = result.threatAlert;

  return (
    <div className="panel-card er-panel">
      <div className="er-result-header">
        <CheckCircle2 size={34} />
        <div>
          <h2>Review Completed</h2>
          <p>{OUTCOME_MESSAGES[result.reviewStatus]}</p>
        </div>
      </div>

      <h3 className="er-section-title">Review Summary</h3>
      <dl className="er-summary">
        <div className="er-summary-row"><dt>Evidence ID</dt><dd>{result.imageCode}</dd></div>
        <div className="er-summary-row"><dt>Camera ID</dt><dd>{formatValue(evidence.cameraTrap?.trapCode)}</dd></div>
        <div className="er-summary-row"><dt>Location</dt><dd>{formatLocation(evidence.cameraTrap)}</dd></div>
        <div className="er-summary-row"><dt>Captured</dt><dd>{formatDateTime(evidence.metadata?.capturedAt)}</dd></div>
        <div className="er-summary-row"><dt>Classification</dt><dd>{getClassificationLabel(result.classification)}</dd></div>
        <div className="er-summary-row">
          <dt>Review Status</dt>
          <dd><ReviewStatusBadge status={result.reviewStatus} /></dd>
        </div>
        {result.review?.notes && <div className="er-summary-row"><dt>Notes</dt><dd>{result.review.notes}</dd></div>}
        {result.metadataIncomplete && (
          <div className="er-summary-row"><dt>Metadata</dt><dd>Reviewed with incomplete metadata</dd></div>
        )}
        {alert && (
          <>
            <div className="er-summary-row"><dt>Threat Alert ID</dt><dd>#{alert.id}</dd></div>
            <div className="er-summary-row">
              <dt>Linked to Image</dt>
              <dd><Link2 size={14} /> {result.imageCode}</dd>
            </div>
          </>
        )}
      </dl>

      {alert && showAlert && <AlertDetails alert={alert} imageCode={result.imageCode} onClose={() => setShowAlert(false)} />}

      <div className="er-actions er-actions-end">
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBackToQueue}>
          <ArrowLeft size={16} /> Back to Review Queue
        </button>
        {alert && (
          <button type="button" className="btn-tactical btn-tactical-danger" onClick={() => setShowAlert(true)}>
            <Siren size={16} /> View Alert
          </button>
        )}
      </div>
    </div>
  );
}
