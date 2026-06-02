const db            = require('../config/db');
const { fileUrl }   = require('../Middleware/upload');
const { encrypt, decrypt } = require('../config/crypto');

// Fields that are encrypted at rest in crew_members
const ENCRYPTED_FIELDS = new Set([
  'home_address', 'account_name', 'account_number',
  'sort_code', 'emergency_contact_phone',
]);

function encryptCrewFields(data) {
  const out = { ...data };
  for (const field of ENCRYPTED_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = encrypt(String(out[field]));
    }
  }
  return out;
}

function decryptCrewMember(row) {
  if (!row) return row;
  const out = { ...row };
  for (const field of ENCRYPTED_FIELDS) {
    if (out[field] !== undefined && out[field] !== null) {
      out[field] = decrypt(out[field]);
    }
  }
  return out;
}

// ─── Trade / rank reference data ──────────────────────────────────────────────
const BECTU_TRADES = {
  Carpenters:          ['HOD', 'Supervisor', 'Chargehand', 'Carpenter'],
  Machinists:          ['HOD', 'Supervisor', 'Chargehand', 'Machinist'],
  Stagehands:          ['HOD', 'Supervisor', 'Chargehand', 'Stagehand NVQ/BLSS', 'Stagehand'],
  Riggers:             ['HOD', 'Supervisor', 'Chargehand', 'Rigger'],
  Plasterers:          ['HOD', 'Supervisor', 'Chargehand', 'Plasterer'],
  'Scenic Painters':   ['HOD', 'Supervisor', 'Chargehand', 'Painter'],
  Sculptors:           ['HOD', 'Supervisor', 'Chargehand', 'Sculptor', 'Sculptor Modeller'],
  'Metal Workers':     ['HOD', 'Supervisor', 'Chargehand', 'Metal Worker'],
  'Plasterers Lab':    ['HOD', 'Supervisor', 'Chargehand', 'Lab Worker'],
  'Painters Lab':      ['HOD', 'Supervisor', 'Chargehand', 'Lab Worker'],
  'Sculptors Lab':     ['HOD', 'Supervisor', 'Chargehand', 'Lab Worker'],
  'Metal Workers Lab': ['HOD', 'Supervisor', 'Chargehand', 'Lab Worker'],
};
const NON_BECTU_ROLES = [
  'Construction Accountant', 'Construction Coordinator', 'Construction Manager', 'Luton Driver',
];

const generateCrewNumber = async () => {
  const { rows } = await db.query('SELECT COUNT(*) AS cnt FROM crew_members');
  const count = parseInt(rows[0].cnt, 10) || 0;
  return `CSC-${String(count + 1).padStart(4, '0')}`;
};

// ─── GET /api/crew/trades ─────────────────────────────────────────────────────
const getTrades = (req, res) => {
  res.json({ bectu: BECTU_TRADES, non_bectu: NON_BECTU_ROLES });
};

// ─── GET /api/crew ────────────────────────────────────────────────────────────
const getAllCrew = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.is_active !== undefined) {
      conditions.push(`cm.is_active = $${i++}`);
      params.push(req.query.is_active === 'true');
    }
    if (req.query.employment_status) {
      conditions.push(`cm.employment_status = $${i++}`);
      params.push(req.query.employment_status);
    }
    if (req.query.crew_trade) {
      conditions.push(`cm.crew_trade = $${i++}`);
      params.push(req.query.crew_trade);
    }
    if (req.query.crew_rank) {
      conditions.push(`cm.crew_rank = $${i++}`);
      params.push(req.query.crew_rank);
    }
    if (req.query.search) {
      conditions.push(
        `(cm.first_name ILIKE $${i} OR cm.last_name ILIKE $${i} OR cm.crew_number ILIKE $${i})`
      );
      params.push(`%${req.query.search}%`);
      i++;
    }
    if (req.query.production_id) {
      conditions.push(
        `EXISTS (SELECT 1 FROM production_crew pc WHERE pc.crew_member_id = cm.id AND pc.production_id = $${i++})`
      );
      params.push(req.query.production_id);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT cm.id, cm.crew_number, cm.first_name, cm.last_name, cm.email, cm.employment_status,
              cm.crew_trade, cm.crew_rank, cm.company_name, cm.is_active,
              COALESCE(
                (SELECT ARRAY_AGG(p.name ORDER BY p.name)
                 FROM production_crew pc
                 JOIN productions p ON pc.production_id = p.id
                 WHERE pc.crew_member_id = cm.id AND p.status NOT IN ('archived','complete')),
                ARRAY[]::text[]
              ) AS active_productions
       FROM crew_members cm ${where}
       ORDER BY cm.last_name`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllCrew:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/crew ───────────────────────────────────────────────────────────
const createCrewMember = async (req, res) => {
  const {
    first_name, last_name, date_of_birth, home_address, email,
    employment_status, crew_trade, crew_rank, paye_withholding_rate,
    company_name, company_registration_number, vat_registration_number,
    account_name, account_number, sort_code,
    emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
  } = req.body;

  if (!first_name || !last_name || !employment_status || !crew_trade || !crew_rank)
    return res.status(400).json({
      error: 'first_name, last_name, employment_status, crew_trade, and crew_rank are required',
    });

  try {
    const crew_number = await generateCrewNumber();
    const { rows } = await db.query(
      `INSERT INTO crew_members
         (crew_number, first_name, last_name, date_of_birth, home_address, email,
          employment_status, crew_trade, crew_rank, paye_withholding_rate,
          company_name, company_registration_number, vat_registration_number,
          account_name, account_number, sort_code,
          emergency_contact_name, emergency_contact_relationship, emergency_contact_phone,
          is_active)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,$13,$14,$15,$16,$17,$18,$19,true)
       RETURNING *`,
      [
        crew_number, first_name, last_name, date_of_birth || null,
        encrypt(home_address) || null,
        email || null,
        employment_status, crew_trade, crew_rank,
        parseFloat(paye_withholding_rate || 0),
        company_name, company_registration_number, vat_registration_number,
        encrypt(account_name) || null,
        encrypt(account_number) || null,
        encrypt(sort_code) || null,
        emergency_contact_name, emergency_contact_relationship,
        encrypt(emergency_contact_phone) || null,
      ]
    );
    res.status(201).json(decryptCrewMember(rows[0]));
  } catch (err) {
    console.error('createCrewMember:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/crew/:id ────────────────────────────────────────────────────────
const getCrewById = async (req, res) => {
  try {
    const { rows: [member] } = await db.query(
      'SELECT * FROM crew_members WHERE id = $1',
      [req.params.id]
    );
    if (!member) return res.status(404).json({ error: 'Crew member not found' });

    // Bank details visible to Coordinator and Accountant only — not MD
    const canSeeBankDetails = ['construction_coordinator', 'construction_accountant'].includes(req.user?.role);
    if (!canSeeBankDetails) {
      delete member.account_name;
      delete member.account_number;
      delete member.sort_code;
    }

    const [{ rows: productionHistory }, { rows: timesheetHistory }, { rows: documents }] =
      await Promise.all([
        db.query(
          `SELECT pc.*, p.id AS prod_id, p.name AS prod_name, p.status AS prod_status
           FROM   production_crew pc
           JOIN   productions p ON pc.production_id = p.id
           WHERE  pc.crew_member_id = $1
           ORDER BY pc.start_date DESC`,
          [req.params.id]
        ),
        db.query(
          `SELECT t.id, t.week_ending_date, t.status, t.grand_total, p.id AS prod_id, p.name AS prod_name
           FROM   timesheets t
           JOIN   productions p ON t.production_id = p.id
           WHERE  t.crew_member_id = $1
           ORDER BY t.week_ending_date DESC`,
          [req.params.id]
        ),
        db.query(
          `SELECT cd.*, p.name AS production_name
           FROM crew_documents cd
           LEFT JOIN productions p ON cd.production_id = p.id
           WHERE cd.crew_member_id = $1
           ORDER BY cd.uploaded_at DESC`,
          [req.params.id]
        ),
      ]);

    res.json({
      ...decryptCrewMember(member),
      production_history:  productionHistory,
      timesheet_history:   timesheetHistory,
      documents,
    });
  } catch (err) {
    console.error('getCrewById:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/crew/:id ────────────────────────────────────────────────────────
const updateCrewMember = async (req, res) => {
  const allowed = [
    'first_name', 'last_name', 'date_of_birth', 'home_address', 'email',
    'employment_status', 'crew_trade', 'crew_rank', 'paye_withholding_rate',
    'company_name', 'company_registration_number', 'vat_registration_number',
    'account_name', 'account_number', 'sort_code',
    'emergency_contact_name', 'emergency_contact_relationship', 'emergency_contact_phone',
    'is_active',
  ];
  const updates = {};
  allowed.forEach(f => { if (req.body[f] !== undefined) updates[f] = req.body[f]; });

  if (!Object.keys(updates).length)
    return res.status(400).json({ error: 'No updatable fields provided' });

  // Encrypt sensitive fields before building the query
  const encryptedUpdates = encryptCrewFields(updates);

  const fields    = Object.keys(encryptedUpdates);
  const values    = Object.values(encryptedUpdates);
  const setClause = fields.map((f, i) => `${f} = $${i + 1}`).join(', ');

  try {
    const { rows } = await db.query(
      `UPDATE crew_members SET ${setClause} WHERE id = $${fields.length + 1} RETURNING *`,
      [...values, req.params.id]
    );
    if (!rows[0]) return res.status(404).json({ error: 'Crew member not found' });
    res.json(decryptCrewMember(rows[0]));
  } catch (err) {
    console.error('updateCrewMember:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/crew/:id/documents ─────────────────────────────────────────────
const addDocument = async (req, res) => {
  const fileStorage = require('../services/fileStorage');
  if (!req.file) return res.status(400).json({ error: 'No file provided' });

  const { context_type, production_id } = req.body;
  const validContextTypes = ['crew_identity', 'crew_contract'];
  if (!context_type || !validContextTypes.includes(context_type))
    return res.status(400).json({ error: `context_type must be one of: ${validContextTypes.join(', ')}` });
  if (context_type === 'crew_contract' && !production_id)
    return res.status(400).json({ error: 'production_id is required for crew_contract documents' });

  try {
    fileStorage.validate(req.file.mimetype, req.file.size);
    const { url, key, size } = fileStorage.store(req.file);

    const docType = context_type === 'crew_contract' ? 'contract' : 'government_id';

    const { rows } = await db.query(
      `INSERT INTO crew_documents
         (crew_member_id, document_type, context_type, production_id, file_url, file_key, file_name, file_size, file_mime_type)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9)
       RETURNING *`,
      [
        req.params.id, docType, context_type,
        context_type === 'crew_contract' ? production_id : null,
        url, key, req.file.originalname, size, req.file.mimetype,
      ]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(err.status ?? 500).json({ error: err.message });
  }
};

// ─── DELETE /api/crew/:id/documents/:docId ────────────────────────────────────
const deleteDocument = async (req, res) => {
  const fileStorage = require('../services/fileStorage');

  // Only Coordinators can delete crew documents
  if (req.user?.role !== 'construction_coordinator')
    return res.status(403).json({ error: 'Only Coordinators can delete crew documents' });

  try {
    const { rows: [doc] } = await db.query(
      'SELECT * FROM crew_documents WHERE id = $1 AND crew_member_id = $2',
      [req.params.docId, req.params.id]
    );
    if (!doc) return res.status(404).json({ error: 'Document not found' });

    // Delete file from storage
    await fileStorage.deleteFile(doc.file_key ?? doc.file_name).catch(e =>
      console.error('fileStorage.deleteFile non-fatal:', e.message)
    );

    await db.query('DELETE FROM crew_documents WHERE id = $1', [req.params.docId]);

    // Get crew member name for audit log
    const { rows: [cm] } = await db.query('SELECT first_name, last_name FROM crew_members WHERE id = $1', [req.params.id]);
    await db.query(
      `INSERT INTO audit_log (user_id, action, metadata) VALUES ($1, 'crew_document_deleted', $2)`,
      [req.user.id, JSON.stringify({
        crew_member:   cm ? `${cm.first_name} ${cm.last_name}` : req.params.id,
        document_type: doc.context_type ?? doc.document_type,
        file_name:     doc.file_name,
        production_id: doc.production_id ?? null,
      })]
    );

    res.json({ message: 'Document deleted' });
  } catch (err) {
    console.error('deleteDocument:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/crew/:id/productions ──────────────────────────────────────────
const linkToProduction = async (req, res) => {
  const { production_id, start_date, end_date, contract_url } = req.body;
  if (!production_id)
    return res.status(400).json({ error: 'production_id is required' });

  try {
    const { rows } = await db.query(
      `INSERT INTO production_crew (crew_member_id, production_id, start_date, end_date, contract_url)
       VALUES ($1,$2,$3,$4,$5)
       RETURNING *`,
      [req.params.id, production_id, start_date, end_date, contract_url]
    );
    res.status(201).json(rows[0]);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── DELETE /api/crew/:id ─────────────────────────────────────────────────────
const deleteCrewMember = async (req, res) => {
  try {
    const { rows: [member] } = await db.query(
      'SELECT id, first_name, last_name, is_active FROM crew_members WHERE id = $1',
      [req.params.id]
    );
    if (!member) return res.status(404).json({ error: 'Crew member not found' });

    // Hard-delete guard: check for timesheets or production engagements
    const { rows: [linked] } = await db.query(
      `SELECT (
         EXISTS(SELECT 1 FROM timesheets     WHERE crew_member_id = $1) OR
         EXISTS(SELECT 1 FROM production_crew WHERE crew_member_id = $1)
       ) AS has_records`,
      [req.params.id]
    );

    if (linked.has_records) {
      // Soft delete — deactivate instead
      await db.query('UPDATE crew_members SET is_active = false WHERE id = $1', [req.params.id]);
      return res.json({
        message: `${member.first_name} ${member.last_name} has been deactivated (linked records exist — hard delete prevented).`,
        soft_deleted: true,
      });
    }

    await db.query('DELETE FROM crew_members WHERE id = $1', [req.params.id]);
    res.json({ message: `${member.first_name} ${member.last_name} has been permanently deleted.`, soft_deleted: false });
  } catch (err) {
    console.error('deleteCrewMember:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getTrades, getAllCrew, createCrewMember, getCrewById, updateCrewMember,
  deleteCrewMember, addDocument, deleteDocument, linkToProduction,
};
