import React from 'react';
import { getStatusLabel } from './evidenceReviewUtils';

export default function ReviewStatusBadge({ status }) {
  const modifier = (status || 'unknown').toLowerCase().replace(/_/g, '-');
  return <span className={`er-status-badge er-status-${modifier}`}>{getStatusLabel(status)}</span>;
}
