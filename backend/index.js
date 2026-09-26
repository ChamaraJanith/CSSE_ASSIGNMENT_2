const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// mongoose.connect(process.env.MONGODB_URI, { useNewUrlParser: true, useUnifiedTopology: true })
//     .then(() => console.log('MongoDB connection established.'))
//     .catch((error) => console.error('MongoDB connection failed:', error.message));

app.get('/', (req, res) => {
    res.send('MERN server is running!');
});

app.listen(PORT, () => {
    console.log(`Server is running on port: ${PORT}`);
});
