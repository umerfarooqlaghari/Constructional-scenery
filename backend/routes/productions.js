const express        = require('express');
const router         = express.Router();
const ctrl           = require('../Controllers/productionsController');
const { upload, documentUpload } = require('../Middleware/upload');

// Static routes before /:id to avoid route conflict
router.get('/audit-log',                ctrl.getAuditLog);
router.post('/handover-alerts',         ctrl.sendHandoverAlerts);

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
router.patch('/:id/sets/:setId',   ctrl.patchSet);
router.delete('/:id/sets/:setId',  ctrl.deleteSet);

// Documents
router.get('/:id/documents',              ctrl.getDocuments);
router.post('/:id/documents',             documentUpload.single('file'), ctrl.uploadDocument);
router.delete('/:id/documents/:docId',    ctrl.deleteDocument);

module.exports = router;
