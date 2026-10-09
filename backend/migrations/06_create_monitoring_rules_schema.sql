-- ==============================================================================
-- WildGuard - UC04: Configure Park-Specific Wildlife Monitoring Rules Schema
-- Compliant with SE3070 Case Study & Critique Specifications
--
-- Relationship chain:
--   parks -> risk_zones -> monitoring_rules
--
-- Reuses existing: public.parks, public.risk_zones, auth.users (Park Manager
-- identity via user_roles / roles). No existing table is altered.
--
-- Business rules (mandatory fields, allowed values, risk zone belongs to the
-- selected park, duplicate / active-conflict detection, ACTIVATE vs SAVE_DRAFT)
-- are enforced in the UC04 service layer, not here. hazard_type, alert_priority,
-- notification_recipients and response_behaviour value sets are validated in
-- code so they can be confirmed without a schema change.
--
-- Status lifecycle (current UC04 scope): NEW -> DRAFT, NEW -> ACTIVE,
-- DRAFT -> DRAFT (edit), DRAFT -> ACTIVE, ACTIVE -> INACTIVE (final).
-- INACTIVE rules are kept and are ignored by duplicate / conflict detection.
-- ==============================================================================

-- 1. Monitoring Rules Table
CREATE TABLE IF NOT EXISTS public.monitoring_rules (
    id SERIAL PRIMARY KEY,
    park_id INT NOT NULL REFERENCES public.parks(id) ON DELETE RESTRICT,
    hazard_type VARCHAR(100) NOT NULL,
    risk_zone_id INT NOT NULL REFERENCES public.risk_zones(id) ON DELETE RESTRICT,
    alert_priority VARCHAR(20) NOT NULL,
    notification_recipients JSONB NOT NULL
        CHECK (jsonb_typeof(notification_recipients) = 'array'
               AND jsonb_array_length(notification_recipients) > 0),
    response_behaviour VARCHAR(100) NOT NULL,
    notes TEXT,
    status VARCHAR(20) NOT NULL
        CHECK (status IN ('DRAFT', 'ACTIVE', 'INACTIVE'))
        DEFAULT 'DRAFT',
    created_by UUID REFERENCES auth.users(id) ON DELETE SET NULL,
    activated_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ DEFAULT NOW(),
    updated_at TIMESTAMPTZ DEFAULT NOW(),
    -- Only an ACTIVE rule has an activation time; DRAFT and INACTIVE rules never do
    CONSTRAINT chk_monitoring_rule_activation
        CHECK ((status = 'ACTIVE') = (activated_at IS NOT NULL))
);

-- Backstop for active-conflict detection: at most one ACTIVE rule per park + hazard + risk zone
CREATE UNIQUE INDEX IF NOT EXISTS ux_monitoring_rules_active_scope
    ON public.monitoring_rules (park_id, hazard_type, risk_zone_id)
    WHERE status = 'ACTIVE';

-- Index for the per-park monitoring rules list
CREATE INDEX IF NOT EXISTS idx_monitoring_rules_park_id ON public.monitoring_rules(park_id);

-- Enable RLS. No public policies are added: UC04 data is only accessed through
-- the backend API using the service-role client (which bypasses RLS), so
-- monitoring rules are not readable/writable with the anon key.
ALTER TABLE public.monitoring_rules ENABLE ROW LEVEL SECURITY;
