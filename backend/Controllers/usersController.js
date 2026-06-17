const bcrypt = require('bcryptjs');
const db = require('../config/db');

const VALID_ROLES = [
  'managing_director',
  'construction_accountant',
  'construction_coordinator',
];

// ─── GET /api/users — list all accounts (MD only) ─────────────────────────────
const listUsers = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, email, full_name, role, is_active, created_at, updated_at
       FROM users
       ORDER BY full_name`
    );
    res.json(rows);
  } catch (err) {
    console.error('listUsers:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/users — create a new account (MD only) ─────────────────────────
const createUser = async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!email || !password || !full_name || !role)
    return res.status(400).json({ error: 'email, password, full_name, and role are required' });

  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

  if (password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.length) return res.status(409).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, is_active, created_at`,
      [email.toLowerCase().trim(), password_hash, full_name, role]
    );

    res.status(201).json({ message: 'User account created', user: rows[0] });
  } catch (err) {
    console.error('createUser:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PATCH /api/users/:id — update role / name / active status (MD only) ──────
const updateUser = async (req, res) => {
  const { full_name, role, is_active } = req.body;

  if (role !== undefined && !VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

  if (full_name === undefined && role === undefined && is_active === undefined)
    return res.status(400).json({ error: 'No updatable fields provided' });

  // Prevent Warren from locking himself out by deactivating/demoting his own only-MD account
  if (req.user.id === req.params.id && (role !== undefined && role !== 'managing_director'))
    return res.status(400).json({ error: 'You cannot change your own role away from Managing Director' });
  if (req.user.id === req.params.id && is_active === false)
    return res.status(400).json({ error: 'You cannot deactivate your own account' });

  try {
    const { rows: [existing] } = await db.query('SELECT id FROM users WHERE id = $1', [req.params.id]);
    if (!existing) return res.status(404).json({ error: 'User not found' });

    const fields = [];
    const params = [];
    let i = 1;
    if (full_name !== undefined) { fields.push(`full_name = $${i++}`); params.push(full_name); }
    if (role      !== undefined) { fields.push(`role = $${i++}`);      params.push(role); }
    if (is_active !== undefined) { fields.push(`is_active = $${i++}`); params.push(is_active); }
    fields.push(`updated_at = NOW()`);
    params.push(req.params.id);

    const { rows: [updated] } = await db.query(
      `UPDATE users SET ${fields.join(', ')} WHERE id = $${i} RETURNING id, email, full_name, role, is_active, created_at, updated_at`,
      params
    );
    res.json({ message: 'User updated', user: updated });
  } catch (err) {
    console.error('updateUser:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { listUsers, createUser, updateUser };
