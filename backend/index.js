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

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
