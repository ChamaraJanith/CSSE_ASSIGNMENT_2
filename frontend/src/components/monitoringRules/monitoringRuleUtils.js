// Pure display/form helpers for UC04. Business decisions (allowed values, mandatory fields,
// park/zone ownership, duplicates and conflicts) always come from the backend; option lists come
// from the reference endpoint and are never hard-coded here.

export { formatDateTime } from '../evidenceReview/evidenceReviewUtils';

export const RULE_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE',
});

export const RULE_ACTIONS = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  SAVE_DRAFT: 'SAVE_DRAFT',
});

export const LIST_TABS = Object.freeze({
  ALL: 'ALL',
  ACTIVE: 'ACTIVE',
  DRAFT: 'DRAFT',
});

export const NOT_RECORDED = 'Not recorded';

const STATUS_LABELS = {
  [RULE_STATUSES.DRAFT]: 'Draft',
  [RULE_STATUSES.ACTIVE]: 'Active',
  [RULE_STATUSES.INACTIVE]: 'Inactive',
};

export const FIELD_LABELS = Object.freeze({
  parkId: 'Park',
  hazardType: 'Hazard / Species',
  riskZoneId: 'Risk Zone',
  alertPriority: 'Alert Priority',
  notificationRecipients: 'Notification Recipients',
  responseBehaviour: 'Response Behaviour',
  notes: 'Notes',
  action: 'Action',
});

// Configuration steps and the form fields each one owns (storyboard: Step 1 = Hazard and Risk Zone)
export const FORM_STEPS = Object.freeze([
  { id: 1, label: 'Hazard & Risk Zone', fields: ['hazardType', 'riskZoneId'] },
  { id: 2, label: 'Priority & Notifications', fields: ['alertPriority', 'notificationRecipients', 'responseBehaviour', 'notes'] },
]);

export const LAST_STEP = FORM_STEPS[FORM_STEPS.length - 1].id;

// The review screen is the final step of the flow, reached only through Submit for Validation
export const REVIEW_STEP = Object.freeze({ id: LAST_STEP + 1, label: 'Review' });
export const TOTAL_STEPS = REVIEW_STEP.id;

// riskZoneId is kept as a number (or '' when nothing is selected) so it is sent as a JSON number
export const EMPTY_RULE_FORM = Object.freeze({
  hazardType: '',
  riskZoneId: '',
  alertPriority: '',
  notificationRecipients: [],
  responseBehaviour: '',
  notes: '',
});

const isBlank = (value) => value === null || value === undefined || String(value).trim() === '';

export const getStatusLabel = (status) => STATUS_LABELS[status] || status || NOT_RECORDED;

export const getFieldLabel = (field) => FIELD_LABELS[field] || field;

export const getOptionLabel = (options, value) => {
  if (isBlank(value)) return NOT_RECORDED;
  const option = (options || []).find((entry) => entry.value === value);
  return option ? option.label : value;
};

export const formatRecipients = (options, values) =>
  Array.isArray(values) && values.length > 0
    ? values.map((value) => getOptionLabel(options, value)).join(', ')
    : NOT_RECORDED;

export const formatZone = (zone) => (zone ? `${zone.zoneCode} – ${zone.zoneName}` : NOT_RECORDED);

export const findZone = (riskZones, riskZoneId) =>
  (riskZones || []).find((zone) => zone.id === riskZoneId) || null;

// A rule from the list endpoint carries its joined zone; fall back to the reference zones
export const getRuleZoneLabel = (rule, riskZones) =>
  formatZone(rule.riskZone || findZone(riskZones, rule.riskZoneId));

export const filterByTab = (rules, tab) =>
  !tab || tab === LIST_TABS.ALL ? rules : rules.filter((rule) => rule.status === tab);

export const countByTab = (rules) => ({
  [LIST_TABS.ALL]: rules.length,
  [LIST_TABS.ACTIVE]: filterByTab(rules, LIST_TABS.ACTIVE).length,
  [LIST_TABS.DRAFT]: filterByTab(rules, LIST_TABS.DRAFT).length,
});

/**
 * Request body for validate / create. Ids are numbers; unselected values stay empty so the
 * backend reports them as REQUIRED. Backend-controlled fields (status, creator, activation time)
 * are never part of the payload.
 */
export const buildRulePayload = (form, parkId) => ({
  parkId,
  hazardType: form.hazardType,
  riskZoneId: form.riskZoneId === '' ? null : form.riskZoneId,
  alertPriority: form.alertPriority,
  notificationRecipients: [...form.notificationRecipients],
  responseBehaviour: form.responseBehaviour,
  notes: form.notes,
});

// Only controls the Next button; the backend decides whether the configuration is valid
export const isStepComplete = (stepId, form) => {
  if (stepId === 1) return !isBlank(form.hazardType) && form.riskZoneId !== '';
  return true;
};

export const groupErrorsByField = (errors) =>
  (errors || []).reduce((grouped, error) => {
    (grouped[error.field] = grouped[error.field] || []).push(error.message);
    return grouped;
  }, {});

export const firstStepWithError = (errors) => {
  const fields = new Set((errors || []).map((error) => error.field));
  const step = FORM_STEPS.find((entry) => entry.fields.some((field) => fields.has(field)));
  return step ? step.id : null;
};

export const toggleRecipient = (recipients, value) =>
  recipients.includes(value) ? recipients.filter((entry) => entry !== value) : [...recipients, value];

// Maps an ApiService error (message + optional HTTP status) to a message for the Park Manager
export const describeApiError = (error) => {
  switch (error?.status) {
    case 401:
      return 'Your session has expired or you are not signed in. Please log in again.';
    case 403:
      return 'Access denied: monitoring rules can only be configured by Park Managers.';
    case 404:
      return 'The selected park could not be found. Choose another park from the park selector.';
    case undefined:
    case null:
      return 'Unable to reach the monitoring rules service. Check your connection and try again.';
    default:
      return error.message || 'Something went wrong while processing the monitoring rule request.';
  }
};
