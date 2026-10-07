import React from 'react';
import { getStatusLabel } from './monitoringRuleUtils';

export default function RuleStatusBadge({ status, large = false }) {
  const modifier = (status || 'unknown').toLowerCase().replace(/_/g, '-');
  return (
    <span className={`mr-status-badge mr-status-${modifier}${large ? ' mr-status-badge-lg' : ''}`}>
      {getStatusLabel(status)}
    </span>
  );
}
