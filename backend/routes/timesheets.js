const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/timesheetsController');
const { upload } = require('../Middleware/upload');

// NOTE: specific paths BEFORE /:id to avoid Express matching them as IDs
router.post('/bulk-distribute',  ctrl.bulkDistribute);
router.post('/chase-invoices',   ctrl.chaseInvoices);
router.get('/verification-pack/:weekEndingDate/:productionId', ctrl.getVerificationPack);

router.get('/',                  ctrl.getAllTimesheets);
router.post('/',                 ctrl.createTimesheet);
router.get('/:id',               ctrl.getTimesheetById);
router.put('/:id/entries',       ctrl.saveEntries);
router.post('/:id/attach-invoice', upload.single('file'), ctrl.attachInvoice);
router.post('/:id/verify',       ctrl.verifyTimesheet);

module.exports = router;
