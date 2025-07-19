const express = require('express');
const { register, login, logout, forgotPassword, resetPassword, verifyOTP, resendOTP } = require('../controllers/authController.js');
const {auth} = require('../middlewares/auth.js')
const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/logout', auth, logout);
router.post('/forgot-password', forgotPassword);
router.put('/reset-password/:token', resetPassword);

module.exports = router;