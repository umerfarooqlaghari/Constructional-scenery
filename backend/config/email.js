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
const sendEmail = async ({ to, subject, html, text, from }) => {
  const fromAddress = from || `"${process.env.SMTP_FROM_NAME || 'CS HQ'}" <${process.env.SMTP_USER}>`;

  try {
    const info = await transporter.sendMail({ from: fromAddress, to, subject, html, text });
    console.log(`📧 Email sent → ${Array.isArray(to) ? to.join(', ') : to} | ${subject} | id: ${info.messageId}`);
    return info;
  } catch (err) {
    console.error(`❌ Email failed → ${subject}:`, err.message);
    throw err;  // let caller decide whether to swallow the error
  }
};

// ─── Email Templates ─────────────────────────────────────────────────────────

const templates = {

  /**
   * PO issued to supplier (triggered by POST /api/purchase-orders/:id/submit)
   */
  poIssued: (po) => ({
    subject: `Purchase Order ${po.po_number} — Construct Scenery Limited`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2c3e50">Purchase Order: ${po.po_number}</h2>
        <p>Dear ${po.supplier_name},</p>
        <p>Please find below a purchase order issued by <strong>Construct Scenery Limited</strong>.</p>
        <table style="width:100%;border-collapse:collapse;margin:16px 0">
          <tr style="background:#f4f4f4"><td style="padding:8px;border:1px solid #ddd"><strong>PO Number</strong></td><td style="padding:8px;border:1px solid #ddd">${po.po_number}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Date</strong></td><td style="padding:8px;border:1px solid #ddd">${po.date_of_po}</td></tr>
          <tr style="background:#f4f4f4"><td style="padding:8px;border:1px solid #ddd"><strong>Description</strong></td><td style="padding:8px;border:1px solid #ddd">${po.description || '—'}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Net Amount</strong></td><td style="padding:8px;border:1px solid #ddd">£${parseFloat(po.net_amount).toFixed(2)}</td></tr>
          <tr style="background:#f4f4f4"><td style="padding:8px;border:1px solid #ddd"><strong>VAT</strong></td><td style="padding:8px;border:1px solid #ddd">£${parseFloat(po.vat || 0).toFixed(2)}</td></tr>
          <tr><td style="padding:8px;border:1px solid #ddd"><strong>Gross Amount</strong></td><td style="padding:8px;border:1px solid #ddd"><strong>£${parseFloat(po.gross_amount).toFixed(2)}</strong></td></tr>
        </table>
        <p>Please confirm receipt of this order and supply the goods/services as specified.</p>
        <p>When invoicing, please quote the PO number <strong>${po.po_number}</strong> on your invoice.</p>
        <br/>
        <p style="color:#666">Regards,<br/><strong>Construct Scenery Limited</strong><br/>info@constructscenery.co.uk</p>
      </div>
    `,
  }),

  /**
   * Timesheet distributed to crew member
   */
  timesheetDistributed: (crewName, weekEndingDate, productionName) => ({
    subject: `Timesheet for Week Ending ${weekEndingDate} — ${productionName}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#2c3e50">Timesheet: Week Ending ${weekEndingDate}</h2>
        <p>Dear ${crewName},</p>
        <p>Your timesheet for the week ending <strong>${weekEndingDate}</strong> on production <strong>${productionName}</strong> has been prepared.</p>
        <p>Please:</p>
        <ol>
          <li>Review your timesheet entries</li>
          <li>Raise your invoice for the amount shown</li>
          <li>Reply to this email with your signed timesheet and invoice attached</li>
        </ol>
        <p>Payment cannot be processed until your invoice is received.</p>
        <br/>
        <p style="color:#666">Regards,<br/><strong>Construct Scenery Limited</strong><br/>accounts@constructscenery.co.uk</p>
      </div>
    `,
  }),

  /**
   * Invoice chase reminder
   */
  invoiceChase: (crewName, weekEndingDate) => ({
    subject: `Reminder: Invoice Required — Week Ending ${weekEndingDate}`,
    html: `
      <div style="font-family:Arial,sans-serif;max-width:600px;margin:0 auto">
        <h2 style="color:#e74c3c">Invoice Required</h2>
        <p>Dear ${crewName},</p>
        <p>We have not yet received your invoice for the week ending <strong>${weekEndingDate}</strong>.</p>
        <p>Could you please send your invoice as soon as possible so we can process your payment promptly.</p>
        <p>If you have already sent your invoice, please disregard this message.</p>
        <br/>
        <p style="color:#666">Regards,<br/><strong>Construct Scenery Limited</strong><br/>accounts@constructscenery.co.uk</p>
      </div>
    `,
  }),

};

module.exports = { sendEmail, templates };
