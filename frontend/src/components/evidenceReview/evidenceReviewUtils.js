// Pure display/filter helpers for UC02. Business decisions (reviewability, metadata completeness,
// resulting status, alert creation) always come from the backend response.

export const REVIEW_STATUSES = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  REVIEWED: 'REVIEWED',
  NEEDS_FURTHER_REVIEW: 'NEEDS_FURTHER_REVIEW',
  REVIEWED_ESCALATED: 'REVIEWED_ESCALATED',
});

export const CLASSIFICATIONS = Object.freeze({
  WILDLIFE_SPECIES: 'WILDLIFE_SPECIES',
  SUSPICIOUS_PERSON: 'SUSPICIOUS_PERSON',
  UNKNOWN: 'UNKNOWN',
});

export const QUEUE_TABS = Object.freeze({
  UNREVIEWED: 'UNREVIEWED',
  REVIEWED: 'REVIEWED',
  ALL: 'ALL',
});

export const IMAGE_STATUS = Object.freeze({ LOADING: 'loading', LOADED: 'loaded', ERROR: 'error' });

export const ALL_STATUSES = 'ALL';
export const NOT_RECORDED = 'Not recorded';

const STATUS_LABELS = {
  [REVIEW_STATUSES.UNREVIEWED]: 'Unreviewed',
  [REVIEW_STATUSES.REVIEWED]: 'Reviewed',
  [REVIEW_STATUSES.NEEDS_FURTHER_REVIEW]: 'Needs Further Review',
  [REVIEW_STATUSES.REVIEWED_ESCALATED]: 'Reviewed – Escalated',
};

const CLASSIFICATION_LABELS = {
  [CLASSIFICATIONS.WILDLIFE_SPECIES]: 'Wildlife Species',
  [CLASSIFICATIONS.SUSPICIOUS_PERSON]: 'Suspicious Person',
  [CLASSIFICATIONS.UNKNOWN]: 'Unknown',
};

const TAB_STATUSES = {
  [QUEUE_TABS.UNREVIEWED]: [REVIEW_STATUSES.UNREVIEWED, REVIEW_STATUSES.NEEDS_FURTHER_REVIEW],
  [QUEUE_TABS.REVIEWED]: [REVIEW_STATUSES.REVIEWED, REVIEW_STATUSES.REVIEWED_ESCALATED],
  [QUEUE_TABS.ALL]: Object.values(REVIEW_STATUSES),
};

const MISSING_METADATA_LABELS = {
  captured_at: 'Capture time not recorded',
  latitude: 'Latitude not recorded',
  longitude: 'Longitude not recorded',
};

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

export const getStatusLabel = (status) => STATUS_LABELS[status] || status || NOT_RECORDED;

export const getClassificationLabel = (classification) =>
  CLASSIFICATION_LABELS[classification] || classification || NOT_RECORDED;

export const getTabStatuses = (tab) => TAB_STATUSES[tab] || TAB_STATUSES[QUEUE_TABS.ALL];

export const filterByTab = (items, tab) => {
  const statuses = getTabStatuses(tab);
  return items.filter((item) => statuses.includes(item.reviewStatus));
};

export const countByTab = (items) => ({
  [QUEUE_TABS.UNREVIEWED]: filterByTab(items, QUEUE_TABS.UNREVIEWED).length,
  [QUEUE_TABS.REVIEWED]: filterByTab(items, QUEUE_TABS.REVIEWED).length,
  [QUEUE_TABS.ALL]: items.length,
});

export const filterByStatus = (items, status) =>
  !status || status === ALL_STATUSES ? items : items.filter((item) => item.reviewStatus === status);

// Same fields the backend search matches: evidence ID, camera ID, location and park
export const filterBySearch = (items, search) => {
  const term = typeof search === 'string' ? search.trim().toLowerCase() : '';
  if (!term) return items;
  return items.filter((item) =>
    [item.imageCode, item.cameraTrap?.trapCode, item.cameraTrap?.locationName, item.cameraTrap?.parkName]
      .some((value) => typeof value === 'string' && value.toLowerCase().includes(term)),
  );
};

export const applyQueueFilters = (items, { tab = QUEUE_TABS.UNREVIEWED, status = ALL_STATUSES, search = '' } = {}) =>
  filterBySearch(filterByStatus(filterByTab(items, tab), status), search);

// Capture time as epoch ms, or null when it is missing or unparseable
const getCaptureTime = (item) => {
  const value = item?.metadata?.capturedAt;
  if (isBlank(value)) return null;
  const time = new Date(value).getTime();
  return Number.isNaN(time) ? null : time;
};

// Newest capture first; evidence without a usable capture time goes last (stable order among ties)
export const sortByCaptureTimeDesc = (items) =>
  [...items].sort((a, b) => {
    const timeA = getCaptureTime(a);
    const timeB = getCaptureTime(b);
    if (timeA === timeB) return 0;
    if (timeA === null) return 1;
    if (timeB === null) return -1;
    return timeB - timeA;
  });

export const QUEUE_PAGE_SIZE = 5;

// Clamps the requested page into the valid range, so a page that no longer exists falls back to the last one
export const paginate = (items, page, pageSize = QUEUE_PAGE_SIZE) => {
  const total = items.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(Math.max(1, page), totalPages);
  const startIndex = (currentPage - 1) * pageSize;
  const pageItems = items.slice(startIndex, startIndex + pageSize);
  return {
    pageItems,
    currentPage,
    totalPages,
    total,
    from: total === 0 ? 0 : startIndex + 1,
    to: startIndex + pageItems.length,
  };
};

export const PAGE_GAP = 'gap';

// Page buttons like the wireframe: 1 2 3 … 7. Up to 7 pages are all shown; otherwise first, last and current ±1.
export const getPageNumbers = (currentPage, totalPages) => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, index) => index + 1);
  const pages = [...new Set([1, currentPage - 1, currentPage, currentPage + 1, totalPages])]
    .filter((page) => page >= 1 && page <= totalPages)
    .sort((a, b) => a - b);
  return pages.flatMap((page, index) => (index > 0 && page - pages[index - 1] > 1 ? [PAGE_GAP, page] : [page]));
};

export const getMissingMetadataLabels = (fields = []) =>
  fields.map((field) => MISSING_METADATA_LABELS[field] || `${field.replace(/_/g, ' ')} not recorded`);

const dateTimeFormatter = new Intl.DateTimeFormat('en-GB', {
  timeZone: 'Asia/Colombo',
  day: '2-digit',
  month: 'short',
  year: 'numeric',
  hour: '2-digit',
  minute: '2-digit',
  hour12: false,
});

// Capture times are shown in park local time (Sri Lanka)
export const formatDateTime = (value) => {
  if (isBlank(value)) return NOT_RECORDED;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? NOT_RECORDED : dateTimeFormatter.format(date);
};

export const formatValue = (value, unit = '') => (isBlank(value) ? NOT_RECORDED : `${value}${unit}`);

export const formatLocation = (cameraTrap) => {
  const parts = [cameraTrap?.locationName, cameraTrap?.parkName].filter((part) => !isBlank(part));
  return parts.length ? parts.join(', ') : NOT_RECORDED;
};

// Maps an ApiService error (message + optional HTTP status) to a message for the Wildlife Officer
export const describeApiError = (error) => {
  switch (error?.status) {
    case 401:
      return 'Your session has expired or you are not signed in. Please log in again.';
    case 403:
      return 'Access denied: camera-trap evidence review is restricted to Wildlife Officers.';
    case 404:
      return 'This camera-trap evidence could not be found. It may have been removed.';
    case undefined:
    case null:
      return 'Unable to reach the evidence review service. Check your connection and try again.';
    default:
      return error.message || 'Something went wrong while processing the evidence review.';
  }
};
