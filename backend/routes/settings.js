const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/settingsController');

router.get('/',         ctrl.getSettings);
router.patch('/:key',   ctrl.patchSetting);

module.exports = router;
