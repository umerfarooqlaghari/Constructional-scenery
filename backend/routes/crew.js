const express    = require('express');
const router     = express.Router();
const multer     = require('multer');
const ctrl       = require('../Controllers/crewController');
const { upload } = require('../Middleware/upload');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 5 * 1024 * 1024 } });

// ── Import (specific paths before /:id) ───────────────────────────────────────
router.get('/import/template',                                ctrl.getImportTemplate);
router.post('/import/preview', csvUpload.single('csv'),       ctrl.previewImport);
router.post('/import',         csvUpload.single('csv'),       ctrl.importCSV);

router.get('/trades',                  ctrl.getTrades);
router.get('/',                        ctrl.getAllCrew);
router.post('/',                       ctrl.createCrewMember);
router.get('/:id',                     ctrl.getCrewById);
router.put('/:id',                     ctrl.updateCrewMember);
router.delete('/:id',                  ctrl.deleteCrewMember);
router.post('/:id/documents',          upload.single('file'), ctrl.addDocument);
router.delete('/:id/documents/:docId', ctrl.deleteDocument);
router.post('/:id/productions',        ctrl.linkToProduction);

module.exports = router;
