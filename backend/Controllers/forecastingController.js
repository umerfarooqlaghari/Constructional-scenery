const db = require('../config/db');

const DEFAULT_RATIOS = [
  { cost_type: 'Carpenters',  percentage: 0.42 },
  { cost_type: 'Painters',    percentage: 0.18 },
  { cost_type: 'Stagehands',  percentage: 0.09 },
  { cost_type: 'Riggers',     percentage: 0.06 },
  { cost_type: 'Timber',      percentage: 0.09 },
  { cost_type: 'Plasterwork', percentage: 0.06 },
  { cost_type: 'Misc',        percentage: 0.03 },
  { cost_type: 'Sculptors',   percentage: 0.02 },
  { cost_type: 'Metalwork',   percentage: 0.02 },
  { cost_type: 'Paint',       percentage: 0.02 },
  { cost_type: 'Glass',       percentage: 0.01 },
];

// ─── Forecasts ────────────────────────────────────────────────────────────────

// GET /api/forecasting/forecasts
const getAllForecasts = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;
    if (req.query.production_id) { conditions.push(`f.production_id = $${i++}`); params.push(req.query.production_id); }
    if (req.query.include_archived !== 'true') {
      conditions.push(`(p.id IS NULL OR p.status != 'archived')`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT f.*, p.id AS prod_id, p.name AS prod_name
       FROM forecasts f
       LEFT JOIN productions p ON f.production_id = p.id
       ${where}
       ORDER BY f.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/forecasting/forecasts
const createForecast = async (req, res) => {
  const { name, production_id, labour_items, materials_items, percentometer_carpenter_cost } = req.body;
  if (!name) return res.status(400).json({ error: 'name is required' });

  const totalLabour    = (labour_items    || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const totalMaterials = (materials_items || []).reduce((s, i) => s + (i.subtotal || 0), 0);
  const percentometerTotal = percentometer_carpenter_cost
    ? parseFloat(percentometer_carpenter_cost) / 0.42
    : null;

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    const { rows: [forecast] } = await client.query(
      `INSERT INTO forecasts
         (name, production_id, total_labour_cost, total_materials_cost, total_forecast_cost,
          percentometer_carpenter_cost, percentometer_total, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        name,
        production_id || null,
        totalLabour,
        totalMaterials,
        totalLabour + totalMaterials,
        percentometer_carpenter_cost ? parseFloat(percentometer_carpenter_cost) : null,
        percentometerTotal,
        req.user.id,
      ]
    );

    // Insert labour items
    if (labour_items?.length) {
      const labourPlaceholders = labour_items.map((_, idx) => {
        const base = idx * 7;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7})`;
      }).join(',');
      await client.query(
        `INSERT INTO forecast_labour_items
           (forecast_id, crew_type, number_of_crew, number_of_weeks, overtime_hours, weekly_rate, subtotal)
         VALUES ${labourPlaceholders}`,
        labour_items.flatMap(i => [
          forecast.id, i.crew_type, i.number_of_crew || 1, i.number_of_weeks || 1,
          i.overtime_hours || 0, i.weekly_rate || 0, i.subtotal || 0,
        ])
      );
    }

    // Insert materials items
    if (materials_items?.length) {
      const matPlaceholders = materials_items.map((_, idx) => {
        const base = idx * 6;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6})`;
      }).join(',');
      await client.query(
        `INSERT INTO forecast_materials_items
           (forecast_id, supplier_catalogue_id, supplier_name, product_description, unit_price, subtotal)
         VALUES ${matPlaceholders}`,
        materials_items.flatMap(i => [
          forecast.id, i.supplier_catalogue_id || null, i.supplier_name,
          i.product_description, i.unit_price || 0, i.subtotal || 0,
        ])
      );
    }

    await client.query('COMMIT');

    // Fetch full forecast for response
    const { rows: [full] } = await db.query(
      `SELECT f.*, p.id AS prod_id, p.name AS prod_name
       FROM forecasts f
       LEFT JOIN productions p ON f.production_id = p.id
       WHERE f.id = $1`,
      [forecast.id]
    );
    const { rows: labourResult }    = await db.query('SELECT * FROM forecast_labour_items WHERE forecast_id = $1', [forecast.id]);
    const { rows: materialsResult } = await db.query('SELECT * FROM forecast_materials_items WHERE forecast_id = $1', [forecast.id]);

    res.status(201).json({ ...full, forecast_labour_items: labourResult, forecast_materials_items: materialsResult });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createForecast:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// GET /api/forecasting/forecasts/:id
const getForecastById = async (req, res) => {
  try {
    const { rows: [forecast] } = await db.query(
      `SELECT f.*, p.id AS prod_id, p.name AS prod_name
       FROM forecasts f
       LEFT JOIN productions p ON f.production_id = p.id
       WHERE f.id = $1`,
      [req.params.id]
    );
    if (!forecast) return res.status(404).json({ error: 'Forecast not found' });

    const [{ rows: labourItems }, { rows: materialsItems }] = await Promise.all([
      db.query('SELECT * FROM forecast_labour_items WHERE forecast_id = $1', [req.params.id]),
      db.query('SELECT * FROM forecast_materials_items WHERE forecast_id = $1', [req.params.id]),
    ]);

    res.json({ ...forecast, forecast_labour_items: labourItems, forecast_materials_items: materialsItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/forecasting/forecasts/:id
const updateForecast = async (req, res) => {
  const allowed = ['name', 'production_id', 'percentometer_carpenter_cost'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields    = Object.keys(updates);
  const values    = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows: [row] } = await db.query(
      `UPDATE forecasts SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

const deleteForecast = async (req, res) => {
  try {
    await db.query('DELETE FROM forecasts WHERE id = $1', [req.params.id]);
    res.json({ message: 'Forecast deleted' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── Percentometer ────────────────────────────────────────────────────────────

// GET /api/forecasting/percentometer/ratios
const getRatios = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM percentometer_ratios ORDER BY percentage DESC'
    );
    res.json(rows.length ? rows : DEFAULT_RATIOS);
  } catch {
    res.json(DEFAULT_RATIOS);
  }
};

// POST /api/forecasting/percentometer/calculate
const calculatePercentometer = async (req, res) => {
  const { known_cost, known_cost_type } = req.body;
  if (!known_cost) return res.status(400).json({ error: 'known_cost is required' });

  try {
    const { rows } = await db.query(
      'SELECT * FROM percentometer_ratios ORDER BY percentage DESC'
    );
    const activeRatios = rows.length ? rows : DEFAULT_RATIOS;
    const costType     = known_cost_type || 'Carpenters';
    const knownRatio   = activeRatios.find(r => r.cost_type === costType);
    if (!knownRatio)
      return res.status(400).json({ error: `Unknown cost type: ${costType}` });

    const totalEstimate = parseFloat(known_cost) / parseFloat(knownRatio.percentage);
    res.json({
      known_cost:               parseFloat(known_cost),
      known_cost_type:          costType,
      total_estimated_job_cost: totalEstimate,
      breakdown: activeRatios.map(r => ({
        cost_type:       r.cost_type,
        percentage:      parseFloat(r.percentage) * 100,
        estimated_value: totalEstimate * parseFloat(r.percentage),
      })),
    });
  } catch (err) {
    console.error('calculatePercentometer:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/forecasting/percentometer/ratios  (MD only — enforced by policies.json)
const updateRatios = async (req, res) => {
  const { ratios } = req.body;
  if (!Array.isArray(ratios) || !ratios.length)
    return res.status(400).json({ error: 'ratios must be a non-empty array' });

  const total = ratios.reduce((s, r) => s + parseFloat(r.percentage || 0), 0);
  if (Math.abs(total - 1.0) > 0.01)
    return res.status(400).json({ error: 'Percentages must sum to 100% (1.0)' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');
    await client.query('DELETE FROM percentometer_ratios');

    const valuePlaceholders = ratios.map((_, idx) => `($${idx * 2 + 1}, $${idx * 2 + 2})`).join(',');
    const { rows } = await client.query(
      `INSERT INTO percentometer_ratios (cost_type, percentage) VALUES ${valuePlaceholders} RETURNING *`,
      ratios.flatMap(r => [r.cost_type, parseFloat(r.percentage)])
    );
    await client.query('COMMIT');
    res.json({ message: 'Percentometer ratios updated', ratios: rows });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('updateRatios:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── Supplier Catalogue ───────────────────────────────────────────────────────

// GET /api/forecasting/catalogue
const getCatalogue = async (req, res) => {
  try {
    const conditions = [`is_active = true`];
    const params     = [];
    let   i          = 1;

    if (req.query.supplier) { conditions.push(`supplier_name ILIKE $${i++}`); params.push(`%${req.query.supplier}%`); }
    if (req.query.search) {
      conditions.push(`(supplier_name ILIKE $${i} OR product_description ILIKE $${i})`);
      params.push(`%${req.query.search}%`);
      i++;
    }

    const { rows } = await db.query(
      `SELECT * FROM supplier_catalogue WHERE ${conditions.join(' AND ')} ORDER BY supplier_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/forecasting/catalogue
const createCatalogueItem = async (req, res) => {
  const { supplier_name, product_description, unit_of_measure, unit_price, notes } = req.body;
  if (!supplier_name || !product_description || !unit_price)
    return res.status(400).json({ error: 'supplier_name, product_description, and unit_price are required' });

  try {
    const { rows: [row] } = await db.query(
      `INSERT INTO supplier_catalogue (supplier_name, product_description, unit_of_measure, unit_price, notes)
       VALUES ($1,$2,$3,$4,$5) RETURNING *`,
      [supplier_name, product_description, unit_of_measure, parseFloat(unit_price), notes]
    );
    res.status(201).json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/forecasting/catalogue/:id
const updateCatalogueItem = async (req, res) => {
  const allowed = ['supplier_name', 'product_description', 'unit_of_measure', 'unit_price', 'notes', 'is_active'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields    = Object.keys(updates);
  const values    = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows: [row] } = await db.query(
      `UPDATE supplier_catalogue SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    res.json(row);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/forecasting/catalogue/:id  (soft delete — deactivate)
const deleteCatalogueItem = async (req, res) => {
  try {
    await db.query(
      `UPDATE supplier_catalogue SET is_active = false WHERE id = $1`,
      [req.params.id]
    );
    res.json({ message: 'Catalogue entry deactivated' });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── BECTU Rates ──────────────────────────────────────────────────────────────

// GET /api/forecasting/bectu-rates
const getBectuRates = async (req, res) => {
  try {
    const { rows } = await db.query('SELECT * FROM bectu_rates ORDER BY trade, rank');
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllForecasts, createForecast, getForecastById, updateForecast, deleteForecast,
  getRatios, calculatePercentometer, updateRatios,
  getCatalogue, createCatalogueItem, updateCatalogueItem, deleteCatalogueItem,
  getBectuRates,
};
