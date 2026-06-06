const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../Controllers/supplierCatalogueController');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Specific paths before /:id
router.get('/suppliers',    ctrl.getSupplierNames);  // distinct supplier names — autocomplete
router.get('/template',     ctrl.getTemplate);       // downloadable blank CSV template

router.get('/',             ctrl.getCatalogue);
router.post('/',            ctrl.createEntry);
router.patch('/:id',        ctrl.updateEntry);
router.delete('/:id',       ctrl.deleteEntry);
router.post('/import',      csvUpload.single('csv'), ctrl.importCSV);

module.exports = router;
