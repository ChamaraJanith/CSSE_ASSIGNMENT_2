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
