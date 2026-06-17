const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/dashboardController');
const { requireRole } = require('../Middleware/requireRole');

// Warren's Dashboard — exclusive to Managing Director. Every sub-route,
// including the base aggregate route, is MD-only: the aggregate payload
// includes cost-report RAG/budget data and forecasting variance, which
// must not be exposed to Accountant/Coordinator sessions.
const MD          = 'managing_director';
const ACCOUNTANT  = 'construction_accountant';
const COORDINATOR = 'construction_coordinator';

// Scoped, role-appropriate overview widgets for the other two roles' /overview page.
router.get('/accountant-overview',  requireRole(ACCOUNTANT),  ctrl.getAccountantOverview);
router.get('/coordinator-overview', requireRole(COORDINATOR), ctrl.getCoordinatorOverview);

router.get('/',              requireRole(MD), ctrl.getDashboard);
router.get('/po-spend',      requireRole(MD), ctrl.getDashboardPOSpend);
router.get('/productions',   requireRole(MD), ctrl.getDashboardProductions);
router.get('/cost-summary',       requireRole(MD), ctrl.getCostSummary);
router.get('/weekly-pl',          requireRole(MD), ctrl.getWeeklyPL);
router.get('/labour-costs',       requireRole(MD), ctrl.getLabourCosts);
router.get('/crew-headcount',     requireRole(MD), ctrl.getCrewHeadcount);
router.get('/forecast-variance',  requireRole(MD), ctrl.getDashboardForecastVariance);

module.exports = router;
