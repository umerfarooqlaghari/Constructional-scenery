const express = require('express');
const router  = express.Router();
const ctrl = require('../Controllers/forecastingController');

// Forecasts
router.get('/forecasts',        ctrl.getAllForecasts);
router.post('/forecasts',       ctrl.createForecast);
router.get('/forecasts/:id',    ctrl.getForecastById);
router.patch('/forecasts/:id',       ctrl.updateForecast);
router.patch('/forecasts/:id/link',  ctrl.linkForecast);
router.delete('/forecasts/:id', ctrl.deleteForecast);

// Percentometer
router.get('/percentometer/ratios',     ctrl.getRatios);
router.post('/percentometer/calculate', ctrl.calculatePercentometer);
router.put('/percentometer/ratios',     ctrl.updateRatios);  // MD only (enforced globally)

// Supplier Catalogue
router.get('/catalogue',        ctrl.getCatalogue);
router.post('/catalogue',       ctrl.createCatalogueItem);
router.put('/catalogue/:id',    ctrl.updateCatalogueItem);
router.delete('/catalogue/:id', ctrl.deleteCatalogueItem);

// BECTU Rates
router.get('/bectu-rates',      ctrl.getBectuRates);

module.exports = router;
