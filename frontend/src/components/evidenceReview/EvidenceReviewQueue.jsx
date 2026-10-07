import React, { useState } from 'react';
import { ScanSearch, Search, RefreshCw, AlertTriangle, Info } from 'lucide-react';
import EvidenceImage from './EvidenceImage';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  ALL_STATUSES, QUEUE_TABS, applyQueueFilters, countByTab, formatDateTime, formatLocation,
  getStatusLabel, getTabStatuses,
} from './evidenceReviewUtils';

const TABS = [
  { id: QUEUE_TABS.UNREVIEWED, label: 'Unreviewed' },
  { id: QUEUE_TABS.REVIEWED, label: 'Reviewed' },
  { id: QUEUE_TABS.ALL, label: 'All' },
];

export default function EvidenceReviewQueue({ items, loading, error, notice, onRetry, onSelect }) {
  const [activeTab, setActiveTab] = useState(QUEUE_TABS.UNREVIEWED);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [search, setSearch] = useState('');

  const counts = countByTab(items);
  const visibleItems = applyQueueFilters(items, { tab: activeTab, status: statusFilter, search });

  const selectTab = (tab) => {
    setActiveTab(tab);
    setStatusFilter(ALL_STATUSES);
  };

  return (
    <div className="panel-card er-panel">
      <div className="panel-header">
        <div className="panel-title"><ScanSearch size={20} /> Camera-Trap Evidence Review</div>
        <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onRetry} disabled={loading}>
          <RefreshCw size={16} /> Refresh
        </button>
      </div>

      {notice && (
        <div className="er-notice" role="status"><Info size={18} /> {notice}</div>
      )}

      <div className="er-tabs" role="tablist" aria-label="Review queue tabs">
        {TABS.map((tab) => (
          <button
            key={tab.id}
            type="button"
            role="tab"
            aria-selected={activeTab === tab.id}
            className={`er-tab ${activeTab === tab.id ? 'active' : ''}`}
            onClick={() => selectTab(tab.id)}
          >
            {tab.label} <span className="er-tab-count">{counts[tab.id]}</span>
          </button>
        ))}
      </div>

      <div className="er-toolbar">
        <label className="er-search">
          <Search size={16} />
          <input
            type="search"
            placeholder="Search evidence, camera or location"
            aria-label="Search Evidence"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
        </label>
        <label className="er-select-label">
          Status
          <select aria-label="Status filter" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
            <option value={ALL_STATUSES}>All statuses</option>
            {getTabStatuses(activeTab).map((status) => (
              <option key={status} value={status}>{getStatusLabel(status)}</option>
            ))}
          </select>
        </label>
      </div>

      {loading ? (
        <div className="er-state" role="status"><RefreshCw size={22} className="er-spin" /> Loading camera-trap evidence…</div>
      ) : error ? (
        <div className="er-state er-state-error" role="alert">
          <AlertTriangle size={26} />
          <p>{error}</p>
          <button type="button" className="btn-tactical btn-tactical-secondary" onClick={onRetry}>
            <RefreshCw size={16} /> Retry
          </button>
        </div>
      ) : visibleItems.length === 0 ? (
        <div className="er-state">
          <ScanSearch size={30} />
          <p>No camera-trap evidence matches the current view.</p>
        </div>
      ) : (
        <div className="er-table-wrapper">
          <table className="tactical-table">
            <thead>
              <tr>
                <th>Image</th>
                <th>Evidence ID</th>
                <th>Camera ID</th>
                <th>Location</th>
                <th>Capture Time</th>
                <th>Review Status</th>
                <th>Action</th>
              </tr>
            </thead>
            <tbody>
              {visibleItems.map((item) => (
                <tr key={item.id} className="tactical-row">
                  <td><EvidenceImage variant="thumbnail" src={item.imageUrl} alt={`Thumbnail of ${item.imageCode}`} /></td>
                  <td>
                    <span className="er-code">{item.imageCode}</span>
                    {item.metadataIncomplete && (
                      <span className="er-metadata-flag" title="Incomplete metadata">
                        <AlertTriangle size={14} aria-hidden="true" /> Incomplete metadata
                      </span>
                    )}
                  </td>
                  <td>{item.cameraTrap?.trapCode}</td>
                  <td>{formatLocation(item.cameraTrap)}</td>
                  <td>{formatDateTime(item.metadata?.capturedAt)}</td>
                  <td><ReviewStatusBadge status={item.reviewStatus} /></td>
                  <td>
                    <button
                      type="button"
                      className={`btn-tactical ${item.isReviewable ? 'btn-tactical-primary' : 'btn-tactical-secondary'}`}
                      onClick={() => onSelect(item)}
                      aria-label={`${item.isReviewable ? 'Review' : 'View'} ${item.imageCode}`}
                    >
                      {item.isReviewable ? 'Review' : 'View'}
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
