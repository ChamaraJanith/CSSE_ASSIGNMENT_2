// UC04 test data mirroring the real API responses: option lists and labels are those of
// backend/utils/monitoringRuleConfig.js; risk zones are the seeded Yala zones (02_seed_data.sql).

export const PARK = { id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' };

export const RISK_ZONES = [
  {
    id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer',
    severityLevel: 'CRITICAL', primaryThreat: 'Poaching & Wire Snares near River Crossing',
  },
  {
    id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary',
    severityLevel: 'HIGH', primaryThreat: 'Elephant Crop Raiding & Fence Breaches',
  },
];

// Same order as the backend sends them
export const OPTIONS = {
  hazardTypes: [
    { value: 'POACHING_SNARING', label: 'Poaching & Snaring' },
    { value: 'ELEPHANT_CROP_RAIDING_FENCE_BREACH', label: 'Elephant Crop Raiding & Fence Breaches' },
    { value: 'ILLEGAL_FISHING_CAMPSITES', label: 'Illegal Fishing & Campsites' },
    { value: 'TOURIST_OFF_ROAD_ENCROACHMENT', label: 'Tourist Off-road Encroachment' },
    { value: 'LEOPARD_FEEDING_GROUND_INCURSION', label: 'Night Incursions into Leopard Feeding Grounds' },
    { value: 'ILLEGAL_GRAZING_TIMBER_CLEARING', label: 'Illegal Cattle Grazing & Timber Clearing' },
  ],
  alertPriorities: [
    { value: 'CRITICAL', label: 'Critical' },
    { value: 'HIGH', label: 'High' },
    { value: 'MEDIUM', label: 'Medium' },
    { value: 'LOW', label: 'Low' },
  ],
  recipientRoles: [
    { value: 'park_manager', label: 'Park Manager' },
    { value: 'wildlife_officer', label: 'Wildlife Officer' },
    { value: 'community_liaison_officer', label: 'Community Liaison Officer' },
  ],
  responseBehaviours: [
    { value: 'PLACEHOLDER_RESPONSE', label: 'Response behaviour (to be confirmed)' },
  ],
};

export const REFERENCE = { park: PARK, riskZones: RISK_ZONES, options: OPTIONS };

const CREATED_AT = '2026-10-08T02:00:00.000Z';

// Backend-like /validate success: recipients de-duplicated + sorted, notes trimmed (blank -> null)
export const validResult = (payload) => ({
  data: {
    valid: true,
    errors: [],
    conflicts: [],
    rule: {
      ...payload,
      notificationRecipients: [...new Set(payload.notificationRecipients)].sort(),
      notes: typeof payload.notes === 'string' && payload.notes.trim() ? payload.notes.trim() : null,
    },
  },
});

export const invalidResult = ({ errors = [], conflicts = [] } = {}) => ({
  data: { valid: false, errors, conflicts, rule: null },
});

// A rule as returned by POST /api/monitoring-rules (camelCase, with the joined zone)
export const createdRule = (rule, status, overrides = {}) => ({
  id: 41,
  ...rule,
  riskZone: { id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary' },
  status,
  createdBy: 'cccccccc-0000-0000-0000-000000000004',
  activatedAt: status === 'ACTIVE' ? CREATED_AT : null,
  createdAt: CREATED_AT,
  updatedAt: CREATED_AT,
  ...overrides,
});

export const createResponse = (rule, status) => ({
  message: status === 'ACTIVE' ? 'Monitoring rule activated successfully.' : 'Monitoring rule saved as draft.',
  data: createdRule(rule, status),
});

// Existing rules for the list (GET /api/monitoring-rules?parkId=1)
export const EXISTING_RULES = [
  createdRule({
    parkId: 1, hazardType: 'POACHING_SNARING', riskZoneId: 1, alertPriority: 'CRITICAL',
    notificationRecipients: ['park_manager', 'wildlife_officer'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: null,
  }, 'ACTIVE', { id: 12, riskZone: { id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer' } }),
  createdRule({
    parkId: 1, hazardType: 'ELEPHANT_CROP_RAIDING_FENCE_BREACH', riskZoneId: 2, alertPriority: 'LOW',
    notificationRecipients: ['community_liaison_officer'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: 'Seasonal',
  }, 'DRAFT', { id: 11 }),
];

// Mirrors an ApiService error (message + HTTP status + optional structured details)
export const apiError = (status, message, details = {}) => Object.assign(new Error(message), { status }, details);

// A promise the test resolves by hand, to observe the in-progress state
export const deferred = () => {
  let resolve;
  let reject;
  const promise = new Promise((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
};
