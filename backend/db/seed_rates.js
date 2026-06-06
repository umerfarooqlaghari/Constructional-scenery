/**
 * Seed BECTU 2026/27 rates from seed_bectu_rates.sql
 * Run: node db/seed_rates.js
 *
 * Fill in the rates in seed_bectu_rates.sql first, then run this script.
 */

require('dotenv').config({ path: require('path').join(__dirname, '../.env') });
const fs   = require('fs');
const path = require('path');
const { Pool } = require('pg');

const connStr = process.env.DATABASE_URL.replace(/[?&]sslmode=[^&]*/g, '');

const pool = new Pool({
  connectionString: connStr,
  ssl: { rejectUnauthorized: false },
  max: 1,
});

async function seedRates() {
  const client = await pool.connect();
  console.log('\n╔══════════════════════════════════════════╗');
  console.log('║     Deepsian — BECTU Rate Card Seeder    ║');
  console.log('╚══════════════════════════════════════════╝\n');

  try {
    const sql = fs.readFileSync(path.join(__dirname, 'seed_bectu_rates.sql'), 'utf8');

    // Extract only the UPDATE statement (skip comments and the SELECT at the end)
    // Run the whole file — PostgreSQL handles comments fine
    console.log('⏳ Running seed_bectu_rates.sql...\n');
    await client.query(sql);

    // Show results
    const { rows } = await client.query(`
      SELECT trade, rank, daily_rate, overtime_rate
      FROM   bectu_rates
      WHERE  rate_year = '2026/27'
      ORDER  BY trade, rank
    `);

    console.log('✅ Updated rates:\n');
    console.log(
      'Trade'.padEnd(22) +
      'Rank'.padEnd(26) +
      'Daily (£)'.padEnd(12) +
      'OT/hr (£)'
    );
    console.log('─'.repeat(72));

    for (const r of rows) {
      const daily = Number(r.daily_rate).toFixed(2).padStart(8);
      const ot    = Number(r.overtime_rate).toFixed(2).padStart(8);
      console.log(
        r.trade.padEnd(22) +
        r.rank.padEnd(26) +
        `£${daily}  `.padEnd(12) +
        `£${ot}`
      );
    }

    const zeros = rows.filter(r => Number(r.daily_rate) === 0).length;
    console.log('\n──────────────────────────────────────────────');
    if (zeros > 0) {
      console.log(`⚠️  ${zeros} rows still have daily_rate = £0`);
      console.log('   Fill them in seed_bectu_rates.sql and re-run.');
    } else {
      console.log('🎉 All rates filled in — ready to go!');
    }
    console.log('──────────────────────────────────────────────\n');

  } catch (err) {
    console.error('\n❌ Seeder failed:', err.message);
    process.exit(1);
  } finally {
    client.release();
    await pool.end();
  }
}

seedRates();
