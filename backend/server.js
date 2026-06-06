require('dotenv').config();
const express = require('express');
const cors    = require('cors');
const path    = require('path');

const { authenticate } = require('./Middleware/auth');
const { checkPolicy  } = require('./Middleware/roleCheck');

const app = express();

// ─── CORS + BODY PARSER ───────────────────────────────────────────────────────
const allowedOrigins = process.env.CLIENT_URL
  ? process.env.CLIENT_URL.split(',').map((s) => s.trim())
  : null; // null = allow all localhost in dev

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (Postman, server-to-server)
    if (!origin) return callback(null, true);
    // In production CLIENT_URL must be set; in dev accept any localhost
    if (allowedOrigins) {
      return callback(
        allowedOrigins.includes(origin) ? null : new Error('Not allowed by CORS'),
        allowedOrigins.includes(origin)
      );
    }
    // Dev: allow any localhost or 127.0.0.1 origin
    if (/^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)) {
      return callback(null, true);
    }
    return callback(new Error('Not allowed by CORS'), false);
  },
  credentials: true,
}));
app.use(express.json({ limit: '25mb' }));
app.use(express.urlencoded({ extended: true, limit: '25mb' }));

// ─── REQUEST LOGGER ───────────────────────────────────────────────────────────
app.use((req, res, next) => {
  console.log(`[${new Date().toISOString()}] ${req.method} ${req.originalUrl}`);
  next();
});

// ─── STATIC FILE SERVING — uploaded documents ────────────────────────────────
// Serves files from backend/uploads/ at GET /uploads/<filename>
// Replace with cloud storage URL when moving off local disk
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));

// ─── HEALTH CHECK (public) ────────────────────────────────────────────────────
app.get('/', (req, res) => {
  res.json({
    name:    'Deepsian API',
    version: '1.0.0',
    status:  'running',
    modules: [
      'Auth                        → /api/auth',
      'Module 1: Purchase Orders   → /api/purchase-orders',
      'Module 2: Crew Database     → /api/crew',
      'Module 3: Timesheets        → /api/timesheets',
      'Module 3: Pay Runs          → /api/pay-runs',
      'Module 4: Cost Reports      → /api/cost-reports',
      'Module 5: Forecasting       → /api/forecasting',
      'Module 6: Dashboard         → /api/dashboard',
      'Module 7: Productions       → /api/productions',
    ],
  });
});

// ─── AUTH ROUTES (public — signup / login / refresh bypass global middleware) ─
// logout + /me handle their own authenticate internally
app.use('/api/auth', require('./routes/auth'));

// ─── GLOBAL MIDDLEWARE (applied to every route BELOW this line) ───────────────
// 1. Verify JWT access token → populates req.user
// 2. Policy check via policies.json → enforces RBAC per role
app.use(authenticate);
app.use(checkPolicy);

// ─── PROTECTED MODULE ROUTES ─────────────────────────────────────────────────
app.use('/api/productions',    require('./routes/productions'));
app.use('/api/purchase-orders', require('./routes/purchaseOrders'));
app.use('/api/crew',           require('./routes/crew'));
app.use('/api/timesheets',     require('./routes/timesheets'));
app.use('/api/pay-runs',       require('./routes/payRuns'));
app.use('/api/cost-reports',   require('./routes/costReports'));
app.use('/api/forecasting',    require('./routes/forecasting'));
app.use('/api/dashboard',      require('./routes/dashboard'));
app.use('/api/crew-rates',     require('./routes/crewRates'));

// ─── 404 ──────────────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ error: `Route not found: ${req.method} ${req.originalUrl}` });
});

// ─── GLOBAL ERROR HANDLER ─────────────────────────────────────────────────────
app.use((err, req, res, next) => {
  // Multer file type / size errors
  if (err.code === 'LIMIT_FILE_SIZE') {
    return res.status(400).json({ error: 'File too large. Maximum size is 20 MB.' });
  }
  if (err.message?.includes('not allowed')) {
    return res.status(400).json({ error: err.message });
  }
  console.error('Unhandled error:', err);
  res.status(500).json({ error: 'Internal server error' });
});

// ─── START ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
app.listen(PORT, () => {
  console.log(`
╔══════════════════════════════════════╗
║       Deepsian API — Running          ║
║  Port  : ${PORT}                          ║
║  Auth  : JWT (bcrypt + pg)           ║
║  Policy: OPA-style policies.json     ║
╚══════════════════════════════════════╝
  `);
});
