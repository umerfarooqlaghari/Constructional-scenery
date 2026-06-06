/**
 * CostReportService — writes PO cost data into cost_report_entries on approval.
 * Must be called within an active database transaction (pass the pg client).
 */

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
      po.set_code        || null,
      po.account_code    || null,
      po.date_of_po,
      parseFloat(po.net_amount),
      parseFloat(po.vat   || 0),
      parseFloat(po.gross_amount),
      po.supplier_name,
      po.po_number,
      po.paid_from       || null,
    ]
  );
};

// Soft-delete the entry when a PO approval is reverted (MD only edge case)
const softDeleteEntry = async (poId, client) => {
  await client.query(
    `UPDATE cost_report_entries
     SET deleted_at = NOW()
     WHERE source_id = $1 AND source_type = 'purchase_order' AND deleted_at IS NULL`,
    [poId]
  );
};

module.exports = { recordSupplierCost, softDeleteEntry };
