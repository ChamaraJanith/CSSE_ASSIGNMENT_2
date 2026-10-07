const supabase = require('../supabaseClient');

const createIncident = async (req, res) => {
    try {
        const { title, description, category, severity, location, status } = req.body;
        const { data, error } = await supabase
            .from('incidents')
            .insert([{ title, description, category, severity, location, status: status || 'OPEN' }])
            .select();
        
        if (error) throw error;
        res.status(201).json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const getIncidents = async (req, res) => {
    try {
        const { data, error } = await supabase
            .from('incidents')
            .select('*')
            .order('created_at', { ascending: false });
        if (error) throw error;
        res.json(data);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const updateIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const updates = req.body;
        updates.updated_at = new Date().toISOString();
        
        const { data, error } = await supabase
            .from('incidents')
            .update(updates)
            .eq('id', id)
            .select();
            
        if (error) throw error;
        res.json(data[0]);
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

const deleteIncident = async (req, res) => {
    try {
        const { id } = req.params;
        const { data, error } = await supabase
            .from('incidents')
            .delete()
            .eq('id', id);
            
        if (error) throw error;
        res.json({ message: 'Deleted successfully' });
    } catch (err) {
        res.status(500).json({ error: err.message });
    }
};

module.exports = {
    createIncident,
    getIncidents,
    updateIncident,
    deleteIncident
};
