const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/dashboardController');

router.get('/',            ctrl.getDashboard);
router.get('/po-spend',    ctrl.getDashboardPOSpend);
router.get('/productions', ctrl.getDashboardProductions);

module.exports = router;
