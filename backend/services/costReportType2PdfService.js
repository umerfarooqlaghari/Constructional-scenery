/**
 * Generates a branded A4 landscape Cost Plus (Type 2) cost report PDF.
 * 9 chapters: Summary, Main Cost Report, POs & Billing, Labour to Send,
 * Materials to Send, Omitted Labour, Omitted Materials,
 * Weekly Invoice Summary, Warren's P&L.
 */

const PDFDocument = require('pdfkit');
const path        = require('path');

const LOGO_PATH = path.join(__dirname, '../assets/construct scenery logo.png');

const fmt     = (n) => `£${parseFloat(n || 0).toFixed(2)}`;
const fmtN    = (n) => parseFloat(n || 0).toFixed(2);
const fmtDate = (d) => {
  if (!d) return '—';
  const s = String(d).split('T')[0];
  const [y, m, day] = s.split('-');
  return new Date(Date.UTC(+y, +m - 1, +day))
    .toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric', timeZone: 'UTC' });
};

const generateCostReportType2Pdf = ({
  production, summary, mainCostReport, posAndBilling,
  labourToSend, materialsToSend, omittedLabour, omittedMaterials,
  weeklyInvoiceSummary, weeklyPL, as_at_date, filterSummary,
}) => {
  return new Promise((resolve, reject) => {
    const doc    = new PDFDocument({ margin: 30, size: 'A4', layout: 'landscape' });
    const chunks = [];
    doc.on('data',  c  => chunks.push(c));
    doc.on('end',   () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const L      = 30;
    const W      = 781.89;
    const PAGE_H = 595.28;
    const BOTTOM = 40;
    let   pageNum = 1;

    const drawPageHeader = (chapterTitle) => {
      try { doc.image(LOGO_PATH, L, 24, { width: 28, height: 28 }); } catch (e) { console.error('Type2 PDF logo error:', e.message); }
      doc.fontSize(14).font('Helvetica-Bold').fillColor('#0f172a').text('Construct Scenery', L + 33, 28);
      doc.fontSize(7.5).font('Helvetica').fillColor('#64748b').text('Construct Scenery Limited', L + 33, 46);
      doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a')
         .text(`COST PLUS REPORT — ${(production.name || '').toUpperCase()}`, L, 30, { align: 'right', width: W });
      doc.fontSize(7.5).font('Helvetica').fillColor('#475569')
         .text(`Generated: ${fmtDate(new Date())}`, L, 48, { align: 'right', width: W });

      let sepY = 62;
      if (as_at_date) {
        doc.rect(L, sepY, W, 14).fill('#fef9c3');
        doc.fontSize(7.5).font('Helvetica-Bold').fillColor('#92400e')
           .text(`Showing data as at ${fmtDate(as_at_date)} — not current.`, L + 4, sepY + 3);
        sepY += 16;
      }
      if (filterSummary) {
        doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(`Filters: ${filterSummary}`, L, sepY, { width: W });
        sepY += 11;
      }
      if (chapterTitle) {
        doc.rect(L, sepY, W, 17).fill('#1e293b');
        doc.fontSize(8.5).font('Helvetica-Bold').fillColor('#ffffff')
           .text(chapterTitle, L + 8, sepY + 4);
        sepY += 19;
      }
      doc.moveTo(L, sepY).lineTo(L + W, sepY).strokeColor('#e2e8f0').lineWidth(1).stroke();
      return sepY + 8;
    };

    const drawFooter = () => {
      const fy = PAGE_H - 16;
      doc.moveTo(L, fy).lineTo(L + W, fy).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#94a3b8')
         .text(`Construct Scenery Limited  ·  Confidential  ·  Cost Plus Report  ·  Page ${pageNum}`, L, fy + 3, { align: 'center', width: W });
      pageNum++;
    };

    const newPage = (chapterTitle) => {
      drawFooter();
      doc.addPage({ size: 'A4', layout: 'landscape', margin: 30 });
      return drawPageHeader(chapterTitle);
    };

    const tableHeader = (cols, y) => {
      doc.rect(L, y, W, 16).fill('#f1f5f9');
      let x = L;
      cols.forEach(c => {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#475569')
           .text(c.label, x + 2, y + 4, { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
        x += c.w;
      });
      return y + 16;
    };

    const tableRow = (cols, values, y, odd) => {
      if (odd) doc.rect(L, y, W, 13).fill('#f8fafc');
      let x = L;
      cols.forEach((c, i) => {
        doc.fontSize(6.5).font('Helvetica').fillColor('#1e293b')
           .text(String(values[i] ?? '—'), x + 2, y + 3,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false, ellipsis: true });
        x += c.w;
      });
      return y + 13;
    };

    const totalRow = (cols, values, y) => {
      doc.moveTo(L, y).lineTo(L + W, y).strokeColor('#cbd5e1').lineWidth(0.5).stroke();
      y += 2;
      doc.rect(L, y, W, 14).fill('#e2e8f0');
      let x = L;
      cols.forEach((c, i) => {
        doc.fontSize(7).font('Helvetica-Bold').fillColor('#0f172a')
           .text(String(values[i] ?? ''), x + 2, y + 3,
             { width: c.w - 4, align: c.right ? 'right' : 'left', lineBreak: false });
        x += c.w;
      });
      return y + 16;
    };

    const emptyMsg = (msg, y) => {
      doc.fontSize(8).font('Helvetica').fillColor('#94a3b8').text(msg, L, y);
      return y + 18;
    };

    // ── CHAPTER 1: SUMMARY ────────────────────────────────────────────────────
    let y = drawPageHeader('CHAPTER 1 — SUMMARY');

    const mW = Math.floor(W / 4);
    const metricBox = (label, value, x, bw) => {
      doc.rect(x, y, bw, 38).fill('#f8fafc');
      doc.moveTo(x, y).lineTo(x, y + 38).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
      doc.fontSize(7).font('Helvetica').fillColor('#64748b').text(label, x + 8, y + 6, { width: bw - 16, lineBreak: false });
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text(fmt(value || 0), x + 8, y + 18, { width: bw - 16, lineBreak: false });
    };
    metricBox('Total Labour (Cost to Production)',    summary.total_labour_ctp,             L,         mW);
    metricBox('Total Materials (Cost to Production)', summary.total_materials_ctp,           L + mW,    mW);
    metricBox('Grand Total (Cost to Production)',     summary.grand_total_ctp,              L + mW*2,  mW);
    metricBox('Total Invoiced to Production',         summary.total_invoiced_to_production, L + mW*3,  mW);
    doc.rect(L, y, W, 38).strokeColor('#e2e8f0').lineWidth(0.5).stroke();
    y += 50;
    doc.fontSize(8.5).font('Helvetica').fillColor('#475569')
       .text(`Margin Rate: ${parseFloat((summary.margin_rate || 0) * 100).toFixed(0)}%`, L, y);
    y += 18;

    // ── CHAPTER 2: MAIN COST REPORT ───────────────────────────────────────────
    y = newPage('CHAPTER 2 — MAIN COST REPORT (Budget vs Actuals)');

    if (mainCostReport && mainCostReport.length) {
      const mcrCols = [
        { label: 'Acct Code',      w: 62,  right: false },
        { label: 'Description',    w: 148, right: false },
        { label: 'Wkly Cost',      w: 68,  right: true  },
        { label: 'Mrg%',           w: 36,  right: true  },
        { label: 'Sub-Total',      w: 68,  right: true  },
        { label: 'Wks',            w: 30,  right: true  },
        { label: 'Budget',         w: 72,  right: true  },
        { label: 'Labour CTD',     w: 72,  right: true  },
        { label: 'Materials CTD',  w: 72,  right: true  },
        { label: 'Total CTD',      w: 68,  right: true  },
        { label: 'Over/Under',     w: 0,   right: true  },
      ];
      mcrCols[mcrCols.length - 1].w = W - mcrCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(mcrCols, y);
      let totBudget = 0, totCTD = 0, totOU = 0;
      mainCostReport.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 2 — MAIN COST REPORT (continued)');
        totBudget += parseFloat(row.budget || 0);
        totCTD    += parseFloat(row.total_costs_to_date || 0);
        totOU     += parseFloat(row.over_under_budget || 0);
        y = tableRow(mcrCols, [
          row.account_code || '—',
          row.description  || '—',
          fmtN(row.weekly_cost),
          `${parseFloat(row.margin_pct || 0).toFixed(0)}%`,
          fmtN(row.sub_total),
          row.weeks ?? '—',
          fmtN(row.budget),
          fmtN(row.labour_costs_to_date),
          fmtN(row.materials_costs_to_date),
          fmtN(row.total_costs_to_date),
          fmtN(row.over_under_budget),
        ], y, idx % 2 === 1);
      });
      y = totalRow(mcrCols, ['TOTAL', '', '', '', '', '', fmtN(totBudget), '', '', fmtN(totCTD), fmtN(totOU)], y);
    } else {
      y = emptyMsg('No budget lines configured.', y);
    }

    // ── CHAPTER 3: POs & AMOUNT TO BILL ──────────────────────────────────────
    y = newPage('CHAPTER 3 — POs & AMOUNT TO BILL');

    if (posAndBilling && posAndBilling.length) {
      const pbCols = [
        { label: 'PO Number',       w: 95,  right: false },
        { label: 'CS Invoice No.',  w: 105, right: false },
        { label: 'PO Value',        w: 100, right: true  },
        { label: 'Amount Invoiced', w: 100, right: true  },
        { label: 'Still to Invoice',w: 100, right: true  },
        { label: 'Omitted',         w: 0,   right: false },
      ];
      pbCols[pbCols.length - 1].w = W - pbCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(pbCols, y);
      let totPOV = 0, totInv = 0, totSTI = 0;
      posAndBilling.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 3 — POs & AMOUNT TO BILL (continued)');
        totPOV += parseFloat(row.po_value || 0);
        totInv += parseFloat(row.amount_invoiced || 0);
        totSTI += parseFloat(row.amount_still_to_invoice || 0);
        y = tableRow(pbCols, [
          row.po_number          || '—',
          row.cs_invoice_number  || '—',
          fmtN(row.po_value),
          fmtN(row.amount_invoiced),
          fmtN(row.amount_still_to_invoice),
          row.is_omitted ? 'Yes' : 'No',
        ], y, idx % 2 === 1);
      });
      y = totalRow(pbCols, ['TOTAL', '', fmtN(totPOV), fmtN(totInv), fmtN(totSTI), ''], y);
    } else {
      y = emptyMsg('No PO billing data.', y);
    }

    // ── CHAPTER 4: LABOUR TO SEND ─────────────────────────────────────────────
    y = newPage('CHAPTER 4 — LABOUR TO SEND PRODUCTION');

    if (labourToSend && labourToSend.length) {
      const lsCols = [
        { label: 'Week Ending',    w: 68,  right: false },
        { label: 'Crew No.',       w: 52,  right: false },
        { label: 'Name',           w: 105, right: false },
        { label: 'Role',           w: 130, right: false },
        { label: 'Net',            w: 78,  right: true  },
        { label: 'Margin',         w: 78,  right: true  },
        { label: 'Cost to Prod.',  w: 0,   right: true  },
      ];
      lsCols[lsCols.length - 1].w = W - lsCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(lsCols, y);
      let totNet = 0, totMgn = 0, totCTP = 0;
      labourToSend.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 4 — LABOUR TO SEND (continued)');
        totNet += parseFloat(row.net_amount_charged || 0);
        totMgn += parseFloat(row.margin_amount      || 0);
        totCTP += parseFloat(row.cost_to_production || 0);
        y = tableRow(lsCols, [
          fmtDate(row.week_ending_date),
          row.crew_number        || '—',
          row.crew_name          || '—',
          row.account_description || '—',
          fmtN(row.net_amount_charged),
          fmtN(row.margin_amount),
          fmtN(row.cost_to_production),
        ], y, idx % 2 === 1);
      });
      y = totalRow(lsCols, ['TOTAL', '', '', '', fmtN(totNet), fmtN(totMgn), fmtN(totCTP)], y);
    } else {
      y = emptyMsg('No labour to send.', y);
    }

    // ── CHAPTER 5: MATERIALS TO SEND ─────────────────────────────────────────
    y = newPage('CHAPTER 5 — MATERIALS TO SEND PRODUCTION');

    if (materialsToSend && materialsToSend.length) {
      const mtsCols = [
        { label: 'Date',           w: 64,  right: false },
        { label: 'PO Number',      w: 80,  right: false },
        { label: 'Supplier',       w: 125, right: false },
        { label: 'Set Code',       w: 56,  right: false },
        { label: 'Acct Code',      w: 66,  right: false },
        { label: 'Net',            w: 74,  right: true  },
        { label: 'Margin',         w: 74,  right: true  },
        { label: 'Recharge',       w: 0,   right: true  },
      ];
      mtsCols[mtsCols.length - 1].w = W - mtsCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(mtsCols, y);
      let totNet = 0, totMgn = 0, totRch = 0;
      materialsToSend.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 5 — MATERIALS TO SEND (continued)');
        totNet += parseFloat(row.net_amount           || 0);
        totMgn += parseFloat(row.margin_amount        || 0);
        totRch += parseFloat(row.recharge_to_production || 0);
        y = tableRow(mtsCols, [
          fmtDate(row.invoice_date),
          row.po_number     || '—',
          row.supplier      || '—',
          row.set_code      || '—',
          row.account_code  || '—',
          fmtN(row.net_amount),
          fmtN(row.margin_amount),
          fmtN(row.recharge_to_production),
        ], y, idx % 2 === 1);
      });
      y = totalRow(mtsCols, ['TOTAL', '', '', '', '', fmtN(totNet), fmtN(totMgn), fmtN(totRch)], y);
    } else {
      y = emptyMsg('No materials to send.', y);
    }

    // ── CHAPTER 6: OMITTED LABOUR ─────────────────────────────────────────────
    y = newPage('CHAPTER 6 — OMITTED LABOUR');

    if (omittedLabour && omittedLabour.length) {
      const olCols = [
        { label: 'Week Ending',  w: 68,  right: false },
        { label: 'Crew Name',    w: 105, right: false },
        { label: 'Role',         w: 120, right: false },
        { label: 'Net',          w: 72,  right: true  },
        { label: 'Margin',       w: 72,  right: true  },
        { label: 'CTP',          w: 72,  right: true  },
        { label: 'Reason',       w: 0,   right: false },
      ];
      olCols[olCols.length - 1].w = W - olCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(olCols, y);
      omittedLabour.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 6 — OMITTED LABOUR (continued)');
        y = tableRow(olCols, [
          fmtDate(row.week_ending_date),
          row.crew_name   || '—',
          row.description || '—',
          fmtN(row.net_amount),
          fmtN(row.margin_amount),
          fmtN(row.cost_to_production),
          row.omit_reason || '—',
        ], y, idx % 2 === 1);
      });
    } else {
      y = emptyMsg('No omitted labour entries.', y);
    }

    // ── CHAPTER 7: OMITTED MATERIALS ─────────────────────────────────────────
    y = newPage('CHAPTER 7 — OMITTED MATERIALS');

    if (omittedMaterials && omittedMaterials.length) {
      const omCols = [
        { label: 'Date',          w: 64,  right: false },
        { label: 'PO Number',     w: 80,  right: false },
        { label: 'Supplier',      w: 145, right: false },
        { label: 'Net',           w: 85,  right: true  },
        { label: 'Margin',        w: 85,  right: true  },
        { label: 'Recharge CTP',  w: 85,  right: true  },
        { label: 'Reason',        w: 0,   right: false },
      ];
      omCols[omCols.length - 1].w = W - omCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(omCols, y);
      omittedMaterials.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 7 — OMITTED MATERIALS (continued)');
        y = tableRow(omCols, [
          fmtDate(row.week_ending_date),
          row.po_number  || '—',
          row.supplier   || row.description || '—',
          fmtN(row.net_amount),
          fmtN(row.margin_amount),
          fmtN(row.recharge_to_production),
          row.omit_reason || '—',
        ], y, idx % 2 === 1);
      });
    } else {
      y = emptyMsg('No omitted material entries.', y);
    }

    // ── CHAPTER 8: WEEKLY INVOICE SUMMARY ────────────────────────────────────
    y = newPage('CHAPTER 8 — WEEKLY INVOICE SUMMARY');

    if (weeklyInvoiceSummary && weeklyInvoiceSummary.length) {
      const wisCols = [
        { label: 'Wk#',           w: 42,  right: true  },
        { label: 'Week Ending',   w: 88,  right: false },
        { label: 'Labour (CTP)',  w: 130, right: true  },
        { label: 'Materials (CTP)', w: 130, right: true },
        { label: 'Total Charged', w: 0,   right: true  },
      ];
      wisCols[wisCols.length - 1].w = W - wisCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(wisCols, y);
      let totLab = 0, totMat = 0, totChg = 0;
      weeklyInvoiceSummary.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage('CHAPTER 8 — WEEKLY INVOICE SUMMARY (continued)');
        totLab += parseFloat(row.labour_charged || 0);
        totMat += parseFloat(row.materials      || 0);
        totChg += parseFloat(row.charged_so_far || 0);
        y = tableRow(wisCols, [
          row.week_number,
          fmtDate(row.week_ending_date),
          fmtN(row.labour_charged),
          fmtN(row.materials),
          fmtN(row.charged_so_far),
        ], y, idx % 2 === 1);
      });
      y = totalRow(wisCols, ['', 'TOTAL', fmtN(totLab), fmtN(totMat), fmtN(totChg)], y);
    } else {
      y = emptyMsg('No weekly invoice data.', y);
    }

    // ── CHAPTER 9: WARREN'S WEEKLY P&L ───────────────────────────────────────
    y = newPage("CHAPTER 9 — WARREN'S WEEKLY P&L");

    if (weeklyPL && weeklyPL.length) {
      const plCols = [
        { label: 'Week Ending',      w: 90,  right: false },
        { label: 'Margin Earned',    w: 135, right: true  },
        { label: "Warren's Salary",  w: 125, right: true  },
        { label: 'Weekly Profit',    w: 125, right: true  },
        { label: 'Running Total',    w: 0,   right: true  },
      ];
      plCols[plCols.length - 1].w = W - plCols.slice(0, -1).reduce((s, c) => s + c.w, 0);

      y = tableHeader(plCols, y);
      weeklyPL.forEach((row, idx) => {
        if (y + 13 > PAGE_H - BOTTOM) y = newPage("CHAPTER 9 — WARREN'S WEEKLY P&L (continued)");
        y = tableRow(plCols, [
          fmtDate(row.week_ending_date),
          fmtN(row.margin_from_recharged_costs),
          fmtN(row.warrens_salary),
          fmtN(row.weekly_profit),
          fmtN(row.running_total_profit),
        ], y, idx % 2 === 1);
      });
    } else {
      y = emptyMsg("No P&L data available.", y);
    }

    drawFooter();
    doc.end();
  });
};

module.exports = { generateCostReportType2Pdf };
