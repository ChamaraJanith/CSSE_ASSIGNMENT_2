import React, { useState } from 'react';
import { CheckCircle2, ArrowLeft, ArrowUpRight, Siren, Link2, Info, X } from 'lucide-react';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  CLASSIFICATIONS, REVIEW_STATUSES, formatDateTime, formatLocation, formatThreatAlertId, formatValue,
  getClassificationLabel,
} from './evidenceReviewUtils';

const OUTCOME_MESSAGES = {
  [REVIEW_STATUSES.REVIEWED]: 'The evidence was recorded as wildlife. No threat alert was created.',
  [REVIEW_STATUSES.NEEDS_FURTHER_REVIEW]: 'The evidence remains in the review queue for secondary review. No threat alert was created.',
  [REVIEW_STATUSES.REVIEWED_ESCALATED]: 'The evidence was escalated and a Threat Alert was created and linked to the original camera-trap image.',
};

const ALERT_DETAILS_ID = 'er-alert-details';

function SummaryColumn({ label, rows }) {
  return (
    <dl className="er-summary er-result-column" aria-label={label}>
      {rows.map(([term, value]) => (
        <div key={term} className="er-summary-row">
          <dt>{term}</dt>
          <dd>{value}</dd>
        </div>
      ))}
    </dl>
  );
}

function ClassificationTag({ classification }) {
  const suspicious = classification === CLASSIFICATIONS.SUSPICIOUS_PERSON;
  return (
    <span className={suspicious ? 'er-classification-tag' : 'er-classification-tag er-classification-tag-neutral'}>
      {getClassificationLabel(classification)}
    </span>
  );
}

function AlertDetails({ alert, alertReference, imageCode, onClose }) {
  return (
    <div id={ALERT_DETAILS_ID} className="er-alert-details" role="region" aria-label="Threat alert details">
      <div className="er-alert-details-header">
        <strong><Siren size={16} aria-hidden="true" /> Threat Alert {alertReference}</strong>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onClose} aria-label="Close alert details">
          <X size={14} aria-hidden="true" />
        </button>
      </div>
      <dl className="er-summary">
        <div className="er-summary-row"><dt>Alert Record</dt><dd>#{alert.id}</dd></div>
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
  const alertReference = alert ? formatThreatAlertId(alert.id, alert.createdAt) : null;

  const evidenceRows = [
    ['Evidence ID', formatValue(result.imageCode)],
    ['Camera ID', formatValue(evidence.cameraTrap?.trapCode)],
    ['Location', formatLocation(evidence.cameraTrap)],
    ['Captured', formatDateTime(evidence.metadata?.capturedAt)],
  ];
  const outcomeRows = [
    ['Classification', <ClassificationTag key="classification" classification={result.classification} />],
    ['Review Status', <ReviewStatusBadge key="status" status={result.reviewStatus} />],
  ];
  if (alert) {
    outcomeRows.push(
      ['Threat Alert ID', <span key="alert-id" className="er-code">{alertReference}</span>],
      ['Linked to Image', (
        <span key="linked" className="er-linked-image">
          <Link2 size={14} aria-hidden="true" /> Yes <span className="er-muted-inline">({result.imageCode})</span>
        </span>
      )],
    );
  }

  return (
    <div className="panel-card er-panel er-result">
      <div className="er-result-banner" role="status" aria-label="Review result">
        <span className="er-result-icon">
          <CheckCircle2 size={52} aria-hidden="true" />
        </span>
        <h2>Review Completed</h2>
        <ReviewStatusBadge status={result.reviewStatus} />
        <p>The evidence has been reviewed and recorded successfully.</p>
        <p className="er-result-outcome">{OUTCOME_MESSAGES[result.reviewStatus]}</p>
      </div>

      <section className="er-evidence-card" aria-labelledby="er-result-summary-title">
        <h3 id="er-result-summary-title" className="er-section-title">Review Summary</h3>
        <div className="er-result-grid">
          <SummaryColumn label="Evidence details" rows={evidenceRows} />
          <SummaryColumn label="Review outcome" rows={outcomeRows} />
        </div>
        {(result.review?.notes || result.metadataIncomplete) && (
          <dl className="er-summary er-result-extra">
            {result.review?.notes && <div className="er-summary-row"><dt>Notes</dt><dd>{result.review.notes}</dd></div>}
            {result.metadataIncomplete && (
              <div className="er-summary-row"><dt>Metadata</dt><dd>Reviewed with incomplete metadata</dd></div>
            )}
          </dl>
        )}
      </section>

      {alert && (
        <div className="er-info-banner" role="note" aria-label="Threat alert information">
          <Info size={20} className="er-info-banner-icon" aria-hidden="true" />
          <div>
            <p>A threat alert has been created and is linked to the original camera-trap image.</p>
            <p className="er-info-banner-link">
              <Siren size={14} aria-hidden="true" /> {alertReference}
              <Link2 size={14} aria-hidden="true" /> <span className="er-visually-hidden">linked to</span> {result.imageCode}
            </p>
          </div>
        </div>
      )}

      {alert && showAlert && (
        <AlertDetails alert={alert} alertReference={alertReference} imageCode={result.imageCode} onClose={() => setShowAlert(false)} />
      )}

      <div className="er-actions er-result-actions">
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBackToQueue}>
          <ArrowLeft size={16} aria-hidden="true" /> Back to Review Queue
        </button>
        {alert && (
          <button
            type="button"
            className="btn-tactical btn-tactical-danger"
            onClick={() => setShowAlert(true)}
            aria-expanded={showAlert}
            aria-controls={showAlert ? ALERT_DETAILS_ID : undefined}
          >
            View Alert <ArrowUpRight size={16} aria-hidden="true" />
          </button>
        )}
      </div>
    </div>
  );
}
