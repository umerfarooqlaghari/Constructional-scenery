const db                              = require('../config/db');
const { sendEmail, templates }        = require('../config/email');
const { fileUrl }                     = require('../Middleware/upload');
const { generatePoPdf }               = require('../services/poPdfService');
const { recordSupplierCost, softDeleteEntry } = require('../services/costReportService');
const { generatePoListPdf }                   = require('../services/poPdfService');

// ─── Helper: build shared WHERE conditions for PO list queries ────────────────
const buildPoFilterConditions = (query) => {
  const conditions = [];
  const params     = [];
  let   i          = 1;

  if (query.production_id) { conditions.push(`po.production_id = $${i++}`);      params.push(query.production_id); }
  if (query.status)        { conditions.push(`po.status = $${i++}`);              params.push(query.status); }
  if (query.supplier_name) { conditions.push(`po.supplier_name ILIKE $${i++}`);   params.push(`%${query.supplier_name}%`); }
  if (query.set_code)      { conditions.push(`po.set_code = $${i++}`);             params.push(query.set_code); }
  if (query.account_code)  { conditions.push(`po.account_code = $${i++}`);         params.push(query.account_code); }
  if (query.paid_from)     { conditions.push(`po.paid_from = $${i++}`);            params.push(query.paid_from); }
  if (query.date_from)     { conditions.push(`po.date_of_po >= $${i++}`);          params.push(query.date_from); }
  if (query.date_to)       { conditions.push(`po.date_of_po <= $${i++}`);          params.push(query.date_to); }
  if (query.amount_min)    { conditions.push(`po.gross_amount >= $${i++}`);        params.push(query.amount_min); }
  if (query.amount_max)    { conditions.push(`po.gross_amount <= $${i++}`);        params.push(query.amount_max); }
  if (query.net_amount_min){ conditions.push(`po.net_amount >= $${i++}`);          params.push(query.net_amount_min); }
  if (query.net_amount_max){ conditions.push(`po.net_amount <= $${i++}`);          params.push(query.net_amount_max); }

  if (query.include_archived !== 'true') {
    conditions.push(`p.status != $${i++}`);
    params.push('archived');
  }

  return { conditions, params };
};

// ─── Helper: human-readable filter summary for PDF export header ──────────────
const buildFilterSummary = (query) => {
  const parts = [];
  if (query.supplier_name) parts.push(`Supplier: ${query.supplier_name}`);
  if (query.date_from || query.date_to)
    parts.push(`Date: ${query.date_from || '*'} → ${query.date_to || '*'}`);
  if (query.set_code)      parts.push(`Set: ${query.set_code}`);
  if (query.account_code)  parts.push(`Account: ${query.account_code}`);
  if (query.paid_from)     parts.push(`Pmt: ${query.paid_from.replace(/_/g, ' ')}`);
  if (query.status)        parts.push(`Status: ${query.status}`);
  if (query.net_amount_min || query.net_amount_max)
    parts.push(`Net: £${query.net_amount_min || '0'} – £${query.net_amount_max || '∞'}`);
  return parts.length ? parts.join('  ·  ') : null;
};

// ─── Helper: generate unique PO number (global max, deletion-safe) ───────────
const generatePoNumber = async () => {
  const { rows } = await db.query(
    `SELECT MAX(CAST(SUBSTRING(po_number FROM 4) AS INTEGER)) AS max_num
     FROM purchase_orders
     WHERE po_number ~ '^PO-[0-9]+$'`
  );
  const max = parseInt(rows[0]?.max_num, 10) || 0;
  return `PO-${String(max + 1).padStart(4, '0')}`;
};

// ─── Helper: write a PO status transition to the audit log ───────────────────
const logStatusTransition = async (client, poId, productionId, fromStatus, toStatus, userId) => {
  await client.query(
    `INSERT INTO audit_log (user_id, production_id, action, metadata)
     VALUES ($1, $2, 'po_status_transition', $3)`,
    [userId, productionId, JSON.stringify({ po_id: poId, from_status: fromStatus, to_status: toStatus })]
  );
};

// ─── GET /api/purchase-orders ─────────────────────────────────────────────────
const getAllPOs = async (req, res) => {
  try {
    const { conditions, params } = buildPoFilterConditions(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT po.*, p.id AS prod_id, p.name AS prod_name, p.status AS prod_status
       FROM   purchase_orders po
       JOIN   productions p ON po.production_id = p.id
       ${where}
       ORDER BY po.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllPOs:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/purchase-orders/export/csv ──────────────────────────────────────
const exportCSV = async (req, res) => {
  try {
    const { conditions, params } = buildPoFilterConditions(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT po.*, p.name AS prod_name,
              u.full_name AS approved_by_name
       FROM   purchase_orders po
       JOIN   productions p ON po.production_id = p.id
       LEFT JOIN users u ON po.approved_by = u.id
       ${where}
       ORDER BY po.created_at DESC`,
      params
    );

    const esc = (v) => {
      if (v === null || v === undefined) return '';
      const s = String(v);
      return (s.includes(',') || s.includes('"') || s.includes('\n') || s.includes('\r'))
        ? `"${s.replace(/"/g, '""')}"`
        : s;
    };
    const fmtD = (d) => d ? new Date(d).toLocaleDateString('en-GB') : '';

    const header = [
      'PO Number', 'Date', 'Supplier', 'Description', 'Set Code', 'Account Code',
      'Net', 'VAT', 'Gross', 'Payment Method', 'Status', 'Approved By', 'Approved At',
    ];
    const lines = [header.map(esc).join(',')];
    rows.forEach(po => {
      lines.push([
        po.po_number,
        fmtD(po.date_of_po),
        po.supplier_name,
        po.description,
        po.set_code,
        po.account_code,
        po.net_amount,
        po.vat,
        po.gross_amount,
        (po.paid_from || '').replace(/_/g, ' '),
        po.status,
        po.approved_by_name,
        fmtD(po.approved_at),
      ].map(esc).join(','));
    });

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-orders-${date}.csv"`);
    res.send(lines.join('\r\n'));
  } catch (err) {
    console.error('exportCSV:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/purchase-orders/export/pdf ──────────────────────────────────────
const exportPDFList = async (req, res) => {
  try {
    const { conditions, params } = buildPoFilterConditions(req.query);
    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT po.*, p.name AS prod_name,
              u.full_name AS approved_by_name
       FROM   purchase_orders po
       JOIN   productions p ON po.production_id = p.id
       LEFT JOIN users u ON po.approved_by = u.id
       ${where}
       ORDER BY po.created_at DESC`,
      params
    );

    const filterSummary = buildFilterSummary(req.query);
    const pdfBuffer = await generatePoListPdf(rows, filterSummary);

    const date = new Date().toISOString().split('T')[0];
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `attachment; filename="purchase-orders-${date}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('exportPDFList:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/purchase-orders ────────────────────────────────────────────────
const createPO = async (req, res) => {
  const {
    supplier_name, supplier_address, date_of_po, production_id,
    set_code, account_code, description, net_amount, vat, gross_amount, paid_from,
  } = req.body;

  if (!supplier_name || !production_id || !net_amount)
    return res.status(400).json({ error: 'supplier_name, production_id, and net_amount are required' });

  const { supplier_email } = req.body;

  try {
    // Block POs on complete or archived productions
    const { rows: [prod] } = await db.query(
      'SELECT status FROM productions WHERE id = $1', [production_id]
    );
    if (!prod) return res.status(400).json({ error: 'Production not found' });
    if (prod.status === 'complete')
      return res.status(400).json({ error: 'Cannot raise new POs on a completed production' });
    if (prod.status === 'archived')
      return res.status(400).json({ error: 'Cannot raise new POs on an archived production' });

    const po_number = await generatePoNumber();
    const net = parseFloat(net_amount);
    // Auto-calculate VAT at 20% if not provided; auto-calculate gross if not provided
    const vatAmount   = vat          !== undefined ? parseFloat(vat)          : Math.round(net * 0.20 * 100) / 100;
    const grossAmount = gross_amount !== undefined ? parseFloat(gross_amount) : Math.round((net + vatAmount) * 100) / 100;

    const { rows } = await db.query(
      `INSERT INTO purchase_orders
         (po_number, supplier_name, supplier_email, supplier_address, date_of_po, production_id,
          set_code, account_code, description, net_amount, vat, gross_amount, paid_from,
          status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,'draft',$14)
       RETURNING *`,
      [
        po_number, supplier_name, supplier_email || null, supplier_address,
        date_of_po || new Date().toISOString().split('T')[0],
        production_id, set_code, account_code, description,
        net, vatAmount, grossAmount,
        paid_from,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createPO:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/purchase-orders/:id ────────────────────────────────────────────
const getPOById = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT po.*, p.id AS prod_id, p.name AS prod_name
       FROM   purchase_orders po
       JOIN   productions p ON po.production_id = p.id
       WHERE  po.id = $1`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Purchase order not found' });
    res.json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT / PATCH /api/purchase-orders/:id ────────────────────────────────────
const updatePO = async (req, res) => {
  const allowed = [
    'supplier_name', 'supplier_email', 'supplier_address', 'date_of_po', 'production_id',
    'set_code', 'account_code', 'description', 'net_amount', 'vat', 'gross_amount', 'paid_from',
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  try {
    const { rows: existing } = await db.query(
      'SELECT status FROM purchase_orders WHERE id = $1',
      [req.params.id]
    );
    if (!existing[0]) return res.status(404).json({ error: 'Purchase order not found' });
    if (existing[0].status === 'approved')
      return res.status(403).json({ error: 'Cannot edit an approved purchase order' });

    const fields    = Object.keys(updates);
    const values    = Object.values(updates);
    const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

    const { rows } = await db.query(
      `UPDATE purchase_orders SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json(rows[0]);
  } catch (err) {
    console.error('updatePO:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/purchase-orders/:id/issue ─────────────────────────────────────
// Sends PO to supplier via email with PDF attachment; advances draft → issued.
const issuePO = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      `SELECT po.*, p.name AS prod_name
       FROM purchase_orders po
       JOIN productions p ON po.production_id = p.id
       WHERE po.id = $1`,
      [req.params.id]
    );
    if (!po)                     { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Purchase order not found' }); }
    if (po.status !== 'draft')   { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only draft POs can be issued' }); }
    if (!po.supplier_email)      { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Supplier email is required to issue a PO' }); }

    // Generate PDF
    const pdfBuffer = await generatePoPdf(po, po.prod_name);

    // Send email with PDF attachment
    const { subject, html } = templates.poIssued(po, po.prod_name);
    await sendEmail({
      from:    '"Construct Scenery" <warren@constructscenery.co.uk>',
      to:      po.supplier_email,
      subject,
      html,
      attachments: [{ filename: `${po.po_number}.pdf`, content: pdfBuffer, contentType: 'application/pdf' }],
    });

    // Advance status
    const { rows: [updated] } = await client.query(
      `UPDATE purchase_orders SET status = 'issued' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logStatusTransition(client, po.id, po.production_id, 'draft', 'issued', req.user.id);

    await client.query('COMMIT');
    res.json({ message: 'PO issued to supplier', purchase_order: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('issuePO:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── POST /api/purchase-orders/:id/submit ────────────────────────────────────
// Advances draft → submitted to signal the PO is ready for approval.
const submitPO = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      'SELECT * FROM purchase_orders WHERE id = $1', [req.params.id]
    );
    if (!po)                    { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Purchase order not found' }); }
    if (po.status !== 'draft')  { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Only draft purchase orders can be submitted' }); }

    const { rows: [updated] } = await client.query(
      `UPDATE purchase_orders SET status = 'submitted' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    await logStatusTransition(client, po.id, po.production_id, 'draft', 'submitted', req.user.id);

    await client.query('COMMIT');
    res.json({ message: 'PO submitted for approval', purchase_order: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── POST /api/purchase-orders/:id/attach-invoice ────────────────────────────
const attachInvoice = async (req, res) => {
  let invoice_attachment_url  = req.body.invoice_attachment_url;
  let invoice_attachment_name = req.body.invoice_attachment_name;

  if (req.file) {
    invoice_attachment_url  = fileUrl(req.file.filename);
    invoice_attachment_name = req.file.originalname;
  }

  if (!invoice_attachment_url)
    return res.status(400).json({ error: 'Provide a file upload or invoice_attachment_url' });

  try {
    const { rows: [existing] } = await db.query(
      'SELECT status FROM purchase_orders WHERE id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });
    if (existing.status === 'approved')
      return res.status(400).json({ error: 'Cannot replace invoice on an approved purchase order' });

    const newStatus = existing.status === 'submitted' ? 'invoice_received' : existing.status;
    const { rows: [updated] } = await db.query(
      `UPDATE purchase_orders
       SET invoice_attachment_url  = $1,
           invoice_attachment_name = $2,
           status = $3
       WHERE id = $4
       RETURNING *`,
      [invoice_attachment_url, invoice_attachment_name, newStatus, req.params.id]
    );
    res.json({ message: 'Invoice attached successfully', purchase_order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/purchase-orders/:id/invoice/download ───────────────────────────
const downloadInvoice = async (req, res) => {
  try {
    const { rows: [po] } = await db.query(
      'SELECT invoice_attachment_url, invoice_attachment_name FROM purchase_orders WHERE id = $1',
      [req.params.id]
    );
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (!po.invoice_attachment_url)
      return res.status(404).json({ error: 'No invoice attached to this purchase order' });

    res.json({ url: po.invoice_attachment_url, filename: po.invoice_attachment_name });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/purchase-orders/:id/invoice ─────────────────────────────────
const deleteInvoice = async (req, res) => {
  try {
    const { rows: [po] } = await db.query(
      'SELECT status, invoice_attachment_url FROM purchase_orders WHERE id = $1',
      [req.params.id]
    );
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'approved')
      return res.status(403).json({ error: 'Cannot delete invoice on an approved purchase order' });
    if (!po.invoice_attachment_url)
      return res.status(404).json({ error: 'No invoice attached to this purchase order' });

    // If pending_approval, revert to issued since it's no longer ready for approval
    const revertStatus = po.status === 'pending_approval' ? 'issued' : po.status;
    await db.query(
      `UPDATE purchase_orders
       SET invoice_attachment_url = NULL, invoice_attachment_name = NULL, status = $1
       WHERE id = $2`,
      [revertStatus, req.params.id]
    );
    res.json({ message: 'Invoice deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/purchase-orders/:id/approve ───────────────────────────────────
// Accountant only. Runs inside a transaction — cost report write and approval are atomic.
const approvePO = async (req, res) => {
  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [po] } = await client.query(
      `SELECT po.*, p.name AS prod_name
       FROM purchase_orders po
       JOIN productions p ON po.production_id = p.id
       WHERE po.id = $1`,
      [req.params.id]
    );

    if (!po)                                                                         { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Purchase order not found' }); }
    if (po.status === 'approved')                                                    { await client.query('ROLLBACK'); return res.status(400).json({ error: 'Purchase order is already approved' }); }
    if (po.status !== 'submitted' && po.status !== 'invoice_received')               { await client.query('ROLLBACK'); return res.status(409).json({ error: 'PO must be submitted before it can be approved' }); }
    if (!po.invoice_attachment_url)                                                  { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Invoice must be attached before this PO can be approved' }); }

    // Update PO status
    const { rows: [updated] } = await client.query(
      `UPDATE purchase_orders
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    // Feed cost into Cost Report (same transaction — rolls back on failure)
    await recordSupplierCost({ ...po, ...updated }, client);

    // Audit log
    await logStatusTransition(client, po.id, po.production_id, po.status, 'approved', req.user.id);

    await client.query('COMMIT');
    res.json({ message: 'PO approved. Costs fed into Cost Report.', purchase_order: updated });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('approvePO:', err);
    res.status(500).json({ error: 'Approval failed — cost report could not be updated. Please try again.' });
  } finally {
    client.release();
  }
};

// ─── DELETE /api/purchase-orders/:id ─────────────────────────────────────────
const deletePO = async (req, res) => {
  try {
    const { rows: [existing] } = await db.query(
      'SELECT status FROM purchase_orders WHERE id = $1',
      [req.params.id]
    );
    if (!existing)               return res.status(404).json({ error: 'Purchase order not found' });
    if (existing.status === 'approved')
      return res.status(403).json({ error: 'Approved purchase orders cannot be deleted' });

    await db.query('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllPOs, createPO, getPOById, updatePO,
  issuePO, submitPO,
  attachInvoice, downloadInvoice, deleteInvoice,
  approvePO, deletePO,
  exportCSV, exportPDFList,
};
