require('dotenv').config();
const { Client } = require('pg');
const { supabaseAdmin } = require('../supabaseClient');

async function migrate() {
  console.log('Connecting to PostgreSQL to create staging_posts table...');
  const connectionString = process.env.DATABASE_URL || process.env.POSTGRES_URL;

  if (connectionString) {
    const client = new Client({ connectionString });
    try {
      await client.connect();
      await client.query(`
        CREATE TABLE IF NOT EXISTS public.staging_posts (
          id SERIAL PRIMARY KEY,
          park_id INT REFERENCES public.parks(id) ON DELETE CASCADE,
          name VARCHAR(150) NOT NULL,
          latitude DOUBLE PRECISION NOT NULL,
          longitude DOUBLE PRECISION NOT NULL,
          post_type VARCHAR(50) DEFAULT 'FORWARD_OUTPOST',
          created_at TIMESTAMPTZ DEFAULT NOW()
        );

        -- Seed standard official outposts
        INSERT INTO public.staging_posts (park_id, name, latitude, longitude, post_type)
        VALUES 
          -- Yala National Park (park_id: 1)
          (1, 'Katagamuwa Entrance Post (Block 1)', 6.4150, 81.4720, 'ENTRANCE_POST'),
          (1, 'Palatupana Headquarters (Main Gate)', 6.3685, 81.5190, 'MAIN_HEADQUARTERS'),
          (1, 'Camp East Forward Outpost', 6.3980, 81.5100, 'FORWARD_OUTPOST'),
          (1, 'Camp West Staging Post', 6.3845, 81.5050, 'FORWARD_OUTPOST'),
          (1, 'Sithulpawwa Staging Post', 6.4350, 81.4500, 'SANCTUARY_POST'),
          (1, 'Kumbukkan Oya Outpost (Riverine)', 6.5200, 81.6800, 'RIVERINE_OUTPOST'),
          (1, 'Galgamuwa Rapid Response Post', 6.4600, 81.5400, 'RAPID_RESPONSE'),

          -- Wilpattu National Park (park_id: 2)
          (2, 'Hunuwilgama Main Entrance Post', 8.4350, 80.0600, 'ENTRANCE_POST'),
          (2, 'Maradanmaduwa Forward Base', 8.4800, 80.0200, 'FORWARD_OUTPOST'),
          (2, 'Kala Oya Marine Post', 8.3500, 79.8500, 'RIVERINE_OUTPOST'),

          -- Udawalawe National Park (park_id: 3)
          (3, 'Thanamalwila Sector Gate', 6.4700, 80.8900, 'ENTRANCE_POST'),
          (3, 'Reservoir Dam Southern Post', 6.4400, 80.8400, 'FORWARD_OUTPOST')
        ON CONFLICT DO NOTHING;
      `);
      console.log('Successfully created and seeded staging_posts table via PG!');
      await client.end();
      return;
    } catch (err) {
      console.log('PG direct connection failed:', err.message);
    }
  }

  // Fallback check
  const { data, error } = await supabaseAdmin.from('staging_posts').select('*');
  if (error) {
    console.log('staging_posts query error:', error.message);
  } else {
    console.log('staging_posts already exists, count:', data?.length);
  }
}

migrate();
