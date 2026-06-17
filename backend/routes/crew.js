const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const ctrl       = require('../Controllers/crewController');
const { upload } = require('../Middleware/upload');
const { requireRole } = require('../Middleware/requireRole');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// Crew Database: full read/write = Coordinator + Accountant. MD is read-only.
const WRITERS = ['construction_coordinator', 'construction_accountant'];

// ── Import (specific paths before /:id) ───────────────────────────────────────
router.get('/import/template',                                ctrl.getImportTemplate);
router.post('/import/preview', csvUpload.single('csv'),       requireRole(...WRITERS), ctrl.previewImport);
router.post('/import',         csvUpload.single('csv'),       requireRole(...WRITERS), ctrl.importCSV);

router.get('/trades',                  ctrl.getTrades);
router.get('/',                        ctrl.getAllCrew);
router.post('/',                       requireRole(...WRITERS), ctrl.createCrewMember);
router.get('/:id',                     ctrl.getCrewById);
router.put('/:id',                     requireRole(...WRITERS), ctrl.updateCrewMember);
router.delete('/:id',                  requireRole(...WRITERS), ctrl.deleteCrewMember);
router.post('/:id/documents',          upload.single('file'), requireRole(...WRITERS), ctrl.addDocument);
router.delete('/:id/documents/:docId', requireRole(...WRITERS), ctrl.deleteDocument);
router.post('/:id/productions',        requireRole(...WRITERS), ctrl.linkToProduction);

module.exports = router;
