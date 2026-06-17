const express = require('express');
const router  = express.Router();
const { authenticate } = require('../Middleware/auth');
const { requireRole }  = require('../Middleware/requireRole');
const ctrl = require('../Controllers/authController');

// SECURITY: signup must never be public — it can mint a managing_director
// account. Only an already-authenticated MD may create new accounts.
// (The admin "Users" page calls this same endpoint.)
router.post('/signup',           authenticate, requireRole('managing_director'), ctrl.signup);
router.post('/login',            ctrl.login);
router.post('/logout',           authenticate, ctrl.logout);
router.get('/me',                authenticate, ctrl.getMe);
router.post('/refresh',          ctrl.refreshToken);
router.post('/forgot-password',  ctrl.forgotPassword);
router.post('/verify-otp',       ctrl.verifyOtp);
router.post('/reset-password',   ctrl.resetPassword);

module.exports = router;
