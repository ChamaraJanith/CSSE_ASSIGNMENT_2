// UC04 test data mirroring the real API responses: option lists and labels are those of
// backend/utils/monitoringRuleConfig.js; risk zones are the seeded Yala zones (02_seed_data.sql)
// and Wilpattu zones (seed_other_parks.js), with their stored centre and radius.

export const PARK = { id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' };

export const RISK_ZONES = [
  {
    id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer',
    severityLevel: 'CRITICAL', primaryThreat: 'Poaching & Wire Snares near River Crossing',
    centerLat: 6.4128, centerLng: 81.5342, radiusKm: 3.2,
  },
  {
    id: 2, zoneCode: 'RZ-YALA-02', zoneName: 'Katagamuwa Sanctuary Boundary',
    severityLevel: 'HIGH', primaryThreat: 'Elephant Crop Raiding & Fence Breaches',
    centerLat: 6.3845, centerLng: 81.487, radiusKm: 2.8,
  },
];

export const WILPATTU_PARK = { id: 2, code: 'WILP-NP', name: 'Wilpattu National Park' };

export const WILPATTU_ZONES = [
  {
    id: 5, zoneCode: 'RZ-WILP-01', zoneName: 'Kokmote Sandstone River Buffer',
    severityLevel: 'CRITICAL', primaryThreat: 'Poaching & Illegal Snaring along Riverbank',
    centerLat: 8.492, centerLng: 80.035, radiusKm: 3.5,
  },
  {
    id: 6, zoneCode: 'RZ-WILP-02', zoneName: 'Maradanmaduwa Willu Sanctuary',
    severityLevel: 'HIGH', primaryThreat: 'Night Incursions into Leopard Feeding Grounds',
    centerLat: 8.421, centerLng: 80.062, radiusKm: 2.5,
  },
];

// Udawalawe park (02_seed_data.sql) and its zones (seed_other_parks.js); ids are illustrative
export const UDAWALAWE_PARK = { id: 3, code: 'UDAW-NP', name: 'Udawalawe National Park' };

export const UDAWALAWE_ZONES = [
  {
    id: 7, zoneCode: 'RZ-UDAW-01', zoneName: 'Mau Ara Southern Fence Boundary',
    severityLevel: 'CRITICAL', primaryThreat: 'Severe Elephant Crop-Raiding & Electric Fence Breaches',
    centerLat: 6.442, centerLng: 80.892, radiusKm: 3,
  },
  {
    id: 8, zoneCode: 'RZ-UDAW-02', zoneName: 'Reservoir Spillway Buffer',
    severityLevel: 'MEDIUM', primaryThreat: 'Illegal Cattle Grazing & Timber Clearing',
    centerLat: 6.495, centerLng: 80.875, radiusKm: 2.2,
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

export const WILPATTU_REFERENCE = { park: WILPATTU_PARK, riskZones: WILPATTU_ZONES, options: OPTIONS };

export const UDAWALAWE_REFERENCE = { park: UDAWALAWE_PARK, riskZones: UDAWALAWE_ZONES, options: OPTIONS };

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

export const UPDATED_AT = '2026-10-09T04:15:00.000Z';

// A deactivated rule: configuration kept, activatedAt cleared by the backend
export const INACTIVE_RULE = createdRule({
  parkId: 1, hazardType: 'ILLEGAL_FISHING_CAMPSITES', riskZoneId: 1, alertPriority: 'MEDIUM',
  notificationRecipients: ['wildlife_officer'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: null,
}, 'INACTIVE', { id: 9, updatedAt: UPDATED_AT, riskZone: { id: 1, zoneCode: 'RZ-YALA-01', zoneName: 'Northern River Basin Buffer' } });

// One rule of every status (ACTIVE #12, DRAFT #11, INACTIVE #9)
export const RULES_ALL_STATUSES = [...EXISTING_RULES, INACTIVE_RULE];

// A saved ACTIVE rule of `park` in `zone`, as the list endpoint returns it (joined zone has no geometry)
export const ruleInZone = (park, zone, overrides = {}) => createdRule({
  parkId: park.id, hazardType: 'POACHING_SNARING', riskZoneId: zone.id, alertPriority: 'HIGH',
  notificationRecipients: ['park_manager'], responseBehaviour: 'PLACEHOLDER_RESPONSE', notes: null,
}, 'ACTIVE', { id: 30 + zone.id, riskZone: { id: zone.id, zoneCode: zone.zoneCode, zoneName: zone.zoneName }, ...overrides });

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
