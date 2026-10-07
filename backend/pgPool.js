const { Pool } = require('pg');
require('dotenv').config();

// Direct PostgreSQL pool for operations that need a real transaction
// (supabase-js cannot run multi-statement transactions without an RPC function).
let pool = null;

const getPool = () => {
    if (!pool) {
        pool = new Pool({
            connectionString: process.env.DATABASE_URL,
            ssl: { rejectUnauthorized: false }
        });
        pool.on('error', (err) => console.error('PostgreSQL pool error:', err.message));
    }
    return pool;
};

module.exports = { getPool };
