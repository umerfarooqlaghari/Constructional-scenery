/**
 * Generates a branded A4 portrait list PDF of timesheets.
 * Used by GET /api/timesheets/export/pdf.
 * Columns: Crew No., Name, Trade, Rank, Type, Week Ending, Days, Gross, Status
 */

const PDFDocument = require('pdfkit');
const path        = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/construct scenery logo.png');

const fmt     = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const generateTimesheetListPdf = (rows, filterSummary) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L = 50;
    const W = 495; // 595.28 - 2×50

    // Column definitions — must sum to 495
    const cols = [
      { label: 'Crew No.',    field: 'crew_number',      w: 52,  right: false },
      { label: 'Name',        field: '_name',             w: 100, right: false },
      { label: 'Trade',       field: 'crew_trade',        w: 68,  right: false },
      { label: 'Rank',        field: 'crew_rank',         w: 68,  right: false },
      { label: 'Type',        field: '_type',             w: 50,  right: false },
      { label: 'Week Ending', field: 'week_ending_date',  w: 65,  right: false, fmt: fmtDate },
      { label: 'Days',        field: 'days_worked',       w: 30,  right: true  },
      { label: 'Gross',       field: 'grand_total',       w: 55,  right: true,  fmt: fmt },
      { label: 'Status',      field: 'status',            w: 0,   right: false },
    ];
    // Assign remaining width to last column
    const usedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = W - usedW;
    // Pre-compute x offsets
    let xAcc = L;
    cols.forEach(c => { c.x = xAcc; xAcc += c.w; });

    const HEADER_H = 18;
    const ROW_H    = 13;
    const PAGE_H   = 841.89;
    const BOTTOM   = 45;

    const drawTableHeader = (y) => {
      doc.rect(L, y, W, HEADER_H).fill('#f1f5f9');
      cols.forEach(c => {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
           .text(c.label, c.x + 2, y + 5,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
      });
      return y + HEADER_H;
    };

    const drawFooter = () => {
      const fy = PAGE_H - 18;
      doc.moveTo(L, fy).lineTo(L + W, fy).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
         .text('Construct Scenery Limited  ·  Confidential', L, fy + 4, { align: 'center', width: W });
    };

    // ── Page 1 document header ─────────────────────────────────────────────────
    try { doc.image(LOGO_PATH, L, 40, { width: 32, height: 32 }); } catch (e) { console.error('Timesheet list PDF logo load failed:', e.message); }
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('Construct Scenery', L + 38, 45);
    doc.fontSize(8.5).font('Helvetica').fillColor('#64748b').text('Construct Scenery Limited', L + 38, 66);
    doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a')
       .text('TIMESHEETS', L, 45, { align: 'right', width: W });
    doc.fontSize(8).font('Helvetica').fillColor('#475569')
       .text(`Generated: ${fmtDate(new Date())}`, L, 67, { align: 'right', width: W });

    let sepY = 84;
    if (filterSummary) {
      doc.fontSize(7).font('Helvetica').fillColor('#64748b')
         .text(`Filters applied: ${filterSummary}`, L, 84, { width: W });
      sepY = 96;
    }
    doc.moveTo(L, sepY).lineTo(L + W, sepY).strokeColor('#e2e8f0').lineWidth(1).stroke();

    let y = drawTableHeader(sepY + 6);

    // ── Rows ──────────────────────────────────────────────────────────────────
    rows.forEach((row, idx) => {
      if (y + ROW_H > PAGE_H - BOTTOM) {
        drawFooter();
        doc.addPage({ size: 'A4', margin: 50 });
        y = drawTableHeader(50);
      }
      if (idx % 2 === 1) doc.rect(L, y, W, ROW_H).fill('#f8fafc');

      // Computed display fields
      const rowData = {
        ...row,
        _name: `${row.first_name} ${row.last_name}`,
        _type: row.employment_status === 'paye' ? 'PAYE' : 'SE',
      };

      cols.forEach(c => {
        const raw = rowData[c.field];
        const val = c.fmt ? c.fmt(raw) : (raw ?? '—');
        doc.fontSize(7).font('Helvetica').fillColor('#1e293b')
           .text(String(val), c.x + 2, y + 3,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false, ellipsis: true });
      });
      y += ROW_H;
    });

    // ── Totals row ────────────────────────────────────────────────────────────
    if (rows.length) {
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      y += 2;
      if (y + HEADER_H > PAGE_H - BOTTOM) {
        drawFooter();
        doc.addPage({ size: 'A4', margin: 50 });
        y = 50;
      }
      doc.rect(L, y, W, HEADER_H).fill('#e2e8f0');
      const totalGross = rows.reduce((s, r) => s + parseFloat(r.grand_total || 0), 0);
      const grossCol   = cols.find(c => c.field === 'grand_total');
      doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
         .text(`TOTAL (${rows.length} timesheet${rows.length !== 1 ? 's' : ''})`, L + 2, y + 5);
      doc.text(fmt(totalGross), grossCol.x + 2, y + 5,
        { width: grossCol.w - 4, align: 'right' });
    }

    drawFooter();
    doc.end();
  });
};

module.exports = { generateTimesheetListPdf };
