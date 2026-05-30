const express = require('express');
const router  = express.Router();
const { authenticate } = require('../Middleware/auth');
const ctrl = require('../Controllers/authController');

router.post('/signup',           ctrl.signup);
router.post('/login',            ctrl.login);
router.post('/logout',           authenticate, ctrl.logout);
router.get('/me',                authenticate, ctrl.getMe);
router.post('/refresh',          ctrl.refreshToken);
router.post('/forgot-password',  ctrl.forgotPassword);
router.post('/verify-otp',       ctrl.verifyOtp);
router.post('/reset-password',   ctrl.resetPassword);

module.exports = router;
