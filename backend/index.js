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
    const { email, password, name } = req.body;

    if (!email || !password || !name) {
        return res.status(400).json({ error: 'All fields are required' });
    }

    try {
        const { data, error } = await supabase.auth.signUp({
            email,
            password,
            options: {
                data: {
                    full_name: name,
                },
            },
        });

        if (error) throw error;

        res.status(201).json({ message: 'User created successfully', user: data.user });
    } catch (error) {
        console.error('Registration Error:', error.message);
        res.status(400).json({ error: error.message });
    }
});

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
