-- ==============================================================================
-- WildGuard - UC01 Seed Data: Real-world Sri Lankan Parks & Patrol Entities
-- ==============================================================================

-- 1. Seed Parks
INSERT INTO public.parks (id, name, code, province, total_area_sqkm)
VALUES 
    (1, 'Yala National Park (Ruhuna)', 'YALA-NP', 'Southern & Uva', 978.80),
    (2, 'Wilpattu National Park', 'WILP-NP', 'North Western & North Central', 1317.00),
    (3, 'Udawalawe National Park', 'UDAW-NP', 'Sabaragamuwa & Uva', 308.20)
ON CONFLICT (code) DO UPDATE 
SET name = EXCLUDED.name, province = EXCLUDED.province, total_area_sqkm = EXCLUDED.total_area_sqkm;

-- 2. Seed Risk Zones (Yala National Park)
INSERT INTO public.risk_zones (id, park_id, zone_code, zone_name, severity_level, primary_threat, center_lat, center_lng, radius_km)
VALUES 
    (1, 1, 'RZ-YALA-01', 'Northern River Basin Buffer', 'CRITICAL', 'Poaching & Wire Snares near River Crossing', 6.412800, 81.534200, 3.2),
    (2, 1, 'RZ-YALA-02', 'Katagamuwa Sanctuary Boundary', 'HIGH', 'Elephant Crop Raiding & Fence Breaches', 6.384500, 81.487000, 2.8),
    (3, 1, 'RZ-YALA-03', 'Kumbukkan Oya Estuary', 'MEDIUM', 'Illegal Fishing & Campsites', 6.456000, 81.621000, 4.0),
    (4, 1, 'RZ-YALA-04', 'Palatupana Coastal Dunes', 'LOW', 'Tourist Off-road Encroachment', 6.273000, 81.402000, 2.0)
ON CONFLICT (zone_code) DO UPDATE 
SET severity_level = EXCLUDED.severity_level, primary_threat = EXCLUDED.primary_threat;

-- 3. Seed Patrol Routes (Matching Wireframes & Case Study)
INSERT INTO public.patrol_routes (
    id, park_id, route_code, route_name, sector, terrain_type, difficulty,
    distance_km, estimated_duration_hours, waypoints_count, checkpoints,
    coverage_gap_percent, last_patrolled_date, recent_incident_count,
    base_risk_level, telemetry_source, is_telemetry_stale
)
VALUES 
    (
        1, 1, 'RT-SEC-7B', 'Sector 7B - Northern River Basin', 'Sector 7B',
        'Dense Bush & River Basin (Marshland)', 'High Difficulty - 4x4 / Amphibious',
        18.4, 6.5, 14,
        '[
            {"name": "WP-01 Alpha Depot", "lat": 6.4020, "lng": 81.5120, "order": 1},
            {"name": "WP-02 Alpha Fordable River", "lat": 6.4150, "lng": 81.5280, "order": 2},
            {"name": "WP-03 Waterhole 4 Sanctuary", "lat": 6.4280, "lng": 81.5450, "order": 3},
            {"name": "WP-04 Outpost Northern Ridge", "lat": 6.4390, "lng": 81.5600, "order": 4}
        ]'::jsonb,
        82, NOW() - INTERVAL '74 hours', 3, 'CRITICAL', 'ACOUSTIC_ARRAY_V12', false
    ),
    (
        2, 1, 'RT-SEC-4A', 'Sector 4A - Elephant Pass Ridge', 'Sector 4A',
        'Rocky Canyon Corridor & Dense Scrub', 'Moderate',
        14.2, 4.5, 8,
        '[
            {"name": "WP-01 Base Gate", "lat": 6.3750, "lng": 81.4900, "order": 1},
            {"name": "WP-02 Elephant Pass", "lat": 6.3880, "lng": 81.5050, "order": 2},
            {"name": "WP-03 Ridge Lookout", "lat": 6.3980, "lng": 81.5200, "order": 3}
        ]'::jsonb,
        58, NOW() - INTERVAL '4 days', 2, 'HIGH', 'DRONE_SURVEY_ALPHA', false
    ),
    (
        3, 1, 'RT-SEC-9C', 'Sector 9C - South Wetlands Boundary', 'Sector 9C',
        'Floodplain Marshlands & Perimeter Fence', 'Standard',
        22.0, 7.0, 12,
        '[
            {"name": "WP-01 South Post", "lat": 6.3100, "lng": 81.4400, "order": 1},
            {"name": "WP-02 Wetland Bridge", "lat": 6.3300, "lng": 81.4600, "order": 2}
        ]'::jsonb,
        45, NOW() - INTERVAL '7 days', 1, 'MEDIUM', 'PERIMETER_GRID_B', false
    ),
    (
        4, 1, 'RT-SEC-2E', 'Sector 2E - Acacia Plains Foothills', 'Sector 2E',
        'Open Savanna & Light Grassland', 'Low',
        9.5, 3.0, 6,
        '[
            {"name": "WP-01 Visitor Center", "lat": 6.2900, "lng": 81.3900, "order": 1},
            {"name": "WP-02 Acacia Trail", "lat": 6.3100, "lng": 81.4100, "order": 2}
        ]'::jsonb,
        22, NOW() - INTERVAL '12 days', 0, 'LOW', 'RANGER_LOG_MOBILE', false
    )
ON CONFLICT (route_code) DO UPDATE 
SET coverage_gap_percent = EXCLUDED.coverage_gap_percent,
    recent_incident_count = EXCLUDED.recent_incident_count,
    base_risk_level = EXCLUDED.base_risk_level;

-- 4. Route Risk Zones Overlap
INSERT INTO public.route_risk_zones (route_id, risk_zone_id, overlap_percentage)
VALUES 
    (1, 1, 85.0),
    (2, 2, 70.0),
    (3, 3, 50.0),
    (4, 4, 30.0)
ON CONFLICT (route_id, risk_zone_id) DO UPDATE 
SET overlap_percentage = EXCLUDED.overlap_percentage;

-- 5. Seed Rangers (Matching Wireframes & Realistic Availability/Workloads)
INSERT INTO public.rangers (
    id, badge_number, full_name, callsign, assigned_park_id, current_status,
    current_lat, current_lng, base_location_name, active_assignments_count,
    max_active_assignments, is_rest_compliant, certifications
)
VALUES 
    (
        1, 'RG-8842-A', 'Capt. Samuel Kiprono', 'Unit Alpha (Lead)', 1, 'AVAILABLE',
        6.4010, 81.5050, 'Camp East (2.5 km away, ETA ~12m)', 2, 5, true,
        '["Riverine & Night Tracker", "First Aid Certified", "Heavy Weapons"]'::jsonb
    ),
    (
        2, 'RG-7119-B', 'Ranger Maya Lin', 'Unit Bravo (Lead)', 1, 'ON_SHIFT',
        6.4200, 81.4600, 'Forward Post 3 (7.8 km away, ETA ~38m)', 4, 5, true,
        '["K9 Handler", "Tactical Drone Pilot"]'::jsonb
    ),
    (
        3, 'RG-9114-E', 'Ranger Joseph Mwangi', 'Unit Echo (Standby)', 1, 'RESTING',
        6.3400, 81.4200, 'Base Camp South (12.1 km away)', 1, 5, false,
        '["Perimeter Surveillance", "Wildlife Medic"]'::jsonb
    ),
    (
        4, 'RG-4421-D', 'Ranger Samantha Dissanayake', 'Unit Delta', 1, 'AVAILABLE',
        6.3950, 81.5150, 'Outpost Alpha-2 (3.1 km away, ETA ~15m)', 1, 5, true,
        '["Elephant Tracking Specialist", "4x4 Certified"]'::jsonb
    )
ON CONFLICT (badge_number) DO UPDATE 
SET current_status = EXCLUDED.current_status,
    active_assignments_count = EXCLUDED.active_assignments_count;

-- Reset sequence counters
SELECT setval('public.parks_id_seq', (SELECT MAX(id) FROM public.parks));
SELECT setval('public.risk_zones_id_seq', (SELECT MAX(id) FROM public.risk_zones));
SELECT setval('public.patrol_routes_id_seq', (SELECT MAX(id) FROM public.patrol_routes));
SELECT setval('public.rangers_id_seq', (SELECT MAX(id) FROM public.rangers));
