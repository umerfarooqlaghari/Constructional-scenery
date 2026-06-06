const db = require('../config/db');

// ─── GET /api/cost-reports/:productionId ─────────────────────────────────────
const getCostReport = async (req, res) => {
  const { productionId } = req.params;
  const { as_at_date }   = req.query;

  try {
    const { rows: [production] } = await db.query(
      'SELECT * FROM productions WHERE id = $1',
      [productionId]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });

    let poDateFilter = '';
    let tsDateFilter = '';
    const poParams   = [productionId];
    const tsParams   = [productionId];
    if (as_at_date) {
      poDateFilter = ` AND approved_at::date <= $2`;
      poParams.push(as_at_date);
      tsDateFilter = ` AND week_ending_date <= $2`;
      tsParams.push(as_at_date);
    }

    const [
      { rows: approvedPOs },
      { rows: verifiedTimesheets },
      { rows: invoices },
    ] = await Promise.all([
      db.query(
        `SELECT * FROM purchase_orders
         WHERE production_id = $1 AND status = 'approved' ${poDateFilter}
         ORDER BY date_of_po`,
        poParams
      ),
      db.query(
        `SELECT t.*,
                cm.crew_number, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank, cm.employment_status
         FROM   timesheets t
         JOIN   crew_members cm ON t.crew_member_id = cm.id
         WHERE  t.production_id = $1 AND t.status = 'finalised' ${tsDateFilter}  -- TimesheetStatus.FINALISED
         ORDER BY t.week_ending_date`,
        tsParams
      ),
      db.query(
        'SELECT * FROM cost_report_invoices WHERE production_id = $1 ORDER BY date',
        [productionId]
      ),
    ]);

    const totalSupplier = approvedPOs.reduce((s, po) => s + parseFloat(po.net_amount || 0), 0);
    const totalLabour   = verifiedTimesheets.reduce((s, ts) => s + parseFloat(ts.grand_total || 0), 0);
    const totalCosts    = totalSupplier + totalLabour;
    const totalInvoiced = invoices.reduce((s, inv) => s + parseFloat(inv.amount || 0), 0);
    const currentProfit = totalInvoiced - totalCosts;
    const profitPct     = totalInvoiced > 0 ? (currentProfit / totalInvoiced) * 100 : 0;

    const labourByWeek = {};
    verifiedTimesheets.forEach(ts => {
      const key = ts.week_ending_date;
      if (!labourByWeek[key]) labourByWeek[key] = { week_ending_date: key, crew: [], total: 0 };
      labourByWeek[key].crew.push({
        crew_number:  ts.crew_number,
        name:         `${ts.first_name} ${ts.last_name}`,
        trade:        ts.crew_trade,
        rank:         ts.crew_rank,
        grand_total:  parseFloat(ts.grand_total),
      });
      labourByWeek[key].total += parseFloat(ts.grand_total || 0);
    });

    res.json({
      production,
      contract_type:  production.contract_type,
      as_at_date:     as_at_date || new Date().toISOString().split('T')[0],
      metrics: {
        total_supplier_costs:           totalSupplier,
        total_labour_costs:             totalLabour,
        total_costs_to_date:            totalCosts,
        total_invoiced_to_production:   totalInvoiced,
        current_profit:                 currentProfit,
        profit_percentage_of_turnover:  profitPct.toFixed(2),
      },
      supplier_costs: approvedPOs.map(po => ({
        date:            po.date_of_po,
        supplier:        po.supplier_name,
        description:     po.description,
        po_number:       po.po_number,
        set_code:        po.set_code,
        account_code:    po.account_code,
        cost_ex_vat:     parseFloat(po.net_amount),
        vat:             parseFloat(po.vat),
        total:           parseFloat(po.gross_amount),
        purchase_method: po.paid_from,
      })),
      labour_weekly:           Object.values(labourByWeek),
      invoices_to_production:  invoices,
    });
  } catch (err) {
    console.error('getCostReport:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/cost-reports/:productionId/invoices ────────────────────────────
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
        req.params.productionId,
        invoice_description,
        po_number,
        date || new Date().toISOString().split('T')[0],
        invoice_number,
        parseFloat(amount),
        notes,
      ]
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/cost-reports/:productionId/cost-plus ───────────────────────────
const getCostPlus = async (req, res) => {
  const { productionId } = req.params;
  try {
    const { rows: [production] } = await db.query(
      'SELECT * FROM productions WHERE id = $1',
      [productionId]
    );
    if (!production || production.contract_type !== 'cost_plus')
      return res.status(400).json({ error: 'This production is not a Cost Plus contract' });

    const [
      { rows: [budget] },
      { rows: budgetLines },
      { rows: approvedPOs },
      { rows: verifiedTimesheets },
    ] = await Promise.all([
      db.query('SELECT * FROM cost_plus_budgets WHERE production_id = $1', [productionId]),
      db.query(
        `SELECT * FROM cost_plus_budget_lines bl
         JOIN cost_plus_budgets b ON bl.budget_id = b.id
         WHERE b.production_id = $1
         ORDER BY bl.sort_order`,
        [productionId]
      ),
      db.query(
        `SELECT * FROM purchase_orders
         WHERE production_id = $1 AND status = 'approved'
         ORDER BY date_of_po`,
        [productionId]
      ),
      db.query(
        `SELECT t.*, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank
         FROM timesheets t
         JOIN crew_members cm ON t.crew_member_id = cm.id
         WHERE t.production_id = $1 AND t.status = 'finalised'  -- TimesheetStatus.FINALISED
         ORDER BY t.week_ending_date`,
        [productionId]
      ),
    ]);

    const margin = parseFloat(budget?.margin_rate || 0.10);

    const materialsToSend = approvedPOs.map(po => ({
      week_ending_date:       po.date_of_po,
      po_number:              po.po_number,
      invoice_date:           po.date_of_po,
      supplier:               po.supplier_name,
      account_code:           po.account_code,
      description:            po.description,
      net_amount:             parseFloat(po.net_amount),
      margin_amount:          parseFloat(po.net_amount) * margin,
      recharge_to_production: parseFloat(po.net_amount) * (1 + margin),
    }));

    const labourToSend = verifiedTimesheets.map(ts => ({
      week_ending_date:   ts.week_ending_date,
      crew:               `${ts.first_name} ${ts.last_name}`,
      trade:              ts.crew_trade,
      rank:               ts.crew_rank,
      net_amount:         parseFloat(ts.grand_total),
      margin_amount:      parseFloat(ts.grand_total) * margin,
      cost_to_production: parseFloat(ts.grand_total) * (1 + margin),
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

    // Upsert budget header
    const { rows: [budget] } = await client.query(
      `INSERT INTO cost_plus_budgets (production_id, margin_rate, contracted_weeks)
       VALUES ($1,$2,$3)
       ON CONFLICT (production_id)
       DO UPDATE SET
         margin_rate      = EXCLUDED.margin_rate,
         contracted_weeks = EXCLUDED.contracted_weeks,
         updated_at       = NOW()
       RETURNING *`,
      [
        req.params.productionId,
        parseFloat(margin_rate || 0.10),
        parseInt(contracted_weeks || 0, 10),
      ]
    );

    // Replace all budget lines (3NF normalised table)
    await client.query('DELETE FROM cost_plus_budget_lines WHERE budget_id = $1', [budget.id]);

    const lines = Array.isArray(budget_lines) ? budget_lines : [];
    for (let i = 0; i < lines.length; i++) {
      const line     = lines[i];
      const weekly   = parseFloat(line.weekly_cost ?? 0);
      const weeks    = parseInt(line.weeks ?? 0, 10);
      const total    = parseFloat(line.total ?? weekly * weeks);

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

// ─── GET /api/cost-reports/entries?production_id=:id&type=supplier ───────────
const getCostReportEntries = async (req, res) => {
  const { production_id, type } = req.query;
  if (!production_id) return res.status(400).json({ error: 'production_id is required' });

  try {
    const conditions = ['production_id = $1', 'deleted_at IS NULL'];
    const params     = [production_id];
    if (type) { conditions.push(`entry_type = $${params.length + 1}`); params.push(type); }

    const { rows } = await db.query(
      `SELECT * FROM cost_report_entries
       WHERE ${conditions.join(' AND ')}
       ORDER BY date, created_at`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getCostReportEntries:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getCostReport, addInvoice, getCostPlus, upsertBudget, getCostReportEntries };
