/**
 * Generates a PO PDF as a Buffer using PDFKit.
 * Stored temporarily for email attachment — not persisted to disk.
 */

const PDFDocument = require('pdfkit');
const path        = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/logo.png');

const fmt = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const fmtDate = (d) => d ? new Date(d).toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' }) : '—';

const generatePoPdf = (po, productionName) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 50, size: 'A4' });
    const chunks = [];

    doc.on('data',  (c) => chunks.push(c));
    doc.on('end',   ()  => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    // ── Header ──────────────────────────────────────────────────────────────────
    try { doc.image(LOGO_PATH, 50, 44, { width: 34, height: 34 }); } catch (_) { /* logo optional */ }
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('Construct Scenery', 90, 50);
    doc.fontSize(9).font('Helvetica').fillColor('#64748b')
       .text('Construct Scenery Limited', 90, 72)
       .text('info@constructscenery.co.uk', 90, 84);

    doc.fontSize(20).font('Helvetica-Bold').fillColor('#0f172a')
       .text('PURCHASE ORDER', 350, 50, { align: 'right' });
    doc.fontSize(11).font('Helvetica').fillColor('#475569')
       .text(`PO Number: ${po.po_number}`, 350, 78, { align: 'right' })
       .text(`Date: ${fmtDate(po.date_of_po)}`, 350, 93, { align: 'right' });

    doc.moveTo(50, 120).lineTo(545, 120).strokeColor('#e2e8f0').lineWidth(1).stroke();

    // ── Supplier & Production ────────────────────────────────────────────────────
    let y = 135;
    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('SUPPLIER', 50, y);
    doc.fontSize(10).font('Helvetica').fillColor('#0f172a')
       .text(po.supplier_name || '—', 50, y + 14);
    if (po.supplier_address) {
      doc.fontSize(9).fillColor('#475569').text(po.supplier_address, 50, y + 28, { width: 220 });
    }

    doc.fontSize(9).font('Helvetica-Bold').fillColor('#64748b').text('PRODUCTION', 350, y, { align: 'right', width: 195 });
    doc.fontSize(10).font('Helvetica').fillColor('#0f172a')
       .text(productionName || '—', 350, y + 14, { align: 'right', width: 195 });

    // ── PO Details table ─────────────────────────────────────────────────────────
    y = 210;
    const col = [50, 200, 350, 450];
    doc.rect(50, y, 495, 20).fill('#f8fafc');
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#475569')
       .text('Set Code',     col[0], y + 6)
       .text('Account Code', col[1], y + 6)
       .text('Paid From',    col[2], y + 6);

    y += 20;
    doc.fontSize(9).font('Helvetica').fillColor('#0f172a')
       .text(po.set_code     || '—', col[0], y + 5)
       .text(po.account_code || '—', col[1], y + 5)
       .text((po.paid_from || '—').replace(/_/g, ' '), col[2], y + 5);

    // ── Description ──────────────────────────────────────────────────────────────
    y += 35;
    doc.fontSize(8).font('Helvetica-Bold').fillColor('#64748b').text('DESCRIPTION', 50, y);
    y += 13;
    doc.fontSize(9).font('Helvetica').fillColor('#0f172a')
       .text(po.description || '—', 50, y, { width: 495 });

    // ── Financials ───────────────────────────────────────────────────────────────
    y = doc.y + 20;
    doc.moveTo(50, y).lineTo(545, y).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 10;

    const right = 495;
    const labelX = 380;
    const valueX = 495;

    const row = (label, value, bold = false) => {
      doc.fontSize(9)
         .font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor('#475569')
         .text(label, labelX, y, { width: 100 });
      doc.font(bold ? 'Helvetica-Bold' : 'Helvetica')
         .fillColor('#0f172a')
         .text(value, valueX, y, { align: 'right', width: 50 });
      y += 16;
    };

    row('Net Amount', fmt(po.net_amount));
    row('VAT', fmt(po.vat));
    doc.moveTo(labelX, y - 2).lineTo(545, y - 2).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    row('Gross Amount', fmt(po.gross_amount), true);

    // ── Footer ───────────────────────────────────────────────────────────────────
    const footerY = 760;
    doc.moveTo(50, footerY).lineTo(545, footerY).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    doc.fontSize(8).font('Helvetica').fillColor('#94a3b8')
       .text(
         `Construct Scenery Limited  ·  Production: ${productionName || '—'}  ·  Please quote ${po.po_number} on all invoices.`,
         50, footerY + 8, { align: 'center', width: 495 }
       );

    doc.end();
  });
};

// ─── PO List PDF — A4 landscape, for CSV/PDF export ─────────────────────────
const generatePoListPdf = (pos, filterSummary) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L      = 30;
    const W      = 781.89; // 841.89 - 2*30
    const PAGE_H = 595.28;
    const BOTTOM = 45;

    const cols = [
      { label: 'PO Number',   field: 'po_number',       w: 62,  right: false },
      { label: 'Date',        field: 'date_of_po',       w: 55,  right: false, fmt: fmtDate },
      { label: 'Supplier',    field: 'supplier_name',    w: 90,  right: false },
      { label: 'Description', field: 'description',      w: 115, right: false },
      { label: 'Set',         field: 'set_code',         w: 38,  right: false },
      { label: 'Acct Code',   field: 'account_code',     w: 55,  right: false },
      { label: 'Net',         field: 'net_amount',       w: 52,  right: true,  fmt: fmt },
      { label: 'VAT',         field: 'vat',              w: 42,  right: true,  fmt: fmt },
      { label: 'Gross',       field: 'gross_amount',     w: 52,  right: true,  fmt: fmt },
      { label: 'Pmt Method',  field: 'paid_from',        w: 74,  right: false, fmt: v => (v || '—').replace(/_/g, ' ') },
      { label: 'Status',      field: 'status',           w: 58,  right: false },
      { label: 'Approved By', field: 'approved_by_name', w: 0,   right: false },
    ];
    // Assign remaining width to last column
    const usedW = cols.slice(0, -1).reduce((s, c) => s + c.w, 0);
    cols[cols.length - 1].w = W - usedW;
    // Pre-compute x offsets
    let xAcc = L;
    cols.forEach(c => { c.x = xAcc; xAcc += c.w; });

    const HEADER_H = 18;
    const ROW_H    = 13;

    const drawTableHeader = (y) => {
      doc.rect(L, y, W, HEADER_H).fill('#f1f5f9');
      cols.forEach(c => {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
           .text(c.label, c.x + 2, y + 5, { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
      });
      return y + HEADER_H;
    };

    const drawFooter = () => {
      const fy = PAGE_H - 18;
      doc.moveTo(L, fy).lineTo(L + W, fy).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
         .text('Construct Scenery Limited  ·  Confidential', L, fy + 4, { align: 'center', width: W });
    };

    // ── Page 1 header ──────────────────────────────────────────────────────────
    doc.fontSize(18).font('Helvetica-Bold').fillColor('#0f172a').text('DEEPSIAN', L, 32);
    doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Construct Scenery Limited', L, 54);
    doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text('PURCHASE ORDERS', L, 32, { align: 'right', width: W });
    doc.fontSize(7.5).font('Helvetica').fillColor('#475569')
       .text(`Generated: ${fmtDate(new Date())}`, L, 52, { align: 'right', width: W });

    let sepY = 68;
    if (filterSummary) {
      doc.fontSize(7).font('Helvetica').fillColor('#64748b')
         .text(`Filters applied: ${filterSummary}`, L, 68, { width: W });
      sepY = 80;
    }
    doc.moveTo(L, sepY).lineTo(L + W, sepY).strokeColor('#e2e8f0').lineWidth(1).stroke();

    let y = drawTableHeader(sepY + 6);

    // ── Rows ──────────────────────────────────────────────────────────────────
    pos.forEach((po, idx) => {
      if (y + ROW_H > PAGE_H - BOTTOM) {
        drawFooter();
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        y = drawTableHeader(30);
      }
      if (idx % 2 === 1) doc.rect(L, y, W, ROW_H).fill('#f8fafc');

      cols.forEach(c => {
        const raw = po[c.field];
        const val = c.fmt ? c.fmt(raw) : (raw ?? '—');
        doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b')
           .text(String(val), c.x + 2, y + 3,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false, ellipsis: true });
      });
      y += ROW_H;
    });

    // ── Totals row ────────────────────────────────────────────────────────────
    if (pos.length) {
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      y += 2;
      if (y + HEADER_H > PAGE_H - BOTTOM) {
        drawFooter();
        doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
        y = 30;
      }
      doc.rect(L, y, W, HEADER_H).fill('#e2e8f0');

      const totalNet   = pos.reduce((s, p) => s + parseFloat(p.net_amount   || 0), 0);
      const totalVat   = pos.reduce((s, p) => s + parseFloat(p.vat          || 0), 0);
      const totalGross = pos.reduce((s, p) => s + parseFloat(p.gross_amount || 0), 0);

      doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
         .text(`TOTAL (${pos.length} PO${pos.length !== 1 ? 's' : ''})`, L + 2, y + 5);

      const netC   = cols.find(c => c.field === 'net_amount');
      const vatC   = cols.find(c => c.field === 'vat');
      const grossC = cols.find(c => c.field === 'gross_amount');
      doc.text(fmt(totalNet),   netC.x   + 2, y + 5, { width: netC.w   - 4, align: 'right' });
      doc.text(fmt(totalVat),   vatC.x   + 2, y + 5, { width: vatC.w   - 4, align: 'right' });
      doc.text(fmt(totalGross), grossC.x + 2, y + 5, { width: grossC.w - 4, align: 'right' });
    }

    drawFooter();
    doc.end();
  });
};

module.exports = { generatePoPdf, generatePoListPdf };
