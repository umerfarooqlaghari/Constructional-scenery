/**
 * Generic SQL runner — runs any .sql file against the Render database
 * Usage:  node db/run_sql.js  db/my_migration.sql
 *
 * Example:
 *   1. Create db/migration_001.sql with your ALTER TABLE / CREATE TABLE etc
 *   2. node db/run_sql.js db/migration_001.sql
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const file = process.argv[2];
if (!file) {
  console.error('❌  Usage: node db/run_sql.js <path-to-sql-file>');
  console.error('    e.g.   node db/run_sql.js db/migration_001.sql');
  process.exit(1);
}

const sqlPath = path.resolve(process.cwd(), file);
if (!fs.existsSync(sqlPath)) {
  console.error(`❌  File not found: ${sqlPath}`);
  process.exit(1);
}

const connStr = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');
const pool = new Pool({ connectionString: connStr, ssl: { rejectUnauthorized: false }, max: 1 });

async function run() {
  const client = await pool.connect();
  const sql    = fs.readFileSync(sqlPath, 'utf8');

  console.log(`\n⏳  Running: ${file}\n`);
  try {
    await client.query(sql);
    console.log('✅  Done — SQL executed successfully\n');
  } catch (err) {
    console.error('❌  Error:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

run();
