const db          = require('../config/db');
const { fileUrl } = require('../Middleware/upload');

// ─── Helper ───────────────────────────────────────────────────────────────────
const calcSetCountdown = (sets = []) => {
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  return sets.map(set => {
    const days = set.handover_date
      ? Math.ceil((new Date(set.handover_date) - today) / 86400000)
      : null;

    let countdown_colour = null;
    if (days !== null) {
      if      (days > 14) countdown_colour = 'green';
      else if (days > 0)  countdown_colour = 'amber';
      else                countdown_colour = 'red';
    }
    return { ...set, days_until_handover: days, countdown_colour };
  });
};

// ─── Productions ──────────────────────────────────────────────────────────────

// GET /api/productions
const getAllProductions = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.include_archived !== 'true') {
      conditions.push(`status != $${i++}`);
      params.push('archived');
    }
    if (req.query.status) {
      conditions.push(`status = $${i++}`);
      params.push(req.query.status);
    }
    if (req.query.contract_type) {
      conditions.push(`contract_type = $${i++}`);
      params.push(req.query.contract_type);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT p.*,
         COALESCE(sc.total_sets, 0)::int     AS total_sets,
         COALESCE(sc.completed_sets, 0)::int AS completed_sets
       FROM productions p
       LEFT JOIN (
         SELECT production_id,
           COUNT(*)::int AS total_sets,
           COUNT(CASE WHEN completion_status IN ('complete','handed_over') THEN 1 END)::int AS completed_sets
         FROM sets
         GROUP BY production_id
       ) sc ON sc.production_id = p.id
       ${where}
       ORDER BY p.created_at DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllProductions:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions
const createProduction = async (req, res) => {
  const {
    name, production_company, production_designer, production_type,
    start_date, end_date, contract_type, status,
  } = req.body;

  if (!name || !contract_type)
    return res.status(400).json({ error: 'name and contract_type are required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO productions
         (name, production_company, production_designer, production_type,
          start_date, end_date, contract_type, status, created_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        name, production_company, production_designer, production_type,
        start_date, end_date, contract_type,
        status || 'pre_production',
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createProduction:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/productions/:id
const getProductionById = async (req, res) => {
  try {
    const { rows: [production] } = await db.query(
      'SELECT * FROM productions WHERE id = $1',
      [req.params.id]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });

    const [{ rows: sets }, { rows: documents }] = await Promise.all([
      db.query('SELECT * FROM sets WHERE production_id = $1 ORDER BY shoot_week', [req.params.id]),
      db.query('SELECT * FROM production_documents WHERE production_id = $1 ORDER BY uploaded_at DESC', [req.params.id]),
    ]);

    production.sets               = calcSetCountdown(sets);
    production.production_documents = documents;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const handoverDates = production.sets.filter(s => s.handover_date).map(s => new Date(s.handover_date));
    production.days_remaining    = handoverDates.length
      ? Math.ceil((Math.max(...handoverDates) - today) / 86400000)
      : null;
    production.sets_outstanding = production.sets
      .filter(s => !['complete', 'handed_over'].includes(s.completion_status)).length;

    res.json(production);
  } catch (err) {
    console.error('getProductionById:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/productions/:id
const updateProduction = async (req, res) => {
  const allowed = [
    'name', 'production_company', 'production_designer', 'production_type',
    'start_date', 'end_date', 'contract_type', 'status',
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields     = Object.keys(updates);
  const values     = Object.values(updates);
  const setClause  = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows } = await db.query(
      `UPDATE productions SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Production not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateProduction:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/productions/:id/archive-preview
const getArchivePreview = async (req, res) => {
  try {
    const { rows: [production] } = await db.query(
      'SELECT id, name, status FROM productions WHERE id = $1',
      [req.params.id]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });
    if (production.status !== 'complete')
      return res.status(400).json({ error: 'Only complete productions can be archived' });

    const [
      { rows: poRows },
      { rows: tsRows },
      { rows: crewRows },
    ] = await Promise.all([
      db.query('SELECT COUNT(*) AS cnt FROM purchase_orders WHERE production_id = $1', [req.params.id]),
      db.query('SELECT COUNT(*) AS cnt FROM timesheets WHERE production_id = $1', [req.params.id]),
      db.query(
        `SELECT COUNT(DISTINCT crew_member_id) AS cnt FROM timesheets WHERE production_id = $1`,
        [req.params.id]
      ),
    ]);

    res.json({
      production_name: production.name,
      po_count:        parseInt(poRows[0].cnt, 10),
      timesheet_count: parseInt(tsRows[0].cnt, 10),
      crew_count:      parseInt(crewRows[0].cnt, 10),
    });
  } catch (err) {
    console.error('getArchivePreview:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions/:id/archive
const archiveProduction = async (req, res) => {
  const role = req.user?.role;
  if (role !== 'managing_director' && role !== 'construction_accountant')
    return res.status(403).json({ error: 'Only MD or Accountant can archive productions' });

  try {
    const { rows: [existing] } = await db.query(
      'SELECT id, name, status FROM productions WHERE id = $1',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Production not found' });
    if (existing.status !== 'complete')
      return res.status(400).json({ error: 'Only complete productions can be archived' });

    const { rows: [production] } = await db.query(
      `UPDATE productions
         SET status = 'archived', archived_at = NOW()
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, production_id, action, metadata)
       VALUES ($1, $2, 'archived', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ production_name: existing.name })]
    );

    res.json({ message: 'Production archived successfully', production });
  } catch (err) {
    console.error('archiveProduction:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions/:id/unarchive
const unarchiveProduction = async (req, res) => {
  if (req.user?.role !== 'managing_director')
    return res.status(403).json({ error: 'Only MD can unarchive productions' });

  try {
    const { rows: [existing] } = await db.query(
      'SELECT id, name, status FROM productions WHERE id = $1',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Production not found' });
    if (existing.status !== 'archived')
      return res.status(400).json({ error: 'Production is not archived' });

    const { rows: [production] } = await db.query(
      `UPDATE productions
         SET status = 'complete', archived_at = NULL
       WHERE id = $1
       RETURNING *`,
      [req.params.id]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, production_id, action, metadata)
       VALUES ($1, $2, 'unarchived', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ production_name: existing.name })]
    );

    res.json({ message: 'Production unarchived successfully', production });
  } catch (err) {
    console.error('unarchiveProduction:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Sets ──────────────────────────────────────────────────────────────────────

// GET /api/productions/:id/sets
const getSets = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM sets WHERE production_id = $1 ORDER BY shoot_week',
      [req.params.id]
    );
    res.json(calcSetCountdown(rows));
  } catch (err) {
    console.error('getSets:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions/:id/sets
const createSet = async (req, res) => {
  const { set_number, set_name, shoot_week, handover_date, completion_status, notes } = req.body;
  if (!set_name) return res.status(400).json({ error: 'set_name is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO sets
         (production_id, set_number, set_name, shoot_week, handover_date, completion_status, notes)
       VALUES ($1,$2,$3,$4,$5,$6,$7)
       RETURNING *`,
      [req.params.id, set_number, set_name, shoot_week, handover_date, completion_status || 'not_started', notes]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('createSet:', err);
    res.status(500).json({ error: err.message });
  }
};

// PUT /api/productions/:id/sets/:setId
const updateSet = async (req, res) => {
  const allowed = ['set_number', 'set_name', 'shoot_week', 'handover_date', 'completion_status', 'notes'];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  const fields    = Object.keys(updates);
  const values    = Object.values(updates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows } = await db.query(
      `UPDATE sets SET ${setClause}
       WHERE id = $${fields.length + 1} AND production_id = $${fields.length + 2}
       RETURNING *`,
      [...values, req.params.setId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Set not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('updateSet:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/productions/:id/sets/:setId
const deleteSet = async (req, res) => {
  try {
    await db.query(
      'DELETE FROM sets WHERE id = $1 AND production_id = $2',
      [req.params.setId, req.params.id]
    );
    res.json({ message: 'Set deleted successfully' });
  } catch (err) {
    console.error('deleteSet:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Production Documents ──────────────────────────────────────────────────────

// GET /api/productions/:id/documents
const getDocuments = async (req, res) => {
  try {
    const { rows } = await db.query(
      'SELECT * FROM production_documents WHERE production_id = $1 ORDER BY uploaded_at DESC',
      [req.params.id]
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions/:id/documents
const uploadDocument = async (req, res) => {
  let { document_type } = req.body;
  let file_url  = req.body.file_url;
  let file_name = req.body.file_name;

  if (req.file) {
    file_url  = fileUrl(req.file.filename);
    file_name = req.file.originalname;
  }

  if (!file_url || !file_name)
    return res.status(400).json({ error: 'Provide a file upload or file_url + file_name' });

  try {
    const { rows } = await db.query(
      `INSERT INTO production_documents (production_id, document_type, file_url, file_name, uploaded_by)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.params.id, document_type || 'other', file_url, file_name, req.user.id]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllProductions, createProduction, getProductionById, updateProduction,
  getArchivePreview, archiveProduction, unarchiveProduction,
  getSets, createSet, updateSet, deleteSet,
  getDocuments, uploadDocument,
};
