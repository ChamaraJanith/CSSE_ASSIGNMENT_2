import React from 'react';
import { getStatusLabel } from './monitoringRuleUtils';

export default function RuleStatusBadge({ status }) {
  const modifier = (status || 'unknown').toLowerCase().replace(/_/g, '-');
  return <span className={`mr-status-badge mr-status-${modifier}`}>{getStatusLabel(status)}</span>;
}
