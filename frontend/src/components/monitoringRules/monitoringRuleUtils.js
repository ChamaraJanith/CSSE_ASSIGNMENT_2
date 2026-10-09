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
  INACTIVE: 'INACTIVE',
});

// Actions on a saved rule. Every list row offers VIEW only; the details dialog offers the status
// actions, which mirror the backend lifecycle (DRAFT -> edit / activate, ACTIVE -> deactivate,
// INACTIVE is final).
export const RULE_ROW_ACTIONS = Object.freeze({
  VIEW: 'VIEW',
  EDIT: 'EDIT',
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE',
});

const ACTIONS_BY_STATUS = {
  [RULE_STATUSES.DRAFT]: [RULE_ROW_ACTIONS.EDIT, RULE_ROW_ACTIONS.ACTIVATE],
  [RULE_STATUSES.ACTIVE]: [RULE_ROW_ACTIONS.DEACTIVATE],
};

// Status actions offered in the details dialog; an INACTIVE or unknown status offers none
export const getRuleActions = (status) =>
  (Object.hasOwn(ACTIONS_BY_STATUS, status) ? ACTIONS_BY_STATUS[status] : []);

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

export const NO_RESPONSE_BEHAVIOUR = 'Not selected';

const isKnownOption = (options, value) => (options || []).some((entry) => entry.value === value);

// Rules saved before the response behaviours were defined can hold a retired code; once the options
// have loaded, such a value is shown as "Not selected" instead of the raw code.
export const formatResponseBehaviour = (options, value) => {
  if (isBlank(value)) return NOT_RECORDED;
  if (Array.isArray(options) && options.length > 0 && !isKnownOption(options, value)) return NO_RESPONSE_BEHAVIOUR;
  return getOptionLabel(options, value);
};

export const formatRecipients = (options, values) =>
  Array.isArray(values) && values.length > 0
    ? values.map((value) => getOptionLabel(options, value)).join(', ')
    : NOT_RECORDED;

export const formatZone = (zone) => (zone ? `${zone.zoneCode} – ${zone.zoneName}` : NOT_RECORDED);

export const findZone = (riskZones, riskZoneId) =>
  (riskZones || []).find((zone) => zone.id === riskZoneId) || null;

const toFiniteNumber = (value) => (isBlank(value) || !Number.isFinite(Number(value)) ? null : Number(value));

/**
 * Map geometry of a reference risk zone (centre + radius in km, as stored in risk_zones).
 * Returns null when the centre is missing or invalid; a missing or non-positive radius gives
 * radiusMeters null so the caller can show the centre only, without inventing a radius.
 */
export const toZoneCircle = (zone) => {
  if (!zone) return null;
  const lat = toFiniteNumber(zone.centerLat);
  const lng = toFiniteNumber(zone.centerLng);
  if (lat === null || lng === null || Math.abs(lat) > 90 || Math.abs(lng) > 180) return null;
  const radiusKm = toFiniteNumber(zone.radiusKm);
  return { center: [lat, lng], radiusMeters: radiusKm !== null && radiusKm > 0 ? radiusKm * 1000 : null };
};

// A rule from the list endpoint carries its joined zone; fall back to the reference zones
export const getRuleZoneLabel = (rule, riskZones) =>
  formatZone(rule.riskZone || findZone(riskZones, rule.riskZoneId));

// Presentation order for the Step 2 priority choices (storyboard: Low -> Critical). Values are not
// changed; any option not listed keeps its backend order after the listed ones.
const PRIORITY_DISPLAY_ORDER = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'];

export const orderPriorityOptions = (options) => {
  const rank = (option) => {
    const index = PRIORITY_DISPLAY_ORDER.indexOf(option.value);
    return index === -1 ? PRIORITY_DISPLAY_ORDER.length : index;
  };
  return (options || [])
    .map((option, position) => ({ option, position }))
    .sort((a, b) => rank(a.option) - rank(b.option) || a.position - b.position)
    .map(({ option }) => option);
};

export const filterByTab = (rules, tab) =>
  !tab || tab === LIST_TABS.ALL ? rules : rules.filter((rule) => rule.status === tab);

export const countByTab = (rules) => ({
  [LIST_TABS.ALL]: rules.length,
  [LIST_TABS.ACTIVE]: filterByTab(rules, LIST_TABS.ACTIVE).length,
  [LIST_TABS.DRAFT]: filterByTab(rules, LIST_TABS.DRAFT).length,
  [LIST_TABS.INACTIVE]: filterByTab(rules, LIST_TABS.INACTIVE).length,
});

// A saved rule's values in the configuration-form shape (the inverse of buildRulePayload).
// With `options`, a retired response behaviour is cleared so the select asks for a current one.
export const toRuleForm = (rule, options) => {
  const responseBehaviour = rule?.responseBehaviour || '';
  const responseOptions = options?.responseBehaviours;
  const retired = Array.isArray(responseOptions) && responseOptions.length > 0
    && responseBehaviour !== '' && !isKnownOption(responseOptions, responseBehaviour);

  return {
    hazardType: rule?.hazardType || '',
    riskZoneId: rule?.riskZoneId ?? '',
    alertPriority: rule?.alertPriority || '',
    notificationRecipients: Array.isArray(rule?.notificationRecipients) ? [...rule.notificationRecipients] : [],
    responseBehaviour: retired ? '' : responseBehaviour,
    notes: rule?.notes || '',
  };
};

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

// Same mapping for requests on one saved rule, where a 404 means the rule (not the park) is gone
export const describeRuleError = (error) =>
  (error?.status === 404
    ? 'This monitoring rule no longer exists. Refresh the list and try again.'
    : describeApiError(error));
