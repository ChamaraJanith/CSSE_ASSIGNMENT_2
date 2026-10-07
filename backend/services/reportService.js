const { supabaseAdmin } = require('../supabaseClient');

class ReportService {
    async getRangers() {
        const { data, error } = await supabaseAdmin
            .from('user_roles')
            .select('user_id, roles!inner(role_name)')
            .eq('roles.role_name', 'wildlife_officer');

        if (error) throw error;
        
        const { data: { users }, error: usersError } = await supabaseAdmin.auth.admin.listUsers();
        
        let rangers = data.map((ur) => {
            const u = users?.find(user => user.id === ur.user_id);
            return { id: ur.user_id, name: u ? u.email : `Ranger (${ur.user_id.substring(0, 8)})` };
        });

        if (rangers.length === 0) {
            rangers = [
                { id: '11111111-1111-1111-1111-111111111111', name: 'dummy1@wildguard.com' },
                { id: '22222222-2222-2222-2222-222222222222', name: 'dummy2@wildguard.com' }
            ];
        }

        return rangers;
    }

    async createReport(payload) {
        const { data, error } = await supabaseAdmin
            .from('conflict_reports')
            .insert([{
                report_code: payload.reportCode,
                incident_type: payload.incidentType,
                incident_datetime: payload.incidentDateTime,
                description: payload.description,
                immediate_risk: payload.immediateRisk,
                area: payload.area,
                landmark: payload.landmark,
                latitude: payload.latitude,
                longitude: payload.longitude,
                reporter_name: payload.reporterName,
                contact_number: payload.contactNumber,
                preferred_contact_method: payload.preferredContactMethod,
                evidence_url: payload.evidenceUrl,
                consent_confirmed: payload.consentConfirmed,
                status: payload.status || 'NEW',
                priority: payload.priority || null,
                user_id: payload.user_id || null,
                created_at: payload.createdAt
            }])
            .select();

        if (error) throw error;
        return data[0];
    }

    async getReportByCode(code) {
        const { data, error } = await supabaseAdmin
            .from('conflict_reports')
            .select('*, report_clarifications(*), response_assignments(*, ranger_location_updates(*))')
            .eq('report_code', code)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                const notFoundErr = new Error('Report not found');
                notFoundErr.status = 404;
                throw notFoundErr;
            }
            throw error;
        }

        if (data.report_clarifications) {
            data.report_clarifications.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        return data;
    }

    async getAllReports(userId, rangerId) {
        let query = supabaseAdmin.from('conflict_reports').select('*, report_clarifications(*), response_assignments(*, ranger_location_updates(*))').order('created_at', { ascending: false });
        
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;
        if (error) throw error;

        data.forEach(report => {
            if (report.report_clarifications) {
                report.report_clarifications.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
            if (report.response_assignments) {
                report.response_assignments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
        });
        
        const { data: { users } } = await supabaseAdmin.auth.admin.listUsers();
        
        let filteredData = data;
        if (rangerId) {
            filteredData = data.filter(report => 
                report.response_assignments && report.response_assignments.some(a => a.ranger_id === rangerId)
            );
        }

        filteredData.forEach(report => {
            if (report.response_assignments) {
                report.response_assignments.forEach(assignment => {
                    const u = users?.find(user => user.id === assignment.ranger_id);
                    assignment.ranger_email = u ? u.email : `Unknown Ranger (${assignment.ranger_id.substring(0, 8)})`;
                });
            }
        });

        return filteredData;
    }

    async updateReportDetails(code, payload) {
        if (Object.keys(payload).length > 0) {
            // Do not close a report without a recorded ranger outcome.
            if (payload.status === 'CLOSED') {
                const { data: assignments, error: fetchError } = await supabaseAdmin
                    .from('response_assignments')
                    .select('outcome')
                    .eq('report_code', code);
                
                if (fetchError) throw fetchError;
                
                const hasOutcome = assignments && assignments.some(a => a.outcome && a.outcome.trim() !== '');
                if (!hasOutcome) {
                    const err = new Error('Cannot close report without a recorded ranger outcome.');
                    err.status = 400;
                    throw err;
                }
            }

            const { error } = await supabaseAdmin
                .from('conflict_reports')
                .update(payload)
                .eq('report_code', code);
            if (error) throw error;
        }
    }

    async assignRanger(code, rangerId) {
        const { error } = await supabaseAdmin
            .from('response_assignments')
            .insert([{ report_code: code, ranger_id: rangerId, status: 'PENDING' }]);
        if (error) throw error;
    }

    async updateRangerAssignment(assignmentId, rangerStatus, outcome, outcomeImage, requestingUserId) {
        // Prevent rangers from updating assignments that are not assigned to them.
        if (requestingUserId) {
            const { data: assignment, error: fetchError } = await supabaseAdmin
                .from('response_assignments')
                .select('ranger_id')
                .eq('id', assignmentId)
                .single();
            
            if (fetchError) throw fetchError;
            
            if (assignment.ranger_id !== requestingUserId) {
                const err = new Error('Unauthorized: You can only update your own assignments.');
                err.status = 403;
                throw err;
            }
        }

        const assignmentPayload = { status: rangerStatus };
        if (outcome !== undefined) assignmentPayload.outcome = outcome;
        if (outcomeImage !== undefined) assignmentPayload.outcome_image_url = outcomeImage;

        const { error } = await supabaseAdmin
            .from('response_assignments')
            .update(assignmentPayload)
            .eq('id', assignmentId);
        if (error) throw error;
    }

    async saveLocationUpdate(assignmentId, latitude, longitude, requestingUserId) {
        // Validate coordinates
        if (isNaN(latitude) || isNaN(longitude) || latitude < -90 || latitude > 90 || longitude < -180 || longitude > 180) {
            const err = new Error('Invalid coordinates');
            err.status = 400;
            throw err;
        }

        // Fetch assignment to verify ranger and status
        const { data: assignments, error: fetchError } = await supabaseAdmin
            .from('response_assignments')
            .select('ranger_id, status')
            .eq('id', assignmentId)
            .limit(1);

        if (fetchError) throw fetchError;

        const assignment = assignments?.[0];
        if (!assignment) {
            const err = new Error('Assignment not found');
            err.status = 404;
            throw err;
        }

        if (requestingUserId && assignment.ranger_id !== requestingUserId) {
            const err = new Error('Unauthorized: You can only simulate GPS for your own assignments.');
            err.status = 403;
            throw err;
        }

        if (assignment.status !== 'RESPONDING') {
            const err = new Error('Location updates are only allowed when status is RESPONDING.');
            err.status = 400;
            throw err;
        }

        const { data, error } = await supabaseAdmin
            .from('ranger_location_updates')
            .insert([{
                assignment_id: assignmentId,
                ranger_id: assignment.ranger_id,
                latitude,
                longitude,
                source: 'SIMULATED'
            }])
            .select();

        if (error) throw error;
        return data[0];
    }

    async requestClarification(code, officerRequest) {
        const { error } = await supabaseAdmin
            .from('report_clarifications')
            .insert([{ report_code: code, officer_request: officerRequest }]);
        if (error) throw error;
    }

    async replyClarification(clarificationId, reply, evidenceUrl) {
        const { error } = await supabaseAdmin
            .from('report_clarifications')
            .update({ user_reply: reply, evidence_url: evidenceUrl })
            .eq('id', clarificationId);
        if (error) throw error;
    }
}

module.exports = new ReportService();
