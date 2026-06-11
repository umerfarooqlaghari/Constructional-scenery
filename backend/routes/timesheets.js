const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/timesheetsController');
const { upload } = require('../Middleware/upload');

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
router.post('/bulk-distribute',   ctrl.bulkDistribute);
router.post('/chase-invoices',    ctrl.chaseInvoices);
router.post('/verification-pack', ctrl.generateVerificationPackPdf);
router.get('/verification-pack/:weekEndingDate/:productionId', ctrl.getVerificationPack);
router.get('/export/csv',         exportRateLimit, ctrl.exportTimesheetsCSV);
router.get('/export/pdf',         exportRateLimit, ctrl.exportTimesheetsPDF);

router.get('/',                  ctrl.getAllTimesheets);
router.post('/',                 ctrl.createTimesheet);
router.get('/:id',               ctrl.getTimesheetById);
router.patch('/:id',             ctrl.patchTimesheet);
router.put('/:id/entries',       ctrl.saveEntries);
router.post('/:id/resend',       ctrl.resendTimesheet);
router.post('/:id/attach-invoice', upload.single('invoice'), ctrl.attachInvoice);
router.post('/:id/verify',       ctrl.verifyTimesheet);

module.exports = router;
