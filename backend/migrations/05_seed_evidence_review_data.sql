-- ==============================================================================
-- WildGuard - UC02 Seed Data: Camera Traps & Unreviewed Camera-Trap Evidence
--
-- Requires session setting 'uc02.evidence_base_url' (set by
-- run_evidence_review_migration.js) = <SUPABASE_URL>/storage/v1/object/public/evidence
-- Valid images live in the existing public "evidence" bucket under camera-traps/.
--
-- Scenario coverage:
--   IMG-YALA01-0001  wildlife (elephant herd)           complete metadata
--   IMG-YALA01-0002  human figure at night (suspicious) complete metadata
--   IMG-YALA02-0001  wildlife (leopard)                 incomplete: no GPS
--   IMG-YALA02-0002  human figure at fence (suspicious) incomplete: no time, no GPS
--   IMG-WILP01-0001  obscured / indistinct (unknown)    complete metadata
--   IMG-WILP01-0002  image cannot be loaded             complete metadata, broken URL
--
-- All images start UNREVIEWED. No evidence_reviews / threat_alerts are seeded.
-- ==============================================================================

-- 1. Seed Camera Traps (Yala & Wilpattu)
INSERT INTO public.camera_traps (trap_code, park_id, location_name, latitude, longitude)
VALUES
    ('CT-YALA-01', 1, 'Northern River Basin Crossing (Sector 7B)', 6.412800, 81.534200),
    ('CT-YALA-02', 1, 'Katagamuwa Sanctuary Boundary Fence', 6.384500, 81.487000),
    ('CT-WILP-01', 2, 'Kokmote River Buffer Trail', 8.492000, 80.035000)
ON CONFLICT (trap_code) DO NOTHING;

-- 2. Seed Camera Trap Images (all UNREVIEWED)
-- DO NOTHING on conflict so re-running never resets an image that was already reviewed.
INSERT INTO public.camera_trap_images (
    image_code, camera_trap_id, image_url, captured_at, latitude, longitude,
    camera_model, trigger_type, ambient_temperature_c, review_status
)
SELECT
    v.image_code,
    t.id,
    COALESCE(v.external_url, current_setting('uc02.evidence_base_url') || '/' || v.storage_path),
    v.captured_at,
    v.latitude,
    v.longitude,
    v.camera_model,
    v.trigger_type,
    v.ambient_temperature_c,
    'UNREVIEWED'
FROM (
    VALUES
        ('IMG-YALA01-0001', 'CT-YALA-01', 'camera-traps/CT-YALA-01/IMG-YALA01-0001.jpg', NULL,
         TIMESTAMPTZ '2026-10-01 06:12:00+05:30', 6.412850::NUMERIC, 81.534180::NUMERIC,
         'Browning Recon Force Elite HP5', 'MOTION', 27.5::NUMERIC),
        ('IMG-YALA01-0002', 'CT-YALA-01', 'camera-traps/CT-YALA-01/IMG-YALA01-0002.jpg', NULL,
         TIMESTAMPTZ '2026-10-02 01:47:00+05:30', 6.412790, 81.534260,
         'Browning Recon Force Elite HP5', 'HEAT', 23.0),
        ('IMG-YALA02-0001', 'CT-YALA-02', 'camera-traps/CT-YALA-02/IMG-YALA02-0001.jpg', NULL,
         TIMESTAMPTZ '2026-10-02 18:35:00+05:30', NULL, NULL,
         'Bushnell Core DS-4K', 'MOTION', 26.0),
        ('IMG-YALA02-0002', 'CT-YALA-02', 'camera-traps/CT-YALA-02/IMG-YALA02-0002.jpg', NULL,
         NULL, NULL, NULL,
         'Bushnell Core DS-4K', 'HEAT', NULL),
        ('IMG-WILP01-0001', 'CT-WILP-01', 'camera-traps/CT-WILP-01/IMG-WILP01-0001.jpg', NULL,
         TIMESTAMPTZ '2026-10-03 04:20:00+05:30', 8.492040, 80.035110,
         'Reconyx HyperFire 2', 'MOTION', 24.5),
        ('IMG-WILP01-0002', 'CT-WILP-01', NULL, 'https://camera-trap-feed.invalid/CT-WILP-01/IMG-WILP01-0002.jpg',
         TIMESTAMPTZ '2026-10-03 22:58:00+05:30', 8.491970, 80.034930,
         'Reconyx HyperFire 2', 'MOTION', 22.0)
) AS v (
    image_code, trap_code, storage_path, external_url, captured_at, latitude, longitude,
    camera_model, trigger_type, ambient_temperature_c
)
JOIN public.camera_traps t ON t.trap_code = v.trap_code
ON CONFLICT (image_code) DO NOTHING;
