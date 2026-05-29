const db = require('../config/db');
const { encrypt, decrypt } = require('../config/crypto');

// ─── GET /api/pay-runs ────────────────────────────────────────────────────────
const getAllPayRuns = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.production_id) { conditions.push(`pr.production_id = $${i++}`); params.push(req.query.production_id); }
    if (req.query.status)        { conditions.push(`pr.status = $${i++}`);         params.push(req.query.status); }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT pr.*, p.id AS prod_id, p.name AS prod_name
       FROM   pay_runs pr
       JOIN   productions p ON pr.production_id = p.id
       ${where}
       ORDER BY pr.week_ending_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/pay-runs ───────────────────────────────────────────────────────
const createPayRun = async (req, res) => {
  const { production_id, week_ending_date } = req.body;
  if (!production_id || !week_ending_date)
    return res.status(400).json({ error: 'production_id and week_ending_date are required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Get all timesheets with crew bank details (bank fields are encrypted at rest)
    const { rows: timesheets } = await client.query(
      `SELECT t.*,
              cm.employment_status, cm.paye_withholding_rate, cm.crew_number,
              cm.sort_code, cm.account_number, cm.account_name
       FROM   timesheets t
       JOIN   crew_members cm ON t.crew_member_id = cm.id
       WHERE  t.production_id = $1 AND t.week_ending_date = $2`,
      [production_id, week_ending_date]
    );

    const unverified = timesheets.filter(t => t.status !== 'verified');
    if (unverified.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({
        error: `${unverified.length} timesheet(s) not yet verified. All must be verified before processing a pay run.`,
      });
    }
    if (!timesheets.length) {
      await client.query('ROLLBACK');
      return res.status(400).json({ error: 'No verified timesheets found for this week' });
    }

    const { rows: [payRun] } = await client.query(
      `INSERT INTO pay_runs (production_id, week_ending_date, status, created_by)
       VALUES ($1,$2,'draft',$3)
       RETURNING *`,
      [production_id, week_ending_date, req.user.id]
    );

    // Decrypt bank details from crew_members, then re-encrypt for storage in pay_run_items
    const items = timesheets.map(ts => {
      const grossAmount  = parseFloat(ts.grand_total || 0);
      const isPAYE       = ts.employment_status === 'paye';
      const withholdRate = isPAYE ? (parseFloat(ts.paye_withholding_rate || 0) / 100) : 0;
      const withholdAmt  = grossAmount * withholdRate;

      const sortCode     = decrypt(ts.sort_code);
      const accountNum   = decrypt(ts.account_number);
      const accountName  = decrypt(ts.account_name);

      return {
        pay_run_id:         payRun.id,
        timesheet_id:       ts.id,
        crew_member_id:     ts.crew_member_id,
        employment_type:    ts.employment_status,
        gross_amount:       grossAmount,
        withholding_amount: withholdAmt,
        net_amount:         grossAmount - withholdAmt,
        sort_code:          encrypt(sortCode),
        account_number:     encrypt(accountNum),
        account_name:       encrypt(accountName),
        reference:          `${ts.crew_number}-${week_ending_date}`,
      };
    });

    if (items.length) {
      const valuePlaceholders = items.map((_, idx) => {
        const base = idx * 11;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`;
      }).join(',');

      await client.query(
        `INSERT INTO pay_run_items
           (pay_run_id, timesheet_id, crew_member_id, employment_type,
            gross_amount, withholding_amount, net_amount, sort_code, account_number, account_name, reference)
         VALUES ${valuePlaceholders}`,
        items.flatMap(i => [
          i.pay_run_id, i.timesheet_id, i.crew_member_id, i.employment_type,
          i.gross_amount, i.withholding_amount, i.net_amount,
          i.sort_code, i.account_number, i.account_name, i.reference,
        ])
      );
    }

    await client.query('COMMIT');

    const { rows: itemsResult } = await db.query(
      `SELECT pri.*, cm.first_name, cm.last_name, cm.crew_number
       FROM pay_run_items pri
       JOIN crew_members cm ON pri.crew_member_id = cm.id
       WHERE pri.pay_run_id = $1`,
      [payRun.id]
    );

    // Decrypt bank details in response items
    const decryptedItems = itemsResult.map(item => ({
      ...item,
      sort_code:      decrypt(item.sort_code),
      account_number: decrypt(item.account_number),
      account_name:   decrypt(item.account_name),
    }));

    res.status(201).json({
      message:  'Pay run created successfully',
      pay_run:  { ...payRun, pay_run_items: decryptedItems },
      summary: {
        total_crew:     items.length,
        total_gross:    items.reduce((s, i) => s + i.gross_amount,       0),
        total_withheld: items.reduce((s, i) => s + i.withholding_amount, 0),
        total_net:      items.reduce((s, i) => s + i.net_amount,         0),
      },
    });
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('createPayRun:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── GET /api/pay-runs/:id ────────────────────────────────────────────────────
const getPayRunById = async (req, res) => {
  try {
    const { rows: [payRun] } = await db.query(
      `SELECT pr.*, p.id AS prod_id, p.name AS prod_name
       FROM pay_runs pr
       JOIN productions p ON pr.production_id = p.id
       WHERE pr.id = $1`,
      [req.params.id]
    );
    if (!payRun) return res.status(404).json({ error: 'Pay run not found' });

    const { rows: items } = await db.query(
      `SELECT pri.*, cm.crew_number, cm.first_name, cm.last_name, cm.employment_status, cm.crew_trade, cm.crew_rank
       FROM pay_run_items pri
       JOIN crew_members cm ON pri.crew_member_id = cm.id
       WHERE pri.pay_run_id = $1`,
      [req.params.id]
    );

    const decryptedItems = items.map(item => ({
      ...item,
      sort_code:      decrypt(item.sort_code),
      account_number: decrypt(item.account_number),
      account_name:   decrypt(item.account_name),
    }));

    res.json({ ...payRun, pay_run_items: decryptedItems });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/pay-runs/:id/process ──────────────────────────────────────────
const processPayRun = async (req, res) => {
  try {
    const { rows: [pr] } = await db.query(
      `UPDATE pay_runs SET status = 'processed', processed_at = NOW()
       WHERE id = $1 AND status = 'draft'
       RETURNING *`,
      [req.params.id]
    );
    if (!pr) return res.status(400).json({ error: 'Pay run not found or already processed' });
    res.json({ message: 'Pay run marked as processed', pay_run: pr });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/pay-runs/:id/export-csv ────────────────────────────────────────
const exportCsv = async (req, res) => {
  try {
    const { rows: [payRun] } = await db.query(
      `SELECT pr.*, p.name AS prod_name
       FROM pay_runs pr
       JOIN productions p ON pr.production_id = p.id
       WHERE pr.id = $1`,
      [req.params.id]
    );
    if (!payRun) return res.status(404).json({ error: 'Pay run not found' });

    const { rows: items } = await db.query(
      `SELECT pri.sort_code, pri.account_number, pri.account_name, pri.net_amount, pri.reference
       FROM pay_run_items pri
       WHERE pri.pay_run_id = $1`,
      [req.params.id]
    );

    const headers = ['Sort Code', 'Account Number', 'Account Name', 'Amount', 'Reference'];
    const csvRows = items.map(item => [
      decrypt(item.sort_code)      || '',
      decrypt(item.account_number) || '',
      decrypt(item.account_name)   || '',
      parseFloat(item.net_amount).toFixed(2),
      item.reference               || '',
    ]);

    const csvContent = [
      headers.join(','),
      ...csvRows.map(r => r.map(c => `"${String(c).replace(/"/g, '""')}"`).join(',')),
    ].join('\r\n');

    const filename = `pay-run-${payRun.prod_name.replace(/\s+/g, '-')}-${payRun.week_ending_date}.csv`;
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(csvContent);
  } catch (err) {
    console.error('exportCsv:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getAllPayRuns, createPayRun, getPayRunById, processPayRun, exportCsv };
