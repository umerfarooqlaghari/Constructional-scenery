const bcrypt = require('bcryptjs');
const db = require('../config/db');
const {
  signAccessToken,
  generateRefreshToken,
  refreshExpiresAt,
} = require('../config/jwt');

const VALID_ROLES = [
  'managing_director',
  'construction_accountant',
  'construction_coordinator',
];

// ─── POST /api/auth/signup ─────────────────────────────────────────────────────
const signup = async (req, res) => {
  const { email, password, full_name, role } = req.body;

  if (!email || !password || !full_name || !role)
    return res.status(400).json({ error: 'email, password, full_name, and role are required' });

  if (!VALID_ROLES.includes(role))
    return res.status(400).json({ error: `role must be one of: ${VALID_ROLES.join(', ')}` });

  try {
    const { rows: existing } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    if (existing.length) return res.status(400).json({ error: 'Email already registered' });

    const password_hash = await bcrypt.hash(password, 12);
    const { rows } = await db.query(
      `INSERT INTO users (email, password_hash, full_name, role)
       VALUES ($1, $2, $3, $4)
       RETURNING id, email, full_name, role, created_at`,
      [email.toLowerCase().trim(), password_hash, full_name, role]
    );

    res.status(201).json({ message: 'User created successfully', user: rows[0] });
  } catch (err) {
    console.error('signup error:', err);
    res.status(500).json({ error: 'Server error during signup' });
  }
};

// ─── POST /api/auth/login ──────────────────────────────────────────────────────
const login = async (req, res) => {
  const { email, password } = req.body;
  if (!email || !password)
    return res.status(400).json({ error: 'email and password are required' });

  try {
    const { rows } = await db.query(
      'SELECT id, email, password_hash, full_name, role FROM users WHERE email = $1',
      [email.toLowerCase().trim()]
    );
    const user = rows[0];

    // Same generic error for both "not found" and "wrong password" (security: no user enumeration)
    if (!user) return res.status(401).json({ error: 'Invalid email or password' });

    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Invalid email or password' });

    const access_token   = signAccessToken(user);
    const refresh_token  = generateRefreshToken();
    const expires_at     = refreshExpiresAt();

    await db.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [refresh_token, user.id, expires_at]
    );

    res.json({
      access_token,
      refresh_token,
      expires_in: 3600,
      user: { id: user.id, email: user.email, full_name: user.full_name, role: user.role },
    });
  } catch (err) {
    console.error('login error:', err);
    res.status(500).json({ error: 'Server error during login' });
  }
};

// ─── POST /api/auth/logout ─────────────────────────────────────────────────────
// Requires authenticate middleware — revokes the supplied refresh token
const logout = async (req, res) => {
  const { refresh_token } = req.body;
  try {
    if (refresh_token) {
      await db.query(
        'DELETE FROM refresh_tokens WHERE token = $1 AND user_id = $2',
        [refresh_token, req.user.id]
      );
    }
    res.json({ message: 'Logged out successfully' });
  } catch (err) {
    console.error('logout error:', err);
    res.status(500).json({ error: 'Server error during logout' });
  }
};

// ─── GET /api/auth/me ──────────────────────────────────────────────────────────
// Returns the authenticated user's identity from the JWT payload (no DB hit)
const getMe = (req, res) => {
  const { id, email, role, full_name } = req.user;
  res.json({ user: { id, email, role, full_name } });
};

// ─── POST /api/auth/refresh ────────────────────────────────────────────────────
// Token rotation: validates refresh token, issues new access + refresh tokens,
// deletes the old refresh token (one-time use)
const refreshToken = async (req, res) => {
  const { refresh_token } = req.body;
  if (!refresh_token)
    return res.status(400).json({ error: 'refresh_token is required' });

  try {
    const { rows } = await db.query(
      `SELECT rt.token, rt.user_id,
              u.id, u.email, u.full_name, u.role
       FROM   refresh_tokens rt
       JOIN   users u ON u.id = rt.user_id
       WHERE  rt.token = $1
         AND  rt.expires_at > NOW()`,
      [refresh_token]
    );

    const record = rows[0];
    if (!record) return res.status(401).json({ error: 'Invalid or expired refresh token' });

    // Rotate — delete old token first
    await db.query('DELETE FROM refresh_tokens WHERE token = $1', [refresh_token]);

    const user = { id: record.id, email: record.email, full_name: record.full_name, role: record.role };
    const new_access_token  = signAccessToken(user);
    const new_refresh_token = generateRefreshToken();
    const new_expires_at    = refreshExpiresAt();

    await db.query(
      'INSERT INTO refresh_tokens (token, user_id, expires_at) VALUES ($1, $2, $3)',
      [new_refresh_token, record.id, new_expires_at]
    );

    res.json({
      access_token:  new_access_token,
      refresh_token: new_refresh_token,
      expires_in:    3600,
    });
  } catch (err) {
    console.error('refreshToken error:', err);
    res.status(500).json({ error: 'Server error during token refresh' });
  }
};

module.exports = { signup, login, logout, getMe, refreshToken };
