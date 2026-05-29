const policies = require('../config/policies.json');

/**
 * Converts a policy route pattern like "/api/crew/:id/documents/:docId"
 * into a regex that matches actual request paths.
 * e.g.  /api/crew/uuid-here/documents/uuid-here  → match
 */
const buildRouteRegex = (routePath) => {
  const escaped = routePath
    .replace(/\//g, '\\/')             // escape forward slashes
    .replace(/:[^/]+/g, '[^/]+');      // :param  →  [^/]+  (one path segment)
  return new RegExp(`^${escaped}$`);
};

/**
 * Global policy-enforcement middleware (OPA-style).
 *
 * Reads policies.json:
 *   managing_director       → routes: ["*"]     (full access)
 *   construction_accountant → routes: [array of "METHOD /api/path"]
 *   construction_coordinator→ routes: [array of "METHOD /api/path"]
 *
 * Must run AFTER authenticate so req.user is populated.
 */
const checkPolicy = (req, res, next) => {
  const role = req.user?.role;
  if (!role) {
    return res.status(403).json({ error: 'No role found in token' });
  }

  const policy = policies[role];
  if (!policy) {
    return res.status(403).json({ error: `Unknown role: ${role}` });
  }

  // Managing Director — wildcard, no further checks needed
  if (policy.routes.includes('*')) return next();

  // Strip query string from the URL — we only match on path
  const fullPath = req.originalUrl.split('?')[0];

  const allowed = policy.routes.some(route => {
    const spaceIdx  = route.indexOf(' ');
    const method    = route.substring(0, spaceIdx);
    const routePath = route.substring(spaceIdx + 1);

    if (method !== req.method) return false;

    return buildRouteRegex(routePath).test(fullPath);
  });

  if (!allowed) {
    return res.status(403).json({
      error: `Access denied. Your role (${role}) is not permitted to ${req.method} ${fullPath}`,
    });
  }

  next();
};

module.exports = { checkPolicy };
