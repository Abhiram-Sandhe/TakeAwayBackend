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

router.get('/restaurants', auth, authorize('customer'), getRestaurants);
router.get('/restaurants/:id/foods', auth, authorize('customer'), getFoodsByRestaurant);
router.post('/cart/add', auth, authorize('customer'), addToCart);
router.get('/cart', auth, authorize('customer'), getCart);
router.post('/order', auth, authorize('customer'), placeOrder);
router.get('/orders', auth, authorize('customer'), getOrderHistory);

module.exports = router;