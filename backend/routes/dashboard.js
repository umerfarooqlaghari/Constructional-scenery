const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/dashboardController');

router.get('/',              ctrl.getDashboard);
router.get('/po-spend',      ctrl.getDashboardPOSpend);
router.get('/productions',   ctrl.getDashboardProductions);
router.get('/cost-summary',       ctrl.getCostSummary);              // MD only
router.get('/weekly-pl',          ctrl.getWeeklyPL);                 // MD only
router.get('/labour-costs',       ctrl.getLabourCosts);              // MD only
router.get('/crew-headcount',     ctrl.getCrewHeadcount);            // MD only
router.get('/forecast-variance',  ctrl.getDashboardForecastVariance); // MD only

module.exports = router;
