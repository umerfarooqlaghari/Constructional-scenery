const express = require('express');
const router  = express.Router();
const multer  = require('multer');
const ctrl    = require('../Controllers/crewRatesController');

const csvUpload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 2 * 1024 * 1024 } });

router.get('/',         ctrl.getRates);
router.patch('/:id',    ctrl.updateRate);
router.post('/import',  csvUpload.single('csv'), ctrl.importCSV);

module.exports = router;
