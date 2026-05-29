const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/purchaseOrdersController');
const { upload } = require('../Middleware/upload');

router.get('/',                    ctrl.getAllPOs);
router.post('/',                   ctrl.createPO);
router.get('/:id',                 ctrl.getPOById);
router.put('/:id',                 ctrl.updatePO);
router.delete('/:id',              ctrl.deletePO);
router.post('/:id/submit',         ctrl.submitPO);
router.post('/:id/attach-invoice', upload.single('file'), ctrl.attachInvoice);
router.post('/:id/approve',        ctrl.approvePO);

module.exports = router;
