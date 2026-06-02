const db     = require('../config/db');
const multer = require('multer');
const csv    = require('csv-parse/sync');

// ─── GET /api/crew-rates ──────────────────────────────────────────────────────
// ?current=true  → only rows where effective_to IS NULL (active rates)
// ?trade=X       → filter by trade
const getRates = async (req, res) => {
  try {
    const conditions = [];
    const params     = [];
    let   i          = 1;

    if (req.query.current === 'true') {
      conditions.push(`effective_to IS NULL`);
    }
    if (req.query.trade) {
      conditions.push(`trade = $${i++}`);
      params.push(req.query.trade);
    }

    const where = conditions.length ? `WHERE ${conditions.join(' AND ')}` : '';
    const { rows } = await db.query(
      `SELECT id, trade, rank, daily_rate, overtime_rate, weekly_rate,
              rate_year, rate_type, effective_from, effective_to, created_at
       FROM   bectu_rates
       ${where}
       ORDER  BY trade, rank`,
      params
    );
    res.json(rows);
  } catch (err) {
    console.error('getRates:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── PATCH /api/crew-rates/:id  (MD only — edit non-BECTU rates) ─────────────
const updateRate = async (req, res) => {
  if (req.user?.role !== 'managing_director')
    return res.status(403).json({ error: 'Only MD can update rate card entries' });

  const { daily_rate, overtime_rate } = req.body;

  try {
    const { rows: [existing] } = await db.query(
      'SELECT * FROM bectu_rates WHERE id = $1',
      [req.params.id]
    );
    if (!existing) return res.status(404).json({ error: 'Rate not found' });
    if (existing.rate_type !== 'non_bectu')
      return res.status(400).json({ error: 'Only non-BECTU rates can be edited manually. Use CSV import for BECTU rates.' });

    const updates = [];
    const vals    = [];
    let   j       = 1;
    if (daily_rate    !== undefined) { updates.push(`daily_rate = $${j++}`);    vals.push(daily_rate    === '' ? null : parseFloat(daily_rate)); }
    if (overtime_rate !== undefined) { updates.push(`overtime_rate = $${j++}`); vals.push(overtime_rate === '' ? null : parseFloat(overtime_rate)); }

    if (!updates.length) return res.status(400).json({ error: 'No fields to update' });

    const { rows: [updated] } = await db.query(
      `UPDATE bectu_rates SET ${updates.join(', ')} WHERE id = $${j} RETURNING *`,
      [...vals, req.params.id]
    );
    res.json(updated);
  } catch (err) {
    console.error('updateRate:', err);
    res.status(500).json({ error: err.message });
  }
};

// ─── POST /api/crew-rates/import  (MD only — CSV import for new year) ────────
// CSV format: trade,rank,daily_rate,overtime_rate,effective_from
// effective_from is required (e.g. 2027-04-06 for 2027/28 card)
const importCSV = async (req, res) => {
  if (req.user?.role !== 'managing_director')
    return res.status(403).json({ error: 'Only MD can import rate cards' });

  if (!req.file) return res.status(400).json({ error: 'No CSV file provided' });

  const { effective_from, rate_year } = req.body;
  if (!effective_from) return res.status(400).json({ error: 'effective_from date is required (e.g. 2027-04-06)' });
  if (!rate_year)      return res.status(400).json({ error: 'rate_year is required (e.g. 2027/28)' });

  try {
    const records = csv.parse(req.file.buffer.toString(), {
      columns: true,
      skip_empty_lines: true,
      trim: true,
    });

    const required = ['trade', 'rank', 'daily_rate', 'overtime_rate'];
    const missing  = required.filter(c => !Object.keys(records[0] ?? {}).includes(c));
    if (missing.length)
      return res.status(400).json({ error: `CSV missing columns: ${missing.join(', ')}` });

    const client = await db.connect();
    let inserted = 0;
    let expired  = 0;

    try {
      await client.query('BEGIN');

      for (const row of records) {
        const { trade, rank, daily_rate, overtime_rate } = row;
        if (!trade || !rank) continue;

        // Expire current active row for this trade/rank
        const { rowCount } = await client.query(
          `UPDATE bectu_rates
           SET effective_to = $1::date - INTERVAL '1 day'
           WHERE trade = $2 AND rank = $3 AND effective_to IS NULL`,
          [effective_from, trade, rank]
        );
        expired += rowCount;

        // Insert new row
        await client.query(
          `INSERT INTO bectu_rates
             (trade, rank, daily_rate, overtime_rate, rate_year, rate_type, effective_from)
           VALUES ($1,$2,$3,$4,$5,'bectu',$6)
           ON CONFLICT (trade, rank, rate_year) DO UPDATE
             SET daily_rate    = EXCLUDED.daily_rate,
                 overtime_rate = EXCLUDED.overtime_rate,
                 effective_from = EXCLUDED.effective_from,
                 effective_to  = NULL`,
          [trade, rank, parseFloat(daily_rate), parseFloat(overtime_rate), rate_year, effective_from]
        );
        inserted++;
      }

      await client.query('COMMIT');
    } catch (e) {
      await client.query('ROLLBACK');
      throw e;
    } finally {
      client.release();
    }

    res.json({
      message:   `${rate_year} rate card imported successfully`,
      inserted,
      expired,
      effective_from,
    });
  } catch (err) {
    console.error('importCSV:', err);
    res.status(500).json({ error: err.message });
  }
};

module.exports = { getRates, updateRate, importCSV };
