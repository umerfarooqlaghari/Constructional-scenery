const fs = require('fs');

// Read the backup file
let lines = fs.readFileSync('Controllers/purchaseOrdersController.js.bak', 'utf8').split('\n');

// 1. Cut off everything from line 554 down (index 553)
lines = lines.slice(0, 553);

const newFunctions = `

// ─── POST /api/purchase-orders/:id/attach-confirmation ───────────────────────
const attachConfirmation = async (req, res) => {
  let confirmation_attachment_url  = req.body.confirmation_attachment_url;
  let confirmation_attachment_name = req.body.confirmation_attachment_name;

  try {
    if (req.file) {
      const { url } = await fileStorage.store(req.file);
      confirmation_attachment_url  = url;
      confirmation_attachment_name = req.file.originalname;
    }

    if (!confirmation_attachment_url)
      return res.status(400).json({ error: 'Provide a file upload or confirmation_attachment_url' });

    const { rows: [existing] } = await db.query(
      'SELECT status FROM purchase_orders WHERE id = $1', [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Purchase order not found' });

    const { rows: [updated] } = await db.query(
      \`UPDATE purchase_orders
       SET confirmation_attachment_url  = $1,
           confirmation_attachment_name = $2
       WHERE id = $3
       RETURNING *\`,
      [confirmation_attachment_url, confirmation_attachment_name, req.params.id]
    );
    res.json({ message: 'Order confirmation attached successfully', purchase_order: updated });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/purchase-orders/:id/pdf ─────────────────────────────────────────
const downloadPdf = async (req, res) => {
  try {
    const { rows: [po] } = await db.query(
      \`SELECT po.*, p.name AS prod_name
       FROM purchase_orders po
       JOIN productions p ON po.production_id = p.id
       WHERE po.id = $1\`,
      [req.params.id]
    );
    if (!po) return res.status(404).json({ error: 'Purchase order not found' });

    const pdfBuffer = await generatePoPdf(po, po.prod_name);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', \`attachment; filename="\${po.po_number}.pdf"\`);
    res.send(pdfBuffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAccountCodes,
  getAllPOs, getPOById, updatePO,
  createPO,
  issuePO, submitPO,
  attachInvoice, downloadInvoice, deleteInvoice,
  attachConfirmation,
  approvePO, deletePO,
  exportCSV, exportPDFList, downloadPdf,
};
`;

// Append new functions and exports
let content = lines.join('\n') + newFunctions;

// Remove the invoice attachment check from approvePO
const checkToRemove = `    if (!po.invoice_attachment_url)                                                  { await client.query('ROLLBACK'); return res.status(409).json({ error: 'Invoice must be attached before this PO can be approved' }); }`;
content = content.replace(checkToRemove, '');

fs.writeFileSync('Controllers/purchaseOrdersController.js', content, 'utf8');
console.log('File successfully rebuilt.');
