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
      `SELECT p.*,
              EXISTS(SELECT 1 FROM purchase_orders WHERE production_id = p.id) AS has_linked_pos,
              EXISTS(SELECT 1 FROM timesheets      WHERE production_id = p.id) AS has_linked_timesheets
       FROM   productions p
       WHERE  p.id = $1`,
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

// PUT /api/productions/:id  (status is NOT a free-edit field — use /transition)
const updateProduction = async (req, res) => {
  const allowed = [
    'name', 'production_company', 'production_designer', 'production_type',
    'start_date', 'end_date', 'contract_type',
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  try {
    // Contract type lock: block change if linked POs or timesheets exist
    if (updates.contract_type !== undefined) {
      const { rows: [curr] } = await db.query(
        'SELECT contract_type FROM productions WHERE id = $1', [req.params.id]
      );
      if (curr && curr.contract_type !== updates.contract_type) {
        const { rows: [linked] } = await db.query(
          `SELECT EXISTS(
             SELECT 1 FROM purchase_orders WHERE production_id = $1
             UNION ALL
             SELECT 1 FROM timesheets WHERE production_id = $1
             LIMIT 1
           ) AS has_linked`,
          [req.params.id]
        );
        if (linked?.has_linked)
          return res.status(400).json({
            error: 'Contract type cannot be changed once a purchase order or timesheet has been linked to this production.'
          });
      }
    }

    const fields     = Object.keys(updates);
    const values     = Object.values(updates);
    const setClause  = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

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

// ─── Status Lifecycle ─────────────────────────────────────────────────────────

const STATUS_ORDER = ['pre_production', 'active_build', 'strike', 'complete'];

// Which roles may trigger each forward transition
const FORWARD_ROLES = {
  'pre_production→active_build': ['managing_director', 'construction_coordinator', 'construction_accountant'],
  'active_build→strike':         ['managing_director', 'construction_coordinator', 'construction_accountant'],
  'strike→complete':             ['managing_director', 'construction_accountant'],
};

// POST /api/productions/:id/transition
const transitionStatus = async (req, res) => {
  const { to_status, is_rollback, reason, checklist_confirmed } = req.body;
  const role = req.user?.role;

  if (!to_status) return res.status(400).json({ error: 'to_status is required' });
  if (!STATUS_ORDER.includes(to_status))
    return res.status(400).json({ error: `Invalid status: ${to_status}` });

  try {
    const { rows: [production] } = await db.query(
      'SELECT id, name, status FROM productions WHERE id = $1',
      [req.params.id]
    );
    if (!production) return res.status(404).json({ error: 'Production not found' });
    if (['archived'].includes(production.status))
      return res.status(400).json({ error: 'Archived productions cannot be transitioned' });

    const fromIdx = STATUS_ORDER.indexOf(production.status);
    const toIdx   = STATUS_ORDER.indexOf(to_status);

    // ── Rollback path ──────────────────────────────────────────────────────────
    if (is_rollback || toIdx < fromIdx) {
      if (role !== 'managing_director')
        return res.status(403).json({ error: 'Only MD can roll back production status' });
      if (!reason || reason.trim().length < 20)
        return res.status(400).json({ error: 'Rollback requires a reason of at least 20 characters' });
      if (fromIdx - toIdx !== 1)
        return res.status(400).json({ error: 'Can only roll back one step at a time' });

      const { rows: [updated] } = await db.query(
        `UPDATE productions SET status = $1, rollback_notice = $2 WHERE id = $3 RETURNING *`,
        [to_status, reason.trim(), req.params.id]
      );
      await db.query(
        `INSERT INTO audit_log (user_id, production_id, action, metadata) VALUES ($1, $2, 'status_transition', $3)`,
        [req.user.id, req.params.id, JSON.stringify({
          from_status: production.status, to_status, is_rollback: true, reason: reason.trim()
        })]
      );
      return res.json({ message: `Status rolled back to ${to_status}`, production: updated });
    }

    // ── Forward path ───────────────────────────────────────────────────────────
    if (toIdx !== fromIdx + 1)
      return res.status(400).json({ error: `Cannot skip from ${production.status} to ${to_status}` });

    const key = `${production.status}→${to_status}`;
    const allowedRoles = FORWARD_ROLES[key] ?? [];
    if (!allowedRoles.includes(role))
      return res.status(403).json({ error: `Your role (${role}) cannot make this transition` });

    // Strike → Complete requires checklist
    if (production.status === 'strike' && to_status === 'complete') {
      if (!checklist_confirmed)
        return res.status(400).json({ error: 'Strike → Complete requires checklist confirmation' });
    }

    const { rows: [updated] } = await db.query(
      `UPDATE productions SET status = $1, rollback_notice = NULL WHERE id = $2 RETURNING *`,
      [to_status, req.params.id]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, production_id, action, metadata) VALUES ($1, $2, 'status_transition', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ from_status: production.status, to_status, is_rollback: false })]
    );

    // Trigger Percentometer when moving to Complete
    if (to_status === 'complete') {
      setImmediate(() => runPostProductionPercentometer(req.params.id));
    }

    return res.json({ message: `Status advanced to ${to_status}`, production: updated });
  } catch (err) {
    console.error('transitionStatus:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── Percentometer background job ─────────────────────────────────────────────
const runPostProductionPercentometer = async (productionId, attempt = 1) => {
  try {
    // Mark as processing
    await db.query(
      `UPDATE productions SET post_production_percentometer = $1 WHERE id = $2`,
      [JSON.stringify({ status: 'processing' }), productionId]
    );

    // Pull approved POs grouped by account_code and verified timesheets total
    const [{ rows: poRows }, { rows: tsRows }] = await Promise.all([
      db.query(
        `SELECT account_code, SUM(gross_amount::numeric) AS total
         FROM purchase_orders
         WHERE production_id = $1 AND status = 'approved'
         GROUP BY account_code`,
        [productionId]
      ),
      db.query(
        `SELECT SUM(grand_total::numeric) AS total
         FROM timesheets
         WHERE production_id = $1 AND status = 'verified'`,
        [productionId]
      ),
    ]);

    const materialsTotal = poRows.reduce((s, r) => s + parseFloat(r.total || 0), 0);
    const labourTotal    = parseFloat(tsRows[0]?.total || 0);
    const grandTotal     = materialsTotal + labourTotal;

    await db.query(
      `UPDATE productions SET post_production_percentometer = $1 WHERE id = $2`,
      [
        JSON.stringify({
          status:           'complete',
          labour_total:     labourTotal,
          materials_total:  materialsTotal,
          grand_total:      grandTotal,
          labour_pct:       grandTotal > 0 ? ((labourTotal / grandTotal) * 100).toFixed(1) : '0',
          materials_pct:    grandTotal > 0 ? ((materialsTotal / grandTotal) * 100).toFixed(1) : '0',
          computed_at:      new Date().toISOString(),
        }),
        productionId,
      ]
    );
  } catch (err) {
    console.error(`Percentometer job attempt ${attempt} failed for ${productionId}:`, err.message);
    if (attempt < 3) {
      setTimeout(() => runPostProductionPercentometer(productionId, attempt + 1), 5000 * attempt);
    } else {
      await db.query(
        `UPDATE productions SET post_production_percentometer = $1 WHERE id = $2`,
        [JSON.stringify({ status: 'failed', error: err.message }), productionId]
      ).catch(() => {});
    }
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
      { rows: weekRows },
      { rows: crewRows },
    ] = await Promise.all([
      db.query(
        'SELECT COUNT(*) AS cnt FROM purchase_orders WHERE production_id = $1',
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(DISTINCT week_ending_date) AS cnt FROM timesheets WHERE production_id = $1`,
        [req.params.id]
      ),
      db.query(
        `SELECT COUNT(DISTINCT crew_member_id) AS cnt FROM timesheets WHERE production_id = $1`,
        [req.params.id]
      ),
    ]);

    res.json({
      production_name:  production.name,
      po_count:         parseInt(poRows[0].cnt, 10),
      timesheet_weeks:  parseInt(weekRows[0].cnt, 10),
      crew_count:       parseInt(crewRows[0].cnt, 10),
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
         SET status = 'archived', archived_at = NOW(), archived_by = $2
       WHERE id = $1
       RETURNING *`,
      [req.params.id, req.user.id]
    );

    await db.query(
      `INSERT INTO audit_log (user_id, production_id, action, metadata)
       VALUES ($1, $2, 'archived', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ production_name: existing.name })]
    );

    // Fire Percentometer review asynchronously — does not block response
    setImmediate(() => runPostProductionPercentometer(req.params.id));

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
      `SELECT s.*,
              COALESCE(po_links.cnt, 0)::int AS linked_po_count
       FROM   sets s
       LEFT JOIN (
         SELECT set_code, COUNT(*)::int AS cnt
         FROM   purchase_orders
         WHERE  production_id = $1 AND set_code IS NOT NULL
         GROUP  BY set_code
       ) po_links ON po_links.set_code = s.set_number
       WHERE  s.production_id = $1
       ORDER  BY s.shoot_week NULLS LAST, s.handover_date ASC NULLS LAST`,
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

// PATCH /api/productions/:id/sets/:setId  (inline completion_status update)
const patchSet = async (req, res) => {
  const { completion_status } = req.body;
  if (!completion_status) return res.status(400).json({ error: 'completion_status is required' });
  try {
    const { rows } = await db.query(
      `UPDATE sets SET completion_status = $1 WHERE id = $2 AND production_id = $3 RETURNING *`,
      [completion_status, req.params.setId, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Set not found' });
    res.json(rows[0]);
  } catch (err) {
    console.error('patchSet:', err);
    res.status(500).json({ error: err.message });
  }
};

// DELETE /api/productions/:id/sets/:setId
const deleteSet = async (req, res) => {
  try {
    // Guard: check linked purchase orders
    const { rows: [setRow] } = await db.query(
      'SELECT set_number FROM sets WHERE id = $1 AND production_id = $2',
      [req.params.setId, req.params.id]
    );
    if (!setRow) return res.status(404).json({ error: 'Set not found' });

    if (setRow.set_number) {
      const { rows: [linked] } = await db.query(
        'SELECT COUNT(*) AS cnt FROM purchase_orders WHERE production_id = $1 AND set_code = $2',
        [req.params.id, setRow.set_number]
      );
      if (parseInt(linked.cnt, 10) > 0)
        return res.status(400).json({
          error: 'This set has linked purchase orders or timesheet entries.'
        });
    }

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

const fileStorage = require('../services/fileStorage');

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
  if (!req.file)
    return res.status(400).json({ error: 'No file provided' });

  try {
    // Server-side validation (mime type + size already checked by documentUpload multer)
    fileStorage.validate(req.file.mimetype, req.file.size);

    const { url, key, size } = fileStorage.store(req.file);

    const { rows } = await db.query(
      `INSERT INTO production_documents
         (production_id, document_type, file_url, file_key, file_name, file_size, file_mime_type, uploaded_by)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8)
       RETURNING *`,
      [
        req.params.id,
        req.body.document_type || 'other',
        url, key,
        req.file.originalname,
        size,
        req.file.mimetype,
        req.user.id,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    console.error('uploadDocument:', err);
    res.status(err.status ?? 500).json({ error: err.message });
  }
};

// DELETE /api/productions/:id/documents/:docId
const deleteDocument = async (req, res) => {
  try {
    const { rows: [doc] } = await db.query(
      'SELECT * FROM production_documents WHERE id = $1 AND production_id = $2',
      [req.params.docId, req.params.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // RBAC: uploader or MD
    if (doc.uploaded_by !== req.user.id && req.user.role !== 'managing_director')
      return res.status(403).json({ error: 'Only the uploader or MD can delete documents' });

    // Delete from storage (non-fatal if file already gone)
    await fileStorage.deleteFile(doc.file_key ?? doc.file_name).catch(e =>
      console.error('fileStorage.deleteFile failed (non-fatal):', e.message)
    );

    await db.query('DELETE FROM production_documents WHERE id = $1', [req.params.docId]);

    await db.query(
      `INSERT INTO audit_log (user_id, production_id, action, metadata)
       VALUES ($1, $2, 'document_deleted', $3)`,
      [req.user.id, req.params.id, JSON.stringify({ file_name: doc.file_name })]
    );

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('deleteDocument:', err);
    res.status(500).json({ error: err.message });
  }
};

// GET /api/productions/audit-log  (MD only)
const getAuditLog = async (req, res) => {
  if (req.user?.role !== 'managing_director')
    return res.status(403).json({ error: 'Only MD can view the audit log' });
  try {
    const { rows } = await db.query(
      `SELECT al.id, al.action, al.created_at,
              al.metadata,
              u.full_name AS performed_by,
              p.name AS production_name
       FROM audit_log al
       JOIN users u ON al.user_id = u.id
       LEFT JOIN productions p ON al.production_id = p.id
       WHERE al.action IN ('archived', 'unarchived')
       ORDER BY al.created_at DESC
       LIMIT 200`,
      []
    );
    res.json(rows);
  } catch (err) {
    console.error('getAuditLog:', err);
    res.status(500).json({ error: err.message });
  }
};

// POST /api/productions/handover-alerts  (called by cron/scheduler)
const sendHandoverAlerts = async (req, res) => {
  const { sendEmail, templates } = require('../config/email');
  try {
    const { rows: sets14 } = await db.query(
      `SELECT s.*, p.name AS production_name
       FROM sets s
       JOIN productions p ON s.production_id = p.id
       WHERE s.handover_date = CURRENT_DATE + INTERVAL '14 days'
         AND s.completion_status != 'handed_over'`
    );
    const { rows: sets7 } = await db.query(
      `SELECT s.*, p.name AS production_name
       FROM sets s
       JOIN productions p ON s.production_id = p.id
       WHERE s.handover_date = CURRENT_DATE + INTERVAL '7 days'
         AND s.completion_status != 'handed_over'`
    );

    const alerts = [
      ...sets14.map(s => ({ set: s, days: 14 })),
      ...sets7.map(s => ({ set: s, days: 7 })),
    ];

    const results = await Promise.allSettled(
      alerts.map(({ set, days }) => {
        const subject = `⚠ Set handover alert: ${set.set_name} — ${days} days`;
        const html = `<p><strong>${set.set_name}</strong> (${set.set_number ?? 'no code'}) on production <strong>${set.production_name}</strong> has its handover date in <strong>${days} days</strong> (${set.handover_date?.split('T')[0]}).</p><p>Current status: ${set.completion_status}</p>`;
        return sendEmail({ to: process.env.ALERT_EMAIL || process.env.SMTP_USER, subject, html });
      })
    );

    const sent = results.filter(r => r.status === 'fulfilled').length;
    res.json({ message: `Handover alerts sent`, sent, total: alerts.length });
  } catch (err) {
    console.error('sendHandoverAlerts:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllProductions, createProduction, getProductionById, updateProduction,
  transitionStatus,
  getArchivePreview, archiveProduction, unarchiveProduction, getAuditLog,
  getSets, createSet, updateSet, patchSet, deleteSet,
  sendHandoverAlerts,
  getDocuments, uploadDocument, deleteDocument,
};
