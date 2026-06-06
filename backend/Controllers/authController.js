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

// ─── POST /api/auth/forgot-password ───────────────────────────────────────────
const forgotPassword = async (req, res) => {
  const { email } = req.body;
  if (!email) return res.status(400).json({ error: 'email is required' });

  const normalised = email.toLowerCase().trim();

  try {
    const { rows } = await db.query(
      'SELECT id FROM users WHERE email = $1',
      [normalised]
    );

    // Always return success to prevent user-enumeration
    if (!rows.length) {
      return res.json({ message: 'If that email is registered, an OTP has been sent.' });
    }

    const otp       = Math.floor(100000 + Math.random() * 900000).toString();
    const expiresAt = new Date(Date.now() + 15 * 60 * 1000); // 15 min

    await db.query('DELETE FROM password_reset_otps WHERE email = $1', [normalised]);
    await db.query(
      'INSERT INTO password_reset_otps (email, otp, expires_at) VALUES ($1, $2, $3)',
      [normalised, otp, expiresAt]
    );

    const { sendEmail } = require('../config/email');
    await sendEmail({
      to: email,
      subject: 'Deepsian — Password Reset OTP',
      html: `
        <div style="font-family:Arial,sans-serif;max-width:480px;margin:0 auto;padding:24px">
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:24px">
            <div style="background:#0f172a;padding:6px 12px;border-radius:6px;display:inline-block">
              <span style="color:#fff;font-size:13px;font-weight:900;letter-spacing:2px">DEEPSIAN</span>
            </div>
          </div>
          <h2 style="color:#0f172a;font-size:20px;margin:0 0 8px">Password Reset Request</h2>
          <p style="color:#475569;font-size:14px;margin:0 0 24px">Use the code below to reset your Deepsian password. This code expires in <strong>15 minutes</strong>.</p>
          <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:12px;padding:24px;text-align:center;margin-bottom:24px">
            <p style="color:#64748b;font-size:12px;text-transform:uppercase;letter-spacing:2px;margin:0 0 8px">Your OTP</p>
            <p style="font-size:40px;font-weight:700;letter-spacing:12px;color:#0f172a;margin:0">${otp}</p>
          </div>
          <p style="color:#94a3b8;font-size:12px;margin:0">If you did not request this reset, you can safely ignore this email. Your password will not be changed.</p>
          <hr style="border:none;border-top:1px solid #e2e8f0;margin:24px 0"/>
          <p style="color:#94a3b8;font-size:11px;margin:0">Construct Scenery Limited · info@constructscenery.co.uk</p>
        </div>
      `,
    });

    res.json({ message: 'If that email is registered, an OTP has been sent.' });
  } catch (err) {
    console.error('forgotPassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── POST /api/auth/verify-otp ─────────────────────────────────────────────────
const verifyOtp = async (req, res) => {
  const { email, otp } = req.body;
  if (!email || !otp) return res.status(400).json({ error: 'email and otp are required' });

  try {
    const { rows } = await db.query(
      `SELECT id FROM password_reset_otps
       WHERE  email = $1
         AND  otp   = $2
         AND  expires_at > NOW()`,
      [email.toLowerCase().trim(), otp]
    );

    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired OTP' });

    res.json({ message: 'OTP verified' });
  } catch (err) {
    console.error('verifyOtp error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

// ─── POST /api/auth/reset-password ────────────────────────────────────────────
const resetPassword = async (req, res) => {
  const { email, otp, new_password } = req.body;
  if (!email || !otp || !new_password)
    return res.status(400).json({ error: 'email, otp, and new_password are required' });

  if (new_password.length < 8)
    return res.status(400).json({ error: 'Password must be at least 8 characters' });

  const normalised = email.toLowerCase().trim();

  try {
    const { rows } = await db.query(
      `SELECT id FROM password_reset_otps
       WHERE  email = $1
         AND  otp   = $2
         AND  expires_at > NOW()`,
      [normalised, otp]
    );

    if (!rows.length) return res.status(400).json({ error: 'Invalid or expired OTP' });

    const password_hash = await bcrypt.hash(new_password, 12);

    await db.query('UPDATE users SET password_hash = $1 WHERE email = $2', [password_hash, normalised]);
    await db.query('DELETE FROM password_reset_otps WHERE email = $1', [normalised]);
    // Invalidate all refresh tokens for this user on password change
    await db.query(
      'DELETE FROM refresh_tokens WHERE user_id = (SELECT id FROM users WHERE email = $1)',
      [normalised]
    );

    res.json({ message: 'Password reset successfully' });
  } catch (err) {
    console.error('resetPassword error:', err);
    res.status(500).json({ error: 'Server error' });
  }
};

module.exports = { signup, login, logout, getMe, refreshToken, forgotPassword, verifyOtp, resetPassword };
