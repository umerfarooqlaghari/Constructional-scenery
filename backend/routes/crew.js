const express    = require('express');
const router     = express.Router();
const ctrl       = require('../Controllers/crewController');
const { upload } = require('../Middleware/upload');

router.get('/trades',                  ctrl.getTrades);
router.get('/',                        ctrl.getAllCrew);
router.post('/',                       ctrl.createCrewMember);
router.get('/:id',                     ctrl.getCrewById);
router.put('/:id',                     ctrl.updateCrewMember);
router.post('/:id/documents',          upload.single('file'), ctrl.addDocument);
router.delete('/:id/documents/:docId', ctrl.deleteDocument);
router.post('/:id/productions',        ctrl.linkToProduction);

module.exports = router;
