const jwt  = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');

const SECRET           = process.env.JWT_SECRET;
const ACCESS_EXPIRY    = process.env.JWT_ACCESS_EXPIRY || '1h';
const REFRESH_DAYS     = parseInt(process.env.JWT_REFRESH_EXPIRY_DAYS || '7');
const REFRESH_EXPIRY_MS = REFRESH_DAYS * 24 * 60 * 60 * 1000;

/**
 * Sign an access token — payload contains id, email, role, full_name
 * Expires in 1 hour (configurable via JWT_ACCESS_EXPIRY)
 */
const signAccessToken = (user) =>
  jwt.sign(
    { id: user.id, email: user.email, role: user.role, full_name: user.full_name },
    SECRET,
    { expiresIn: ACCESS_EXPIRY }
  );

/**
 * Verify an access token — throws if invalid or expired
 */
const verifyAccessToken = (token) => jwt.verify(token, SECRET);

/**
 * Generate a random opaque refresh token (UUID v4)
 * Stored in the refresh_tokens table in the DB
 */
const generateRefreshToken = () => uuidv4();

/**
 * Returns a Date object representing when the refresh token expires
 */
const refreshExpiresAt = () => new Date(Date.now() + REFRESH_EXPIRY_MS);

module.exports = { signAccessToken, verifyAccessToken, generateRefreshToken, refreshExpiresAt };
