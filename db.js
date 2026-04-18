// import postgres from 'postgres'

// const connectionString = process.env.DATABASE_URL
// const sql = postgres(connectionString)

// export default sql

const { Pool } = require('pg');
require('dotenv').config();

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: {
    rejectUnauthorized: false // Required for Supabase connections
  }
});

module.exports = {
  query: (text, params) => pool.query(text, params),
};

const testConnection = async () => {
  try {
    const res = await pool.query('SELECT NOW()');
    console.log('✅ DATABASE CONNECTED:', res.rows[0].now);
  } catch (err) {
    console.error('❌ DATABASE CONNECTION ERROR:', err.message);
  }
};

testConnection();