const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/costReportsController');

// ─── Export rate limiter: 10 per minute per user ──────────────────────────────
const exportCounts = new Map();
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

// ── Specific paths before /:productionId ──────────────────────────────────────
router.get('/entries', ctrl.getCostReportEntries);

// ── Per-production report endpoints ──────────────────────────────────────────
router.get('/:productionId/type1',                              ctrl.getType1Report);
router.get('/:productionId/type2',                              ctrl.getType2Report);
router.get('/:productionId/snapshot',                           ctrl.getSnapshot);
router.get('/:productionId/cost-plus',                          ctrl.getCostPlus);
router.get('/:productionId/export/csv',  exportRateLimit,       ctrl.exportCostReportCSV);
router.get('/:productionId/export/pdf',  exportRateLimit,       ctrl.exportCostReportPDF);
router.get('/:productionId',                                    ctrl.getCostReport);

// ── Mutations ─────────────────────────────────────────────────────────────────
router.post('/:productionId/invoices',                          ctrl.addInvoice);
router.delete('/:productionId/invoices/:invoiceId',             ctrl.deleteInvoice);
router.post('/:productionId/budget',                            ctrl.upsertBudget);
router.patch('/:productionId/po-billing/:sourceId',             ctrl.updatePoBilling);
router.post('/:productionId/omit-entry',                        ctrl.omitEntry);
router.delete('/:productionId/omit-entry/:entryId',             ctrl.unomitEntry);
router.put('/:productionId/margins-reference',                  ctrl.updateMarginsReference);
router.put('/:productionId/weekly-pl/:weekEndingDate',          ctrl.upsertWeeklyPL);

module.exports = router;
