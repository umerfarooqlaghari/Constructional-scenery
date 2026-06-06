/**
 * CostReportService — the single access point for all cost_report_entries reads
 * and the write operations triggered on PO approval and pay run processing.
 *
 * No controller or module should query cost_report_entries directly.
 * All read methods accept a `db` argument (pool or pg client).
 *
 * entry_type = 'supplier' → written on PO approval (recordSupplierCost)
 * entry_type = 'labour'   → written on pay run processing (recordWeeklyLabour)
 * deleted_at IS NOT NULL  → soft-deleted; excluded from all live reads
 */

// ─── Write: PO approval ───────────────────────────────────────────────────────
const recordSupplierCost = async (po, client) => {
  await client.query(
    `INSERT INTO cost_report_entries
       (production_id, entry_type, source_id, source_type,
        set_code, account_code, date, net_amount, vat, gross_amount,
        supplier_name, po_number, payment_method)
     VALUES ($1,'supplier',$2,'purchase_order',$3,$4,$5,$6,$7,$8,$9,$10,$11)`,
    [
      po.production_id,
      po.id,
      po.set_code     || null,
      po.account_code || null,
      po.date_of_po,
      parseFloat(po.net_amount),
      parseFloat(po.vat || 0),
      parseFloat(po.gross_amount),
      po.supplier_name,
      po.po_number,
      po.paid_from    || null,
    ]
  );
};

// ─── Write: soft-delete on PO approval revert (MD edge case) ─────────────────
const softDeleteEntry = async (poId, client) => {
  await client.query(
    `UPDATE cost_report_entries
     SET deleted_at = NOW()
     WHERE source_id = $1 AND source_type = 'purchase_order' AND deleted_at IS NULL`,
    [poId]
  );
};

// ─── Read: supplier cost entries ──────────────────────────────────────────────
// Optional filters: as_at_date, set_code, account_code, supplier_name,
//                   date_from, date_to.
const getSupplierCosts = async (productionId, filters = {}, db) => {
  const conds  = [`cre.production_id = $1`, `cre.entry_type = 'supplier'`, `cre.deleted_at IS NULL`];
  const params = [productionId];
  let i = 2;

  if (filters.as_at_date)    { conds.push(`cre.date <= $${i++}`);             params.push(filters.as_at_date); }
  if (filters.set_code)      { conds.push(`cre.set_code = $${i++}`);           params.push(filters.set_code); }
  if (filters.account_code)  { conds.push(`cre.account_code = $${i++}`);       params.push(filters.account_code); }
  if (filters.supplier_name) { conds.push(`cre.supplier_name ILIKE $${i++}`);  params.push(`%${filters.supplier_name}%`); }
  if (filters.date_from)     { conds.push(`cre.date >= $${i++}`);              params.push(filters.date_from); }
  if (filters.date_to)       { conds.push(`cre.date <= $${i++}`);              params.push(filters.date_to); }

  const { rows } = await db.query(
    `SELECT cre.*
     FROM   cost_report_entries cre
     WHERE  ${conds.join(' AND ')}
     ORDER  BY cre.date DESC, cre.created_at DESC`,
    params
  );
  return rows;
};

// ─── Read: labour cost entries ────────────────────────────────────────────────
// Joined with crew_members for name and initials.
// Optional filters: as_at_date, week_ending_date, trade, crew_member_id.
const getLabourCosts = async (productionId, filters = {}, db) => {
  const conds  = [`cre.production_id = $1`, `cre.entry_type = 'labour'`, `cre.deleted_at IS NULL`];
  const params = [productionId];
  let i = 2;

  if (filters.as_at_date)       { conds.push(`cre.date <= $${i++}`);             params.push(filters.as_at_date); }
  if (filters.week_ending_date) { conds.push(`cre.week_ending_date = $${i++}`);  params.push(filters.week_ending_date); }
  if (filters.trade)            { conds.push(`cre.trade = $${i++}`);             params.push(filters.trade); }
  if (filters.crew_member_id)   { conds.push(`cre.crew_member_id = $${i++}`);    params.push(filters.crew_member_id); }

  const { rows } = await db.query(
    `SELECT cre.*,
            cm.crew_number,
            cm.first_name,
            cm.last_name,
            UPPER(LEFT(cm.first_name, 1) || LEFT(cm.last_name, 1)) AS initials
     FROM   cost_report_entries cre
     LEFT JOIN crew_members cm ON cm.id = cre.crew_member_id
     WHERE  ${conds.join(' AND ')}
     ORDER  BY cre.week_ending_date DESC, cre.trade, cm.last_name, cm.first_name`,
    params
  );
  return rows;
};

// ─── Read: aggregated summary metrics ────────────────────────────────────────
// Supplier + labour totals and invoiced-to-production total.
const getSummaryMetrics = async (productionId, db) => {
  const [{ rows: [costs] }, { rows: [invoiced] }] = await Promise.all([
    db.query(
      `SELECT
         COALESCE(SUM(CASE WHEN entry_type = 'supplier' THEN gross_amount ELSE 0 END), 0) AS total_supplier,
         COALESCE(SUM(CASE WHEN entry_type = 'labour'   THEN gross_amount ELSE 0 END), 0) AS total_labour,
         COALESCE(SUM(gross_amount), 0)                                                    AS total_costs,
         MAX(created_at)                                                                   AS last_updated
       FROM cost_report_entries
       WHERE production_id = $1 AND deleted_at IS NULL`,
      [productionId]
    ),
    db.query(
      `SELECT COALESCE(SUM(amount), 0) AS total_invoiced
       FROM cost_report_invoices
       WHERE production_id = $1`,
      [productionId]
    ),
  ]);

  const totalCosts    = parseFloat(costs.total_costs);
  const totalInvoiced = parseFloat(invoiced.total_invoiced);
  const profit        = totalInvoiced - totalCosts;

  return {
    total_supplier_costs: parseFloat(costs.total_supplier),
    total_labour_costs:   parseFloat(costs.total_labour),
    total_costs_to_date:  totalCosts,
    total_invoiced:       totalInvoiced,
    current_profit:       profit,
    profit_pct:           totalInvoiced > 0 ? (profit / totalInvoiced) * 100 : 0,
    last_updated:         costs.last_updated,
  };
};

// ─── Read: as-at-date snapshot ────────────────────────────────────────────────
// Returns cost totals as of asAtDate — identical to a live query run that day.
// Powers the date-specific export feature across both report types.
const getAsAtSnapshot = async (productionId, asAtDate, db) => {
  const { rows: [snap] } = await db.query(
    `SELECT
       COALESCE(SUM(CASE WHEN entry_type = 'supplier' THEN gross_amount ELSE 0 END), 0) AS total_supplier,
       COALESCE(SUM(CASE WHEN entry_type = 'labour'   THEN gross_amount ELSE 0 END), 0) AS total_labour,
       COALESCE(SUM(gross_amount), 0)                                                    AS total_costs
     FROM cost_report_entries
     WHERE production_id = $1
       AND date          <= $2
       AND deleted_at    IS NULL`,
    [productionId, asAtDate]
  );

  return {
    as_at_date:           asAtDate,
    total_supplier_costs: parseFloat(snap.total_supplier),
    total_labour_costs:   parseFloat(snap.total_labour),
    total_costs_to_date:  parseFloat(snap.total_costs),
  };
};

module.exports = {
  recordSupplierCost, softDeleteEntry,
  getSupplierCosts, getLabourCosts, getSummaryMetrics, getAsAtSnapshot,
};
