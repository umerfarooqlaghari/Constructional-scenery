const db = require('../config/db');

// ─── GET /api/suppliers/names ──────────────────────────────────────────────────
// Distinct active supplier names — used for autocomplete in forms.
const getSupplierNames = async (_req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT DISTINCT name
       FROM suppliers
       ORDER BY name`
    );
    res.json(rows.map(r => r.name));
  } catch (err) {
    console.error('getSupplierNames:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/suppliers ────────────────────────────────────────────────────────
const getSuppliers = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT id, name, email, street_name, city, county, zip_code, phone, notes, created_at, updated_at
       FROM suppliers
       ORDER BY name`
    );
    res.json(rows);
  } catch (err) {
    console.error('getSuppliers:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/suppliers/:id ────────────────────────────────────────────────────
const getSupplierById = async (req, res) => {
  try {
    const { rows: [row] } = await db.query(
      `SELECT id, name, email, street_name, city, county, zip_code, phone, notes, created_at, updated_at
       FROM suppliers
       WHERE id = $1`,
      [req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Supplier not found' });
    res.json(row);
  } catch (err) {
    console.error('getSupplierById:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/suppliers ───────────────────────────────────────────────────────
const createSupplier = async (req, res) => {
  const { name, email, street_name, city, county, zip_code, phone, notes } = req.body;
  if (!name) return res.status(400).json({ error: 'Name is required' });

  try {
    const { rows: [row] } = await db.query(
      `INSERT INTO suppliers (name, email, street_name, city, county, zip_code, phone, notes)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
       RETURNING *`,
      [name.trim(), email || null, street_name || null, city || null, county || null, zip_code || null, phone || null, notes || null]
    );
    res.status(201).json(row);
  } catch (err) {
    console.error('createSupplier:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/suppliers/:id ────────────────────────────────────────────────────
const updateSupplier = async (req, res) => {
  const allowed = ['name', 'email', 'street_name', 'city', 'county', 'zip_code', 'phone', 'notes'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields = Object.keys(updates);
  const values = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows: [row] } = await db.query(
      `UPDATE suppliers
       SET ${setClause}, updated_at = NOW()
       WHERE id = $${fields.length + 1}
       RETURNING *`,
      [...values, req.params.id]
    );
    if (!row) return res.status(404).json({ error: 'Supplier not found' });
    res.json(row);
  } catch (err) {
    console.error('updateSupplier:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/suppliers/:id ─────────────────────────────────────────────────
const deleteSupplier = async (req, res) => {
  try {
    const { rowCount } = await db.query('DELETE FROM suppliers WHERE id = $1', [req.params.id]);
    if (!rowCount) return res.status(404).json({ error: 'Supplier not found' });
    res.json({ message: 'Supplier deleted' });
  } catch (err) {
    console.error('deleteSupplier:', err);
    // Handle foreign key constraint error, though we don't have them yet
    if (err.code === '23503') {
       return res.status(400).json({ error: 'Cannot delete supplier because they are referenced elsewhere.' });
    }
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getSupplierNames,
  getSuppliers,
  getSupplierById,
  createSupplier,
  updateSupplier,
  deleteSupplier
};
