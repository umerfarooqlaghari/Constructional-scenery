const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/forecastingController');
const { requireRole } = require('../Middleware/requireRole');

// Forecasting: full read/write = MD + Accountant. Coordinator has none
// (already excluded entirely in policies.json).
const MD         = 'managing_director';
const ACCOUNTANT = 'construction_accountant';
const WRITERS    = [MD, ACCOUNTANT];

// Forecasts
router.get('/forecasts',        ctrl.getAllForecasts);
router.post('/forecasts',       requireRole(...WRITERS), ctrl.createForecast);
router.get('/forecasts/:id',    ctrl.getForecastById);
router.patch('/forecasts/:id',       requireRole(...WRITERS), ctrl.updateForecast);
router.patch('/forecasts/:id/link',  requireRole(...WRITERS), ctrl.linkForecast);
router.delete('/forecasts/:id', requireRole(...WRITERS), ctrl.deleteForecast);

// Percentometer
router.get('/percentometer/ratios',     ctrl.getRatios);
router.post('/percentometer/calculate', ctrl.calculatePercentometer);
router.put('/percentometer/ratios',     requireRole(MD), ctrl.updateRatios);  // MD only

// Supplier/Materials Catalogue (forecasting pricing data)
router.get('/catalogue',        ctrl.getCatalogue);
router.post('/catalogue',       requireRole(...WRITERS), ctrl.createCatalogueItem);
router.put('/catalogue/:id',    requireRole(...WRITERS), ctrl.updateCatalogueItem);
router.delete('/catalogue/:id', requireRole(...WRITERS), ctrl.deleteCatalogueItem);

// BECTU Rates
router.get('/bectu-rates',      ctrl.getBectuRates);

module.exports = router;
