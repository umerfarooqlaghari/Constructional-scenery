const { Pool } = require('pg');

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
  ssl: { rejectUnauthorized: false },
  max: 10,                // max pool connections
  idleTimeoutMillis: 30000,
  connectionTimeoutMillis: 5000,
});

pool.on('error', (err) => {
  console.error('Unexpected PostgreSQL pool error:', err);
});

// Test connection on startup
pool.query('SELECT NOW()').then(() => {
  console.log('✅ PostgreSQL connected (Render)');
}).catch(err => {
  console.error('❌ PostgreSQL connection failed:', err.message);
});

module.exports = pool;
