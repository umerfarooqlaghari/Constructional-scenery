const db = require('../config/db');

const getWeekStart = () => {
  const d    = new Date();
  const diff = d.getDay() === 0 ? -6 : 1 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

const getWeekEnd = () => {
  const d    = new Date();
  const diff = d.getDay() === 0 ? 0 : 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return d.toISOString().split('T')[0];
};

// ─── Sub-aggregators ──────────────────────────────────────────────────────────

const getPOSpend = async (today, weekStart, weekEnd) => {
  const [{ rows: todayPOs }, { rows: weekPOs }] = await Promise.all([
    db.query(
      `SELECT po.gross_amount, po.production_id, p.name AS prod_name
       FROM purchase_orders po
       JOIN productions p ON po.production_id = p.id
       WHERE po.status = 'approved' AND po.date_of_po = $1`,
      [today]
    ),
    db.query(
      `SELECT po.gross_amount, po.production_id, p.name AS prod_name
       FROM purchase_orders po
       JOIN productions p ON po.production_id = p.id
       WHERE po.status = 'approved' AND po.date_of_po BETWEEN $1 AND $2`,
      [weekStart, weekEnd]
    ),
  ]);

  const byProd = {};
  weekPOs.forEach(po => {
    const name = po.prod_name || 'Unknown';
    byProd[name] = (byProd[name] || 0) + parseFloat(po.gross_amount || 0);
  });

  return {
    today_total:   todayPOs.reduce((s, po) => s + parseFloat(po.gross_amount || 0), 0),
    week_total:    weekPOs.reduce((s, po) => s + parseFloat(po.gross_amount || 0), 0),
    by_production: Object.entries(byProd).map(([production, total]) => ({ production, total })),
  };
};

const getCurrentWeekLabour = async (weekEnd) => {
  const { rows } = await db.query(
    `SELECT t.grand_total, t.status, p.name AS prod_name
     FROM timesheets t
     JOIN productions p ON t.production_id = p.id
     WHERE t.week_ending_date = $1`,
    [weekEnd]
  );

  const byProd = {};
  rows.forEach(ts => {
    const name = ts.prod_name || 'Unknown';
    if (!byProd[name]) byProd[name] = { production: name, total: 0, pending: 0, approved: 0 };
    const amt = parseFloat(ts.grand_total || 0);
    byProd[name].total += amt;
    if (ts.status === 'verified') byProd[name].approved += amt;
    else                          byProd[name].pending  += amt;
  });

  return {
    week_ending:   weekEnd,
    total:         rows.reduce((s, ts) => s + parseFloat(ts.grand_total || 0), 0),
    by_production: Object.values(byProd),
  };
};

const getActiveProductionsSummary = async () => {
  const { rows: productions } = await db.query(
    `SELECT id, name, contract_type, start_date, end_date, status
     FROM productions
     WHERE status IN ('pre_production', 'active_build', 'strike')`
  );
  if (!productions.length) return [];

  return Promise.all(productions.map(async prod => {
    const [{ rows: pos }, { rows: timesheets }, { rows: [budget] }] = await Promise.all([
      db.query(
        `SELECT net_amount FROM purchase_orders WHERE production_id = $1 AND status = 'approved'`,
        [prod.id]
      ),
      db.query(
        `SELECT grand_total FROM timesheets WHERE production_id = $1 AND status = 'verified'`,
        [prod.id]
      ),
      db.query(
        `SELECT total_budget FROM cost_plus_budgets WHERE production_id = $1`,
        [prod.id]
      ),
    ]);

    const totalCosts      = [
      ...pos.map(p => parseFloat(p.net_amount || 0)),
      ...timesheets.map(t => parseFloat(t.grand_total || 0)),
    ].reduce((s, v) => s + v, 0);
    const totalBudget     = budget?.total_budget ? parseFloat(budget.total_budget) : null;
    const amountRemaining = totalBudget ? totalBudget - totalCosts : null;
    const pctRemaining    = totalBudget ? (amountRemaining / totalBudget) * 100 : null;

    let rag_status = 'unknown';
    if (pctRemaining !== null) {
      if      (pctRemaining > 20) rag_status = 'green';
      else if (pctRemaining > 5)  rag_status = 'amber';
      else                        rag_status = 'red';
    }

    return {
      id:                  prod.id,
      name:                prod.name,
      status:              prod.status,
      contract_type:       prod.contract_type,
      total_budget:        totalBudget,
      total_costs_to_date: totalCosts,
      amount_remaining:    amountRemaining,
      percent_remaining:   pctRemaining?.toFixed(1) || null,
      rag_status,
    };
  }));
};

const getCrewHeadcount = async () => {
  const { rows: productions } = await db.query(
    `SELECT id, name FROM productions WHERE status IN ('pre_production', 'active_build', 'strike')`
  );
  if (!productions.length) return { total: 0, by_production: [] };

  const byProd = await Promise.all(productions.map(async prod => {
    const { rows: [{ cnt }] } = await db.query(
      `SELECT COUNT(*) AS cnt FROM production_crew
       WHERE production_id = $1 AND end_date IS NULL`,
      [prod.id]
    );
    return { production: prod.name, headcount: parseInt(cnt, 10) || 0 };
  }));

  return {
    total:         byProd.reduce((s, p) => s + p.headcount, 0),
    by_production: byProd,
  };
};

const getForecastingVariance = async () => {
  const { rows: forecasts } = await db.query(
    `SELECT f.*, p.name AS prod_name
     FROM forecasts f
     JOIN productions p ON f.production_id = p.id
     WHERE f.production_id IS NOT NULL`
  );
  if (!forecasts.length) return [];

  return Promise.all(forecasts.map(async f => {
    const [{ rows: pos }, { rows: tss }] = await Promise.all([
      db.query(
        `SELECT net_amount FROM purchase_orders WHERE production_id = $1 AND status = 'approved'`,
        [f.production_id]
      ),
      db.query(
        `SELECT grand_total FROM timesheets WHERE production_id = $1 AND status = 'verified'`,
        [f.production_id]
      ),
    ]);
    const actual        = [
      ...pos.map(p => parseFloat(p.net_amount || 0)),
      ...tss.map(t => parseFloat(t.grand_total || 0)),
    ].reduce((s, v) => s + v, 0);
    const forecastTotal = parseFloat(f.total_forecast_cost || 0);
    const variance      = actual - forecastTotal;
    return {
      forecast_name:       f.name,
      production:          f.prod_name,
      forecast_total:      forecastTotal,
      actual_cost:         actual,
      variance_gbp:        variance,
      variance_percentage: (forecastTotal > 0 ? (variance / forecastTotal) * 100 : 0).toFixed(1),
      status: variance > 0 ? 'over_forecast' : variance < 0 ? 'under_forecast' : 'on_track',
    };
  }));
};

const getProductionPipeline = async () => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const { rows } = await db.query(
    `SELECT id, name, start_date, end_date, status, contract_type
     FROM productions
     WHERE status != 'archived'
     ORDER BY start_date`
  );
  return rows.map(p => ({
    id:           p.id,
    name:         p.name,
    start_date:   p.start_date,
    end_date:     p.end_date,
    current_phase: p.status,
    days_remaining: p.end_date
      ? Math.ceil((new Date(p.end_date) - today) / 86400000)
      : null,
  }));
};

// ─── GET /api/dashboard ───────────────────────────────────────────────────────
const getDashboard = async (req, res) => {
  const today     = new Date().toISOString().split('T')[0];
  const weekStart = getWeekStart();
  const weekEnd   = getWeekEnd();

  try {
    const [poSpend, labourCosts, activeProductions, crewHeadcount, forecastingVariance, pipeline] =
      await Promise.all([
        getPOSpend(today, weekStart, weekEnd),
        getCurrentWeekLabour(weekEnd),
        getActiveProductionsSummary(),
        getCrewHeadcount(),
        getForecastingVariance(),
        getProductionPipeline(),
      ]);

    res.json({
      generated_at:         new Date().toISOString(),
      current_week:         { start: weekStart, end: weekEnd },
      po_spend:             poSpend,
      current_week_labour:  labourCosts,
      active_productions:   activeProductions,
      crew_headcount:       crewHeadcount,
      forecasting_variance: forecastingVariance,
      production_pipeline:  pipeline,
      cash_flow: {
        note: 'Xero integration pending — to be quoted separately.',
        data: null,
      },
    });
  } catch (err) {
    console.error('getDashboard:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/dashboard/po-spend
const getDashboardPOSpend = async (req, res) => {
  const today = new Date().toISOString().split('T')[0];
  try {
    res.json(await getPOSpend(today, getWeekStart(), getWeekEnd()));
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// GET /api/dashboard/productions
const getDashboardProductions = async (req, res) => {
  try {
    res.json(await getActiveProductionsSummary());
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getDashboard, getDashboardPOSpend, getDashboardProductions };
