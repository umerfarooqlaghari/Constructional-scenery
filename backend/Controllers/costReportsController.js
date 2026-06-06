const db  = require('../config/db');
const CRS = require('../services/costReportService');

// ─── Helper: build weekly cost summary from supplier + labour entries ──────────
// Groups supplier entries by date (as-of week proxy) and labour entries by
// week_ending_date, then merges into an array sorted chronologically.
const buildWeeklyCostSummary = (supplierEntries, labourEntries) => {
  const weekMap = {};

  supplierEntries.forEach(e => {
    const key = String(e.date).split('T')[0];
    if (!weekMap[key]) weekMap[key] = { week_or_date: key, supplier_cost: 0, labour_cost: 0, crew_count: 0 };
    weekMap[key].supplier_cost += parseFloat(e.gross_amount || 0);
  });

  labourEntries.forEach(e => {
    const key = String(e.week_ending_date).split('T')[0];
    if (!weekMap[key]) weekMap[key] = { week_or_date: key, supplier_cost: 0, labour_cost: 0, crew_count: 0 };
    weekMap[key].labour_cost += parseFloat(e.gross_amount || 0);
    weekMap[key].crew_count  += 1;
  });

  return Object.values(weekMap)
    .sort((a, b) => a.week_or_date.localeCompare(b.week_or_date))
    .map(w => ({
      ...w,
      total_cost: w.supplier_cost + w.labour_cost,
    }));
};

// ─── Helper: group labour entries by week_ending_date then by trade ───────────
const groupLabourByWeekAndTrade = (labourEntries) => {
  const byWeek = {};
  labourEntries.forEach(e => {
    const week  = String(e.week_ending_date).split('T')[0];
    const trade = e.trade || 'Unknown';
    if (!byWeek[week]) byWeek[week] = { week_ending_date: week, by_trade: {}, total_gross: 0 };
    if (!byWeek[week].by_trade[trade]) byWeek[week].by_trade[trade] = { trade, entries: [], subtotal: 0 };
    byWeek[week].by_trade[trade].entries.push(e);
    byWeek[week].by_trade[trade].subtotal += parseFloat(e.gross_amount || 0);
    byWeek[week].total_gross += parseFloat(e.gross_amount || 0);
  });

  // Convert inner maps to sorted arrays
  return Object.values(byWeek)
    .sort((a, b) => b.week_ending_date.localeCompare(a.week_ending_date))
    .map(w => ({
      week_ending_date: w.week_ending_date,
      total_gross:      w.total_gross,
      by_trade:         Object.values(w.by_trade).sort((a, b) => a.trade.localeCompare(b.trade)),
    }));
};

// ─── GET /api/cost-reports/:productionId/type1 ───────────────────────────────
// Type 1 (On a Price) full report: Lead Summary, Supplier Costs, Labour Summary,
// Invoiced to Production. Only available for contract_type = 'on_a_price'.
const getType1Report = async (req, res) => {
  const { productionId } = req.params;
  const { as_at_date, set_code, account_code, supplier_name, date_from, date_to } = req.query;

  try {
    const { rows: [production] } = await db.query(
      `SELECT id, name, contract_type, status, target_profit_pct FROM productions WHERE id = $1`,
      [productionId]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });
    if (production.contract_type !== 'on_a_price')
      return res.status(400).json({
        error:         'Type 1 report is only available for On a Price contracts',
        contract_type: production.contract_type,
        redirect_to:   'type2',
      });

    const supplierFilters = { as_at_date, set_code, account_code, supplier_name, date_from, date_to };
    const labourFilters   = { as_at_date };

    const [supplierEntries, labourEntries, metrics, invoiceRows] = await Promise.all([
      CRS.getSupplierCosts(productionId, supplierFilters, db),
      CRS.getLabourCosts(productionId, labourFilters, db),
      CRS.getSummaryMetrics(productionId, db),
      db.query(
        'SELECT * FROM cost_report_invoices WHERE production_id = $1 ORDER BY date DESC',
        [productionId]
      ).then(r => r.rows),
    ]);

    // Lead summary derived metrics
    const totalCosts      = metrics.total_costs_to_date;
    const totalInvoiced   = metrics.total_invoiced;
    const targetProfitPct = parseFloat(production.target_profit_pct || 0);
    const targetFraction  = targetProfitPct / 100;
    const availableSpend  = totalInvoiced * (1 - targetFraction) - totalCosts;
    const availableSpendPct = totalInvoiced > 0 ? (availableSpend / totalInvoiced) * 100 : 0;

    res.json({
      production: {
        id:                production.id,
        name:              production.name,
        contract_type:     production.contract_type,
        status:            production.status,
        target_profit_pct: targetProfitPct,
      },
      lead_summary: {
        total_costs_to_date:              totalCosts,
        total_supplier_costs:             metrics.total_supplier_costs,
        total_labour_costs:               metrics.total_labour_costs,
        amounts_invoiced_to_production:   totalInvoiced,
        current_profit:                   totalInvoiced - totalCosts,
        profit_pct_of_turnover:           totalInvoiced > 0
          ? ((totalInvoiced - totalCosts) / totalInvoiced) * 100 : 0,
        target_profit_pct:                targetProfitPct,
        available_spend_remaining:        availableSpend,
        available_spend_pct_of_budget:    availableSpendPct,
        last_updated:                     metrics.last_updated,
      },
      weekly_cost_summary:   buildWeeklyCostSummary(supplierEntries, labourEntries),
      supplier_costs:        supplierEntries.map(e => ({
        date:            e.date,
        supplier:        e.supplier_name,
        description:     null,           // not stored in cost_report_entries; use PO join if needed
        po_number:       e.po_number,
        set_code:        e.set_code,
        account_code:    e.account_code,
        cost_ex_vat:     parseFloat(e.net_amount),
        vat:             parseFloat(e.vat),
        total:           parseFloat(e.gross_amount),
        purchase_method: e.payment_method,
      })),
      labour_summary:        groupLabourByWeekAndTrade(labourEntries),
      invoiced_to_production: invoiceRows,
    });
  } catch (err) {
    console.error('getType1Report:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/cost-reports/:productionId ─────────────────────────────────────
// Generic cost report (used by both contract types and existing consumers).
// Now reads from cost_report_entries via CostReportService.
const getCostReport = async (req, res) => {
  const { productionId } = req.params;
  const { as_at_date }   = req.query;

  try {
    const { rows: [production] } = await db.query(
      'SELECT * FROM productions WHERE id = $1', [productionId]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });

    const filters = { as_at_date };
    const [metrics, supplierEntries, labourEntries, invoiceRows] = await Promise.all([
      as_at_date
        ? CRS.getAsAtSnapshot(productionId, as_at_date, db)
        : CRS.getSummaryMetrics(productionId, db),
      CRS.getSupplierCosts(productionId, filters, db),
      CRS.getLabourCosts(productionId, filters, db),
      db.query(
        'SELECT * FROM cost_report_invoices WHERE production_id = $1 ORDER BY date',
        [productionId]
      ).then(r => r.rows),
    ]);

    res.json({
      production,
      contract_type: production.contract_type,
      as_at_date:    as_at_date || new Date().toISOString().split('T')[0],
      metrics: {
        total_supplier_costs:          metrics.total_supplier_costs ?? metrics.total_supplier_costs,
        total_labour_costs:            metrics.total_labour_costs,
        total_costs_to_date:           metrics.total_costs_to_date,
        total_invoiced_to_production:  metrics.total_invoiced ?? null,
        current_profit:                metrics.current_profit ?? null,
        profit_percentage_of_turnover: metrics.profit_pct != null
          ? parseFloat(metrics.profit_pct).toFixed(2) : null,
        last_updated:                  metrics.last_updated || null,
      },
      supplier_costs: supplierEntries.map(e => ({
        date:            e.date,
        supplier:        e.supplier_name,
        po_number:       e.po_number,
        set_code:        e.set_code,
        account_code:    e.account_code,
        cost_ex_vat:     parseFloat(e.net_amount),
        vat:             parseFloat(e.vat),
        total:           parseFloat(e.gross_amount),
        purchase_method: e.payment_method,
      })),
      labour_weekly:          groupLabourByWeekAndTrade(labourEntries),
      invoices_to_production: invoiceRows,
    });
  } catch (err) {
    console.error('getCostReport:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/cost-reports/entries ───────────────────────────────────────────
// Raw entry list — used by integration tests and admin tooling.
// Routed through CostReportService; does not query cost_report_entries directly.
const getCostReportEntries = async (req, res) => {
  const { production_id, type } = req.query;
  if (!production_id) return res.status(400).json({ error: 'production_id is required' });

  try {
    let rows;
    if (!type || type === 'supplier') {
      rows = await CRS.getSupplierCosts(production_id, {}, db);
      if (type === 'labour') rows = [];
    }
    if (type === 'labour') {
      rows = await CRS.getLabourCosts(production_id, {}, db);
    }
    if (!type) {
      // Both types
      const [supplier, labour] = await Promise.all([
        CRS.getSupplierCosts(production_id, {}, db),
        CRS.getLabourCosts(production_id, {}, db),
      ]);
      rows = [...supplier, ...labour].sort((a, b) =>
        String(a.date).localeCompare(String(b.date))
      );
    }
    res.json(rows);
  } catch (err) {
    console.error('getCostReportEntries:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/cost-reports/:productionId/snapshot ────────────────────────────
// Returns cost totals as of a given date — powers date-specific exports.
const getSnapshot = async (req, res) => {
  const { productionId } = req.params;
  const { as_at_date }   = req.query;
  if (!as_at_date) return res.status(400).json({ error: 'as_at_date is required' });
  try {
    const snapshot = await CRS.getAsAtSnapshot(productionId, as_at_date, db);
    res.json(snapshot);
  } catch (err) {
    console.error('getSnapshot:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/cost-reports/:productionId/invoices ───────────────────────────
const addInvoice = async (req, res) => {
  const { invoice_description, po_number, date, invoice_number, amount, notes } = req.body;
  if (!amount) return res.status(400).json({ error: 'amount is required' });

  try {
    const { rows: [row] } = await db.query(
      `INSERT INTO cost_report_invoices
         (production_id, invoice_description, po_number, date, invoice_number, amount, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [
        req.params.productionId, invoice_description, po_number,
        date || new Date().toISOString().split('T')[0],
        invoice_number, parseFloat(amount), notes,
      ]
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/cost-reports/:productionId/invoices/:invoiceId ──────────────
const deleteInvoice = async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'DELETE FROM cost_report_invoices WHERE id = $1 AND production_id = $2',
      [req.params.invoiceId, req.params.productionId]
    );
    if (!rowCount) return res.status(404).json({ error: 'Invoice not found' });
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/cost-reports/:productionId/cost-plus ───────────────────────────
// Cost Plus (Type 2) report — also refactored to read from cost_report_entries.
const getCostPlus = async (req, res) => {
  const { productionId } = req.params;
  try {
    const { rows: [production] } = await db.query(
      'SELECT * FROM productions WHERE id = $1', [productionId]
    );
    if (!production || production.contract_type !== 'cost_plus')
      return res.status(400).json({ error: 'This production is not a Cost Plus contract' });

    const [budget, budgetLines, supplierEntries, labourEntries] = await Promise.all([
      db.query('SELECT * FROM cost_plus_budgets WHERE production_id = $1', [productionId]).then(r => r.rows[0]),
      db.query(
        `SELECT bl.* FROM cost_plus_budget_lines bl
         JOIN cost_plus_budgets b ON bl.budget_id = b.id
         WHERE b.production_id = $1 ORDER BY bl.sort_order`,
        [productionId]
      ).then(r => r.rows),
      CRS.getSupplierCosts(productionId, {}, db),
      CRS.getLabourCosts(productionId, {}, db),
    ]);

    const margin = parseFloat(budget?.margin_rate || 0.10);

    const materialsToSend = supplierEntries.map(e => ({
      date:                   e.date,
      po_number:              e.po_number,
      supplier:               e.supplier_name,
      account_code:           e.account_code,
      net_amount:             parseFloat(e.net_amount),
      margin_amount:          parseFloat(e.net_amount) * margin,
      recharge_to_production: parseFloat(e.net_amount) * (1 + margin),
    }));

    const labourToSend = labourEntries.map(e => ({
      week_ending_date:   e.week_ending_date,
      crew:               `${e.first_name} ${e.last_name}`,
      trade:              e.trade,
      rank:               e.rank,
      net_amount:         parseFloat(e.net_amount),
      margin_amount:      parseFloat(e.net_amount) * margin,
      cost_to_production: parseFloat(e.net_amount) * (1 + margin),
    }));

    const totalLabourNet    = labourToSend.reduce((s, l) => s + l.net_amount, 0);
    const totalMaterialsNet = materialsToSend.reduce((s, m) => s + m.net_amount, 0);
    const totalNet          = totalLabourNet + totalMaterialsNet;

    res.json({
      production,
      budget:            budget ? { ...budget, budget_lines: budgetLines } : null,
      margin_rate:       margin,
      margin_percentage: `${(margin * 100).toFixed(0)}%`,
      totals: {
        total_labour_net:    totalLabourNet,
        total_materials_net: totalMaterialsNet,
        total_net:           totalNet,
        total_margin:        totalNet * margin,
        total_to_production: totalNet * (1 + margin),
      },
      materials_to_send: materialsToSend,
      labour_to_send:    labourToSend,
    });
  } catch (err) {
    console.error('getCostPlus:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/cost-reports/:productionId/budget ─────────────────────────────
const upsertBudget = async (req, res) => {
  const { margin_rate, contracted_weeks, budget_lines } = req.body;
  const client = await db.connect();
  try {
    await client.query('BEGIN');
    const { rows: [budget] } = await client.query(
      `INSERT INTO cost_plus_budgets (production_id, margin_rate, contracted_weeks)
       VALUES ($1,$2,$3)
       ON CONFLICT (production_id)
       DO UPDATE SET
         margin_rate      = EXCLUDED.margin_rate,
         contracted_weeks = EXCLUDED.contracted_weeks,
         updated_at       = NOW()
       RETURNING *`,
      [req.params.productionId, parseFloat(margin_rate || 0.10), parseInt(contracted_weeks || 0, 10)]
    );
    await client.query('DELETE FROM cost_plus_budget_lines WHERE budget_id = $1', [budget.id]);

    const lines = Array.isArray(budget_lines) ? budget_lines : [];
    for (let i = 0; i < lines.length; i++) {
      const line   = lines[i];
      const weekly = parseFloat(line.weekly_cost ?? 0);
      const weeks  = parseInt(line.weeks ?? 0, 10);
      const total  = parseFloat(line.total ?? weekly * weeks);
      await client.query(
        `INSERT INTO cost_plus_budget_lines
           (budget_id, account_code, description, weekly_cost, weeks, total, sort_order)
         VALUES ($1,$2,$3,$4,$5,$6,$7)`,
        [budget.id, line.account_code ?? null, line.description ?? '', weekly, weeks, total, i]
      );
    }
    await client.query('COMMIT');
    const { rows: savedLines } = await db.query(
      'SELECT * FROM cost_plus_budget_lines WHERE budget_id = $1 ORDER BY sort_order',
      [budget.id]
    );
    res.json({ ...budget, budget_lines: savedLines });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = {
  getType1Report, getCostReport, getSnapshot,
  getCostReportEntries, addInvoice, deleteInvoice,
  getCostPlus, upsertBudget,
};
