/**
 * Generates a full timesheet PDF (header info + daily grid + weekly totals).
 * Used as an email attachment when distributing or re-sending timesheets to crew.
 */

const PDFDocument = require('pdfkit');

const fmt      = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const fmtDate  = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';
const fmtShort = (iso) => {
  if (!iso) return '—';
  const [y, m, day] = iso.split('-');
  return new Date(Date.UTC(+y, +m - 1, +day))
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', timeZone: 'UTC' });
};

const DAYS_ORDER = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];

const calcTimeOut = (ot = 0) => {
  const m = 15 * 60 + 45 + Math.round((ot || 0) * 60); // base 15:45 + OT
  return `${String(Math.floor(m / 60)).padStart(2, '0')}:${String(m % 60).padStart(2, '0')}`;
};

// Build one row object per day Mon→Sun, merging saved entries where they exist.
const buildDayRows = (weekEndingDate, entries) => {
  const byDay = {};
  entries.forEach(e => { byDay[e.day_of_week] = e; });

  const sunday = new Date(weekEndingDate + 'T00:00:00Z');
  return DAYS_ORDER.map((day, i) => {
    const d   = new Date(sunday);
    d.setUTCDate(sunday.getUTCDate() - (6 - i)); // Mon = sunday-6 … Sun = sunday+0
    const e   = byDay[day] || {};
    const worked = !!e.full_day_worked;
    const ot     = parseFloat(e.overtime_hours || 0);
    return {
      day:       day.slice(0, 3),
      date:      fmtShort(d.toISOString().split('T')[0]),
      fullDay:   worked,
      timeOut:   (worked || ot > 0) ? calcTimeOut(ot) : '—',
      ot:        ot > 0 ? ot.toFixed(1) : '—',
      set:       e.set_number  || '—',
      site:      e.site        || '—',
      travel:    parseFloat(e.travel || 0) > 0 ? fmt(e.travel) : '—',
      breakfast: !!e.meal_breakfast,
      lunch:     !!e.meal_lunch,
      supper:    !!e.meal_supper,
      isWeekend: i >= 5,
    };
  });
};

const generateTimesheetPdf = (ts, entries) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 50;
    const W = 495; // 595.28 - 2×50

    // ── Page header ────────────────────────────────────────────────────────────
    doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('DEEPSIAN', L, 45);
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748b')
       .text('Construct Scenery Limited', L, 70)
       .text('invoice@constructscenery.co.uk', L, 80);

    doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a')
       .text('TIMESHEET', L, 45, { align: 'right', width: W });
    doc.fontSize(9).font('Helvetica').fillColor('#475569')
       .text(`Week Ending: ${fmtDate(ts.week_ending_date)}`, L, 68, { align: 'right', width: W });

    doc.moveTo(L, 100).lineTo(L + W, 100).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // ── Crew / Production info block ───────────────────────────────────────────
    let y = 112;
    const infoCell = (label, value, x, w) => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#64748b').text(label, x, y);
      doc.fontSize(9).font('Helvetica').fillColor('#0f172a').text(value || '—', x, y + 11, { width: w, lineBreak: false });
    };

    infoCell('CREW MEMBER',      `${ts.first_name} ${ts.last_name}`,          L,       125);
    infoCell('CREW NUMBER',      ts.crew_number,                               L + 135, 100);
    infoCell('JOB TITLE / RANK', [ts.crew_trade, ts.crew_rank].filter(Boolean).join(' / ') || '—', L + 245, 140);
    infoCell('EMPLOYMENT',       ts.employment_status === 'paye' ? 'PAYE' : 'Self-Employed', L + 395, 100);

    y += 38;
    infoCell('PRODUCTION', ts.prod_name, L, 220);
    if (ts.employment_status === 'self_employed' && ts.company_name) {
      infoCell('LIMITED COMPANY', ts.company_name, L + 245, 250);
    }

    y += 32;
    doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 10;

    // ── Daily time record ──────────────────────────────────────────────────────
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('DAILY TIME RECORD', L, y);
    y += 13;

    // Column layout — must sum to 495
    const cols = [
      { label: 'Day',      w: 40,  right: false },
      { label: 'Date',     w: 55,  right: false },
      { label: 'Full Day', w: 45,  right: true  },
      { label: 'Time Out', w: 50,  right: true  },
      { label: 'OT Hrs',   w: 42,  right: true  },
      { label: 'Set No.',  w: 50,  right: false },
      { label: 'Site',     w: 103, right: false },
      { label: 'Travel',   w: 45,  right: true  },
      { label: 'B',        w: 18,  right: true  },
      { label: 'L',        w: 18,  right: true  },
      { label: 'S',        w: 29,  right: true  },
    ];
    let xAcc = L;
    cols.forEach(c => { c.x = xAcc; xAcc += c.w; });

    const HROW = 16;
    const DROW = 13;

    // Table header
    doc.rect(L, y, W, HROW).fill('#f1f5f9');
    cols.forEach(c => {
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
         .text(c.label, c.x + 2, y + 4,
           { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
    });
    y += HROW;

    // Data rows
    buildDayRows(ts.week_ending_date, entries).forEach((row, idx) => {
      if (row.isWeekend)  doc.rect(L, y, W, DROW).fill('#fef9c3');
      else if (idx % 2)   doc.rect(L, y, W, DROW).fill('#f8fafc');

      const vals = [
        row.day, row.date,
        row.fullDay ? '✓' : '—',
        row.timeOut, row.ot, row.set, row.site, row.travel,
        row.breakfast ? '✓' : '',
        row.lunch     ? '✓' : '',
        row.supper    ? '✓' : '',
      ];
      cols.forEach((c, i) => {
        doc.fontSize(7.5)
           .font(row.fullDay && i < 2 ? 'Helvetica-Bold' : 'Helvetica')
           .fillColor('#1e293b')
           .text(String(vals[i]), c.x + 2, y + 3,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
      });
      y += DROW;
    });

    doc.moveTo(L, y + 2).lineTo(L + W, y + 2).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
    y += 14;

    // ── Weekly totals ──────────────────────────────────────────────────────────
    doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#0f172a').text('WEEKLY TOTALS', L, y);
    y += 13;

    const lblX = L + 270;
    const valR = L + W;

    const totRow = (label, amount, bold = false, rule = false) => {
      if (rule) {
        doc.moveTo(lblX, y - 1).lineTo(valR, y - 1).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      }
      doc.fontSize(8.5)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#475569')
         .text(label, lblX, y, { width: 140, lineBreak: false });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica').fillColor('#0f172a')
         .text(fmt(amount), valR - 65, y, { align: 'right', width: 65 });
      y += 14;
    };

    totRow('Weekly Rate',      ts.weekly_rate);
    totRow('6th Day Payment',  ts.sixth_day_payment);
    totRow('7th Day Payment',  ts.seventh_day_payment);
    totRow('Overtime Amount',  ts.overtime_amount);
    totRow('Meal Allowance',   ts.meal_allowance_total);
    totRow('Mileage & Travel', ts.mileage_and_travel);
    totRow('Gross Total',      ts.gross_total, false, true);
    if (parseFloat(ts.vat || 0) > 0) {
      totRow('VAT (20%)', ts.vat);
    }
    totRow('GRAND TOTAL', ts.grand_total, true, true);

    // ── Signature line ─────────────────────────────────────────────────────────
    y += 10;
    doc.fontSize(8).font('Helvetica').fillColor('#475569').text('Crew member signature:', L, y);
    doc.moveTo(L + 130, y + 10).lineTo(L + 350, y + 10).strokeColor('#94a3b8').lineWidth(0.5).stroke();
    doc.text('Date:', L + 360, y);
    doc.moveTo(L + 385, y + 10).lineTo(L + W, y + 10).strokeColor('#94a3b8').lineWidth(0.5).stroke();

    // ── Footer ─────────────────────────────────────────────────────────────────
    const footerY = 760;
    doc.moveTo(L, footerY).lineTo(L + W, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(7.5).font('Helvetica').fillColor('#94a3b8')
       .text(
         `Construct Scenery Limited  ·  ${ts.prod_name || '—'}  ·  Week ending ${fmtDate(ts.week_ending_date)}`,
         L, footerY + 8, { align: 'center', width: W }
       );

    doc.end();
  });
};

module.exports = { generateTimesheetPdf };
