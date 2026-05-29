const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/costReportsController');

router.get('/:productionId',           ctrl.getCostReport);
router.post('/:productionId/invoices', ctrl.addInvoice);
router.get('/:productionId/cost-plus', ctrl.getCostPlus);
router.post('/:productionId/budget',   ctrl.upsertBudget);

module.exports = router;
