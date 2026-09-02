const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/assetsHireController');

router.get('/',           ctrl.getHireEquipment);
router.post('/',          ctrl.createHireEquipment);
router.get('/:id',        ctrl.getHireEquipmentById);
router.put('/:id',        ctrl.updateHireEquipment);
router.post('/:id/return', ctrl.returnHireEquipment);
router.delete('/:id',     ctrl.deleteHireEquipment);

module.exports = router;
