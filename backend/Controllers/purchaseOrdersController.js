const db                    = require('../config/db');
const { sendEmail, templates } = require('../config/email');
const { fileUrl }           = require('../Middleware/upload');

// ─── Helper: generate unique PO number ────────────────────────────────────────
const generatePoNumber = async () => {
  const year = new Date().getFullYear();
  const { rows } = await db.query('SELECT COUNT(*) AS cnt FROM purchase_orders');
  const count = parseInt(rows[0].cnt, 10) || 0;
  return `CS-${year}-${String(count + 1).padStart(4, '0')}`;
};

// ─── GET /api/purchase-orders ─────────────────────────────────────────────────
const getAllPOs = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.production_id) { conditions.push(`po.production_id = $${i++}`);  params.push(req.query.production_id); }
    if (req.query.status)        { conditions.push(`po.status = $${i++}`);          params.push(req.query.status); }
    if (req.query.supplier_name) { conditions.push(`po.supplier_name ILIKE $${i++}`); params.push(`%${req.query.supplier_name}%`); }
    if (req.query.set_code)      { conditions.push(`po.set_code = $${i++}`);         params.push(req.query.set_code); }
    if (req.query.account_code)  { conditions.push(`po.account_code = $${i++}`);     params.push(req.query.account_code); }
    if (req.query.paid_from)     { conditions.push(`po.paid_from = $${i++}`);        params.push(req.query.paid_from); }
    if (req.query.date_from)     { conditions.push(`po.date_of_po >= $${i++}`);      params.push(req.query.date_from); }
    if (req.query.date_to)       { conditions.push(`po.date_of_po <= $${i++}`);      params.push(req.query.date_to); }
    if (req.query.amount_min)       { conditions.push(`po.gross_amount >= $${i++}`);  params.push(req.query.amount_min); }
    if (req.query.amount_max)       { conditions.push(`po.gross_amount <= $${i++}`);  params.push(req.query.amount_max); }
    if (req.query.net_amount_min)   { conditions.push(`po.net_amount >= $${i++}`);    params.push(req.query.net_amount_min); }
    if (req.query.net_amount_max)   { conditions.push(`po.net_amount <= $${i++}`);    params.push(req.query.net_amount_max); }

    if (req.query.include_archived !== 'true') {
      conditions.push(`p.status != $${i++}`);
      params.push('archived');
    }

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
    // STATUS GATE — block POs on complete or archived productions
    const { rows: [prod] } = await db.query(
      'SELECT status FROM productions WHERE id = $1', [production_id]
    );
    if (!prod) return res.status(400).json({ error: 'Production not found' });
    if (prod.status === 'complete')
      return res.status(400).json({ error: 'Cannot raise new POs on a completed production' });
    if (prod.status === 'archived')
      return res.status(400).json({ error: 'Cannot raise new POs on an archived production' });

    const po_number = await generatePoNumber();
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
        parseFloat(net_amount),
        parseFloat(vat || 0),
        parseFloat(gross_amount || net_amount),
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

// ─── PUT /api/purchase-orders/:id ────────────────────────────────────────────
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
      return res.status(400).json({ error: 'Cannot edit an approved purchase order' });

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

// ─── POST /api/purchase-orders/:id/submit ────────────────────────────────────
const submitPO = async (req, res) => {
  try {
    const { rows } = await db.query(
      `UPDATE purchase_orders SET status = 'submitted'
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [req.params.id]
    );
    if (!rows[0]) return res.status(400).json({ error: 'PO not found or not in draft status' });

    const po = rows[0];
    // Send PO email to supplier if they have an email address
    if (po.supplier_email) {
      const { subject, html } = templates.poIssued(po);
      sendEmail({ to: po.supplier_email, subject, html }).catch(err =>
        console.error('PO email send failed (non-critical):', err.message)
      );
    }

    res.json({ message: 'PO submitted and issued to supplier', purchase_order: po });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/purchase-orders/:id/attach-invoice ────────────────────────────
const attachInvoice = async (req, res) => {
  // Accepts either a multipart file upload OR a JSON body with invoice_attachment_url
  let invoice_attachment_url  = req.body.invoice_attachment_url;
  let invoice_attachment_name = req.body.invoice_attachment_name;

  if (req.file) {
    invoice_attachment_url  = fileUrl(req.file.filename);
    invoice_attachment_name = req.file.originalname;
  }

  if (!invoice_attachment_url)
    return res.status(400).json({ error: 'Provide a file upload or invoice_attachment_url' });

  try {
    // Don't downgrade status if already approved
    const { rows } = await db.query(
      `UPDATE purchase_orders
       SET invoice_attachment_url = $1,
           invoice_attachment_name = $2,
           status = CASE WHEN status = 'approved' THEN 'approved' ELSE 'invoice_received' END
       WHERE id = $3
       RETURNING *`,
      [invoice_attachment_url, invoice_attachment_name, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Purchase order not found' });
    res.json({ message: 'Invoice attached successfully', purchase_order: rows[0] });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/purchase-orders/:id/approve ───────────────────────────────────
const approvePO = async (req, res) => {
  try {
    const { rows: [po] } = await db.query(
      'SELECT * FROM purchase_orders WHERE id = $1',
      [req.params.id]
    );

    if (!po)                       return res.status(404).json({ error: 'Purchase order not found' });
    if (po.status === 'draft')     return res.status(400).json({ error: 'Cannot approve a draft PO. Submit it first.' });
    if (po.status === 'approved')  return res.status(400).json({ error: 'Purchase order is already approved' });

    const { rows } = await db.query(
      `UPDATE purchase_orders
       SET status = 'approved', approved_by = $1, approved_at = NOW()
       WHERE id = $2
       RETURNING *`,
      [req.user.id, req.params.id]
    );

    // Cost Report auto-updates via SQL queries on approved POs — no extra insert needed
    res.json({ message: 'PO approved. Costs fed into Cost Report.', purchase_order: rows[0] });
  } catch (err) {
    console.error('approvePO:', err);
    res.status(500).json({ error: err.message });
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
    if (existing.status !== 'draft')
      return res.status(400).json({ error: 'Only draft purchase orders can be deleted' });

    await db.query('DELETE FROM purchase_orders WHERE id = $1', [req.params.id]);
    res.json({ message: 'Purchase order deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllPOs, createPO, getPOById, updatePO, submitPO, attachInvoice, approvePO, deletePO };
