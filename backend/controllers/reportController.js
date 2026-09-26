const { supabaseAdmin } = require('../supabaseClient');

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
    console.log('HIT getReportByCode:', req.params.code);
    try {
        const { code } = req.params;
        const { data, error } = await supabaseAdmin
            .from('conflict_reports')
            .select('*')
            .eq('report_code', code)
            .single();

        if (error) {
            if (error.code === 'PGRST116') {
                return res.status(404).json({ error: 'Report not found' });
            }
            throw error;
        }

        res.status(200).json({ data });
    } catch (error) {
        console.error('Get Report Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const getAllReports = async (req, res) => {
    console.log('HIT getAllReports, query:', req.query);
    try {
        const { userId } = req.query;
        let query = supabaseAdmin.from('conflict_reports').select('*').order('created_at', { ascending: false });
        
        if (userId) {
            query = query.eq('user_id', userId);
        }

        const { data, error } = await query;

        if (error) throw error;

        res.status(200).json({ data });
    } catch (error) {
        console.error('Get All Reports Error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = {
    createConflictReport,
    getReportByCode,
    getAllReports
};
