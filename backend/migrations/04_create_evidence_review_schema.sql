-- ==============================================================================
-- WildGuard - UC02: Review and Escalate Camera-Trap Evidence Schema
-- Compliant with SE3070 Case Study & Critique Specifications
--
-- Relationship chain:
--   parks -> camera_traps -> camera_trap_images -> evidence_reviews -> threat_alerts
--
-- Reuses existing: public.parks, auth.users (Wildlife Officer identity via
-- user_roles / wildlife_officer_details). No separate WildlifeOfficer table.
--
-- Business rules (classification -> review status, escalation confirmation,
-- justification, alert creation) are enforced in the UC02 service layer, not here.
-- ==============================================================================

-- 1. Camera Traps Table
CREATE TABLE IF NOT EXISTS public.camera_traps (
    id SERIAL PRIMARY KEY,
    trap_code VARCHAR(50) UNIQUE NOT NULL,
    park_id INT NOT NULL REFERENCES public.parks(id) ON DELETE RESTRICT,
    location_name VARCHAR(255) NOT NULL,
    latitude NUMERIC(10, 6) NOT NULL CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(10, 6) NOT NULL CHECK (longitude BETWEEN -180 AND 180),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Camera Trap Images Table (captured evidence + metadata + review status)
-- Capture metadata columns are nullable on purpose: incomplete metadata is a
-- valid UC02 scenario (warning shown, review may continue).
CREATE TABLE IF NOT EXISTS public.camera_trap_images (
    id SERIAL PRIMARY KEY,
    image_code VARCHAR(50) UNIQUE NOT NULL,
    camera_trap_id INT NOT NULL REFERENCES public.camera_traps(id) ON DELETE RESTRICT,
    image_url TEXT NOT NULL,
    captured_at TIMESTAMPTZ,
    latitude NUMERIC(10, 6) CHECK (latitude BETWEEN -90 AND 90),
    longitude NUMERIC(10, 6) CHECK (longitude BETWEEN -180 AND 180),
    camera_model VARCHAR(100),
    trigger_type VARCHAR(30) CHECK (trigger_type IN ('MOTION', 'HEAT', 'TIME_LAPSE', 'MANUAL')),
    ambient_temperature_c NUMERIC(4, 1),
    review_status VARCHAR(30) NOT NULL
        CHECK (review_status IN ('UNREVIEWED', 'REVIEWED', 'NEEDS_FURTHER_REVIEW', 'REVIEWED_ESCALATED'))
        DEFAULT 'UNREVIEWED',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Evidence Reviews Table (one row per review; an UNKNOWN image may receive
-- a secondary review, so image_id is intentionally not unique)
CREATE TABLE IF NOT EXISTS public.evidence_reviews (
    id SERIAL PRIMARY KEY,
    image_id INT NOT NULL REFERENCES public.camera_trap_images(id) ON DELETE RESTRICT,
    reviewed_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    classification VARCHAR(30) NOT NULL
        CHECK (classification IN ('WILDLIFE_SPECIES', 'SUSPICIOUS_PERSON', 'UNKNOWN')),
    notes TEXT,
    metadata_incomplete_acknowledged BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_confirmed BOOLEAN NOT NULL DEFAULT FALSE,
    escalation_justification TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- Target for the composite FK below (keeps an alert tied to its review's image)
    CONSTRAINT unique_evidence_review_image UNIQUE (id, image_id)
);

-- 4. Threat Alerts Table (created by UC02 only for confirmed suspicious evidence)
CREATE TABLE IF NOT EXISTS public.threat_alerts (
    id SERIAL PRIMARY KEY,
    camera_trap_image_id INT NOT NULL REFERENCES public.camera_trap_images(id) ON DELETE RESTRICT,
    evidence_review_id INT NOT NULL UNIQUE,
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    justification TEXT,
    -- UC02 only creates OPEN alerts; later states are handled outside UC02
    status VARCHAR(30) NOT NULL CHECK (status IN ('OPEN', 'ACKNOWLEDGED', 'CLOSED')) DEFAULT 'OPEN',
    created_at TIMESTAMPTZ DEFAULT NOW(),
    -- BR3: the alert's image must be the same original image its review was for
    CONSTRAINT fk_threat_alert_review_image
        FOREIGN KEY (evidence_review_id, camera_trap_image_id)
        REFERENCES public.evidence_reviews(id, image_id) ON DELETE RESTRICT
);

-- Indexes for the review queue and lookups
CREATE INDEX IF NOT EXISTS idx_camera_traps_park_id ON public.camera_traps(park_id);
CREATE INDEX IF NOT EXISTS idx_camera_trap_images_review_status ON public.camera_trap_images(review_status);
CREATE INDEX IF NOT EXISTS idx_camera_trap_images_camera_trap_id ON public.camera_trap_images(camera_trap_id);
CREATE INDEX IF NOT EXISTS idx_evidence_reviews_image_id ON public.evidence_reviews(image_id);
CREATE INDEX IF NOT EXISTS idx_threat_alerts_camera_trap_image_id ON public.threat_alerts(camera_trap_image_id);

-- Enable RLS. No public policies are added: UC02 data is only accessed through
-- the backend API using the service-role client (which bypasses RLS), so
-- evidence and threat alerts are not readable/writable with the anon key.
ALTER TABLE public.camera_traps ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.camera_trap_images ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.evidence_reviews ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.threat_alerts ENABLE ROW LEVEL SECURITY;
