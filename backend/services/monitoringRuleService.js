const { supabaseAdmin } = require('../supabaseClient');
const { getPool } = require('../pgPool');
const monitoringRuleRules = require('../utils/monitoringRuleRules');
const {
    HAZARD_TYPES, ALERT_PRIORITIES, RECIPIENT_ROLES, RESPONSE_BEHAVIOURS, RULE_STATUSES
} = require('../utils/monitoringRuleConfig');

const { ENFORCED_STATUSES, ERROR_CODES, RULE_OPERATIONS } = monitoringRuleRules;

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

const assertRuleId = (ruleId) => {
    if (!Number.isSafeInteger(ruleId) || ruleId <= 0) {
        throw serviceError('Rule ID must be a positive integer.', 400);
    }
};

// Field / reference errors -> 400 { errors }; duplicates / active conflicts -> 409 { conflicts }
const assertEvaluationPassed = (evaluation, invalidMessage) => {
    if (evaluation.errors.length > 0) {
        throw serviceError(invalidMessage, 400, { errors: evaluation.errors });
    }
    if (evaluation.conflicts.length > 0) {
        throw serviceError('The monitoring rule duplicates or conflicts with an existing rule. No changes were saved.', 409, {
            conflicts: evaluation.conflicts
        });
    }
};

// NUMERIC columns may arrive as numbers or strings; a missing or invalid value stays null (never 0)
const toNumberOrNull = (value) => {
    if (value === null || value === undefined || String(value).trim() === '') return null;
    const number = Number(value);
    return Number.isFinite(number) ? number : null;
};

const toRiskZone = (row) => ({
    id: row.id,
    zoneCode: row.zone_code,
    zoneName: row.zone_name,
    severityLevel: row.severity_level,
    primaryThreat: row.primary_threat,
    centerLat: toNumberOrNull(row.center_lat),
    centerLng: toNumberOrNull(row.center_lng),
    radiusKm: toNumberOrNull(row.radius_km)
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

// The stored configuration of a saved rule, in the request shape validateFields expects
const toRuleInput = (rule) => ({
    parkId: rule.parkId,
    hazardType: rule.hazardType,
    riskZoneId: rule.riskZoneId,
    alertPriority: rule.alertPriority,
    notificationRecipients: rule.notificationRecipients,
    responseBehaviour: rule.responseBehaviour,
    notes: rule.notes
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
            .select('id, zone_code, zone_name, severity_level, primary_threat, center_lat, center_lng, radius_km')
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
     * "Submit for Validation" dry run. Runs exactly the checks createRule / updateDraft run, using
     * plain SELECTs on the pool: nothing is written, locked or opened as a transaction.
     * The final action is chosen later on the review screen, so it is only validated here when sent.
     * An optional `ruleId` (editing a saved draft) excludes that rule from its own duplicate detection.
     */
    async validateRule(input) {
        const ruleId = input && typeof input === 'object' ? input.ruleId : undefined;
        if (ruleId !== undefined && ruleId !== null) assertRuleId(ruleId);

        try {
            const evaluation = await this.evaluateRule(getPool(), input, { requireAction: false, ruleId: ruleId ?? null });
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

        return this.runTransaction(async (client) => {
            // Serialise creates for the same scope before any rule is read
            const { rule: scope } = monitoringRuleRules.validateFields(input);
            if (scope) await this.lockScope(client, scope);

            const evaluation = await this.evaluateRule(client, input, { requireAction: true });
            assertEvaluationPassed(evaluation, 'The monitoring rule configuration is invalid. No changes were saved.');

            const status = monitoringRuleRules.resolveCreateStatus(evaluation.action);
            const created = await this.insertRule(client, evaluation.rule, status, userId);
            return toMonitoringRule(created);
        }, 'Failed to save the monitoring rule. No changes were saved.');
    }

    /**
     * Saves changes to an existing DRAFT in one transaction, keeping its id, park, creator and DRAFT
     * status: BEGIN -> lock the rule row -> must be DRAFT -> lock the (new) scope -> re-validate with
     * the rule excluded from its own duplicate detection -> UPDATE -> COMMIT.
     * Any `action` in the body is ignored: activation is a separate operation.
     *
     * @throws 400 invalid id, fields, references or a different park; 404 unknown rule;
     *         409 not a DRAFT / duplicate / active conflict
     */
    async updateDraft(ruleId, input, userId) {
        if (!userId) throw serviceError('Authentication required.', 401);
        assertRuleId(ruleId);

        return this.runTransaction(async (client) => {
            const existing = await this.selectRuleForUpdate(client, ruleId);
            monitoringRuleRules.resolveTransition(RULE_OPERATIONS.EDIT, existing.status);

            const { action: _ignoredAction, ...config } = input && typeof input === 'object' ? input : {};
            const { rule: scope } = monitoringRuleRules.validateFields(config);
            if (scope) await this.lockScope(client, scope);

            const evaluation = await this.evaluateRule(client, config, { requireAction: false, ruleId });
            if (Number.isSafeInteger(config.parkId) && config.parkId !== existing.parkId) {
                evaluation.errors.push({
                    field: 'parkId',
                    code: ERROR_CODES.INVALID_VALUE,
                    message: 'A saved monitoring rule cannot be moved to another park.'
                });
            }
            assertEvaluationPassed(evaluation, 'The monitoring rule configuration is invalid. No changes were saved.');

            const updated = await this.updateRuleConfiguration(client, ruleId, evaluation.rule);
            return toMonitoringRule(updated);
        }, 'Failed to update the draft monitoring rule. No changes were saved.');
    }

    /**
     * DRAFT -> ACTIVE in one transaction: BEGIN -> lock the rule row -> must be DRAFT -> lock its scope ->
     * re-validate the stored configuration against the current option sets, references and rules
     * (the rule itself excluded) -> set ACTIVE + activated_at -> COMMIT.
     *
     * @throws 400 invalid id / the stored draft no longer passes validation; 404 unknown rule;
     *         409 not a DRAFT / duplicate / active conflict (including a concurrent activation)
     */
    async activateRule(ruleId, userId) {
        if (!userId) throw serviceError('Authentication required.', 401);
        assertRuleId(ruleId);

        return this.runTransaction(async (client) => {
            const existing = await this.selectRuleForUpdate(client, ruleId);
            const status = monitoringRuleRules.resolveTransition(RULE_OPERATIONS.ACTIVATE, existing.status);
            await this.lockScope(client, existing);

            const evaluation = await this.evaluateRule(client, toRuleInput(existing), { requireAction: false, ruleId });
            assertEvaluationPassed(
                evaluation,
                'The saved draft no longer passes validation. Edit the draft before activating it. No changes were saved.'
            );

            const updated = await this.updateRuleStatus(client, ruleId, status);
            return toMonitoringRule(updated);
        }, 'Failed to activate the monitoring rule. No changes were saved.');
    }

    /**
     * ACTIVE -> INACTIVE in one transaction: BEGIN -> lock the rule row -> must be ACTIVE ->
     * set INACTIVE and clear activated_at (required by chk_monitoring_rule_activation) -> COMMIT.
     * The configuration is kept. Removing an ACTIVE rule cannot create a conflict, so none is checked.
     *
     * @throws 400 invalid id; 404 unknown rule; 409 not ACTIVE
     */
    async deactivateRule(ruleId, userId) {
        if (!userId) throw serviceError('Authentication required.', 401);
        assertRuleId(ruleId);

        return this.runTransaction(async (client) => {
            const existing = await this.selectRuleForUpdate(client, ruleId);
            const status = monitoringRuleRules.resolveTransition(RULE_OPERATIONS.DEACTIVATE, existing.status);
            const updated = await this.updateRuleStatus(client, ruleId, status);
            return toMonitoringRule(updated);
        }, 'Failed to deactivate the monitoring rule. No changes were saved.');
    }

    /**
     * BEGIN -> work(client) -> COMMIT on one pooled client, rolling back on any failure.
     * Service errors keep their status; a unique-index violation (a concurrent ACTIVE rule in the
     * same scope) becomes 409; anything else is logged and becomes a safe 500 with `failureMessage`.
     */
    async runTransaction(work, failureMessage) {
        const client = await getPool().connect();
        try {
            await client.query('BEGIN');
            const result = await work(client);
            await client.query('COMMIT');
            return result;
        } catch (error) {
            await client.query('ROLLBACK').catch(() => {});
            if (error.status) throw error;
            if (error.code === UNIQUE_VIOLATION) {
                throw serviceError('An ACTIVE rule already exists for this park, hazard and risk zone. No changes were saved.', 409, {
                    conflicts: []
                });
            }
            console.error('Monitoring rule transaction failed:', error.message);
            throw serviceError(failureMessage, 500);
        } finally {
            client.release();
        }
    }

    /**
     * Shared validation path for validateRule (pool) and the write operations (transaction client).
     * Field and action errors are collected together; reference checks run only for a field-valid
     * rule, and duplicate/conflict detection only when the references are valid. `ruleId` is the
     * saved rule being edited or activated, which never conflicts with itself.
     */
    async evaluateRule(db, input, { requireAction, ruleId = null }) {
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
                const candidate = ruleId === null ? fields.rule : { ...fields.rule, id: ruleId };
                conflicts = monitoringRuleRules.findConflicts(candidate, existingRules);
            }
        }

        const valid = errors.length === 0 && conflicts.length === 0;
        return { valid, errors, conflicts, rule: valid ? fields.rule : null, action: actionCheck.action };
    }

    // Serialises writes for one scope (park + hazard + risk zone) until the transaction ends
    async lockScope(client, rule) {
        await client.query('SELECT pg_advisory_xact_lock(hashtext($1))', [scopeLockKey(rule)]);
    }

    // Every write path on a saved rule locks its row first, then its scope
    async selectRuleForUpdate(client, ruleId) {
        const { rows } = await client.query(
            `SELECT ${RULE_COLUMNS} FROM public.monitoring_rules WHERE id = $1 FOR UPDATE`,
            [ruleId]
        );
        if (!rows[0]) throw serviceError('Monitoring rule not found.', 404);
        return toMonitoringRule(rows[0]);
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

    // Replaces the configuration only: id, park, status, creator and created_at never change
    async updateRuleConfiguration(client, ruleId, rule) {
        const { rows } = await client.query(
            `UPDATE public.monitoring_rules
             SET hazard_type = $2, risk_zone_id = $3, alert_priority = $4, notification_recipients = $5::jsonb,
                 response_behaviour = $6, notes = $7, updated_at = NOW()
             WHERE id = $1
             RETURNING ${RULE_COLUMNS}`,
            [
                ruleId, rule.hazardType, rule.riskZoneId, rule.alertPriority,
                JSON.stringify(rule.notificationRecipients), rule.responseBehaviour, rule.notes
            ]
        );
        return rows[0];
    }

    // Only an ACTIVE rule has an activation time (chk_monitoring_rule_activation)
    async updateRuleStatus(client, ruleId, status) {
        const { rows } = await client.query(
            `UPDATE public.monitoring_rules
             SET status = $2, activated_at = CASE WHEN $3::boolean THEN NOW() ELSE NULL END, updated_at = NOW()
             WHERE id = $1
             RETURNING ${RULE_COLUMNS}`,
            [ruleId, status, status === RULE_STATUSES.ACTIVE]
        );
        return rows[0];
    }
}

module.exports = new MonitoringRuleService();
