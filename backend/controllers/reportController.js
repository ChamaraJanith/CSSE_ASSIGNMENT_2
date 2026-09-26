const { supabaseAdmin } = require('../supabaseClient');

const getRangers = async (req, res) => {
    try {
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

        res.status(200).json({ data: rangers });
    } catch (error) {
        console.error('Get Rangers Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const createConflictReport = async (req, res) => {
    try {
        const payload = req.body;
        
        // We assume the DB table is named 'conflict_reports'
        // Using supabaseAdmin (Service Role) to bypass RLS policies
        const { data, error } = await supabaseAdmin
            .from('conflict_reports')
            .insert([
                {
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
                    // created_at is usually handled by DB default, but we can pass it if we want
                    created_at: payload.createdAt
                }
            ])
            .select(); // Return the inserted data

        if (error) throw error;

        res.status(201).json({ message: 'Report submitted successfully', data: data[0] });
    } catch (error) {
        console.error('Submit Report Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getReportByCode = async (req, res) => {
    try {
        const { code } = req.params;
        const { data, error } = await supabaseAdmin
            .from('conflict_reports')
            .select('*, report_clarifications(*)')
            .eq('report_code', code)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Report not found' });
            }
            throw error;
        }

        if (data.report_clarifications) {
            data.report_clarifications.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        res.status(200).json({ data });
    } catch (error) {
        console.error('Get Report Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getAllReports = async (req, res) => {
    try {
        const { userId, rangerId } = req.query;
        let query = supabaseAdmin.from('conflict_reports').select('*, report_clarifications(*), response_assignments(*)').order('created_at', { ascending: false });
        
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        // Sort clarifications and assignments by created_at for each report
        data.forEach(report => {
            if (report.report_clarifications) {
                report.report_clarifications.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
            if (report.response_assignments) {
                report.response_assignments.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
            }
        });
        
        let filteredData = data;
        if (rangerId) {
            // Only return reports where this ranger has an assignment
            filteredData = data.filter(report => 
                report.response_assignments && report.response_assignments.some(a => a.ranger_id === rangerId)
            );
        }

        res.status(200).json({ data: filteredData });
    } catch (error) {
        console.error('Get All Reports Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const updateReportStatus = async (req, res) => {
    try {
        const { code } = req.params;
        const { status, priority, clarification_request, clarification_reply, clarification_evidence_url, clarification_id, assigned_ranger_id, assignment_id, ranger_status, ranger_outcome, ranger_outcome_image } = req.body;
        
        const payload = {};
        if (status) payload.status = status;
        if (priority) payload.priority = priority;

        // Update the main report
        if (Object.keys(payload).length > 0) {
            const { error } = await supabaseAdmin
                .from('conflict_reports')
                .update(payload)
                .eq('report_code', code);
            if (error) throw error;
        }

        // Handle NEW Ranger Assignment (from CLO)
        if (assigned_ranger_id) {
            const { error } = await supabaseAdmin
                .from('response_assignments')
                .insert([{ report_code: code, ranger_id: assigned_ranger_id, status: 'PENDING' }]);
            if (error) throw error;
        }

        // Handle Ranger updating their assignment status/outcome
        if (assignment_id && ranger_status) {
            const assignmentPayload = { status: ranger_status };
            if (ranger_outcome !== undefined) assignmentPayload.outcome = ranger_outcome;
            if (ranger_outcome_image !== undefined) assignmentPayload.outcome_image_url = ranger_outcome_image;

            const { error } = await supabaseAdmin
                .from('response_assignments')
                .update(assignmentPayload)
                .eq('id', assignment_id);
            if (error) throw error;
        }

        // Handle CLO Requesting Clarification
        if (clarification_request) {
            const { error } = await supabaseAdmin
                .from('report_clarifications')
                .insert([{ report_code: code, officer_request: clarification_request }]);
            if (error) throw error;
        }

        // Handle User Replying to Clarification
        if (clarification_reply && clarification_id) {
            const { error } = await supabaseAdmin
                .from('report_clarifications')
                .update({ user_reply: clarification_reply, evidence_url: clarification_evidence_url })
                .eq('id', clarification_id);
            if (error) throw error;
        }
        
        // Fetch the updated report with clarifications
        const { data, error: fetchError } = await supabaseAdmin
            .from('conflict_reports')
            .select('*, report_clarifications(*)')
            .eq('report_code', code)
            .single();

        if (fetchError) throw fetchError;
        
        if (data.report_clarifications) {
            data.report_clarifications.sort((a, b) => new Date(a.created_at) - new Date(b.created_at));
        }

        res.status(200).json({ message: 'Report updated successfully', data });
    } catch (error) {
        console.error('Update Status Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createConflictReport,
    getReportByCode,
    getAllReports,
    updateReportStatus,
    getRangers
};
