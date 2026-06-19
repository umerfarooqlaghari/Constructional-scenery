/**
 * SMTP email service — using Gmail App Password for development.
 * In production replace with Microsoft Graph API (Outlook) when MS Azure is configured.
 *
 * Usage:
 *   const { sendEmail } = require('../config/email');
 *   await sendEmail({ to: 'user@example.com', subject: 'Hello', html: '<p>Hi</p>' });
 */

const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
  host:   process.env.SMTP_HOST || 'smtp.gmail.com',
  port:   parseInt(process.env.SMTP_PORT || '587'),
  secure: false,  // STARTTLS on port 587
  auth: {
    user: process.env.SMTP_USER,
    pass: process.env.SMTP_PASS,
  },
  tls: { rejectUnauthorized: false },
});

// Verify SMTP connection on startup so misconfiguration is caught early
transporter.verify((err) => {
  if (err) console.error('❌ SMTP connection failed:', err.message);
  else     console.log('✅ SMTP ready');
});

/**
 * Send a single email.
 * @param {object} opts
 * @param {string|string[]} opts.to       - Recipient(s)
 * @param {string}          opts.subject  - Subject line
 * @param {string}          opts.html     - HTML body
 * @param {string}          [opts.text]   - Plain-text fallback
 * @param {string}          [opts.from]   - Override sender (defaults to SMTP_FROM_NAME <SMTP_USER>)
 * @returns {Promise<object>} Nodemailer info object
 */
const sendEmail = async ({ to, subject, html, text, from, replyTo, attachments }) => {
  const fromAddress = from || `"${process.env.SMTP_FROM_NAME || 'Deepsian'}" <${process.env.SMTP_USER}>`;
  const opts = { from: fromAddress, to, subject, html, text };
  if (replyTo)     opts.replyTo     = replyTo;
  if (attachments) opts.attachments = attachments;

  try {
    const info = await transporter.sendMail(opts);
    console.log(`📧 Email sent → ${Array.isArray(to) ? to.join(', ') : to} | ${subject} | id: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Email failed → ${subject}:`, err.message);
    throw err;
  }
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const templates = {

  /**
   * PO issued to supplier (triggered by POST /api/purchase-orders/:id/issue)
   * @param {object} po
   * @param {string} productionName
   */
  poIssued: (po, productionName) => ({
    subject: `Purchase Order ${po.po_number} — Construct Scenery Limited`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f172a;padding:20px 24px;margin-bottom:24px">
          <span style="color:#fff;font-size:20px;font-weight:700;letter-spacing:2px">DEEPSIAN</span>
          <span style="color:#94a3b8;font-size:12px;margin-left:12px">Construct Scenery Limited</span>
        </div>
        <h2 style="color:#0f172a;margin:0 0 4px">Purchase Order: ${po.po_number}</h2>
        <p style="color:#64748b;margin:0 0 20px">Production: <strong>${productionName || '—'}</strong></p>
        <p>Dear ${po.supplier_name},</p>
        <p>Please find attached a purchase order issued by <strong>Construct Scenery Limited</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="background:#f8fafc"><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>PO Number</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${po.po_number}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>Date</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${po.date_of_po}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>Production</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${productionName || '—'}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>Description</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">${po.description || '—'}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>Net Amount</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">£${parseFloat(po.net_amount).toFixed(2)}</td></tr>
          <tr><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>VAT</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0">£${parseFloat(po.vat || 0).toFixed(2)}</td></tr>
          <tr style="background:#f8fafc"><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>Gross Amount</strong></td><td style="padding:8px 12px;border:1px solid #e2e8f0"><strong>£${parseFloat(po.gross_amount).toFixed(2)}</strong></td></tr>
        </table>
        <p>Please confirm receipt of this order and supply the goods/services as specified.</p>
        <p>When invoicing, please quote the PO number <strong>${po.po_number}</strong> on your invoice.</p>
        <br/>
        <p style="color:#666">Regards,<br/><strong>Construct Scenery Limited</strong><br/>warren@constructscenery.co.uk</p>
      </div>
    `,
  }),

  /**
   * Timesheet distributed to crew member.
   * @param {string} crewName
   * @param {string} weekEndingDate  YYYY-MM-DD
   * @param {string} productionName
   * @param {number} daysWorked      Standard days worked that week
   * @param {number|string} grandTotal
   */
  timesheetDistributed: (crewName, weekEndingDate, productionName, daysWorked, grandTotal) => ({
    subject: `Timesheet for Week Ending ${weekEndingDate} — ${productionName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f172a;padding:16px 24px;margin-bottom:24px">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:2px">DEEPSIAN</span>
          <span style="color:#94a3b8;font-size:11px;margin-left:10px">Construct Scenery Limited</span>
        </div>
        <h2 style="color:#0f172a;margin:0 0 4px">Timesheet: Week Ending ${weekEndingDate}</h2>
        <p style="color:#64748b;margin:0 0 20px">Production: <strong>${productionName || '—'}</strong></p>
        <p>Dear ${crewName},</p>
        <p>Please find your timesheet for the week ending <strong>${weekEndingDate}</strong> attached to this email.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0;background:#f8fafc;border-radius:6px">
          <tr>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0"><strong>Days worked</strong></td>
            <td style="padding:10px 16px;border-bottom:1px solid #e2e8f0">${daysWorked ?? '—'}</td>
          </tr>
          <tr>
            <td style="padding:10px 16px"><strong>Grand total</strong></td>
            <td style="padding:10px 16px"><strong>£${parseFloat(grandTotal || 0).toFixed(2)}</strong></td>
          </tr>
        </table>
        <p>If everything looks correct, please sign the timesheet and reply to this email with:</p>
        <ol>
          <li>Your <strong>signed timesheet</strong> (the attached PDF, signed and scanned/photographed)</li>
          <li>Your <strong>invoice</strong> for the amount shown above</li>
        </ol>
        <p>If anything needs correcting, please reply explaining the issue and we will amend and resend.</p>
        <br/>
        <p style="color:#666;font-size:13px">Regards,<br/><strong>Construct Scenery Limited</strong><br/>invoice@constructscenery.co.uk</p>
      </div>
    `,
  }),

  /**
   * Invoice chase reminder (self-employed crew only).
   * @param {string}       crewName
   * @param {string}       weekEndingDate  YYYY-MM-DD
   * @param {number|string} grandTotal
   */
  invoiceChase: (crewName, weekEndingDate, grandTotal) => ({
    subject: `Reminder: Invoice Required — Week Ending ${weekEndingDate}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <div style="background:#0f172a;padding:16px 24px;margin-bottom:24px">
          <span style="color:#fff;font-size:18px;font-weight:700;letter-spacing:2px">DEEPSIAN</span>
          <span style="color:#94a3b8;font-size:11px;margin-left:10px">Construct Scenery Limited</span>
        </div>
        <h2 style="color:#b91c1c;margin:0 0 4px">Invoice Required</h2>
        <p style="color:#64748b;margin:0 0 20px">Week ending: <strong>${weekEndingDate}</strong></p>
        <p>Dear ${crewName},</p>
        <p>We have not yet received your invoice for the week ending <strong>${weekEndingDate}</strong>.</p>
        <p>Your timesheet total is <strong>£${parseFloat(grandTotal || 0).toFixed(2)}</strong>. Please submit your invoice for this amount as soon as possible so we can process your payment promptly.</p>
        <p>Please reply to this email with your invoice attached. If you have already sent it, please disregard this message.</p>
        <br/>
        <p style="color:#666;font-size:13px">Regards,<br/><strong>Construct Scenery Limited</strong><br/>invoice@constructscenery.co.uk</p>
      </div>
    `,
  }),

  /**
   * Handover alert — sent to coordinators + MD at 14-day and 7-day marks
   */
  handoverAlert: (set, days) => {
    const handoverDate = set.handover_date
      ? new Date(set.handover_date).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })
      : '—';
    const statusLabel = (set.completion_status ?? '').replace(/_/g, ' ');
    const appUrl = process.env.APP_URL || 'https://deepsian.onrender.com';
    const deepLink = `${appUrl}/productions/${set.prod_id}`;
    const dotColor = days <= 7 ? '#ef4444' : '#f59e0b';
    const subject = `Handover alert — ${set.set_name}${set.set_number ? ` (Set ${set.set_number})` : ''} · ${days} days`;
    return {
      subject,
      html: `
        <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto;background:#fff;border:1px solid #e2e8f0;border-radius:8px;overflow:hidden">
          <div style="background:#1e293b;padding:16px 24px">
            <p style="color:#94a3b8;font-size:11px;margin:0;letter-spacing:1px;text-transform:uppercase">Handover alert — ${set.set_name}${set.set_number ? ` (Set ${set.set_number})` : ''}</p>
            <p style="color:#64748b;font-size:11px;margin:6px 0 0">From: invoice@constructscenery.co.uk &nbsp;·&nbsp; To: coordinator, warren</p>
          </div>
          <div style="padding:24px">
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:20px">
              <span style="color:${dotColor};font-size:18px;margin-top:1px">⏱</span>
              <div>
                <p style="font-weight:700;color:#1e293b;margin:0;font-size:15px">${days} days to handover</p>
                <p style="color:#475569;font-size:13px;margin:6px 0 0">
                  <strong>${set.set_name}${set.set_number ? ` — (Set ${set.set_number})` : ''}</strong>
                  is due for handover to production on <strong>${handoverDate}</strong>.
                  Current status: <strong style="text-transform:capitalize">${statusLabel || 'Not started'}</strong>.
                </p>
              </div>
            </div>
            <div style="display:flex;align-items:flex-start;gap:12px;margin-bottom:20px;padding-top:16px;border-top:1px solid #e2e8f0">
              <span style="font-size:16px;margin-top:1px">🎬</span>
              <div>
                <p style="font-weight:700;color:#1e293b;margin:0;font-size:13px">Production</p>
                <p style="color:#475569;font-size:13px;margin:4px 0 0">
                  ${set.production_name ?? '—'}${set.production_company ? ` &nbsp;·&nbsp; ${set.production_company}` : ''}${set.production_designer ? ` &nbsp;·&nbsp; Production designer: ${set.production_designer}` : ''}
                </p>
              </div>
            </div>
            <div style="background:#f8fafc;border:1px solid #e2e8f0;border-radius:6px;padding:14px 16px">
              <a href="${deepLink}" style="color:#0ea5e9;font-size:13px;text-decoration:none">
                View full set schedule in Deepsian &rarr; <span style="text-decoration:underline">[link]</span>
              </a>
            </div>
          </div>
          <div style="background:#f8fafc;padding:10px 24px;border-top:1px solid #e2e8f0">
            <p style="color:#94a3b8;font-size:11px;margin:0">Construct Scenery Limited &nbsp;·&nbsp; Automated alert &nbsp;·&nbsp; Do not reply</p>
          </div>
        </div>
      `,
    };
  },

};

module.exports = { sendEmail, templates };
