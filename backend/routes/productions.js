const express        = require('express');
const router         = express.Router();
const ctrl           = require('../Controllers/productionsController');
const { upload, documentUpload } = require('../Middleware/upload');
const { requireRole } = require('../Middleware/requireRole');

// Productions (incl. set tracker): full read/write = Coordinator only.
// MD has full read. Accountant has financial-read only (same GET surface).
const COORDINATOR = 'construction_coordinator';

// Static routes before /:id to avoid route conflict
router.get('/audit-log',                ctrl.getAuditLog);
router.post('/handover-alerts',         requireRole(COORDINATOR), ctrl.sendHandoverAlerts);

// Productions
router.get('/',                         ctrl.getAllProductions);
router.post('/',                        requireRole(COORDINATOR), ctrl.createProduction);
router.get('/:id',                      ctrl.getProductionById);
router.put('/:id',                      requireRole(COORDINATOR), ctrl.updateProduction);
router.post('/:id/transition',          requireRole(COORDINATOR), ctrl.transitionStatus);
router.get('/:id/archive-preview',      ctrl.getArchivePreview);
router.post('/:id/archive',             requireRole(COORDINATOR), ctrl.archiveProduction);
router.post('/:id/unarchive',           requireRole(COORDINATOR), ctrl.unarchiveProduction);
router.get('/:id/forecast-variance',    ctrl.getForecastVariance);

// Sets (set tracker)
router.get('/:id/sets',            ctrl.getSets);
router.post('/:id/sets',           requireRole(COORDINATOR), ctrl.createSet);
router.put('/:id/sets/:setId',     requireRole(COORDINATOR), ctrl.updateSet);
router.patch('/:id/sets/:setId',   requireRole(COORDINATOR), ctrl.patchSet);
router.delete('/:id/sets/:setId',  requireRole(COORDINATOR), ctrl.deleteSet);

// Documents
router.get('/:id/documents',              ctrl.getDocuments);
router.post('/:id/documents',             documentUpload.single('file'), requireRole(COORDINATOR), ctrl.uploadDocument);
router.delete('/:id/documents/:docId',    requireRole(COORDINATOR), ctrl.deleteDocument);

module.exports = router;
