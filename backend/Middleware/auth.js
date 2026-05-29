const { verifyAccessToken } = require('../config/jwt');

/**
 * Verifies the JWT access token from the Authorization: Bearer header.
 * Attaches req.user = { id, email, role, full_name } from the token payload.
 * No DB lookup required — all identity data lives in the token.
 */
const authenticate = (req, res, next) => {
  const authHeader = req.headers.authorization;

  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing or invalid authorization header' });
  }

  const token = authHeader.split(' ')[1];

  try {
    const payload = verifyAccessToken(token);
    req.user = payload; // { id, email, role, full_name, iat, exp }
    next();
  } catch (err) {
    return res.status(401).json({ error: 'Invalid or expired token' });
  }
};

module.exports = { authenticate };
