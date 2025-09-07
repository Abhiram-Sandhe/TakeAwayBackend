const express = require('express');
const { register, login, logout, forgotPassword, resetPassword, verifyOTP, resendOTP, verifyToken, getCurrentUser} = require('../controllers/authController.js');
const {auth} = require('../middlewares/auth.js')
const router = express.Router();

router.post('/register', register);
router.post('/verify-otp', verifyOTP);
router.post('/resend-otp', resendOTP);
router.post('/login', login);
router.post('/logout', auth, logout);
router.post('/forgot-password', forgotPassword);

router.get('/verify-token', auth, verifyToken);
router.get('/me', auth, getCurrentUser);


router.get('/reset-password/:token', async (req, res) => {
  try {
    const { token } = req.params;
    const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

    const user = await User.findOne({
      resetPasswordToken: hashedToken,
      resetPasswordExpire: { $gt: Date.now() }
    });

    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired token' });
    }

    res.json({ message: 'Token is valid' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
});



router.put('/reset-password/:token', resetPassword);

module.exports = router;