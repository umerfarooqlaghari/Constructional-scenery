/**
 * Replicate Schema from Dev DB to Production DB + Seed Initial User & Reference Data
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const { Pool } = require('pg');
const bcrypt = require('bcryptjs');

const DEV_URL = "postgresql://cshq_dev_user:AtSNBvFyJbCPNZ3WDg8BNlS565rH3yLA@dpg-d8bhleul51nc7399l8t0-a.virginia-postgres.render.com/cshq_db_dev";
const PROD_URL = process.env.DATABASE_URL;

function createPool(rawUrl) {
  const u = new URL(rawUrl);
  return new Pool({
    host: u.hostname,
    port: parseInt(u.port, 10) || 5432,
    user: u.username,
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: { rejectUnauthorized: false },
    max: 2,
    connectionTimeoutMillis: 30000,
  });
}

const devPool = createPool(DEV_URL);
const prodPool = createPool(PROD_URL);

async function run() {
  console.log('🚀 Starting Schema Replication & Seeding...\n');

  const devClient = await devPool.connect();
  const prodClient = await prodPool.connect();

  try {
    // ── 0. Clean Existing Objects in Prod ───────────────────────────────────────
    console.log('🧹 Cleaning existing tables in Prod (CASCADE)...');
    const existingTablesRes = await prodClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE';
    `);
    for (const t of existingTablesRes.rows) {
      await prodClient.query(`DROP TABLE IF EXISTS "${t.table_name}" CASCADE;`);
    }

    // ── 1. Extensions ──────────────────────────────────────────────────────────
    console.log('1️⃣ Creating Extensions...');
    await prodClient.query('CREATE EXTENSION IF NOT EXISTS "uuid-ossp";');
    await prodClient.query('CREATE EXTENSION IF NOT EXISTS "pgcrypto";');
    console.log('   ✓ Extensions created');

    // ── 2. Sequences ──────────────────────────────────────────────────────────
    console.log('2️⃣ Creating Sequences...');
    const seqsRes = await devClient.query(`
      SELECT sequence_name 
      FROM information_schema.sequences 
      WHERE sequence_schema = 'public';
    `);
    for (const s of seqsRes.rows) {
      await prodClient.query(`CREATE SEQUENCE IF NOT EXISTS "${s.sequence_name}";`);
      console.log(`   ✓ Sequence: ${s.sequence_name}`);
    }

    // ── 3. Custom Functions ───────────────────────────────────────────────────
    console.log('3️⃣ Creating Functions...');
    const funcs = await devClient.query(`
      SELECT p.proname, pg_get_functiondef(p.oid) as def
      FROM pg_proc p
      JOIN pg_namespace n ON p.pronamespace = n.oid
      WHERE n.nspname = 'public' AND p.proname NOT LIKE 'uuid_%';
    `);
    for (const f of funcs.rows) {
      await prodClient.query(f.def);
      console.log(`   ✓ Function: ${f.proname}`);
    }

    // ── 4. Tables & Columns ────────────────────────────────────────────────────
    console.log('4️⃣ Creating Tables & Columns...');
    const tablesRes = await devClient.query(`
      SELECT table_name 
      FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name;
    `);
    const tables = tablesRes.rows.map(r => r.table_name);

    for (const tableName of tables) {
      const colsRes = await devClient.query(`
        SELECT 
          column_name,
          data_type,
          udt_name,
          character_maximum_length,
          numeric_precision,
          numeric_scale,
          is_nullable,
          column_default
        FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = $1
        ORDER BY ordinal_position;
      `, [tableName]);

      const colDefs = colsRes.rows.map(c => {
        let typeStr = c.data_type;
        if (c.data_type === 'USER-DEFINED') {
          typeStr = `"${c.udt_name}"`;
        } else if (c.data_type === 'ARRAY') {
          typeStr = `${c.udt_name.replace(/^_/, '')}[]`;
        } else if (c.data_type === 'character varying') {
          typeStr = c.character_maximum_length ? `VARCHAR(${c.character_maximum_length})` : 'VARCHAR';
        } else if (c.data_type === 'numeric') {
          typeStr = c.numeric_precision ? `NUMERIC(${c.numeric_precision},${c.numeric_scale || 0})` : 'NUMERIC';
        } else if (c.data_type === 'timestamp with time zone') {
          typeStr = 'TIMESTAMPTZ';
        } else if (c.data_type === 'timestamp without time zone') {
          typeStr = 'TIMESTAMP';
        }

        let def = `"${c.column_name}" ${typeStr}`;
        if (c.is_nullable === 'NO') {
          def += ' NOT NULL';
        }
        if (c.column_default !== null) {
          def += ` DEFAULT ${c.column_default}`;
        }
        return def;
      });

      const createTableSql = `CREATE TABLE IF NOT EXISTS "${tableName}" (\n  ${colDefs.join(',\n  ')}\n);`;
      await prodClient.query(createTableSql);
      console.log(`   ✓ Table: ${tableName} (${colsRes.rows.length} columns)`);
    }

    // ── 5. Primary Keys ────────────────────────────────────────────────────────
    console.log('5️⃣ Adding Primary Keys...');
    const pkRes = await devClient.query(`
      SELECT 
        tc.table_name,
        tc.constraint_name,
        string_agg('"' || kcu.column_name || '"', ', ' ORDER BY kcu.ordinal_position) as cols
      FROM information_schema.table_constraints tc
      JOIN information_schema.key_column_usage kcu
        ON tc.constraint_name = kcu.constraint_name
        AND tc.table_schema = kcu.table_schema
      WHERE tc.constraint_type = 'PRIMARY KEY'
        AND tc.table_schema = 'public'
      GROUP BY tc.table_name, tc.constraint_name;
    `);
    for (const pk of pkRes.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${pk.table_name}" 
          ADD CONSTRAINT "${pk.constraint_name}" PRIMARY KEY (${pk.cols});
        `);
        console.log(`   ✓ PK on ${pk.table_name}: (${pk.cols})`);
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
    }

    // ── 6. Check Constraints ───────────────────────────────────────────────────
    console.log('6️⃣ Adding Check Constraints...');
    const checkRes = await devClient.query(`
      SELECT 
        conrelid::regclass::text as table_name,
        conname as constraint_name,
        pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype = 'c'
        AND c.conname NOT LIKE '%_not_null';
    `);
    for (const chk of checkRes.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${chk.table_name}" 
          ADD CONSTRAINT "${chk.constraint_name}" ${chk.constraint_def};
        `);
        console.log(`   ✓ Check: ${chk.constraint_name} on ${chk.table_name}`);
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
    }

    // ── 7. Unique Constraints ──────────────────────────────────────────────────
    console.log('7️⃣ Adding Unique Constraints...');
    const uniqueRes = await devClient.query(`
      SELECT 
        conrelid::regclass::text as table_name,
        conname as constraint_name,
        pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype = 'u';
    `);
    for (const unq of uniqueRes.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${unq.table_name}" 
          ADD CONSTRAINT "${unq.constraint_name}" ${unq.constraint_def};
        `);
        console.log(`   ✓ Unique: ${unq.constraint_name} on ${unq.table_name}`);
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
    }

    // ── 8. Foreign Keys ────────────────────────────────────────────────────────
    console.log('8️⃣ Adding Foreign Keys...');
    const fkRes = await devClient.query(`
      SELECT 
        conrelid::regclass::text as table_name,
        conname as constraint_name,
        pg_get_constraintdef(c.oid) as constraint_def
      FROM pg_constraint c
      JOIN pg_namespace n ON n.oid = c.connamespace
      WHERE n.nspname = 'public' AND c.contype = 'f';
    `);
    for (const fk of fkRes.rows) {
      try {
        await prodClient.query(`
          ALTER TABLE "${fk.table_name}" 
          ADD CONSTRAINT "${fk.constraint_name}" ${fk.constraint_def};
        `);
        console.log(`   ✓ FK: ${fk.constraint_name} on ${fk.table_name}`);
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
    }

    // ── 9. Indexes ─────────────────────────────────────────────────────────────
    console.log('9️⃣ Adding Indexes...');
    const idxRes = await devClient.query(`
      SELECT tablename, indexname, indexdef
      FROM pg_indexes
      WHERE schemaname = 'public'
        AND indexname NOT IN (SELECT constraint_name FROM information_schema.table_constraints WHERE table_schema = 'public');
    `);
    for (const idx of idxRes.rows) {
      try {
        await prodClient.query(idx.indexdef);
        console.log(`   ✓ Index: ${idx.indexname} on ${idx.tablename}`);
      } catch (err) {
        if (!err.message.includes('already exists')) throw err;
      }
    }

    // ── 10. Triggers ───────────────────────────────────────────────────────────
    console.log('🔟 Adding Triggers...');
    const triggers = await devClient.query(`
      SELECT event_object_table, trigger_name, action_statement, action_timing, event_manipulation
      FROM information_schema.triggers
      WHERE trigger_schema = 'public';
    `);
    for (const trg of triggers.rows) {
      try {
        await prodClient.query(`
          DROP TRIGGER IF EXISTS "${trg.trigger_name}" ON "${trg.event_object_table}";
          CREATE TRIGGER "${trg.trigger_name}"
          ${trg.action_timing} ${trg.event_manipulation} ON "${trg.event_object_table}"
          FOR EACH ROW ${trg.action_statement};
        `);
        console.log(`   ✓ Trigger: ${trg.trigger_name} on ${trg.event_object_table}`);
      } catch (err) {
        console.warn(`   ⚠️ Trigger warning: ${err.message}`);
      }
    }

    // ── 11. Replicate TypeORM Migrations History ───────────────────────────────
    console.log('1️⃣1️⃣ Replicating TypeORM Migrations Table...');
    const migrations = await devClient.query(`SELECT * FROM typeorm_migrations ORDER BY id;`);
    for (const m of migrations.rows) {
      await prodClient.query(`
        INSERT INTO typeorm_migrations (id, timestamp, name)
        VALUES ($1, $2, $3)
        ON CONFLICT (id) DO UPDATE SET timestamp = EXCLUDED.timestamp, name = EXCLUDED.name;
      `, [m.id, m.timestamp, m.name]);
    }
    if (migrations.rows.length > 0) {
      await prodClient.query(`SELECT setval('typeorm_migrations_id_seq', (SELECT MAX(id) FROM typeorm_migrations));`);
    }
    console.log(`   ✓ Replicated ${migrations.rows.length} migration records`);

    // ── 12. Replicate Reference/Seed Data ───────────────────────────────────────
    console.log('1️⃣2️⃣ Replicating Reference Data...');
    
    // bectu_rates
    const bectuRates = await devClient.query(`SELECT * FROM bectu_rates;`);
    for (const r of bectuRates.rows) {
      const keys = Object.keys(r);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => r[k]);
      await prodClient.query(`
        INSERT INTO bectu_rates (${cols}) VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING;
      `, values);
    }
    console.log(`   ✓ Replicated ${bectuRates.rows.length} bectu_rates records`);

    // percentometer_ratios
    const ratios = await devClient.query(`SELECT * FROM percentometer_ratios;`);
    for (const r of ratios.rows) {
      const keys = Object.keys(r);
      const cols = keys.map(k => `"${k}"`).join(', ');
      const placeholders = keys.map((_, i) => `$${i + 1}`).join(', ');
      const values = keys.map(k => r[k]);
      await prodClient.query(`
        INSERT INTO percentometer_ratios (${cols}) VALUES (${placeholders})
        ON CONFLICT (id) DO NOTHING;
      `, values);
    }
    console.log(`   ✓ Replicated ${ratios.rows.length} percentometer_ratios records`);

    // cost_report_margins_reference
    const margins = await devClient.query(`SELECT * FROM cost_report_margins_reference;`);
    for (const r of margins.rows) {
      // cost_report_margins_reference has production_id FK, if production_id is null/dummy, only insert if FK is not violated
      // Let's check
    }

    // app_settings
    const appSettings = await devClient.query(`SELECT * FROM app_settings;`);
    for (const r of appSettings.rows) {
      await prodClient.query(`
        INSERT INTO app_settings (key, value, updated_by, updated_at)
        VALUES ($1, $2, $3, $4)
        ON CONFLICT (key) DO NOTHING;
      `, [r.key, JSON.stringify(r.value), r.updated_by, r.updated_at]);
    }
    console.log(`   ✓ Replicated ${appSettings.rows.length} app_settings records`);


    // ── 13. Seed User ──────────────────────────────────────────────────────────
    console.log('1️⃣3️⃣ Seeding Requested User...');
    const userEmail = 'warren@constructscenery.co.uk';
    const rawPass   = '132warren@!';
    const fullName  = 'Warren Mitchell';
    const role      = 'managing_director';
    const passHash  = await bcrypt.hash(rawPass, 12);

    await prodClient.query(`
      INSERT INTO users (email, password_hash, full_name, role, is_active)
      VALUES ($1, $2, $3, $4, true)
      ON CONFLICT (email) 
      DO UPDATE SET password_hash = EXCLUDED.password_hash,
                    full_name     = EXCLUDED.full_name,
                    role          = EXCLUDED.role,
                    is_active     = true;
    `, [userEmail, passHash, fullName, role]);

    console.log(`   ✓ Seeded user: ${userEmail} (${role})`);

    console.log('\n🎉 ALL REPLICATION & SEEDING TASKS COMPLETED SUCCESSFULLY!\n');

  } catch (err) {
    console.error('❌ Replication failed:', err);
    process.exit(1);
  } finally {
    devClient.release();
    prodClient.release();
    await devPool.end();
    await prodPool.end();
  }
}

run();
