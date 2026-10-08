// Shared test doubles for the UC02 evidence review tests (no real Supabase / PostgreSQL access)

const OFFICER_ID = 'aaaaaaaa-0000-0000-0000-000000000001';
const STORAGE_BASE = 'https://example-project.supabase.co/storage/v1/object/public/evidence';

const yalaTrap = {
  id: 1, trap_code: 'CT-YALA-01', location_name: 'Northern River Basin Crossing (Sector 7B)',
  latitude: '6.412800', longitude: '81.534200', park_id: 1, parks: { id: 1, name: 'Yala National Park (Ruhuna)' }
};
const wilpattuTrap = {
  id: 3, trap_code: 'CT-WILP-01', location_name: 'Kokmote River Buffer Trail',
  latitude: '8.492000', longitude: '80.035000', park_id: 2, parks: { id: 2, name: 'Wilpattu National Park' }
};

const imageRow = (overrides = {}) => ({
  id: 1,
  image_code: 'IMG-YALA01-0001',
  image_url: `${STORAGE_BASE}/camera-traps/CT-YALA-01/IMG-YALA01-0001.jpg`,
  captured_at: '2026-10-01T00:42:00+00:00',
  latitude: '6.412850',
  longitude: '81.534180',
  camera_model: 'Browning Recon Force Elite HP5',
  trigger_type: 'MOTION',
  ambient_temperature_c: '27.5',
  review_status: 'UNREVIEWED',
  created_at: '2026-10-07T00:00:00+00:00',
  updated_at: '2026-10-07T00:00:00+00:00',
  camera_traps: yalaTrap,
  ...overrides
});

const incompleteImageRow = (overrides = {}) => imageRow({
  id: 4,
  image_code: 'IMG-YALA02-0002',
  image_url: `${STORAGE_BASE}/camera-traps/CT-YALA-02/IMG-YALA02-0002.jpg`,
  captured_at: null, latitude: null, longitude: null, ambient_temperature_c: null, trigger_type: 'HEAT',
  ...overrides
});

const brokenImageRow = () => imageRow({
  id: 6,
  image_code: 'IMG-WILP01-0002',
  image_url: 'https://camera-trap-feed.invalid/CT-WILP-01/IMG-WILP01-0002.jpg',
  camera_traps: wilpattuTrap
});

// Row shape returned by the transactional SELECT ... FOR UPDATE
const lockedImage = (row) => ({
  id: row.id, image_code: row.image_code, review_status: row.review_status,
  captured_at: row.captured_at, latitude: row.latitude, longitude: row.longitude
});

/**
 * Chainable, awaitable stand-in for a supabase-js query builder.
 * `tables` maps table name -> { data, error }. The latest builder per table is exposed for assertions.
 */
const createSupabaseFake = (supabaseAdmin, tables = {}) => {
  const builders = {};
  supabaseAdmin.from.mockImplementation((table) => {
    const result = tables[table] || { data: [], error: null };
    const builder = {};
    ['select', 'eq', 'in', 'order', 'maybeSingle'].forEach((method) => {
      builder[method] = jest.fn(() => builder);
    });
    builder.then = (onFulfilled, onRejected) => Promise.resolve(result).then(onFulfilled, onRejected);
    builders[table] = builder;
    return builder;
  });
  return builders;
};

/**
 * Fake pg pool/client that records every statement of the review transaction.
 * `failOn` makes the first statement starting with that text throw (simulated database failure).
 */
const createPgFake = (getPool, { image = null, failOn = null } = {}) => {
  const statements = [];
  const client = {
    query: jest.fn(async (text, params = []) => {
      const sql = text.replace(/\s+/g, ' ').trim();
      statements.push({ sql, params });
      if (failOn && sql.startsWith(failOn)) {
        throw new Error('relation "public.threat_alerts" internal failure detail');
      }
      if (sql.startsWith('SELECT')) return { rows: image ? [image] : [] };
      if (sql.startsWith('INSERT INTO public.evidence_reviews')) {
        const [imageId, reviewedBy, classification, notes, metadataAck, confirmed, justification] = params;
        return {
          rows: [{
            id: 501, image_id: imageId, reviewed_by: reviewedBy, classification, notes,
            metadata_incomplete_acknowledged: metadataAck, escalation_confirmed: confirmed,
            escalation_justification: justification, created_at: '2026-10-07T01:00:00+00:00'
          }]
        };
      }
      if (sql.startsWith('INSERT INTO public.threat_alerts')) {
        const [imageId, reviewId, createdBy, justification, status] = params;
        return {
          rows: [{
            id: 901, camera_trap_image_id: imageId, evidence_review_id: reviewId, created_by: createdBy,
            justification, status, created_at: '2026-10-07T01:00:00+00:00'
          }]
        };
      }
      return { rows: [], rowCount: 1 };
    }),
    release: jest.fn()
  };
  const pool = { connect: jest.fn().mockResolvedValue(client) };
  getPool.mockReturnValue(pool);

  const STEP_LABELS = [
    ['BEGIN', 'BEGIN'], ['COMMIT', 'COMMIT'], ['ROLLBACK', 'ROLLBACK'],
    ['SELECT', 'LOCK_IMAGE'], ['INSERT INTO public.evidence_reviews', 'INSERT_REVIEW'],
    ['UPDATE public.camera_trap_images', 'UPDATE_STATUS'], ['INSERT INTO public.threat_alerts', 'INSERT_ALERT']
  ];
  const label = (sql) => (STEP_LABELS.find(([prefix]) => sql.startsWith(prefix)) || [null, sql])[1];

  const find = (prefix) => statements.filter((s) => s.sql.startsWith(prefix));
  return { client, pool, statements, find, steps: () => statements.map((s) => label(s.sql)) };
};

module.exports = {
  OFFICER_ID,
  STORAGE_BASE,
  imageRow,
  incompleteImageRow,
  brokenImageRow,
  lockedImage,
  createSupabaseFake,
  createPgFake
};
