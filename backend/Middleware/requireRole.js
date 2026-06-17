/**
 * Per-route role gate. Use alongside the global checkPolicy middleware
 * (policies.json) as an explicit, readable annotation on routes where the
 * exact allowed role(s) matter and should be obvious from the route file
 * itself — not just buried in the policy JSON.
 *
 * Must run after `authenticate` (req.user must already be populated).
 *
 * Usage:
 *   router.post('/', requireRole('construction_coordinator'), createPO);
 *   router.post('/:id/approve', requireRole('construction_accountant'), approvePO);
 *
 * Status codes:
 *   401 — no authenticated user at all (token missing/invalid upstream)
 *   403 — authenticated, but role is not one of the allowed roles
 */
const requireRole = (...roles) => (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({ error: 'Authentication required' });
  }

  if (!roles.includes(req.user.role)) {
    return res.status(403).json({
      error: `Access denied. This action requires role: ${roles.join(' or ')}. Your role: ${req.user.role}`,
    });
  }

  next();
};

module.exports = { requireRole };
