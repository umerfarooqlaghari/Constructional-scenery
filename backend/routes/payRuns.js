const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/payRunsController');

router.get('/',               ctrl.getAllPayRuns);
router.post('/',              ctrl.createPayRun);
router.get('/:id',            ctrl.getPayRunById);
router.post('/:id/process',   ctrl.processPayRun);
router.get('/:id/export-csv', ctrl.exportCsv);

module.exports = router;
