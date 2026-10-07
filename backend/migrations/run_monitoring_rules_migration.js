// ==============================================================================
// WildGuard - UC04 Migration Runner (Configure Park-Specific Wildlife Monitoring Rules)
// Usage: node migrations/run_monitoring_rules_migration.js
// Runs against the shared Supabase database - coordinate with the team first.
// Creates the schema only; no seed data is inserted.
// ==============================================================================

const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL must be set in .env');
    process.exit(1);
  }

  const client = new Client({
    connectionString,
    ssl: { rejectUnauthorized: false }
  });

  try {
    console.log('Connecting to Supabase PostgreSQL database...');
    await client.connect();
    console.log('Connected successfully!');

    const schemaSql = fs.readFileSync(path.resolve(__dirname, '06_create_monitoring_rules_schema.sql'), 'utf-8');
    console.log('Executing 06_create_monitoring_rules_schema.sql...');
    await client.query(schemaSql);
    console.log('Schema created successfully!');

    // Verify table and indexes
    const tableRes = await client.query(`SELECT to_regclass('public.monitoring_rules') AS table_name`);
    const indexRes = await client.query(
      `SELECT indexname FROM pg_indexes
       WHERE schemaname = 'public' AND tablename = 'monitoring_rules'
       ORDER BY indexname`
    );
    const rulesRes = await client.query('SELECT COUNT(*) FROM public.monitoring_rules');

    console.log('\n--- VERIFICATION ---');
    console.log('Table:', tableRes.rows[0].table_name);
    console.log('Indexes:', indexRes.rows.map((row) => row.indexname).join(', '));
    console.log('Monitoring rules count:', rulesRes.rows[0].count);

  } catch (err) {
    console.error('Migration failed:', err);
    process.exitCode = 1;
  } finally {
    await client.end();
  }
}

runMigrations();
