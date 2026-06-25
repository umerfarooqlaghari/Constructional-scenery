const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/payRunsController');
const { requireRole } = require('../Middleware/requireRole');

// Pay Run tab: Accountant has full access. MD may view (read access to all
// modules). Coordinator has zero access — enforced here AND in policies.json.
const MD         = 'managing_director';
const ACCOUNTANT = 'construction_accountant';
const READERS    = [MD, ACCOUNTANT];

// Specific paths before /:id
router.get('/available-weeks', requireRole(...READERS), ctrl.getAvailableWeeks);
router.get('/preview',         requireRole(...READERS), ctrl.getPayRunPreview);

router.get('/',               requireRole(...READERS), ctrl.getAllPayRuns);
router.post('/',              requireRole(ACCOUNTANT),  ctrl.createPayRun);
router.get('/:id',            requireRole(...READERS), ctrl.getPayRunById);
router.post('/:id/process',     requireRole(ACCOUNTANT), ctrl.processPayRun);
router.post('/:id/sync-labour', requireRole(ACCOUNTANT), ctrl.syncLabourCosts);
router.get('/:id/export-csv',   requireRole(...READERS), ctrl.exportCsv);

module.exports = router;
