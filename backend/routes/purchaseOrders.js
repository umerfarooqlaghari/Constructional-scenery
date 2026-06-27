const express      = require('express');
const router       = express.Router();
const ctrl         = require('../Controllers/purchaseOrdersController');
const importCtrl   = require('../Controllers/purchaseOrdersImportController');
const { upload }   = require('../Middleware/upload');
const { requireRole } = require('../Middleware/requireRole');
const multer       = require('multer');

const csvUpload    = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

const COORDINATOR = 'construction_coordinator';
const ACCOUNTANT  = 'construction_accountant';

router.get('/',                          ctrl.getAllPOs);
router.get('/export/csv',                ctrl.exportCSV);
router.get('/export/pdf',                ctrl.exportPDFList);
router.get('/import/template',           importCtrl.getImportTemplate);
router.post('/import',                   csvUpload.single('csv'), requireRole(COORDINATOR), importCtrl.importCSV);
router.post('/',                         requireRole(COORDINATOR), ctrl.createPO);
router.get('/:id',                       ctrl.getPOById);
router.put('/:id',                       requireRole(COORDINATOR), ctrl.updatePO);
router.patch('/:id',                     requireRole(COORDINATOR), ctrl.updatePO);
router.delete('/:id',                    requireRole(COORDINATOR), ctrl.deletePO);
router.post('/:id/issue',                requireRole(COORDINATOR), ctrl.issuePO);
router.post('/:id/submit',               requireRole(COORDINATOR), ctrl.submitPO);
router.post('/:id/attach-invoice',       upload.single('invoice'), requireRole(COORDINATOR, ACCOUNTANT), ctrl.attachInvoice);
router.get('/:id/invoice/download',      ctrl.downloadInvoice);
router.delete('/:id/invoice',            requireRole(COORDINATOR), ctrl.deleteInvoice);
router.post('/:id/approve',              requireRole(ACCOUNTANT), ctrl.approvePO);

module.exports = router;
