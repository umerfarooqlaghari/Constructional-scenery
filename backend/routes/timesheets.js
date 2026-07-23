const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/timesheetsController');
const { upload } = require('../Middleware/upload');
const { requireRole } = require('../Middleware/requireRole');

// Timesheets full access (create/verify/distribute/chase/etc.) = Accountant only.
// Coordinator and MD may only read.
const ACCOUNTANT = 'construction_accountant';

// ─── Export rate limiter: 10 exports per minute per user ─────────────────────
const exportCounts = new Map(); // userId → [timestamp, ...]
const exportRateLimit = (req, res, next) => {
  const userId = req.user?.id;
  if (!userId) return next();
  const now    = Date.now();
  const window = (exportCounts.get(userId) || []).filter(t => now - t < 60_000);
  if (window.length >= 10)
    return res.status(429).json({ error: 'Export rate limit exceeded — maximum 10 exports per minute.' });
  window.push(now);
  exportCounts.set(userId, window);
  next();
};

// NOTE: specific paths BEFORE /:id to avoid Express matching them as IDs
router.post('/bulk-distribute',   requireRole(ACCOUNTANT), ctrl.bulkDistribute);
router.post('/chase-invoices',    requireRole(ACCOUNTANT), ctrl.chaseInvoices);
router.post('/verification-pack', requireRole(ACCOUNTANT), ctrl.generateVerificationPackPdf);
router.post('/verification-pack-pdf', requireRole(ACCOUNTANT), ctrl.generateVerificationPackCombinedPdf);
router.get('/verification-pack/:weekEndingDate/:productionId', requireRole(ACCOUNTANT), ctrl.getVerificationPack);
router.get('/:id/verification-pack', requireRole(ACCOUNTANT), ctrl.getTimesheetVerificationPack);
router.get('/:id/draft-pdf',      requireRole(ACCOUNTANT), ctrl.getDraftPdf);
router.get('/export/csv',         exportRateLimit, ctrl.exportTimesheetsCSV);
router.get('/export/pdf',         exportRateLimit, ctrl.exportTimesheetsPDF);

router.get('/',                  ctrl.getAllTimesheets);
router.post('/',                 requireRole(ACCOUNTANT), ctrl.createTimesheet);
router.get('/:id',               ctrl.getTimesheetById);
router.patch('/:id',             requireRole(ACCOUNTANT), ctrl.patchTimesheet);
router.put('/:id/entries',       requireRole(ACCOUNTANT), ctrl.saveEntries);
router.post('/:id/resend',       requireRole(ACCOUNTANT), ctrl.resendTimesheet);
router.post('/:id/send',         requireRole(ACCOUNTANT), ctrl.sendSingleTimesheet);
router.post('/:id/attach-invoice', upload.single('invoice'), requireRole(ACCOUNTANT), ctrl.attachInvoice);
router.post('/:id/verify',       requireRole(ACCOUNTANT), ctrl.verifyTimesheet);

module.exports = router;
