import React, { useState } from 'react';
import { ScanSearch, Search, RefreshCw, AlertTriangle, Info, ChevronLeft, ChevronRight } from 'lucide-react';
import EvidenceImage from './EvidenceImage';
import ReviewStatusBadge from './ReviewStatusBadge';
import {
  ALL_STATUSES, PAGE_GAP, QUEUE_TABS, applyQueueFilters, countByTab, formatDateTime, formatLocation,
  getPageNumbers, getStatusLabel, getTabStatuses, paginate, sortByCaptureTimeDesc,
} from './evidenceReviewUtils';

const TABS = [
  { id: QUEUE_TABS.UNREVIEWED, label: 'Unreviewed' },
  { id: QUEUE_TABS.REVIEWED, label: 'Reviewed' },
  { id: QUEUE_TABS.ALL, label: 'All' },
];

function QueuePagination({ currentPage, totalPages, onPageChange }) {
  return (
    <nav className="er-pagination" aria-label="Review queue pagination">
      <button
        type="button"
        className="er-page-btn"
        onClick={() => onPageChange(currentPage - 1)}
        disabled={currentPage === 1}
        aria-label="Previous page"
      >
        <ChevronLeft size={16} />
      </button>
      {getPageNumbers(currentPage, totalPages).map((page, index) => (
        page === PAGE_GAP ? (
          <span key={`gap-${index}`} className="er-page-gap" aria-hidden="true">…</span>
        ) : (
          <button
            key={page}
            type="button"
            className={`er-page-btn ${page === currentPage ? 'active' : ''}`}
            onClick={() => onPageChange(page)}
            aria-label={`Page ${page}`}
            aria-current={page === currentPage ? 'page' : undefined}
          >
            {page}
          </button>
        )
      ))}
      <button
        type="button"
        className="er-page-btn"
        onClick={() => onPageChange(currentPage + 1)}
        disabled={currentPage === totalPages}
        aria-label="Next page"
      >
        <ChevronRight size={16} />
      </button>
    </nav>
  );
}

export default function EvidenceReviewQueue({ items, loading, error, notice, onRetry, onSelect }) {
  const [activeTab, setActiveTab] = useState(QUEUE_TABS.UNREVIEWED);
  const [statusFilter, setStatusFilter] = useState(ALL_STATUSES);
  const [search, setSearch] = useState('');
  const [page, setPage] = useState(1);

  const counts = countByTab(items);
  const visibleItems = sortByCaptureTimeDesc(applyQueueFilters(items, { tab: activeTab, status: statusFilter, search }));
  const { pageItems, currentPage, totalPages, total, from, to } = paginate(visibleItems, page);

  const selectTab = (tab) => {
    setActiveTab(tab);
    setStatusFilter(ALL_STATUSES);
    setPage(1);
  };

  const changeSearch = (value) => {
    setSearch(value);
    setPage(1);
  };

  const changeStatusFilter = (value) => {
    setStatusFilter(value);
    setPage(1);
  };

  return (
    <div className="panel-card er-panel er-queue">
      <div className="panel-header">
        <div className="panel-title"><ScanSearch size={20} /> Camera-Trap Evidence Review</div>
      </div>

      {notice && (
        <div className="er-notice" role="status"><Info size={18} /> {notice}</div>
      )}

      <div className="er-queue-controls">
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
            <input
              type="search"
              placeholder="Search evidence..."
              aria-label="Search Evidence"
              value={search}
              onChange={(event) => changeSearch(event.target.value)}
            />
            <Search size={16} aria-hidden="true" />
          </label>
          <label className="er-select-label">
            <span>Status Filter</span>
            <select aria-label="Status filter" value={statusFilter} onChange={(event) => changeStatusFilter(event.target.value)}>
              <option value={ALL_STATUSES}>All statuses</option>
              {getTabStatuses(activeTab).map((status) => (
                <option key={status} value={status}>{getStatusLabel(status)}</option>
              ))}
            </select>
          </label>
        </div>
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
      ) : total === 0 ? (
        <div className="er-state">
          <ScanSearch size={30} />
          <p>No camera-trap evidence matches the current view.</p>
        </div>
      ) : (
        <>
          <div className="er-table-wrapper">
            <table className="tactical-table">
              <thead>
                <tr>
                  <th>Thumbnail</th>
                  <th>Evidence ID</th>
                  <th>Camera ID</th>
                  <th>Location</th>
                  <th>Capture Time</th>
                  <th>Review Status</th>
                  <th>Action</th>
                </tr>
              </thead>
              <tbody>
                {pageItems.map((item) => (
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

          <div className="er-queue-footer">
            <p className="er-results-count">Showing {from} to {to} of {total} results</p>
            {totalPages > 1 && (
              <QueuePagination currentPage={currentPage} totalPages={totalPages} onPageChange={setPage} />
            )}
          </div>
        </>
      )}
    </div>
  );
}
