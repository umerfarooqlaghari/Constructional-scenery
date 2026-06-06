/**
 * Migration script — drops all existing tables and re-creates from schema.sql
 * Run: node db/migrate.js
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

// Strip sslmode from the URL; handle SSL via the ssl object instead
const connStr = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  max: 1,
  connectionTimeoutMillis: 30000,
  idleTimeoutMillis: 60000,
});

/**
 * Split SQL file into individual statements, correctly handling:
 *  - Dollar-quoted PL/pgSQL blocks ($$...$$)
 *  - Single-line -- comments
 *  - Block /* ... *\/ comments
 *  - Normal statements terminated by ;
 */
function splitStatements(sql) {
  const statements = [];
  let current = '';
  let i = 0;
  let inDollarBlock = false;

  while (i < sql.length) {
    // Dollar-quote start/end
    if (sql.slice(i, i + 2) === '$$') {
      inDollarBlock = !inDollarBlock;
      current += '$$';
      i += 2;
      continue;
    }

    // Inside $$ block — copy verbatim until closing $$
    if (inDollarBlock) {
      current += sql[i++];
      continue;
    }

    // Single-line comment
    if (sql.slice(i, i + 2) === '--') {
      const end = sql.indexOf('\n', i);
      if (end === -1) break;
      current += sql.slice(i, end + 1);
      i = end + 1;
      continue;
    }

    // Statement terminator
    if (sql[i] === ';') {
      const stmt = current.trim();
      if (stmt) statements.push(stmt + ';');
      current = '';
      i++;
      continue;
    }

    current += sql[i++];
  }

  const last = current.trim();
  if (last) statements.push(last);

  return statements.filter(s => {
    const stripped = s.replace(/--[^\n]*/g, '').replace(/\s+/g, ' ').trim();
    return stripped.length > 1 && stripped !== ';';
  });
}

async function migrate() {
  const client = await pool.connect();
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     Deepsian — Database Migration        ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    // ── Step 1: Drop all existing tables ──────────────────────────────────────
    console.log('🗑️  Dropping existing tables (CASCADE)...');
    const DROP_TABLES = [
      'pay_run_items', 'pay_runs', 'timesheet_entries', 'timesheets',
      'cost_report_invoices', 'cost_plus_budgets',
      'forecast_labour_items', 'forecast_materials_items',
      'forecasts', 'supplier_catalogue', 'percentometer_ratios', 'bectu_rates',
      'crew_documents', 'production_crew', 'crew_members',
      'production_documents', 'purchase_orders', 'sets', 'productions',
      'refresh_tokens', 'users',
      // Legacy Supabase table (if it exists from old setup)
      'user_profiles',
    ];

    for (const table of DROP_TABLES) {
      await client.query(`DROP TABLE IF EXISTS "${table}" CASCADE`);
      process.stdout.write(`  dropped ${table}\n`);
    }

    // Also drop the trigger function if it exists
    await client.query(`DROP FUNCTION IF EXISTS update_updated_at() CASCADE`);

    console.log('\n📋 Running schema.sql...\n');

    // ── Step 2: Read and split schema.sql ─────────────────────────────────────
    const schemaPath = path.join(__dirname, 'schema.sql');
    const schemaSql  = fs.readFileSync(schemaPath, 'utf8');
    const statements = splitStatements(schemaSql);

    console.log(`  Found ${statements.length} SQL statements\n`);

    let ok = 0;
    for (let idx = 0; idx < statements.length; idx++) {
      const stmt = statements[idx];
      // Derive a short label for logging
      const label = stmt.replace(/\s+/g, ' ').slice(0, 70).trim();

      try {
        await client.query(stmt);
        process.stdout.write(`  ✓ [${idx + 1}/${statements.length}] ${label}\n`);
        ok++;
      } catch (err) {
        console.error(`\n  ✗ [${idx + 1}/${statements.length}] FAILED: ${label}`);
        console.error(`    Error: ${err.message}\n`);
        // Continue on non-fatal errors (e.g. duplicate seeds on re-run)
        if (!err.message.includes('already exists') && !err.message.includes('duplicate key')) {
          throw err;
        }
      }
    }

    console.log(`\n✅ Migration complete — ${ok}/${statements.length} statements applied`);
    console.log('──────────────────────────────────────────────');
    console.log('📌 Next step: fill in BECTU 2026/27 daily_rate / overtime_rate');
    console.log('   in the bectu_rates table via Render SQL Console');
    console.log('──────────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n❌ Migration failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

migrate();
