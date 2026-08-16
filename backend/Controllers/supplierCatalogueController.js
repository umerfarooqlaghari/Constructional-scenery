const db  = require('../config/db');
const csv = require('csv-parse/sync');

const REQUIRED_COLS = ['Supplier Name', 'Product Description', 'Unit of Measure', 'Unit Price'];
const TEMPLATE_HEADER = 'Supplier Name,Product Description,Unit of Measure,Unit Price,Notes\r\n';

// ─── GET /api/supplier-catalogue ─────────────────────────────────────────────
// ?supplier=  ?search=  (supplier name autocomplete uses GET /api/supplier-catalogue/suppliers)
const getCatalogue = async (req, res) => {
  try {
    const conds  = [`deleted_at IS NULL`];
    const params = [];
    let   i      = 1;

    if (req.query.supplier) { conds.push(`supplier_name ILIKE $${i++}`); params.push(`%${req.query.supplier}%`); }
    if (req.query.search) {
      conds.push(`(supplier_name ILIKE $${i} OR product_description ILIKE $${i})`);
      params.push(`%${req.query.search}%`);
      i++;
    }

    const { rows } = await db.query(
      `SELECT id, supplier_name, product_description, unit_of_measure, unit_price, notes, created_at, updated_at
       FROM supplier_catalogue
       WHERE ${conds.join(' AND ')}
       ORDER BY supplier_name, product_description`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getCatalogue:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/supplier-catalogue/suppliers ────────────────────────────────────
// Distinct active supplier names — used for autocomplete in forms.
const getSupplierNames = async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT supplier_name
       FROM supplier_catalogue
       WHERE deleted_at IS NULL
       ORDER BY supplier_name`
    );
    res.json(rows.map(r => r.supplier_name));
  } catch (err) {
    console.error('getSupplierNames:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/supplier-catalogue/template ─────────────────────────────────────
// Returns a blank CSV template for bulk import.
const getTemplate = (_req, res) => {
  res.setHeader('Content-Type', 'text/csv; charset=utf-8');
  res.setHeader('Content-Disposition', 'attachment; filename="supplier_catalogue_template.csv"');
  res.send(TEMPLATE_HEADER);
};

// ─── POST /api/supplier-catalogue ────────────────────────────────────────────
const createEntry = async (req, res) => {
  const { supplier_name, product_description, unit_of_measure, unit_price, notes } = req.body;
  if (!supplier_name || !product_description || !unit_of_measure || !unit_price)
    return res.status(400).json({ error: 'supplier_name, product_description, unit_of_measure and unit_price are required' });

  try {
    const { rows: [row] } = await db.query(
      `INSERT INTO supplier_catalogue
         (supplier_name, product_description, unit_of_measure, unit_price, notes)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING id, supplier_name, product_description, unit_of_measure, unit_price, notes, created_at, updated_at`,
      [supplier_name.trim(), product_description.trim(), unit_of_measure.trim(), parseFloat(unit_price), notes || null]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('createEntry:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PATCH /api/supplier-catalogue/:id ───────────────────────────────────────
const updateEntry = async (req, res) => {
  const allowed = ['supplier_name', 'product_description', 'unit_of_measure', 'unit_price', 'notes'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields    = Object.keys(updates);
  const values    = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows: [row] } = await db.query(
      `UPDATE supplier_catalogue
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1} AND deleted_at IS NULL
       RETURNING id, supplier_name, product_description, unit_of_measure, unit_price, notes, updated_at`,
      [...values, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Catalogue entry not found' });
    res.json(row);
  } catch (err) {
    console.error('updateEntry:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/supplier-catalogue/:id ──────────────────────────────────────
// Soft-delete: entry is hidden from list and forecaster dropdown.
// Any saved forecast row that referenced it retains its snapshotted price.
const deleteEntry = async (req, res) => {
  try {
    const { rowCount } = await db.query(
      'UPDATE supplier_catalogue SET deleted_at = NOW() WHERE id = $1 AND deleted_at IS NULL',
      [req.params.id]
    );
    if (!rowCount) return res.status(404).json({ error: 'Catalogue entry not found' });
    res.json({ message: 'Entry deleted' });
  } catch (err) {
    console.error('deleteEntry:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/supplier-catalogue/import ─────────────────────────────────────
// Atomic CSV import. Validates all rows before committing — no partial imports.
// CSV columns: Supplier Name, Product Description, Unit of Measure, Unit Price, Notes (optional)
const importCSV = async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });

  let records;
  try {
    records = csv.parse(req.file.buffer.toString(), {
      columns:           true,
      skip_empty_lines:  true,
      trim:              true,
    });
  } catch (parseErr) {
    return res.status(400).json({ error: `CSV parse error: ${parseErr.message}` });
  }

  if (!records.length)
    return res.status(400).json({ error: 'CSV is empty' });

  // Flexible column mapper helper
  const getCol = (row, candidates) => {
    for (const name of candidates) {
      const key = Object.keys(row).find(k => k.trim().toLowerCase() === name.toLowerCase());
      if (key && row[key] !== undefined && row[key] !== null) return String(row[key]);
    }
    return '';
  };

  // Validate every row before touching the DB
  const errors = [];
  const parsedRows = records.map((row, idx) => {
    const rowNum = idx + 2; // +2 because row 1 is header
    const supplier_name = getCol(row, ['Supplier Name', 'supplier_name', 'Supplier', 'Vendor']).trim();
    const product_description = getCol(row, ['Product Description', 'product_description', 'Description', 'Product', 'Item']).trim();
    const unit_of_measure = getCol(row, ['Unit of Measure', 'unit_of_measure', 'Unit', 'UOM', 'Measure']).trim();
    const priceRaw = getCol(row, ['Unit Price', 'unit_price', 'Price', 'Cost', 'Rate']).trim();
    const notes = getCol(row, ['Notes', 'notes', 'Note', 'Comments', 'Comment']).trim();

    if (!supplier_name)       errors.push({ row: rowNum, field: 'Supplier Name',       message: 'required' });
    if (!product_description) errors.push({ row: rowNum, field: 'Product Description', message: 'required' });
    if (!unit_of_measure)     errors.push({ row: rowNum, field: 'Unit of Measure',     message: 'required' });
    const price = parseFloat(priceRaw);
    if (!priceRaw || isNaN(price) || price < 0) errors.push({ row: rowNum, field: 'Unit Price', message: 'must be a non-negative number' });

    return { supplier_name, product_description, unit_of_measure, unit_price: price, notes: notes || null };
  });

  if (errors.length) return res.status(422).json({ errors });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    for (const r of parsedRows) {
      await client.query(
        `INSERT INTO supplier_catalogue
           (supplier_name, product_description, unit_of_measure, unit_price, notes)
         VALUES ($1,$2,$3,$4,$5)`,
        [r.supplier_name, r.product_description, r.unit_of_measure, r.unit_price, r.notes]
      );
    }
    await client.query('COMMIT');
    res.status(201).json({ imported: parsedRows.length });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('importCSV:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

module.exports = { getCatalogue, getSupplierNames, getTemplate, createEntry, updateEntry, deleteEntry, importCSV };
