const db                       = require('../config/db');
const { sendEmail, templates } = require('../config/email');
const { fileUrl }              = require('../Middleware/upload');

const STANDARD_START = '07:30';
const MEAL_RATES     = { breakfast: 10.50, lunch: 14.00, supper: 10.50 };

const calcTimeOut = (overtimeHours = 0) => {
  const endMinutes = 15 * 60 + 45 + Math.round(overtimeHours * 60); // 15:45 + OT
  return `${String(Math.floor(endMinutes / 60)).padStart(2, '0')}:${String(endMinutes % 60).padStart(2, '0')}`;
};

// ─── GET /api/timesheets ──────────────────────────────────────────────────────
const getAllTimesheets = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.production_id)    { conditions.push(`t.production_id = $${i++}`);    params.push(req.query.production_id); }
    if (req.query.crew_member_id)   { conditions.push(`t.crew_member_id = $${i++}`);   params.push(req.query.crew_member_id); }
    if (req.query.week_ending_date) { conditions.push(`t.week_ending_date = $${i++}`); params.push(req.query.week_ending_date); }
    if (req.query.status)           { conditions.push(`t.status = $${i++}`);           params.push(req.query.status); }
    if (req.query.date_from)        { conditions.push(`t.week_ending_date >= $${i++}`); params.push(req.query.date_from); }
    if (req.query.date_to)          { conditions.push(`t.week_ending_date <= $${i++}`); params.push(req.query.date_to); }
    if (req.query.invoice_attached === 'yes') { conditions.push(`t.invoice_attachment_url IS NOT NULL`); }
    if (req.query.invoice_attached === 'no')  { conditions.push(`t.invoice_attachment_url IS NULL`); }
    if (req.query.crew_trade) { conditions.push(`cm.crew_trade = $${i++}`); params.push(req.query.crew_trade); }
    if (req.query.crew_rank)  { conditions.push(`cm.crew_rank = $${i++}`);  params.push(req.query.crew_rank); }

    if (req.query.include_archived !== 'true') {
      conditions.push(`p.status != 'archived'`);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT t.*,
              cm.id AS cm_id, cm.crew_number, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank,
              p.id AS prod_id, p.name AS prod_name
       FROM   timesheets t
       JOIN   crew_members cm ON t.crew_member_id = cm.id
       JOIN   productions p  ON t.production_id   = p.id
       ${where}
       ORDER BY t.week_ending_date DESC`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getAllTimesheets:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/timesheets ─────────────────────────────────────────────────────
const createTimesheet = async (req, res) => {
  const { crew_member_id, production_id, week_ending_date } = req.body;
  if (!crew_member_id || !production_id || !week_ending_date)
    return res.status(400).json({ error: 'crew_member_id, production_id, and week_ending_date are required' });

  try {
    // STATUS GATE — block timesheets on pre_production, complete, archived
    const { rows: [prod] } = await db.query(
      'SELECT status FROM productions WHERE id = $1', [production_id]
    );
    if (!prod) return res.status(400).json({ error: 'Production not found' });
    if (prod.status === 'pre_production')
      return res.status(400).json({ error: 'Cannot create timesheets for a pre-production project — activate the build first' });
    if (prod.status === 'complete')
      return res.status(400).json({ error: 'Cannot create new timesheets on a completed production' });
    if (prod.status === 'archived')
      return res.status(400).json({ error: 'Cannot create timesheets on an archived production' });

    // GATEWAY RULE — crew member must exist and be active
    const { rows: [crew] } = await db.query(
      'SELECT * FROM crew_members WHERE id = $1 AND is_active = true',
      [crew_member_id]
    );
    if (!crew)
      return res.status(400).json({
        error: 'Crew member not found or not active. Register the crew member first (Crew Database Gateway Rule).',
      });

    // Prevent duplicate timesheet
    const { rows: [existing] } = await db.query(
      `SELECT id FROM timesheets
       WHERE crew_member_id = $1 AND production_id = $2 AND week_ending_date = $3`,
      [crew_member_id, production_id, week_ending_date]
    );
    if (existing)
      return res.status(400).json({ error: 'A timesheet already exists for this crew member and week' });

    const { rows: [ts] } = await db.query(
      `INSERT INTO timesheets (crew_member_id, production_id, week_ending_date, status, created_by)
       VALUES ($1,$2,$3,'draft',$4)
       RETURNING *`,
      [crew_member_id, production_id, week_ending_date, req.user.id]
    );

    // Return with joined crew and production info
    const { rows: [full] } = await db.query(
      `SELECT t.*,
              cm.id AS cm_id, cm.crew_number, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank,
              cm.employment_status, cm.company_name, cm.paye_withholding_rate,
              p.id AS prod_id, p.name AS prod_name
       FROM   timesheets t
       JOIN   crew_members cm ON t.crew_member_id = cm.id
       JOIN   productions p  ON t.production_id   = p.id
       WHERE  t.id = $1`,
      [ts.id]
    );
    res.status(201).json(full);
  } catch (err) {
    console.error('createTimesheet:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/timesheets/:id ──────────────────────────────────────────────────
const getTimesheetById = async (req, res) => {
  try {
    const { rows: [ts] } = await db.query(
      `SELECT t.*,
              cm.crew_number, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank,
              cm.employment_status, cm.company_name, cm.paye_withholding_rate,
              cm.vat_registration_number,
              p.id AS prod_id, p.name AS prod_name
       FROM   timesheets t
       JOIN   crew_members cm ON t.crew_member_id = cm.id
       JOIN   productions p  ON t.production_id   = p.id
       WHERE  t.id = $1`,
      [req.params.id]
    );
    if (!ts) return res.status(404).json({ error: 'Timesheet not found' });

    const { rows: entries } = await db.query(
      'SELECT * FROM timesheet_entries WHERE timesheet_id = $1 ORDER BY date',
      [req.params.id]
    );

    ts.timesheet_entries = entries.map(e => ({
      ...e,
      time_in:  e.full_day_worked ? STANDARD_START : null,
      time_out: e.full_day_worked ? calcTimeOut(e.overtime_hours) : null,
    }));

    res.json(ts);
  } catch (err) {
    console.error('getTimesheetById:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PUT /api/timesheets/:id/entries — save daily entries + recalculate totals
const saveEntries = async (req, res) => {
  const { entries } = req.body;
  if (!Array.isArray(entries) || !entries.length)
    return res.status(400).json({ error: 'entries array is required' });

  const client = await db.connect();
  try {
    await client.query('BEGIN');

    // Get timesheet with crew details
    const { rows: [ts] } = await client.query(
      `SELECT t.*, cm.crew_trade, cm.crew_rank, cm.employment_status, cm.vat_registration_number
       FROM timesheets t
       JOIN crew_members cm ON t.crew_member_id = cm.id
       WHERE t.id = $1`,
      [req.params.id]
    );
    if (!ts) { await client.query('ROLLBACK'); return res.status(404).json({ error: 'Timesheet not found' }); }

    // Get BECTU rate for this crew member's trade/rank
    const { rows: [rateRow] } = await client.query(
      'SELECT daily_rate, overtime_rate FROM bectu_rates WHERE trade = $1 AND rank = $2',
      [ts.crew_trade, ts.crew_rank]
    );
    const dailyRate = parseFloat(rateRow?.daily_rate || 0);
    const otRate    = parseFloat(rateRow?.overtime_rate || 0);

    // Delete old entries and re-insert
    await client.query('DELETE FROM timesheet_entries WHERE timesheet_id = $1', [req.params.id]);

    const rows = entries.map(e => ({
      timesheet_id:    req.params.id,
      date:            e.date,
      day_of_week:     e.day_of_week,
      full_day_worked: e.full_day_worked || false,
      overtime_hours:  parseFloat(e.overtime_hours || 0),
      set_number:      e.set_number || null,
      site:            e.site || null,
      travel:          parseFloat(e.travel || 0),
      meal_breakfast:  e.meal_breakfast || false,
      meal_lunch:      e.meal_lunch || false,
      meal_supper:     e.meal_supper || false,
    }));

    if (rows.length) {
      const valuePlaceholders = rows.map((_, idx) => {
        const base = idx * 11;
        return `($${base+1},$${base+2},$${base+3},$${base+4},$${base+5},$${base+6},$${base+7},$${base+8},$${base+9},$${base+10},$${base+11})`;
      }).join(',');

      const flatValues = rows.flatMap(r => [
        r.timesheet_id, r.date, r.day_of_week, r.full_day_worked, r.overtime_hours,
        r.set_number, r.site, r.travel, r.meal_breakfast, r.meal_lunch, r.meal_supper,
      ]);

      await client.query(
        `INSERT INTO timesheet_entries
           (timesheet_id, date, day_of_week, full_day_worked, overtime_hours,
            set_number, site, travel, meal_breakfast, meal_lunch, meal_supper)
         VALUES ${valuePlaceholders}`,
        flatValues
      );
    }

    // ─── Weekly totals ────────────────────────────────────────────────────────
    const worked    = rows.filter(e => e.full_day_worked);
    const saturday  = rows.find(e => e.day_of_week === 'Saturday'  && e.full_day_worked);
    const sunday    = rows.find(e => e.day_of_week === 'Sunday'    && e.full_day_worked);
    const stdDays   = worked.filter(e => !['Saturday', 'Sunday'].includes(e.day_of_week)).length;

    const weeklyRate         = dailyRate * stdDays;
    const sixthDayPayment    = saturday ? dailyRate * 1.5 : 0;
    const seventhDayPayment  = sunday   ? dailyRate * 2.0 : 0;
    const totalOT            = rows.reduce((s, e) => s + e.overtime_hours, 0);
    const overtimeAmount     = totalOT * otRate;
    const mealAllowance      = rows.reduce((s, e) =>
      s + (e.meal_breakfast ? MEAL_RATES.breakfast : 0)
        + (e.meal_lunch     ? MEAL_RATES.lunch     : 0)
        + (e.meal_supper    ? MEAL_RATES.supper    : 0), 0);
    const mileageAndTravel   = rows.reduce((s, e) => s + e.travel, 0);
    const grossTotal         = weeklyRate + sixthDayPayment + seventhDayPayment + overtimeAmount + mealAllowance + mileageAndTravel;
    const vatRegistered      = ts.employment_status === 'self_employed' && !!ts.vat_registration_number;
    const vat                = vatRegistered ? grossTotal * 0.20 : 0;
    const grandTotal         = grossTotal + vat;

    const { rows: [updated] } = await client.query(
      `UPDATE timesheets SET
         weekly_rate = $1, sixth_day_payment = $2, seventh_day_payment = $3,
         overtime_amount = $4, meal_allowance_total = $5, mileage_and_travel = $6,
         vat = $7, gross_total = $8, grand_total = $9
       WHERE id = $10
       RETURNING *`,
      [weeklyRate, sixthDayPayment, seventhDayPayment, overtimeAmount,
       mealAllowance, mileageAndTravel, vat, grossTotal, grandTotal, req.params.id]
    );

    await client.query('COMMIT');
    res.json(updated);
  } catch (err) {
    await client.query('ROLLBACK');
    console.error('saveEntries:', err);
    res.status(500).json({ error: err.message });
  } finally {
    client.release();
  }
};

// ─── POST /api/timesheets/bulk-distribute ─────────────────────────────────────
const bulkDistribute = async (req, res) => {
  const { week_ending_date, production_id } = req.body;
  if (!week_ending_date)
    return res.status(400).json({ error: 'week_ending_date is required' });

  try {
    const conditions = ["t.week_ending_date = $1", "t.status = 'draft'"];
    const params     = [week_ending_date];
    if (production_id) { conditions.push(`t.production_id = $2`); params.push(production_id); }

    const { rows: timesheets } = await db.query(
      `SELECT t.id, cm.first_name, cm.last_name, cm.email, p.name AS prod_name
       FROM timesheets t
       JOIN crew_members cm ON t.crew_member_id = cm.id
       JOIN productions p   ON t.production_id  = p.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!timesheets.length)
      return res.status(400).json({ error: 'No draft timesheets found for this week' });

    const ids = timesheets.map(t => t.id);
    await db.query(
      `UPDATE timesheets SET status = 'sent' WHERE id = ANY($1::uuid[])`,
      [ids]
    );

    // Send email to each crew member who has an email address
    const emailResults = { sent: 0, skipped: 0 };
    for (const ts of timesheets) {
      if (ts.email) {
        const { subject, html } = templates.timesheetDistributed(
          `${ts.first_name} ${ts.last_name}`,
          week_ending_date,
          ts.prod_name || 'your production'
        );
        await sendEmail({ to: ts.email, subject, html }).catch(err => {
          console.error(`Timesheet email failed for ${ts.first_name} ${ts.last_name}:`, err.message);
        });
        emailResults.sent++;
      } else {
        emailResults.skipped++;
      }
    }

    res.json({
      message:           `${timesheets.length} timesheet(s) distributed`,
      distributed_count: timesheets.length,
      emails_sent:       emailResults.sent,
      emails_skipped:    emailResults.skipped,
      week_ending_date,
    });
  } catch (err) {
    console.error('bulkDistribute:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/timesheets/:id/attach-invoice ──────────────────────────────────
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
    const { rows: [ts] } = await db.query(
      `UPDATE timesheets
       SET invoice_attachment_url = $1, invoice_attachment_name = $2, status = 'invoice_received'
       WHERE id = $3
       RETURNING *`,
      [invoice_attachment_url, invoice_attachment_name, req.params.id]
    );
    res.json({ message: 'Invoice attached', timesheet: ts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/timesheets/chase-invoices ─────────────────────────────────────
const chaseInvoices = async (req, res) => {
  const { week_ending_date } = req.body;
  try {
    const conditions = ["t.status = 'sent'", 't.invoice_attachment_url IS NULL'];
    const params     = [];
    if (week_ending_date) { conditions.push(`t.week_ending_date = $1`); params.push(week_ending_date); }

    const { rows } = await db.query(
      `SELECT t.week_ending_date, cm.first_name, cm.last_name, cm.email
       FROM timesheets t
       JOIN crew_members cm ON t.crew_member_id = cm.id
       WHERE ${conditions.join(' AND ')}`,
      params
    );

    if (!rows.length) return res.json({ message: 'No outstanding invoices to chase', chased_count: 0 });

    // Send chase emails to crew members who have an email address on file
    const emailResults = { sent: 0, skipped: 0 };
    for (const t of rows) {
      if (t.email) {
        const { subject, html } = templates.invoiceChase(
          `${t.first_name} ${t.last_name}`,
          t.week_ending_date
        );
        await sendEmail({ to: t.email, subject, html }).catch(err => {
          console.error(`Chase email failed for ${t.first_name} ${t.last_name}:`, err.message);
        });
        emailResults.sent++;
      } else {
        emailResults.skipped++;
      }
    }

    res.json({
      message:      `Invoice chase sent to ${emailResults.sent} crew member(s)`,
      chased_count: rows.length,
      emails_sent:  emailResults.sent,
      emails_skipped: emailResults.skipped,
      crew_chased:  rows.map(t => ({
        crew_member: `${t.first_name} ${t.last_name}`,
        week_ending:  t.week_ending_date,
      })),
    });
  } catch (err) {
    console.error('chaseInvoices:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/timesheets/:id/verify ─────────────────────────────────────────
const verifyTimesheet = async (req, res) => {
  try {
    const { rows: [existing] } = await db.query(
      'SELECT invoice_attachment_url FROM timesheets WHERE id = $1',
      [req.params.id]
    );
    if (!existing?.invoice_attachment_url)
      return res.status(400).json({ error: 'Cannot verify: invoice not yet attached' });

    const { rows: [ts] } = await db.query(
      `UPDATE timesheets SET status = 'verified' WHERE id = $1 RETURNING *`,
      [req.params.id]
    );
    res.json({ message: 'Timesheet verified', timesheet: ts });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
};

// ─── GET /api/timesheets/verification-pack/:weekEndingDate/:productionId ──────
const getVerificationPack = async (req, res) => {
  try {
    const { rows } = await db.query(
      `SELECT t.*,
              cm.crew_number, cm.first_name, cm.last_name, cm.crew_trade, cm.crew_rank, cm.employment_status
       FROM   timesheets t
       JOIN   crew_members cm ON t.crew_member_id = cm.id
       WHERE  t.week_ending_date = $1
         AND  t.production_id    = $2
         AND  t.invoice_attachment_url IS NOT NULL
       ORDER BY cm.last_name`,
      [req.params.weekEndingDate, req.params.productionId]
    );

    const pack = await Promise.all(rows.map(async ts => {
      const { rows: entries } = await db.query(
        'SELECT * FROM timesheet_entries WHERE timesheet_id = $1 ORDER BY date',
        [ts.id]
      );
      return {
        crew_member:      `${ts.first_name} ${ts.last_name}`,
        crew_number:       ts.crew_number,
        crew_trade:        ts.crew_trade,
        crew_rank:         ts.crew_rank,
        week_ending_date:  ts.week_ending_date,
        grand_total:       ts.grand_total,
        timesheet:        { ...ts, timesheet_entries: entries },
        invoice_url:       ts.invoice_attachment_url,
      };
    }));

    res.json({
      week_ending_date: req.params.weekEndingDate,
      total_crew:       pack.length,
      total_gross:      pack.reduce((s, p) => s + parseFloat(p.grand_total || 0), 0),
      records:          pack,
    });
  } catch (err) {
    console.error('getVerificationPack:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = {
  getAllTimesheets, createTimesheet, getTimesheetById,
  saveEntries, bulkDistribute,
  attachInvoice, chaseInvoices, verifyTimesheet, getVerificationPack,
};
