// UC04 option / value sets - the single source of truth for monitoring rule values.
// The frontend receives these lists from the API, so changing a value set here needs no
// schema migration and no frontend change.

const freezeOptions = (options) => Object.freeze(options.map((option) => Object.freeze({ ...option })));

// UNCONFIRMED – replace with Assignment 02 values.
// Placeholder codes: one per primary_threat theme already seeded in public.risk_zones
// (02_seed_data.sql, seed_other_parks.js). Labels repeat the seeded wording; no business
// meaning is attached to any of them.
const HAZARD_TYPES = freezeOptions([
  { value: 'POACHING_SNARING', label: 'Poaching & Snaring' }, // RZ-YALA-01, RZ-WILP-01
  { value: 'ELEPHANT_CROP_RAIDING_FENCE_BREACH', label: 'Elephant Crop Raiding & Fence Breaches' }, // RZ-YALA-02, RZ-UDAW-01
  { value: 'ILLEGAL_FISHING_CAMPSITES', label: 'Illegal Fishing & Campsites' }, // RZ-YALA-03
  { value: 'TOURIST_OFF_ROAD_ENCROACHMENT', label: 'Tourist Off-road Encroachment' }, // RZ-YALA-04
  { value: 'LEOPARD_FEEDING_GROUND_INCURSION', label: 'Night Incursions into Leopard Feeding Grounds' }, // RZ-WILP-02
  { value: 'ILLEGAL_GRAZING_TIMBER_CLEARING', label: 'Illegal Cattle Grazing & Timber Clearing' } // RZ-UDAW-02
]);

// Project-defined response behaviours (the Assignment 02 specification does not list any).
// UC04 only stores the chosen behaviour as rule configuration; it does not notify or create incidents.
// Rules saved before these values existed may still hold the retired 'PLACEHOLDER_RESPONSE' code:
// they display safely, and a draft must pick one of these values before it can be saved or activated.
const RESPONSE_BEHAVIOURS = freezeOptions([
  { value: 'NOTIFY_RECIPIENTS', label: 'Notify Recipients' },
  { value: 'CREATE_INCIDENT', label: 'Create Incident' },
  { value: 'NOTIFY_AND_CREATE_INCIDENT', label: 'Notify & Create Incident' },
  { value: 'NOTIFY_AND_ESCALATE', label: 'Notify & Escalate' }
]);

// Reuses the existing severity vocabulary (risk_zones.severity_level, patrol_plans.priority)
const ALERT_PRIORITIES = freezeOptions([
  { value: 'CRITICAL', label: 'Critical' },
  { value: 'HIGH', label: 'High' },
  { value: 'MEDIUM', label: 'Medium' },
  { value: 'LOW', label: 'Low' }
]);

// Reuses the existing role names from public.roles (see Login.jsx role routing).
// UC04 only stores these as recipient configuration; it does not send notifications.
const RECIPIENT_ROLES = freezeOptions([
  { value: 'park_manager', label: 'Park Manager' },
  { value: 'wildlife_officer', label: 'Wildlife Officer' },
  { value: 'community_liaison_officer', label: 'Community Liaison Officer' }
]);

// INACTIVE is only reached by deactivating an ACTIVE rule; it is never created and never reactivated
const RULE_STATUSES = Object.freeze({
  DRAFT: 'DRAFT',
  ACTIVE: 'ACTIVE',
  INACTIVE: 'INACTIVE'
});

const RULE_ACTIONS = Object.freeze({
  ACTIVATE: 'ACTIVATE',
  SAVE_DRAFT: 'SAVE_DRAFT'
});

module.exports = Object.freeze({
  HAZARD_TYPES,
  RESPONSE_BEHAVIOURS,
  ALERT_PRIORITIES,
  RECIPIENT_ROLES,
  RULE_STATUSES,
  RULE_ACTIONS
});
