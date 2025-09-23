const express = require('express');
const router = express.Router();
const {
  createOrder,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  getOrderStats,
  cancelOrder,
  getUserOrders,
  getTransactionDetails
} = require('../controllers/orderController');
const { validateOrder, validateOrderStatus } = require('../middlewares/validation');
const { auth, authorize } = require('../middlewares/auth');

// Apply auth middleware to all routes
router.use(auth);

// Customer routes - only customers can create orders
// router.post('/', authorize('customer'), validateOrder, createOrder);

// Routes accessible by all authenticated users with role-based filtering in controller
router.get('/', auth, authorize('restaurant'), getAllOrders);
// router.get('/stats/dashboard', getOrderStats);
router.get('/:id', getOrder);

// Restaurant and admin can update order status
router.patch('/:id/status', authorize('restaurant', 'admin'), validateOrderStatus, updateOrderStatus);

// Cancel order - customers can cancel their own, restaurant/admin can cancel any
router.patch('/:id/cancel', cancelOrder);

router.get('/userOrders/:id', auth, getUserOrders); 

router.get('/transactions/:id', auth, authorize('restaurant'), getTransactionDetails); 

module.exports = router;

