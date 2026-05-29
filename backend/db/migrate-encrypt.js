/**
 * One-time script to encrypt existing plaintext sensitive data in crew_members
 * and pay_run_items.
 *
 * Run ONCE after adding ENCRYPTION_KEY to .env:
 *   node db/migrate-encrypt.js
 *
 * Safe to re-run — the decrypt() fallback returns ciphertext unchanged,
 * so already-encrypted rows are skipped gracefully.
 */

require('dotenv').config();
const db = require('../config/db');
const { encrypt, decrypt } = require('../config/crypto');

const CREW_SENSITIVE = ['home_address', 'account_name', 'account_number', 'sort_code', 'emergency_contact_phone'];
const PAY_SENSITIVE  = ['sort_code', 'account_number', 'account_name'];

function isAlreadyEncrypted(value) {
  if (!value) return true;
  try {
    const buf = Buffer.from(value, 'base64');
    // Encrypted values are at least IV(12) + AuthTag(16) + 1 byte = 29 bytes
    return buf.length >= 29 && buf.length > value.length * 0.6;
  } catch {
    return false;
  }
}

async function encryptTable(tableName, fields) {
  console.log(`\n=== Encrypting ${tableName} ===`);
  const { rows } = await db.query(`SELECT id, ${fields.join(', ')} FROM ${tableName}`);

  let updated = 0;
  for (const row of rows) {
    const needsUpdate = fields.some(f => row[f] && !isAlreadyEncrypted(row[f]));
    if (!needsUpdate) continue;

    const setClauses = [];
    const values     = [];
    let   idx        = 1;

    for (const field of fields) {
      if (row[field] && !isAlreadyEncrypted(row[field])) {
        setClauses.push(`${field} = $${idx++}`);
        values.push(encrypt(row[field]));
      }
    }

    if (setClauses.length) {
      values.push(row.id);
      await db.query(
        `UPDATE ${tableName} SET ${setClauses.join(', ')} WHERE id = $${idx}`,
        values
      );
      updated++;
    }
  }

  console.log(`  ${updated} / ${rows.length} rows encrypted`);
}

async function main() {
  console.log('Starting sensitive data encryption migration...');
  console.log('Using ENCRYPTION_KEY:', process.env.ENCRYPTION_KEY ? '(set)' : '(NOT SET — aborting)');

  if (!process.env.ENCRYPTION_KEY || process.env.ENCRYPTION_KEY === '0'.repeat(64)) {
    console.error('\nERROR: ENCRYPTION_KEY is not set or is the placeholder value.');
    console.error('Generate a real key with:');
    console.error('  node -e "console.log(require(\'crypto\').randomBytes(32).toString(\'hex\'))"');
    process.exit(1);
  }

  try {
    await encryptTable('crew_members', CREW_SENSITIVE);
    await encryptTable('pay_run_items', PAY_SENSITIVE);
    console.log('\nEncryption migration complete.');
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  } finally {
    await db.end();
  }
}

main();
