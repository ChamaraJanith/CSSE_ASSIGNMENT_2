import React, { useEffect, useState } from 'react';
import { AlertTriangle, ArrowLeft, RefreshCw } from 'lucide-react';
import { apiService } from '../../services/api';
import EvidenceReviewQueue from './EvidenceReviewQueue';
import ClassifyEvidenceView from './ClassifyEvidenceView';
import EscalationConfirmationModal from './EscalationConfirmationModal';
import ReviewResultView from './ReviewResultView';
import { CLASSIFICATIONS, IMAGE_STATUS, describeApiError } from './evidenceReviewUtils';
import '../../pages/PatrolPlanning.css';
import '../../pages/EvidenceReview.css';

const SCREENS = Object.freeze({ QUEUE: 'QUEUE', CLASSIFY: 'CLASSIFY', RESULT: 'RESULT' });

export default function EvidenceReviewManager() {
  const [screen, setScreen] = useState(SCREENS.QUEUE);

  const [queueItems, setQueueItems] = useState([]);
  const [queueLoading, setQueueLoading] = useState(true);
  const [queueError, setQueueError] = useState(null);
  const [queueNotice, setQueueNotice] = useState(null);
  const [queueVersion, setQueueVersion] = useState(0);

  const [selectedId, setSelectedId] = useState(null);
  const [evidence, setEvidence] = useState(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const [detailError, setDetailError] = useState(null);

  const [classification, setClassification] = useState('');
  const [notes, setNotes] = useState('');
  const [imageStatus, setImageStatus] = useState(IMAGE_STATUS.LOADING);
  const [submitting, setSubmitting] = useState(false);
  const [actionError, setActionError] = useState(null);

  const [escalationOpen, setEscalationOpen] = useState(false);
  const [justification, setJustification] = useState('');
  const [metadataAcknowledged, setMetadataAcknowledged] = useState(false);
  const [escalationError, setEscalationError] = useState(null);

  const [result, setResult] = useState(null);

  // The queue loads every status once; tabs and filters are applied in the browser.
  // Bumping queueVersion triggers a reload; responses from superseded requests are ignored.
  useEffect(() => {
    let ignore = false;
    apiService.getEvidenceReviewQueue('ALL')
      .then((response) => {
        if (ignore) return;
        setQueueItems(response.data || []);
        setQueueError(null);
      })
      .catch((error) => {
        if (!ignore) setQueueError(describeApiError(error));
      })
      .finally(() => {
        if (!ignore) setQueueLoading(false);
      });
    return () => {
      ignore = true;
    };
  }, [queueVersion]);

  const reloadQueue = () => {
    setQueueLoading(true);
    setQueueError(null);
    setQueueVersion((version) => version + 1);
  };

  const returnToQueue = ({ reload = false, notice = null } = {}) => {
    setScreen(SCREENS.QUEUE);
    setEscalationOpen(false);
    setResult(null);
    setQueueNotice(notice);
    if (reload) reloadQueue();
  };

  const loadEvidence = async (imageId) => {
    setEvidence(null);
    setDetailError(null);
    setDetailLoading(true);
    try {
      const response = await apiService.getEvidenceDetail(imageId);
      setEvidence(response.data);
    } catch (error) {
      setDetailError(describeApiError(error));
    } finally {
      setDetailLoading(false);
    }
  };

  const openEvidence = (item) => {
    setSelectedId(item.id);
    setClassification('');
    setNotes('');
    setImageStatus(IMAGE_STATUS.LOADING);
    setActionError(null);
    setQueueNotice(null);
    setScreen(SCREENS.CLASSIFY);
    loadEvidence(item.id);
  };

  // 409: the evidence was reviewed elsewhere, so go back to a refreshed queue and explain why
  const handleReviewError = (error, showError) => {
    if (error?.status === 409) {
      returnToQueue({ reload: true, notice: describeApiError(error) });
      return;
    }
    showError(describeApiError(error));
  };

  const showResult = (data) => {
    setResult(data);
    setEscalationOpen(false);
    setScreen(SCREENS.RESULT);
  };

  const handleConfirmReview = async () => {
    setSubmitting(true);
    setActionError(null);
    try {
      const response = await apiService.submitEvidenceReview(evidence.id, { classification, notes });
      if (response.data.reviewRecorded) {
        showResult(response.data);
      } else if (response.data.escalationConfirmationRequired) {
        setJustification('');
        setMetadataAcknowledged(false);
        setEscalationError(null);
        setEscalationOpen(true);
      }
    } catch (error) {
      handleReviewError(error, setActionError);
    } finally {
      setSubmitting(false);
    }
  };

  const handleConfirmEscalation = async () => {
    setSubmitting(true);
    setEscalationError(null);
    try {
      const response = await apiService.submitEvidenceReview(evidence.id, {
        classification: CLASSIFICATIONS.SUSPICIOUS_PERSON,
        notes,
        escalationConfirmed: true,
        escalationJustification: justification,
      });
      if (response.data.reviewRecorded) {
        showResult(response.data);
      } else {
        setEscalationError('The escalation was not recorded. Please try again.');
      }
    } catch (error) {
      handleReviewError(error, setEscalationError);
    } finally {
      setSubmitting(false);
    }
  };

  if (screen === SCREENS.RESULT && result && evidence) {
    return (
      <div className="er-container">
        <ReviewResultView result={result} evidence={evidence} onBackToQueue={() => returnToQueue({ reload: true })} />
      </div>
    );
  }

  if (screen === SCREENS.CLASSIFY) {
    return (
      <div className="er-container">
        {detailLoading && (
          <div className="panel-card er-panel er-state" role="status">
            <RefreshCw size={22} className="er-spin" /> Loading evidence details…
          </div>
        )}
        {detailError && (
          <div className="panel-card er-panel er-state er-state-error" role="alert">
            <AlertTriangle size={26} />
            <p>{detailError}</p>
            <div className="er-actions">
              <button type="button" className="btn-tactical btn-tactical-secondary" onClick={() => loadEvidence(selectedId)}>
                <RefreshCw size={16} /> Retry
              </button>
              <button type="button" className="btn-tactical btn-tactical-secondary" onClick={() => returnToQueue()}>
                <ArrowLeft size={16} /> Back to Review Queue
              </button>
            </div>
          </div>
        )}
        {evidence && (
          <ClassifyEvidenceView
            evidence={evidence}
            classification={classification}
            notes={notes}
            imageStatus={imageStatus}
            submitting={submitting && !escalationOpen}
            error={actionError}
            onClassificationChange={setClassification}
            onNotesChange={setNotes}
            onImageStatusChange={setImageStatus}
            onCancel={() => returnToQueue()}
            onConfirm={handleConfirmReview}
            onBackToQueue={() => returnToQueue()}
          />
        )}
        {evidence && escalationOpen && (
          <EscalationConfirmationModal
            evidence={evidence}
            justification={justification}
            metadataAcknowledged={metadataAcknowledged}
            submitting={submitting}
            imageFailed={imageStatus !== IMAGE_STATUS.LOADED}
            error={escalationError}
            onJustificationChange={setJustification}
            onMetadataAcknowledgedChange={setMetadataAcknowledged}
            onCancel={() => setEscalationOpen(false)}
            onConfirm={handleConfirmEscalation}
          />
        )}
      </div>
    );
  }

  return (
    <div className="er-container">
      <EvidenceReviewQueue
        items={queueItems}
        loading={queueLoading}
        error={queueError}
        notice={queueNotice}
        onRetry={reloadQueue}
        onSelect={openEvidence}
      />
    </div>
  );
}
