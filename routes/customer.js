const express = require('express');
const { auth, authorize } = require('../middleware/auth');
const {
  getRestaurants,
  getFoodsByRestaurant,
  addToCart,
  getCart,
  placeOrder,
  getOrderHistory
} = require('../controllers/customerController');
const router = express.Router();

// Public route for all restaurants
router.get('/restaurants', getRestaurants);

// Protected route (if you need customer-specific functionality later)
router.get('/restaurants/customer', auth, authorize('customer'), getRestaurants);
router.get('/restaurants/:id/foods', auth, authorize('customer'), getFoodsByRestaurant);
router.post('/cart/add', auth, authorize('customer'), addToCart);
router.get('/cart', auth, authorize('customer'), getCart);
router.post('/order', auth, authorize('customer'), placeOrder);
router.get('/orders', auth, authorize('customer'), getOrderHistory);

module.exports = router;