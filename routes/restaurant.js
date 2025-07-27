const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { uploadSingle } = require('../middlewares/upload'); 
const {
  getProfile,
  createRestaurant,
  updateRestaurant,
  addFood,
  getFoods,
  updateFood,
  deleteFood
} = require('../controllers/restaurantController');

const router = express.Router();

router.get('/profile', auth, authorize('restaurant'), getProfile);
router.put('/update', auth, authorize('restaurant'),uploadSingle('image'), updateRestaurant); // Only update - no create

// Food routes (restaurant owners only - admins use admin routes)
router.post('/food', auth, authorize('restaurant'), addFood);
router.get('/foods', auth, authorize('restaurant'), getFoods);
router.put('/food/:foodId', auth, authorize('restaurant'), updateFood);
router.delete('/food/:foodId', auth, authorize('restaurant'), deleteFood);

module.exports = router;