const express = require('express');
const router = express.Router();
const PaymentController = require('../controllers/paymentComtroller');
const { auth } = require('../middlewares/auth'); // Assuming you have auth middleware

// Create payment order (requires authentication)
router.post('/create-order', auth, PaymentController.createPaymentOrder);

// Verify payment and create order (requires authentication)
router.post('/verify', auth, PaymentController.verifyPayment);

// Handle payment failure (requires authentication)
router.post('/failure', auth, PaymentController.handlePaymentFailure);

// Get payment status (requires authentication)
router.get('/status/:paymentId', auth, PaymentController.getPaymentStatus);

// Webhook endpoint (no auth required - Razorpay calls this)
router.post('/webhook', express.raw({ type: 'application/json' }), PaymentController.handleWebhook);

module.exports = router;