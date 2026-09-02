const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/assetsHireController');

// Specific paths before /:id
router.post('/compliance-check', ctrl.triggerVehicleComplianceCheck);

router.get('/',       ctrl.getVehicles);
router.post('/',      ctrl.createVehicle);
router.get('/:id',    ctrl.getVehicleById);
router.put('/:id',    ctrl.updateVehicle);
router.delete('/:id', ctrl.deleteVehicle);

module.exports = router;
