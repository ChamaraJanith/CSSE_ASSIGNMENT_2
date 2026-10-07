// ==============================================================================
// WildGuard - UC02 Migration Runner (Review and Escalate Camera-Trap Evidence)
// Usage: node migrations/run_evidence_review_migration.js
// Runs against the shared Supabase database - coordinate with the team first.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const { supabaseAdmin } = require('../supabaseClient');

const EVIDENCE_BUCKET = 'evidence';
const SEED_ASSETS_DIR = path.resolve(__dirname, 'seed_assets');
const SEED_IMAGE_PATHS = [
  'camera-traps/CT-YALA-01/IMG-YALA01-0001.jpg',
  'camera-traps/CT-YALA-01/IMG-YALA01-0002.jpg',
  'camera-traps/CT-YALA-02/IMG-YALA02-0001.jpg',
  'camera-traps/CT-YALA-02/IMG-YALA02-0002.jpg',
  'camera-traps/CT-WILP-01/IMG-WILP01-0001.jpg'
];

async function uploadSeedImages() {
  for (const storagePath of SEED_IMAGE_PATHS) {
    const fileBuffer = fs.readFileSync(path.join(SEED_ASSETS_DIR, storagePath));
    const { error } = await supabaseAdmin.storage
      .from(EVIDENCE_BUCKET)
      .upload(storagePath, fileBuffer, { contentType: 'image/jpeg', upsert: true });

    if (error) throw new Error(`Upload failed for ${storagePath}: ${error.message}`);
    console.log(`Uploaded ${storagePath}`);
  }
}

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString || !process.env.SUPABASE_URL) {
    console.error('DATABASE_URL and SUPABASE_URL must be set in .env');
    process.exit(1);
  }

  const evidenceBaseUrl = `${process.env.SUPABASE_URL.replace(/\/$/, '')}/storage/v1/object/public/${EVIDENCE_BUCKET}`;

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    const schemaSql = fs.readFileSync(path.resolve(__dirname, '04_create_evidence_review_schema.sql'), 'utf-8');
    console.log('Executing 04_create_evidence_review_schema.sql...');
    await client.query(schemaSql);
    console.log('Schema created successfully!');

    console.log('Uploading camera-trap seed images to the evidence bucket...');
    await uploadSeedImages();

    const seedSql = fs.readFileSync(path.resolve(__dirname, '05_seed_evidence_review_data.sql'), 'utf-8');
    console.log('Executing 05_seed_evidence_review_data.sql...');
    await client.query(
      `BEGIN;
       SELECT set_config('uc02.evidence_base_url', ${client.escapeLiteral(evidenceBaseUrl)}, true);
       ${seedSql}
       COMMIT;`
    );
    console.log('Seed data inserted successfully!');

    // Verify counts
    const trapsRes = await client.query('SELECT COUNT(*) FROM public.camera_traps');
    const imagesRes = await client.query('SELECT review_status, COUNT(*) FROM public.camera_trap_images GROUP BY review_status ORDER BY review_status');

    console.log('\n--- VERIFICATION ---');
    console.log('Camera traps count:', trapsRes.rows[0].count);
    imagesRes.rows.forEach((row) => console.log(`Images ${row.review_status}:`, row.count));

  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigrations();
