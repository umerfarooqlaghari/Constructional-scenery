const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/percentometerController');

router.get('/ratios',                ctrl.getRatios);
router.post('/calculate',            ctrl.calculate);
router.patch('/ratios/:id',          ctrl.updateRatio);      // MD only — enforced in controller
router.get('/actuals/:productionId', ctrl.getActuals);

module.exports = router;
