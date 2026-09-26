const express = require('express');
const cors = require('cors');
require('dotenv').config();

const supabase = require('./supabaseClient'); // Import Supabase client

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
        // Create the user in Supabase Auth
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    mobile: mobileNumber,
                    age: age,
                    checkpoint: assignedCheckpoint,
                    role: 'wildlife_officer'
                },
            },
        });

        if (error) throw error;

        // NOTE: In a fully secure production app, you should use the Supabase Admin API (Service Role Key) 
        // here to auto-insert their role into the public.user_roles table directly from the backend.
        
        res.status(201).json({ message: 'Wildlife Officer registered successfully', user: data.user });
    } catch (error) {
        console.error('Officer Registration Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
