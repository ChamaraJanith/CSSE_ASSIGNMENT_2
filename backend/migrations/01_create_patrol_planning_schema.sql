-- ==============================================================================
-- WildGuard - UC01: Plan a Risk-Based Ranger Patrol Schema
-- Compliant with SE3070 Case Study & Critique Specifications
-- ==============================================================================

-- 1. Parks Table
CREATE TABLE IF NOT EXISTS public.parks (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    code VARCHAR(50) UNIQUE NOT NULL,
    province VARCHAR(100),
    total_area_sqkm NUMERIC(10, 2),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 2. Risk Zones Table
CREATE TABLE IF NOT EXISTS public.risk_zones (
    id SERIAL PRIMARY KEY,
    park_id INT REFERENCES public.parks(id) ON DELETE CASCADE,
    zone_code VARCHAR(50) UNIQUE NOT NULL,
    zone_name VARCHAR(255) NOT NULL,
    severity_level VARCHAR(20) CHECK (severity_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT NULL,
    primary_threat VARCHAR(150) NOT NULL,
    center_lat NUMERIC(10, 6) NOT NULL,
    center_lng NUMERIC(10, 6) NOT NULL,
    radius_km NUMERIC(6, 2) DEFAULT 2.5,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 3. Patrol Routes Table
CREATE TABLE IF NOT EXISTS public.patrol_routes (
    id SERIAL PRIMARY KEY,
    park_id INT REFERENCES public.parks(id) ON DELETE CASCADE,
    route_code VARCHAR(50) UNIQUE NOT NULL,
    route_name VARCHAR(255) NOT NULL,
    sector VARCHAR(100) NOT NULL,
    terrain_type VARCHAR(150) NOT NULL,
    difficulty VARCHAR(50) DEFAULT 'Moderate',
    distance_km NUMERIC(6, 2) NOT NULL,
    estimated_duration_hours NUMERIC(4, 2) NOT NULL,
    waypoints_count INT DEFAULT 8,
    checkpoints JSONB DEFAULT '[]'::jsonb,
    coverage_gap_percent INT DEFAULT 50,
    last_patrolled_date TIMESTAMPTZ,
    recent_incident_count INT DEFAULT 0,
    base_risk_level VARCHAR(20) CHECK (base_risk_level IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) DEFAULT 'MEDIUM',
    telemetry_source VARCHAR(50) DEFAULT 'SENSOR_GRID_V11',
    is_telemetry_stale BOOLEAN DEFAULT FALSE,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 4. Route Risk Zones Join Table (Critique UC01-C08)
CREATE TABLE IF NOT EXISTS public.route_risk_zones (
    id SERIAL PRIMARY KEY,
    route_id INT REFERENCES public.patrol_routes(id) ON DELETE CASCADE,
    risk_zone_id INT REFERENCES public.risk_zones(id) ON DELETE CASCADE,
    overlap_percentage NUMERIC(5, 2) DEFAULT 50.0,
    CONSTRAINT unique_route_risk_zone UNIQUE (route_id, risk_zone_id)
);

-- 5. Rangers Table
CREATE TABLE IF NOT EXISTS public.rangers (
    id SERIAL PRIMARY KEY,
    user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    badge_number VARCHAR(50) UNIQUE NOT NULL,
    full_name VARCHAR(255) NOT NULL,
    callsign VARCHAR(50),
    assigned_park_id INT REFERENCES public.parks(id),
    current_status VARCHAR(50) CHECK (current_status IN ('AVAILABLE', 'ON_SHIFT', 'RESTING', 'ON_LEAVE', 'UNAVAILABLE')) DEFAULT 'AVAILABLE',
    current_lat NUMERIC(10, 6) NOT NULL,
    current_lng NUMERIC(10, 6) NOT NULL,
    base_location_name VARCHAR(255),
    active_assignments_count INT DEFAULT 0,
    max_active_assignments INT DEFAULT 5, -- Critique UC01-C02 Workload Cap
    is_rest_compliant BOOLEAN DEFAULT TRUE,
    certifications JSONB DEFAULT '["Riverine & Night Tracker", "First Aid Certified"]'::jsonb,
    last_location_update TIMESTAMPTZ DEFAULT NOW(),
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 6. Patrol Plans Table (Critique UC01-C03, C06, C07)
CREATE TABLE IF NOT EXISTS public.patrol_plans (
    id SERIAL PRIMARY KEY,
    plan_code VARCHAR(50) UNIQUE NOT NULL,
    park_id INT REFERENCES public.parks(id) ON DELETE RESTRICT,
    route_id INT REFERENCES public.patrol_routes(id) ON DELETE RESTRICT,
    recommended_route_id INT REFERENCES public.patrol_routes(id) ON DELETE SET NULL,
    is_route_overridden BOOLEAN DEFAULT FALSE,
    route_override_reason TEXT,
    ranger_id INT REFERENCES public.rangers(id) ON DELETE SET NULL,
    recommended_ranger_id INT REFERENCES public.rangers(id) ON DELETE SET NULL,
    is_ranger_overridden BOOLEAN DEFAULT FALSE,
    ranger_override_reason TEXT,
    created_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    patrol_date DATE NOT NULL,
    start_time TIME NOT NULL,
    estimated_duration_hours NUMERIC(4, 2) DEFAULT 4.0,
    priority VARCHAR(20) CHECK (priority IN ('CRITICAL', 'HIGH', 'MEDIUM', 'LOW')) NOT NULL,
    calculated_threat_score NUMERIC(4, 2),
    score_breakdown JSONB,
    dispatch_field_notes TEXT,
    equipment_checklist JSONB DEFAULT '["GPS Tracker", "Sat-Phone VHF", "Night Vision Mk4", "Med Kit A"]'::jsonb,
    status VARCHAR(30) CHECK (status IN ('DRAFT', 'PENDING_ASSIGNMENT', 'ASSIGNED', 'ACKNOWLEDGED', 'DECLINED', 'CANCELLED')) DEFAULT 'DRAFT',
    acknowledgement_deadline TIMESTAMPTZ,
    acknowledged_at TIMESTAMPTZ,
    decline_reason TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- 7. Patrol Plan Status History Table (Audit Trail)
CREATE TABLE IF NOT EXISTS public.patrol_plan_status_history (
    id SERIAL PRIMARY KEY,
    patrol_plan_id INT REFERENCES public.patrol_plans(id) ON DELETE CASCADE,
    from_status VARCHAR(30),
    to_status VARCHAR(30) NOT NULL,
    changed_by_user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    actor_role VARCHAR(50) DEFAULT 'Park Manager',
    reason_or_notes TEXT,
    created_at TIMESTAMPTZ DEFAULT NOW()
);

-- 8. Patrol Notification Logs Table (Critique UC01-C09 / UX07)
CREATE TABLE IF NOT EXISTS public.patrol_notification_logs (
    id SERIAL PRIMARY KEY,
    patrol_plan_id INT REFERENCES public.patrol_plans(id) ON DELETE CASCADE,
    recipient_ranger_id INT REFERENCES public.rangers(id) ON DELETE SET NULL,
    delivery_channel VARCHAR(50) DEFAULT 'SATELLITE_IRIDIUM_BURST',
    delivery_status VARCHAR(30) CHECK (delivery_status IN ('SENT', 'DELIVERED', 'PENDING_SYNC', 'FAILED')) DEFAULT 'SENT',
    sent_at TIMESTAMPTZ DEFAULT NOW(),
    delivered_at TIMESTAMPTZ,
    payload JSONB,
    retry_count INT DEFAULT 0
);

-- Enable RLS and public access for development
ALTER TABLE public.parks ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_routes ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.route_risk_zones ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.rangers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_plans ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_plan_status_history ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.patrol_notification_logs ENABLE ROW LEVEL SECURITY;

-- Development policies (allow authenticated & service_role)
DO $$
BEGIN
    DROP POLICY IF EXISTS "Public full access parks" ON public.parks;
    CREATE POLICY "Public full access parks" ON public.parks FOR ALL USING (true);
    
    DROP POLICY IF EXISTS "Public full access risk_zones" ON public.risk_zones;
    CREATE POLICY "Public full access risk_zones" ON public.risk_zones FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access patrol_routes" ON public.patrol_routes;
    CREATE POLICY "Public full access patrol_routes" ON public.patrol_routes FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access route_risk_zones" ON public.route_risk_zones;
    CREATE POLICY "Public full access route_risk_zones" ON public.route_risk_zones FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access rangers" ON public.rangers;
    CREATE POLICY "Public full access rangers" ON public.rangers FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access patrol_plans" ON public.patrol_plans;
    CREATE POLICY "Public full access patrol_plans" ON public.patrol_plans FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access patrol_plan_status_history" ON public.patrol_plan_status_history;
    CREATE POLICY "Public full access patrol_plan_status_history" ON public.patrol_plan_status_history FOR ALL USING (true);

    DROP POLICY IF EXISTS "Public full access patrol_notification_logs" ON public.patrol_notification_logs;
    CREATE POLICY "Public full access patrol_notification_logs" ON public.patrol_notification_logs FOR ALL USING (true);
END $$;
