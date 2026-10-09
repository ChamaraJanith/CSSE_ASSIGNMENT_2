// Shared test doubles for the UC04 monitoring rule tests (no real Supabase / PostgreSQL access).
// Supabase reads reuse the UC02 chainable fake; the pg fake below mirrors UC02's createPgFake
// but answers the UC04 statements.

const { createSupabaseFake } = require('./evidenceReviewFakes');
const { HAZARD_TYPES, RESPONSE_BEHAVIOURS } = require('../../utils/monitoringRuleConfig');

const MANAGER_ID = 'cccccccc-0000-0000-0000-000000000004';
const HAZARD = HAZARD_TYPES[0].value;
const RESPONSE = RESPONSE_BEHAVIOURS[0].value;
const CREATED_AT = '2026-10-07T01:00:00+00:00';
// NOW() of the fake database for UPDATE statements
const UPDATED_AT = '2026-10-09T03:00:00+00:00';

const yalaPark = { id: 1, code: 'YALA-NP', name: 'Yala National Park (Ruhuna)' };
const wilpattuPark = { id: 2, code: 'WILP-NP', name: 'Wilpattu National Park' };

const zoneRow = (overrides = {}) => ({
  id: 2,
  park_id: 1,
  zone_code: 'RZ-YALA-02',
  zone_name: 'Katagamuwa Sanctuary Boundary',
  severity_level: 'HIGH',
  primary_threat: 'Elephant Crop Raiding & Fence Breaches',
  center_lat: 6.3845,
  center_lng: 81.487,
  radius_km: 2.8,
  ...overrides
});

// A monitoring_rules row as returned by PostgreSQL / Supabase (snake_case)
const ruleRow = (overrides = {}) => ({
  id: 10,
  park_id: 1,
  hazard_type: HAZARD,
  risk_zone_id: 2,
  alert_priority: 'HIGH',
  notification_recipients: ['park_manager', 'wildlife_officer'],
  response_behaviour: RESPONSE,
  notes: null,
  status: 'DRAFT',
  created_by: MANAGER_ID,
  activated_at: null,
  created_at: CREATED_AT,
  updated_at: CREATED_AT,
  ...overrides
});

// A request body for validate / create (camelCase, JSON numbers)
const ruleInput = (overrides = {}) => ({
  parkId: 1,
  hazardType: HAZARD,
  riskZoneId: 2,
  alertPriority: 'HIGH',
  notificationRecipients: ['wildlife_officer', 'park_manager'],
  responseBehaviour: RESPONSE,
  notes: '  Snare lines reported near the fence  ',
  ...overrides
});

const STEP_LABELS = [
  ['BEGIN', 'BEGIN'], ['COMMIT', 'COMMIT'], ['ROLLBACK', 'ROLLBACK'],
  ['SELECT pg_advisory_xact_lock', 'LOCK_SCOPE'],
  ['SELECT id, code, name FROM public.parks', 'SELECT_PARK'],
  ['SELECT id, park_id, zone_code, zone_name FROM public.risk_zones', 'SELECT_ZONE'],
  ['SELECT id, park_id, hazard_type', 'SELECT_SCOPE_RULES'],
  ['INSERT INTO public.monitoring_rules', 'INSERT_RULE'],
  ['UPDATE public.monitoring_rules SET status', 'UPDATE_STATUS'],
  ['UPDATE public.monitoring_rules SET hazard_type', 'UPDATE_CONFIGURATION']
];

const isRowLock = (sql) => sql.startsWith('SELECT id, park_id, hazard_type') && sql.endsWith('FOR UPDATE');

/**
 * Fake pg pool/client recording every UC04 statement. `state` is live, so a test can change the
 * database between calls (e.g. a rule created by another Park Manager after /validate).
 * `failOn` makes the first statement starting with that prefix throw `failWith`
 * (default: an internal error whose text must never reach the caller).
 */
const createRulePgFake = (getPool, { park = yalaPark, zone = zoneRow(), existingRules = [], failOn = null, failWith = null } = {}) => {
  const state = { park, zone, existingRules };
  const statements = [];

  const query = jest.fn(async (text, params = []) => {
    const sql = text.replace(/\s+/g, ' ').trim();
    statements.push({ sql, params });
    if (failOn && sql.startsWith(failOn)) {
      throw failWith || new Error('relation "public.monitoring_rules" internal failure detail');
    }
    if (sql.startsWith('SELECT pg_advisory_xact_lock')) return { rows: [{ pg_advisory_xact_lock: '' }] };
    if (sql.startsWith('SELECT id, code, name FROM public.parks')) return { rows: state.park ? [state.park] : [] };
    if (sql.startsWith('SELECT id, park_id, zone_code, zone_name FROM public.risk_zones')) {
      return { rows: state.zone ? [state.zone] : [] };
    }
    // existingRules doubles as the monitoring_rules table for the row lock and the UPDATEs
    if (isRowLock(sql)) {
      const row = state.existingRules.find((r) => r.id === params[0]);
      return { rows: row ? [{ ...row }] : [] };
    }
    if (sql.startsWith('UPDATE public.monitoring_rules SET status')) {
      const [id, status, isActive] = params;
      const row = state.existingRules.find((r) => r.id === id);
      if (!row) return { rows: [] };
      Object.assign(row, { status, activated_at: isActive ? UPDATED_AT : null, updated_at: UPDATED_AT });
      return { rows: [{ ...row }] };
    }
    if (sql.startsWith('UPDATE public.monitoring_rules SET hazard_type')) {
      const [id, hazardType, riskZoneId, alertPriority, recipientsJson, responseBehaviour, notes] = params;
      const row = state.existingRules.find((r) => r.id === id);
      if (!row) return { rows: [] };
      Object.assign(row, {
        hazard_type: hazardType, risk_zone_id: riskZoneId, alert_priority: alertPriority,
        notification_recipients: JSON.parse(recipientsJson), response_behaviour: responseBehaviour, notes,
        updated_at: UPDATED_AT
      });
      return { rows: [{ ...row }] };
    }
    if (sql.startsWith('SELECT id, park_id, hazard_type')) {
      const [parkId, hazardType, riskZoneId, statuses] = params;
      return {
        rows: state.existingRules.filter((r) =>
          r.park_id === parkId && r.hazard_type === hazardType && r.risk_zone_id === riskZoneId && statuses.includes(r.status))
      };
    }
    if (sql.startsWith('INSERT INTO public.monitoring_rules')) {
      const [parkId, hazardType, riskZoneId, alertPriority, recipientsJson, responseBehaviour, notes, status, createdBy, isActive] = params;
      return {
        rows: [ruleRow({
          id: 701, park_id: parkId, hazard_type: hazardType, risk_zone_id: riskZoneId, alert_priority: alertPriority,
          notification_recipients: JSON.parse(recipientsJson), response_behaviour: responseBehaviour, notes, status,
          created_by: createdBy, activated_at: isActive ? CREATED_AT : null
        })]
      };
    }
    return { rows: [], rowCount: 0 };
  });

  const client = { query, release: jest.fn() };
  const pool = { connect: jest.fn().mockResolvedValue(client), query };
  getPool.mockReturnValue(pool);

  const label = (sql) => (isRowLock(sql)
    ? 'LOCK_RULE'
    : (STEP_LABELS.find(([prefix]) => sql.startsWith(prefix)) || [null, sql])[1]);
  const find = (prefix) => statements.filter((s) => s.sql.startsWith(prefix));
  return { client, pool, state, statements, find, steps: () => statements.map((s) => label(s.sql)) };
};

module.exports = {
  MANAGER_ID,
  HAZARD,
  RESPONSE,
  CREATED_AT,
  UPDATED_AT,
  yalaPark,
  wilpattuPark,
  zoneRow,
  ruleRow,
  ruleInput,
  createSupabaseFake,
  createRulePgFake
};
