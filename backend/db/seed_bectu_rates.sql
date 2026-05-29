-- ============================================================
-- CS HQ — BECTU 2026/27 Rate Card
-- Fill in daily_rate and overtime_rate from your rate card
-- then paste the whole thing into Render SQL Console
--
-- HOW TO ACCESS RENDER SQL CONSOLE:
--   1. Go to https://dashboard.render.com
--   2. Click on your PostgreSQL database (cshq_db_dev)
--   3. Click the "Connect" button (top right)
--   4. Click "PSQL Command" — OR — scroll down to find "SQL Console" tab
--   5. Copy-paste this entire file and click Run
-- ============================================================

-- ─── QUICK CHECK — see current rates before updating ─────────────────────────
-- Run this first to confirm all rows exist and are currently 0:
-- SELECT trade, rank, daily_rate, overtime_rate FROM bectu_rates ORDER BY trade, rank;


-- ─── SINGLE BULK UPDATE (most efficient — one query) ─────────────────────────
-- Replace each 0.00 pair with: daily_rate, overtime_rate from your 2026/27 card
-- Format: daily rate is the standard BECTU daily rate (£)
--         overtime rate is the per-hour overtime rate (£/hr)

-- ⚠️  DEMO RATES — Replace with actual 2026/27 Pact/BECTU rate card figures
--     when available. OT rate = daily ÷ 10 × 1.5 (time-and-a-half per hour).

UPDATE bectu_rates AS b
SET
  daily_rate    = v.daily_rate,
  overtime_rate = v.overtime_rate
FROM (VALUES
  -- ── Carpenters ──────────────────────────────────────────────────
  ('Carpenters',        'HOD',                 425.00,  63.75),
  ('Carpenters',        'Supervisor',          375.00,  56.25),
  ('Carpenters',        'Chargehand',          350.00,  52.50),
  ('Carpenters',        'Carpenter',           320.00,  48.00),

  -- ── Machinists ──────────────────────────────────────────────────
  ('Machinists',        'HOD',                 425.00,  63.75),
  ('Machinists',        'Supervisor',          375.00,  56.25),
  ('Machinists',        'Chargehand',          350.00,  52.50),
  ('Machinists',        'Machinist',           320.00,  48.00),

  -- ── Stagehands ──────────────────────────────────────────────────
  ('Stagehands',        'HOD',                 390.00,  58.50),
  ('Stagehands',        'Supervisor',          345.00,  51.75),
  ('Stagehands',        'Chargehand',          320.00,  48.00),
  ('Stagehands',        'Stagehand NVQ/BLSS',  298.00,  44.70),
  ('Stagehands',        'Stagehand',           280.00,  42.00),

  -- ── Riggers ─────────────────────────────────────────────────────
  ('Riggers',           'HOD',                 430.00,  64.50),
  ('Riggers',           'Supervisor',          380.00,  57.00),
  ('Riggers',           'Chargehand',          355.00,  53.25),
  ('Riggers',           'Rigger',              328.00,  49.20),

  -- ── Plasterers ──────────────────────────────────────────────────
  ('Plasterers',        'HOD',                 390.00,  58.50),
  ('Plasterers',        'Supervisor',          345.00,  51.75),
  ('Plasterers',        'Chargehand',          320.00,  48.00),
  ('Plasterers',        'Plasterer',           295.00,  44.25),

  -- ── Scenic Painters ─────────────────────────────────────────────
  ('Scenic Painters',   'HOD',                 420.00,  63.00),
  ('Scenic Painters',   'Supervisor',          370.00,  55.50),
  ('Scenic Painters',   'Chargehand',          345.00,  51.75),
  ('Scenic Painters',   'Painter',             312.00,  46.80),

  -- ── Sculptors ───────────────────────────────────────────────────
  ('Sculptors',         'HOD',                 425.00,  63.75),
  ('Sculptors',         'Supervisor',          375.00,  56.25),
  ('Sculptors',         'Chargehand',          348.00,  52.20),
  ('Sculptors',         'Sculptor',            322.00,  48.30),
  ('Sculptors',         'Sculptor Modeller',   305.00,  45.75),

  -- ── Metal Workers ───────────────────────────────────────────────
  ('Metal Workers',     'HOD',                 428.00,  64.20),
  ('Metal Workers',     'Supervisor',          378.00,  56.70),
  ('Metal Workers',     'Chargehand',          352.00,  52.80),
  ('Metal Workers',     'Metal Worker',        326.00,  48.90),

  -- ── Plasterers Lab ──────────────────────────────────────────────
  ('Plasterers Lab',    'HOD',                 385.00,  57.75),
  ('Plasterers Lab',    'Supervisor',          338.00,  50.70),
  ('Plasterers Lab',    'Chargehand',          315.00,  47.25),
  ('Plasterers Lab',    'Lab Worker',          285.00,  42.75),

  -- ── Painters Lab ────────────────────────────────────────────────
  ('Painters Lab',      'HOD',                 385.00,  57.75),
  ('Painters Lab',      'Supervisor',          338.00,  50.70),
  ('Painters Lab',      'Chargehand',          315.00,  47.25),
  ('Painters Lab',      'Lab Worker',          285.00,  42.75),

  -- ── Sculptors Lab ───────────────────────────────────────────────
  ('Sculptors Lab',     'HOD',                 385.00,  57.75),
  ('Sculptors Lab',     'Supervisor',          338.00,  50.70),
  ('Sculptors Lab',     'Chargehand',          315.00,  47.25),
  ('Sculptors Lab',     'Lab Worker',          285.00,  42.75),

  -- ── Metal Workers Lab ───────────────────────────────────────────
  ('Metal Workers Lab', 'HOD',                 388.00,  58.20),
  ('Metal Workers Lab', 'Supervisor',          340.00,  51.00),
  ('Metal Workers Lab', 'Chargehand',          316.00,  47.40),
  ('Metal Workers Lab', 'Lab Worker',          288.00,  43.20),

  -- ── Non-BECTU (directly agreed with Warren) ─────────────────────
  ('Non-BECTU',         'Construction Accountant',  480.00,  72.00),
  ('Non-BECTU',         'Construction Coordinator', 420.00,  63.00),
  ('Non-BECTU',         'Construction Manager',     550.00,  82.50),
  ('Non-BECTU',         'Luton Driver',             255.00,  38.25)

) AS v(trade, rank, daily_rate, overtime_rate)
WHERE b.trade     = v.trade
  AND b.rank      = v.rank
  AND b.rate_year = '2026/27';


-- ─── VERIFY AFTER RUNNING ────────────────────────────────────────────────────
-- Run this to confirm all rates updated correctly:
SELECT trade, rank, daily_rate, overtime_rate
FROM   bectu_rates
WHERE  rate_year = '2026/27'
ORDER  BY trade, rank;
