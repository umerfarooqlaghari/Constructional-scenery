const express        = require('express');
const router         = express.Router();
const ctrl           = require('../Controllers/productionsController');
const { upload }     = require('../Middleware/upload');

// Audit log — before /:id to avoid route conflict
router.get('/audit-log',                ctrl.getAuditLog);

// Productions
router.get('/',                         ctrl.getAllProductions);
router.post('/',                        ctrl.createProduction);
router.get('/:id',                      ctrl.getProductionById);
router.put('/:id',                      ctrl.updateProduction);
router.post('/:id/transition',          ctrl.transitionStatus);
router.get('/:id/archive-preview',      ctrl.getArchivePreview);
router.post('/:id/archive',             ctrl.archiveProduction);
router.post('/:id/unarchive',           ctrl.unarchiveProduction);

// Sets
router.get('/:id/sets',            ctrl.getSets);
router.post('/:id/sets',           ctrl.createSet);
router.put('/:id/sets/:setId',     ctrl.updateSet);
router.delete('/:id/sets/:setId',  ctrl.deleteSet);

// Documents
router.get('/:id/documents',       ctrl.getDocuments);
router.post('/:id/documents',      upload.single('file'), ctrl.uploadDocument);

module.exports = router;
