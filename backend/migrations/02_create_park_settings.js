require('dotenv').config();
const { Client } = require('pg');
const { supabaseAdmin } = require('../supabaseClient');

async function migrate() {
  console.log('Connecting to PostgreSQL to create park_settings table...');
  
  // Use connection string from env if available or direct pg client
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.park_settings (
          id SERIAL PRIMARY KEY,
          park_id INT UNIQUE REFERENCES public.parks(id) ON DELETE CASCADE,
          acoustic_spike_threshold INT DEFAULT 3,
          max_ranger_workload INT DEFAULT 5,
          unmonitored_blindspot_hours INT DEFAULT 72,
          telemetry_interval_mins INT DEFAULT 45,
          target_coverage_percent INT DEFAULT 90,
          updated_at TIMESTAMPTZ DEFAULT NOW()
        );

        INSERT INTO public.park_settings (park_id, acoustic_spike_threshold, max_ranger_workload, unmonitored_blindspot_hours, telemetry_interval_mins, target_coverage_percent)
        VALUES 
          (1, 3, 5, 72, 45, 90),
          (2, 3, 5, 72, 45, 90),
          (3, 4, 5, 48, 30, 85)
        ON CONFLICT (park_id) DO NOTHING;
      `);
      console.log('Successfully created park_settings table via PG!');
      await client.end();
      return;
    } catch (err) {
      console.log('PG direct connection failed, trying Supabase REST...', err.message);
    }
  }

  // Fallback: check if park_settings can be queried via Supabase
  const { data, error } = await supabaseAdmin.from('park_settings').select('*');
  if (error) {
    console.log('park_settings query error (table might need to be created):', error.message);
  } else {
    console.log('park_settings already exists, count:', data?.length);
  }
}

migrate();
