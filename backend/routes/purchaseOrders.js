const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/purchaseOrdersController');
const { upload } = require('../Middleware/upload');

router.get('/',                          ctrl.getAllPOs);
router.get('/export/csv',                ctrl.exportCSV);
router.get('/export/pdf',                ctrl.exportPDFList);
router.post('/',                         ctrl.createPO);
router.get('/:id',                       ctrl.getPOById);
router.put('/:id',                       ctrl.updatePO);
router.patch('/:id',                     ctrl.updatePO);
router.delete('/:id',                    ctrl.deletePO);
router.post('/:id/issue',                ctrl.issuePO);
router.post('/:id/submit',               ctrl.submitPO);
router.post('/:id/attach-invoice',       upload.single('invoice'), ctrl.attachInvoice);
router.get('/:id/invoice/download',      ctrl.downloadInvoice);
router.delete('/:id/invoice',            ctrl.deleteInvoice);
router.post('/:id/approve',              ctrl.approvePO);

module.exports = router;
