const express = require('express');
const router  = express.Router();
const ctrl    = require('../Controllers/assetsHireController');

router.get('/summary', ctrl.getAssetsHireSummary);

module.exports = router;
