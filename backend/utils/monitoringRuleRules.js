const {
  HAZARD_TYPES,
  RESPONSE_BEHAVIOURS,
  ALERT_PRIORITIES,
  RECIPIENT_ROLES,
  RULE_STATUSES,
  RULE_ACTIONS
} = require('./monitoringRuleConfig');

const ERROR_CODES = Object.freeze({
  REQUIRED: 'REQUIRED',
  INVALID_TYPE: 'INVALID_TYPE',
  INVALID_VALUE: 'INVALID_VALUE',
  NOT_FOUND: 'NOT_FOUND',
  ZONE_NOT_IN_PARK: 'ZONE_NOT_IN_PARK'
});

const CONFLICT_TYPES = Object.freeze({
  DUPLICATE: 'DUPLICATE',
  CONFLICT: 'CONFLICT'
});

// Existing rules in these statuses take part in duplicate / conflict detection (INACTIVE is ignored)
const ENFORCED_STATUSES = Object.freeze([RULE_STATUSES.DRAFT, RULE_STATUSES.ACTIVE]);

const CREATE_STATUS_BY_ACTION = Object.freeze({
  [RULE_ACTIONS.ACTIVATE]: RULE_STATUSES.ACTIVE,
  [RULE_ACTIONS.SAVE_DRAFT]: RULE_STATUSES.DRAFT
});

// Status changes of a saved rule. INACTIVE is final in the current UC04 scope (no reactivation).
const RULE_OPERATIONS = Object.freeze({
  EDIT: 'EDIT',
  ACTIVATE: 'ACTIVATE',
  DEACTIVATE: 'DEACTIVATE'
});

const TRANSITIONS = Object.freeze({
  [RULE_OPERATIONS.EDIT]: { from: RULE_STATUSES.DRAFT, to: RULE_STATUSES.DRAFT, verb: 'edited' },
  [RULE_OPERATIONS.ACTIVATE]: { from: RULE_STATUSES.DRAFT, to: RULE_STATUSES.ACTIVE, verb: 'activated' },
  [RULE_OPERATIONS.DEACTIVATE]: { from: RULE_STATUSES.ACTIVE, to: RULE_STATUSES.INACTIVE, verb: 'deactivated' }
});

// RULE_ACTIONS in the { value } option shape used by the field checks
const ACTION_OPTIONS = Object.freeze(Object.values(RULE_ACTIONS).map((value) => Object.freeze({ value })));

const FIELD_LABELS = Object.freeze({
  parkId: 'Park',
  hazardType: 'Hazard / species',
  riskZoneId: 'Risk zone',
  alertPriority: 'Alert priority',
  notificationRecipients: 'Notification recipients',
  responseBehaviour: 'Response behaviour',
  notes: 'Notes',
  action: 'Rule action'
});

const isBlank = (value) =>
  value === undefined || value === null || (typeof value === 'string' && value.trim() === '');

const optionValues = (options) => options.map((option) => option.value);

const fieldError = (field, code, message) => ({ field, code, message });

const requiredError = (field) => fieldError(field, ERROR_CODES.REQUIRED, `${FIELD_LABELS[field]} is required.`);

const validationResult = (errors, valueKey, value) => ({
  valid: errors.length === 0,
  errors,
  [valueKey]: errors.length === 0 ? value : null
});

// Each check pushes at most one error for its field and returns the normalised value (or null)
const checkPositiveInteger = (field, value, errors) => {
  if (isBlank(value)) {
    errors.push(requiredError(field));
    return null;
  }
  if (typeof value !== 'number') {
    errors.push(fieldError(field, ERROR_CODES.INVALID_TYPE, `${FIELD_LABELS[field]} must be a number.`));
    return null;
  }
  if (!Number.isSafeInteger(value) || value <= 0) {
    errors.push(fieldError(field, ERROR_CODES.INVALID_VALUE, `${FIELD_LABELS[field]} must be a positive integer.`));
    return null;
  }
  return value;
};

const checkOption = (field, value, options, errors) => {
  if (isBlank(value)) {
    errors.push(requiredError(field));
    return null;
  }
  if (typeof value !== 'string') {
    errors.push(fieldError(field, ERROR_CODES.INVALID_TYPE, `${FIELD_LABELS[field]} must be text.`));
    return null;
  }
  const allowed = optionValues(options);
  if (!allowed.includes(value)) {
    errors.push(fieldError(
      field,
      ERROR_CODES.INVALID_VALUE,
      `Invalid ${FIELD_LABELS[field].toLowerCase()} "${value}". Allowed values: ${allowed.join(', ')}.`
    ));
    return null;
  }
  return value;
};

const checkRecipients = (value, errors) => {
  const field = 'notificationRecipients';
  if (isBlank(value)) {
    errors.push(requiredError(field));
    return null;
  }
  if (!Array.isArray(value)) {
    errors.push(fieldError(field, ERROR_CODES.INVALID_TYPE, `${FIELD_LABELS[field]} must be a list.`));
    return null;
  }
  if (value.length === 0) {
    errors.push(fieldError(field, ERROR_CODES.REQUIRED, 'At least one notification recipient is required.'));
    return null;
  }
  const allowed = optionValues(RECIPIENT_ROLES);
  const invalid = value.filter((recipient) => !allowed.includes(recipient));
  if (invalid.length > 0) {
    errors.push(fieldError(
      field,
      ERROR_CODES.INVALID_VALUE,
      `Invalid notification recipient(s): ${invalid.map(String).join(', ')}. Allowed values: ${allowed.join(', ')}.`
    ));
    return null;
  }
  return MonitoringRuleRules.normalizeRecipients(value);
};

const checkNotes = (value, errors) => {
  if (value === undefined || value === null) return null;
  if (typeof value !== 'string') {
    errors.push(fieldError('notes', ERROR_CODES.INVALID_TYPE, `${FIELD_LABELS.notes} must be text.`));
    return null;
  }
  const trimmed = value.trim();
  return trimmed === '' ? null : trimmed;
};

const isInScope = (rule, existing) =>
  Number(existing.parkId) === rule.parkId &&
  existing.hazardType === rule.hazardType &&
  Number(existing.riskZoneId) === rule.riskZoneId;

const isSameRule = (rule, existing) =>
  rule.id !== undefined && rule.id !== null && existing.id === rule.id;

class MonitoringRuleRules {
  /**
   * Removes duplicate recipients and sorts them so recipient order never affects comparisons.
   * Non-array input is treated as an empty list.
   */
  static normalizeRecipients(recipients) {
    return Array.isArray(recipients) ? [...new Set(recipients)].sort() : [];
  }

  /**
   * Mandatory-field and allowed-value validation for a monitoring rule (UC04).
   * Collects every field error instead of stopping at the first one, so the Park Manager
   * can correct the whole configuration in one pass.
   *
   * parkId, riskZoneId                      required positive integers
   * hazardType, alertPriority,
   * responseBehaviour                       required, one of the configured options
   * notificationRecipients                  required non-empty list of configured recipient roles,
   *                                         de-duplicated and sorted
   * notes                                   optional text, trimmed, blank -> null
   *
   * Park / risk zone existence and ownership are checked separately (checkReferences)
   * because they need reference data supplied by the service layer.
   *
   * @returns {{ valid: boolean, errors: Array<{field, code, message}>, rule: object|null }}
   */
  static validateFields(input) {
    const source = input && typeof input === 'object' ? input : {};
    const errors = [];

    const rule = {
      parkId: checkPositiveInteger('parkId', source.parkId, errors),
      hazardType: checkOption('hazardType', source.hazardType, HAZARD_TYPES, errors),
      riskZoneId: checkPositiveInteger('riskZoneId', source.riskZoneId, errors),
      alertPriority: checkOption('alertPriority', source.alertPriority, ALERT_PRIORITIES, errors),
      notificationRecipients: checkRecipients(source.notificationRecipients, errors),
      responseBehaviour: checkOption('responseBehaviour', source.responseBehaviour, RESPONSE_BEHAVIOURS, errors),
      notes: checkNotes(source.notes, errors)
    };

    return validationResult(errors, 'rule', rule);
  }

  /**
   * The final action chosen on the review screen: ACTIVATE or SAVE_DRAFT.
   * @returns {{ valid: boolean, errors: Array<{field, code, message}>, action: string|null }}
   */
  static validateAction(action) {
    const errors = [];
    const value = checkOption('action', action, ACTION_OPTIONS, errors);
    return validationResult(errors, 'action', value);
  }

  /**
   * Checks the reference data the service looked up for an already field-valid rule.
   * `park` and `zone` are the database rows (or null when not found); zone.park_id is the owning park.
   * Ownership is only checked when both exist.
   *
   * @returns {{ valid: boolean, errors: Array<{field, code, message}> }}
   */
  static checkReferences(rule, park, zone) {
    const errors = [];
    if (!park) {
      errors.push(fieldError('parkId', ERROR_CODES.NOT_FOUND, 'The selected park was not found.'));
    }
    if (!zone) {
      errors.push(fieldError('riskZoneId', ERROR_CODES.NOT_FOUND, 'The selected risk zone was not found.'));
    }
    if (park && zone && Number(zone.park_id) !== rule.parkId) {
      errors.push(fieldError(
        'riskZoneId',
        ERROR_CODES.ZONE_NOT_IN_PARK,
        'The selected risk zone does not belong to the selected park.'
      ));
    }
    return { valid: errors.length === 0, errors };
  }

  /**
   * Two rules have the same configuration when alert priority, notification recipients
   * (order-insensitive) and response behaviour match. Notes, ids, status and timestamps are ignored.
   */
  static isSameConfiguration(a, b) {
    const recipientsA = MonitoringRuleRules.normalizeRecipients(a.notificationRecipients);
    const recipientsB = MonitoringRuleRules.normalizeRecipients(b.notificationRecipients);
    return a.alertPriority === b.alertPriority &&
      a.responseBehaviour === b.responseBehaviour &&
      recipientsA.length === recipientsB.length &&
      recipientsA.every((recipient, index) => recipient === recipientsB[index]);
  }

  /**
   * Duplicate / active-conflict detection within the scope park + hazard + risk zone.
   *
   * DC1  existing DRAFT or ACTIVE rule, same configuration       -> DUPLICATE
   * DC2  existing ACTIVE rule, different configuration           -> CONFLICT
   * DC3  existing DRAFT rule, different configuration            -> no conflict
   * DC4  existing INACTIVE rule                                   -> ignored
   * A rule never conflicts with itself (same id).
   *
   * `existingRules` use the camelCase rule shape (parkId, hazardType, riskZoneId, status, ...).
   * @returns {Array<{ type, ruleId, status, message }>}
   */
  static findConflicts(rule, existingRules) {
    const candidates = Array.isArray(existingRules) ? existingRules : [];
    return candidates
      .filter((existing) => ENFORCED_STATUSES.includes(existing.status))
      .filter((existing) => isInScope(rule, existing) && !isSameRule(rule, existing))
      .reduce((conflicts, existing) => {
        if (MonitoringRuleRules.isSameConfiguration(rule, existing)) {
          conflicts.push({
            type: CONFLICT_TYPES.DUPLICATE,
            ruleId: existing.id,
            status: existing.status,
            message: `An identical ${existing.status} rule (#${existing.id}) already exists for this hazard and risk zone.`
          });
        } else if (existing.status === RULE_STATUSES.ACTIVE) {
          conflicts.push({
            type: CONFLICT_TYPES.CONFLICT,
            ruleId: existing.id,
            status: existing.status,
            message: `An ACTIVE rule (#${existing.id}) with a different configuration already exists for this hazard and risk zone.`
          });
        }
        return conflicts;
      }, []);
  }

  /**
   * Status of a newly created rule: ACTIVATE -> ACTIVE, SAVE_DRAFT -> DRAFT.
   * @throws {Error} with status 400 for any other action
   */
  static resolveCreateStatus(action) {
    if (typeof action !== 'string' || !Object.hasOwn(CREATE_STATUS_BY_ACTION, action)) {
      const err = new Error(`Invalid rule action "${action}". Allowed values: ${Object.values(RULE_ACTIONS).join(', ')}.`);
      err.status = 400;
      throw err;
    }
    return CREATE_STATUS_BY_ACTION[action];
  }

  /**
   * Status of a saved rule after an operation:
   * EDIT DRAFT -> DRAFT, ACTIVATE DRAFT -> ACTIVE, DEACTIVATE ACTIVE -> INACTIVE.
   * @throws {Error} with status 409 when the rule is not in the required status,
   *                 status 500 for an unknown operation (a programming error)
   */
  static resolveTransition(operation, currentStatus) {
    const transition = Object.hasOwn(TRANSITIONS, operation) ? TRANSITIONS[operation] : null;
    if (!transition) {
      const err = new Error(`Unknown monitoring rule operation "${operation}".`);
      err.status = 500;
      throw err;
    }
    if (currentStatus !== transition.from) {
      const err = new Error(
        `Only ${transition.from} rules can be ${transition.verb}. This rule is ${currentStatus}. No changes were saved.`
      );
      err.status = 409;
      throw err;
    }
    return transition.to;
  }
}

module.exports = MonitoringRuleRules;
module.exports.RULE_OPERATIONS = RULE_OPERATIONS;
module.exports.ERROR_CODES = ERROR_CODES;
module.exports.CONFLICT_TYPES = CONFLICT_TYPES;
module.exports.ENFORCED_STATUSES = ENFORCED_STATUSES;
