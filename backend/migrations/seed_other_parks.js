const path = require('path');
const { Client } = require('pg');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });

async function seedAllParks() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
  });

  try {
    await client.connect();
    console.log('Connected to Supabase DB...');

    // 1. Wilpattu (park_id = 2) Risk Zones
    await client.query(`
      INSERT INTO public.risk_zones (park_id, zone_code, zone_name, severity_level, primary_threat, center_lat, center_lng, radius_km)
      VALUES 
        (2, 'RZ-WILP-01', 'Kokmote Sandstone River Buffer', 'CRITICAL', 'Poaching & Illegal Snaring along Riverbank', 8.4920, 80.0350, 3.5),
        (2, 'RZ-WILP-02', 'Maradanmaduwa Willu Sanctuary', 'HIGH', 'Night Incursions into Leopard Feeding Grounds', 8.4210, 80.0620, 2.5)
      ON CONFLICT (zone_code) DO NOTHING;
    `);

    // 2. Wilpattu Routes
    await client.query(`
      INSERT INTO public.patrol_routes (
        park_id, route_code, route_name, sector, terrain_type, difficulty,
        distance_km, estimated_duration_hours, waypoints_count, checkpoints,
        coverage_gap_percent, last_patrolled_date, recent_incident_count,
        base_risk_level, telemetry_source, is_telemetry_stale
      )
      VALUES 
        (
          2, 'RT-WILP-01', 'Sector 3 - Kokmote River Corridor', 'Sector 3',
          'Dense Dry-Zone Jungle & Sandstone Riverbanks', 'High Difficulty - 4x4 / Deep Sand',
          16.2, 5.5, 10,
          '[
            {"name": "WP-01 Hunuwilagama Base Gate", "lat": 8.4100, "lng": 80.0100, "order": 1},
            {"name": "WP-02 Maradanmaduwa Willu", "lat": 8.4350, "lng": 80.0400, "order": 2},
            {"name": "WP-03 Kokmote River Camp", "lat": 8.4850, "lng": 80.0550, "order": 3}
          ]'::jsonb,
          78, NOW() - INTERVAL '68 hours', 2, 'CRITICAL', 'SENSOR_WILP_NET', false
        ),
        (
          2, 'RT-WILP-02', 'Sector 1 - Maradanmaduwa Willu Circuit', 'Sector 1',
          'Open Willu Grasslands & Scrub', 'Moderate',
          11.5, 4.0, 7,
          '[
            {"name": "WP-01 Circuit Entrance", "lat": 8.4200, "lng": 80.0300, "order": 1},
            {"name": "WP-02 West Willu Bank", "lat": 8.4400, "lng": 80.0500, "order": 2}
          ]'::jsonb,
          42, NOW() - INTERVAL '3 days', 1, 'HIGH', 'SENSOR_WILP_NET', false
        )
      ON CONFLICT (route_code) DO NOTHING;
    `);

    // 3. Wilpattu Rangers
    await client.query(`
      INSERT INTO public.rangers (
        badge_number, full_name, callsign, assigned_park_id, current_status,
        current_lat, current_lng, base_location_name, active_assignments_count,
        max_active_assignments, is_rest_compliant, certifications
      )
      VALUES 
        ('RG-2101-W', 'Ranger Nihal Rajapaksa', 'Wilpattu Alpha-Lead', 2, 'AVAILABLE', 8.4120, 80.0150, 'Hunuwilagama Station (~1.8 km away)', 1, 5, true, '["Dense Jungle Tracker", "Heavy Sand Driving"]'::jsonb),
        ('RG-2102-W', 'Ranger Susantha Bandara', 'Unit Willu-2', 2, 'AVAILABLE', 8.4250, 80.0250, 'Maradanmaduwa Post (~3.5 km away)', 2, 5, true, '["Leopard Habitat Specialist", "First Aid"]'::jsonb)
      ON CONFLICT (badge_number) DO NOTHING;
    `);

    // 4. Udawalawe (park_id = 3) Risk Zones
    await client.query(`
      INSERT INTO public.risk_zones (park_id, zone_code, zone_name, severity_level, primary_threat, center_lat, center_lng, radius_km)
      VALUES 
        (3, 'RZ-UDAW-01', 'Mau Ara Southern Fence Boundary', 'CRITICAL', 'Severe Elephant Crop-Raiding & Electric Fence Breaches', 6.4420, 80.8920, 3.0),
        (3, 'RZ-UDAW-02', 'Reservoir Spillway Buffer', 'MEDIUM', 'Illegal Cattle Grazing & Timber Clearing', 6.4950, 80.8750, 2.2)
      ON CONFLICT (zone_code) DO NOTHING;
    `);

    // 5. Udawalawe Routes
    await client.query(`
      INSERT INTO public.patrol_routes (
        park_id, route_code, route_name, sector, terrain_type, difficulty,
        distance_km, estimated_duration_hours, waypoints_count, checkpoints,
        coverage_gap_percent, last_patrolled_date, recent_incident_count,
        base_risk_level, telemetry_source, is_telemetry_stale
      )
      VALUES 
        (
          3, 'RT-UDAW-01', 'Sector 2 - Mau Ara Southern Fence Corridor', 'Sector 2',
          'Teak Plantations & Electric Fence Boundary Buffer', 'Moderate - Perimeter Patrol',
          13.8, 4.5, 9,
          '[
            {"name": "WP-01 Park HQ Gate", "lat": 6.4350, "lng": 80.8700, "order": 1},
            {"name": "WP-02 Mau Ara Fence Post 4", "lat": 6.4520, "lng": 80.8950, "order": 2},
            {"name": "WP-03 Village Boundary Watchtower", "lat": 6.4710, "lng": 80.9100, "order": 3}
          ]'::jsonb,
          85, NOW() - INTERVAL '82 hours', 4, 'CRITICAL', 'ELEPHANT_COLLAR_MESH', false
        ),
        (
          3, 'RT-UDAW-02', 'Sector 4 - Reservoir North Catchment', 'Sector 4',
          'Marshy Catchment & Open Grassland', 'Standard',
          9.2, 3.0, 6,
          '[
            {"name": "WP-01 Dam Crest", "lat": 6.4650, "lng": 80.8650, "order": 1},
            {"name": "WP-02 North Catchment Bay", "lat": 6.4850, "lng": 80.8750, "order": 2}
          ]'::jsonb,
          35, NOW() - INTERVAL '2 days', 1, 'HIGH', 'UDAW_SENSOR_ARRAY', false
        )
      ON CONFLICT (route_code) DO NOTHING;
    `);

    // 6. Udawalawe Rangers
    await client.query(`
      INSERT INTO public.rangers (
        badge_number, full_name, callsign, assigned_park_id, current_status,
        current_lat, current_lng, base_location_name, active_assignments_count,
        max_active_assignments, is_rest_compliant, certifications
      )
      VALUES 
        ('RG-3301-U', 'Ranger Ruwan Senaratne', 'Transit Elephant Squad', 3, 'AVAILABLE', 6.4400, 80.8750, 'Park Main HQ (2.1 km from fence)', 1, 5, true, '["Elephant Conflict Mitigation", "Tranquilizer Certified"]'::jsonb),
        ('RG-3302-U', 'Ranger Kanishka Silva', 'Reservoir Unit Delta', 3, 'AVAILABLE', 6.4600, 80.8680, 'Reservoir North Post (3.8 km away)', 2, 5, true, '["Perimeter Security", "Boat Patrol"]'::jsonb)
      ON CONFLICT (badge_number) DO NOTHING;
    `);

    console.log('Successfully seeded all 3 parks with real routes, risk zones, and rangers!');
  } catch (err) {
    console.error('Error seeding parks:', err);
  } finally {
    await client.end();
  }
}

seedAllParks();
