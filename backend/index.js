const express = require('express');
const cors = require('cors');
require('dotenv').config();

const { supabase, supabaseAdmin } = require('./supabaseClient'); // Import both clients

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
    res.send('Backend server is running with Supabase!');
});

app.post('/api/auth/register', async (req, res) => {
    // ... existing register logic ...
    const { email, password, name } = req.body;
    if (!email || !password || !name) return res.status(400).json({ error: 'All fields are required' });
    try {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } });
        if (error) throw error;
        res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (error) {
        res.status(400).json({ error: error.message });
    }
});

app.post('/api/wildlife-officers', async (req, res) => {
    const { email, password, mobileNumber, age, assignedCheckpoint } = req.body;

    if (!email || !password || !mobileNumber) {
        return res.status(400).json({ error: 'Required fields missing' });
    }

    try {
        // 1. Create the user via Admin API (no confirmation email sent, no rate limit!)
        const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
            email,
            password,
            email_confirm: true, // Auto-confirm, no email needed
        });

        if (authError) throw authError;

        // 2. Insert their extra details into the specific table
        const { error: dbError } = await supabase
            .from('wildlife_officer_details')
            .insert([
                { 
                    user_id: authData.user.id,
                    mobile_number: mobileNumber,
                    age: parseInt(age),
                    assigned_checkpoint: assignedCheckpoint
                }
            ]);

        if (dbError) {
            console.error('Database Insert Error:', dbError.message);
            // Non-fatal, but we should inform the client
            return res.status(201).json({ message: 'User created, but failed to save details to table. Ensure table and policies exist.', user: authData.user });
        }
        
        res.status(201).json({ message: 'Wildlife Officer registered and details saved!', user: authData.user });
    } catch (error) {
        console.error('Officer Registration Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
