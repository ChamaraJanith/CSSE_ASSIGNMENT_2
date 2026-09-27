const fs = require('fs');
const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function runMigrations() {
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    console.error('DATABASE_URL not found in .env');
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

    const schemaSql = fs.readFileSync(path.resolve(__dirname, '01_create_patrol_planning_schema.sql'), 'utf-8');
    console.log('Executing 01_create_patrol_planning_schema.sql...');
    await client.query(schemaSql);
    console.log('Schema created successfully!');

    const seedSql = fs.readFileSync(path.resolve(__dirname, '02_seed_data.sql'), 'utf-8');
    console.log('Executing 02_seed_data.sql...');
    await client.query(seedSql);
    console.log('Seed data inserted successfully!');

    // Verify counts
    const parksRes = await client.query('SELECT COUNT(*) FROM public.parks');
    const routesRes = await client.query('SELECT COUNT(*) FROM public.patrol_routes');
    const rangersRes = await client.query('SELECT COUNT(*) FROM public.rangers');
    const zonesRes = await client.query('SELECT COUNT(*) FROM public.risk_zones');

    console.log('\n--- VERIFICATION ---');
    console.log('Parks count:', parksRes.rows[0].count);
    console.log('Routes count:', routesRes.rows[0].count);
    console.log('Rangers count:', rangersRes.rows[0].count);
    console.log('Risk Zones count:', zonesRes.rows[0].count);

  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await client.end();
  }
}

runMigrations();
