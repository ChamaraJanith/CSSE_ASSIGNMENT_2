const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const monitoringRuleRules = require('../utils/monitoringRuleRules');
const {
    HAZARD_TYPES, ALERT_PRIORITIES, RECIPIENT_ROLES, RESPONSE_BEHAVIOURS, RULE_STATUSES
} = require('../utils/monitoringRuleConfig');

const { ENFORCED_STATUSES } = monitoringRuleRules;

const PARK_MANAGER_ROLE = 'park_manager';
const UNIQUE_VIOLATION = '23505';

const RULE_COLUMNS = `
    id, park_id, hazard_type, risk_zone_id, alert_priority, notification_recipients,
    response_behaviour, notes, status, created_by, activated_at, created_at, updated_at
`;

const serviceError = (message, status, details = {}) => {
    const err = new Error(message);
    err.status = status;
    Object.assign(err, details);
    return err;
};

const assertParkId = (parkId) => {
    if (!Number.isSafeInteger(parkId) || parkId <= 0) {
        throw serviceError('Park ID must be a positive integer.', 400);
    }
};

const toRiskZone = (row) => ({
    id: row.id,
    zoneCode: row.zone_code,
    zoneName: row.zone_name,
    severityLevel: row.severity_level,
    primaryThreat: row.primary_threat
});

const toMonitoringRule = (row) => ({
    id: row.id,
    parkId: row.park_id,
    hazardType: row.hazard_type,
    riskZoneId: row.risk_zone_id,
    riskZone: row.risk_zones
        ? { id: row.risk_zones.id, zoneCode: row.risk_zones.zone_code, zoneName: row.risk_zones.zone_name }
        : null,
    alertPriority: row.alert_priority,
    notificationRecipients: row.notification_recipients,
    responseBehaviour: row.response_behaviour,
    notes: row.notes,
    status: row.status,
    createdBy: row.created_by,
    activatedAt: row.activated_at,
    createdAt: row.created_at,
    updatedAt: row.updated_at
});

// Advisory-lock key for one rule scope: park + hazard + risk zone
const scopeLockKey = (rule) => `monitoring_rule:${rule.parkId}:${rule.hazardType}:${rule.riskZoneId}`;

class MonitoringRuleService {
    async isParkManager(userId) {
        const { data, error } = await supabaseAdmin
            .from('user_roles')
            .select('user_id, roles!inner(role_name)')
            .eq('user_id', userId)
            .eq('roles.role_name', PARK_MANAGER_ROLE);

        if (error) throw error;
        return Array.isArray(data) && data.length > 0;
    }

    async findPark(parkId) {
        assertParkId(parkId);
        const { data: park, error } = await supabaseAdmin
            .from('parks')
            .select('id, code, name')
            .eq('id', parkId)
            .maybeSingle();

        if (error) throw error;
        if (!park) throw serviceError('Park not found.', 404);
        return park;
    }

    /**
     * Data for the "Create New Rule" form: the selected park, its existing risk zones and the
     * configured option lists (monitoringRuleConfig is the single source of truth).
     */
    async getReferenceData(parkId) {
        const park = await this.findPark(parkId);
        const { data: zones, error } = await supabaseAdmin
            .from('risk_zones')
            .select('id, zone_code, zone_name, severity_level, primary_threat')
            .eq('park_id', parkId)
            .order('zone_code', { ascending: true });

        if (error) throw error;

        return {
            park: { id: park.id, code: park.code, name: park.name },
            riskZones: (zones || []).map(toRiskZone),
            options: {
                hazardTypes: HAZARD_TYPES,
                alertPriorities: ALERT_PRIORITIES,
                recipientRoles: RECIPIENT_ROLES,
                responseBehaviours: RESPONSE_BEHAVIOURS
            }
        };
    }

    async listRules(parkId) {
        await this.findPark(parkId);
        const { data, error } = await supabaseAdmin
            .from('monitoring_rules')
            .select(`${RULE_COLUMNS}, risk_zones(id, zone_code, zone_name)`)
            .eq('park_id', parkId)
            .order('created_at', { ascending: false })
            .order('id', { ascending: false });

        if (error) throw error;
        return (data || []).map(toMonitoringRule);
    }

    /**
     * "Submit for Validation" dry run. Runs exactly the checks createRule runs, using plain
     * SELECTs on the pool: nothing is written, locked or opened as a transaction.
     * The final action is chosen later on the review screen, so it is only validated here when sent.
     */
    async validateRule(input) {
        try {
            const evaluation = await this.evaluateRule(getPool(), input, { requireAction: false });
            const { valid, errors, conflicts, rule } = evaluation;
            return { valid, errors, conflicts, rule };
        } catch (error) {
            console.error('Monitoring rule validation failed:', error.message);
            throw serviceError('Failed to validate the monitoring rule.', 500);
        }
    }

    /**
     * Creates a rule after review in a single PostgreSQL transaction:
     * BEGIN -> lock scope -> re-validate fields/action, references and conflicts against
     * freshly read rules -> INSERT (ACTIVATE -> ACTIVE, SAVE_DRAFT -> DRAFT) -> COMMIT.
     * Any earlier /validate result is never trusted. Nothing is written when a check fails.
     *
     * @throws 400 { errors } invalid fields, action or references
     * @throws 409 { conflicts } duplicate / active conflict (including a concurrent ACTIVE insert)
     * @throws 500 unexpected database failure (details are logged, never returned)
     */
    async createRule(input, userId) {
        if (!userId) throw serviceError('Authentication required.', 401);

        const client = await getPool().connect();
        try {
            await client.query('BEGIN');

            // Serialise creates for the same scope before any rule is read
            const { rule: scope } = monitoringRuleRules.validateFields(input);
            if (scope) {
                await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [scopeLockKey(scope)]);
            }

            const evaluation = await this.evaluateRule(client, input, { requireAction: true });
            if (evaluation.errors.length > 0) {
                throw serviceError('The monitoring rule configuration is invalid. No changes were saved.', 400, {
                    errors: evaluation.errors
                });
            }
            if (evaluation.conflicts.length > 0) {
                throw serviceError('The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', 409, {
                    conflicts: evaluation.conflicts
                });
            }

            const status = monitoringRuleRules.resolveCreateStatus(evaluation.action);
            const created = await this.insertRule(client, evaluation.rule, status, userId);

            await client.query('COMMIT');
            return toMonitoringRule(created);
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            if (error.status) throw error;
            if (error.code === UNIQUE_VIOLATION) {
                throw serviceError('An ACTIVE rule already exists for this park, hazard and risk zone. No changes were saved.', 409, {
                    conflicts: []
                });
            }
            console.error('Monitoring rule transaction failed:', error.message);
            throw serviceError('Failed to save the monitoring rule. No changes were saved.', 500);
        } finally {
            client.release();
        }
    }

    /**
     * Shared validation path for validateRule (pool) and createRule (transaction client).
     * Field and action errors are collected together; reference checks run only for a field-valid
     * rule, and duplicate/conflict detection only when the references are valid.
     */
    async evaluateRule(db, input, { requireAction }) {
        const source = input && typeof input === 'object' ? input : {};
        const fields = monitoringRuleRules.validateFields(source);
        const actionCheck = requireAction || source.action !== undefined
            ? monitoringRuleRules.validateAction(source.action)
            : { errors: [], action: null };

        const errors = [...fields.errors, ...actionCheck.errors];
        let conflicts = [];

        if (fields.valid) {
            const park = await this.selectPark(db, fields.rule.parkId);
            const zone = await this.selectRiskZone(db, fields.rule.riskZoneId);
            const references = monitoringRuleRules.checkReferences(fields.rule, park, zone);
            errors.push(...references.errors);

            if (references.valid) {
                const existingRules = await this.selectRulesInScope(db, fields.rule);
                conflicts = monitoringRuleRules.findConflicts(fields.rule, existingRules);
            }
        }

        const valid = errors.length === 0 && conflicts.length === 0;
        return { valid, errors, conflicts, rule: valid ? fields.rule : null, action: actionCheck.action };
    }

    async selectPark(db, parkId) {
        const { rows } = await db.query('SELECT id, code, name FROM public.parks WHERE id = $1', [parkId]);
        return rows[0] || null;
    }

    async selectRiskZone(db, riskZoneId) {
        const { rows } = await db.query(
            'SELECT id, park_id, zone_code, zone_name FROM public.risk_zones WHERE id = $1',
            [riskZoneId]
        );
        return rows[0] || null;
    }

    async selectRulesInScope(db, rule) {
        const { rows } = await db.query(
            `SELECT ${RULE_COLUMNS}
             FROM public.monitoring_rules
             WHERE park_id = $1 AND hazard_type = $2 AND risk_zone_id = $3 AND status = ANY($4)
             ORDER BY id`,
            [rule.parkId, rule.hazardType, rule.riskZoneId, [...ENFORCED_STATUSES]]
        );
        return rows.map(toMonitoringRule);
    }

    async insertRule(client, rule, status, userId) {
        const { rows } = await client.query(
            `INSERT INTO public.monitoring_rules
                (park_id, hazard_type, risk_zone_id, alert_priority, notification_recipients,
                 response_behaviour, notes, status, created_by, activated_at)
             VALUES ($1, $2, $3, $4, $5::jsonb, $6, $7, $8, $9, CASE WHEN $10::boolean THEN NOW() ELSE NULL END)
             RETURNING ${RULE_COLUMNS}`,
            [
                rule.parkId, rule.hazardType, rule.riskZoneId, rule.alertPriority,
                JSON.stringify(rule.notificationRecipients), rule.responseBehaviour, rule.notes,
                status, userId, status === RULE_STATUSES.ACTIVE
            ]
        );
        return rows[0];
    }
}

module.exports = new MonitoringRuleService();
