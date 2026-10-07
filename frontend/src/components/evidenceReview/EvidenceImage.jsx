import React, { useState } from 'react';
import { ImageOff, RefreshCw, ArrowLeft } from 'lucide-react';
import { IMAGE_STATUS } from './evidenceReviewUtils';

/**
 * Camera-trap image with loading, failure and retry states.
 * The backend never validates image files, so a broken URL is only detected here (img onError).
 */
export default function EvidenceImage({ src, alt, variant = 'full', onStatusChange, onBackToQueue }) {
  const [status, setStatus] = useState(IMAGE_STATUS.LOADING);
  const [attempt, setAttempt] = useState(0);

  const updateStatus = (nextStatus) => {
    setStatus(nextStatus);
    if (onStatusChange) onStatusChange(nextStatus);
  };

  const handleRetry = () => {
    setAttempt((value) => value + 1);
    updateStatus(IMAGE_STATUS.LOADING);
  };

  if (variant === 'thumbnail') {
    return (
      <div className="er-thumbnail">
        {status === IMAGE_STATUS.ERROR ? (
          <ImageOff size={20} aria-label="Image unavailable" />
        ) : (
          <img src={src} alt={alt} loading="lazy" onLoad={() => setStatus(IMAGE_STATUS.LOADED)} onError={() => setStatus(IMAGE_STATUS.ERROR)} />
        )}
      </div>
    );
  }

  if (status === IMAGE_STATUS.ERROR) {
    return (
      <div className="er-image-frame er-image-error" role="alert">
        <ImageOff size={40} />
        <strong>Image could not be loaded</strong>
        <p>The camera-trap image is unavailable. The evidence remains unreviewed until the image can be inspected.</p>
        <div className="er-actions">
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={handleRetry}>
            <RefreshCw size={16} /> Retry
          </button>
          {onBackToQueue && (
            <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onBackToQueue}>
              <ArrowLeft size={16} /> Back to Review Queue
            </button>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="er-image-frame">
      {status === IMAGE_STATUS.LOADING && (
        <div className="er-image-loading" role="status">
          <RefreshCw size={22} className="er-spin" /> Loading image…
        </div>
      )}
      <img
        key={attempt}
        src={src}
        alt={alt}
        className={status === IMAGE_STATUS.LOADED ? 'er-image' : 'er-image er-image-pending'}
        onLoad={() => updateStatus(IMAGE_STATUS.LOADED)}
        onError={() => updateStatus(IMAGE_STATUS.ERROR)}
      />
    </div>
  );
}
