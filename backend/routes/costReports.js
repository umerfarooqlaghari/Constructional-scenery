const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/costReportsController');

// Specific paths before /:productionId to prevent param shadowing
router.get('/entries',                                ctrl.getCostReportEntries);

router.get('/:productionId/type1',                    ctrl.getType1Report);
router.get('/:productionId/snapshot',                 ctrl.getSnapshot);
router.get('/:productionId/cost-plus',                ctrl.getCostPlus);
router.get('/:productionId',                          ctrl.getCostReport);

router.post('/:productionId/invoices',                ctrl.addInvoice);
router.delete('/:productionId/invoices/:invoiceId',   ctrl.deleteInvoice);
router.post('/:productionId/budget',                  ctrl.upsertBudget);

module.exports = router;
