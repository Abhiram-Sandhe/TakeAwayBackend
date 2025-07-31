const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { 
  uploadRestaurantImage, 
  uploadFoodImage 
} = require('../middlewares/upload'); 
const {
  getProfile,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  addFood,
  getFoods,
  toggleFoodAvailability,
  updateFood,
  deleteFood
} = require('../controllers/restaurantController');

const router = express.Router();

// Restaurant profile routes
router.get('/profile', auth, authorize('restaurant'), getProfile);

// Restaurant image upload - uses 'restaurants' folder
router.put('/update', auth, authorize('restaurant'), uploadRestaurantImage('image'), updateRestaurant);

// Toggle restaurant status
router.patch('/toggle-status', auth, authorize('restaurant'), toggleRestaurantStatus);


// Food image upload - uses 'food-items' folder  
router.post('/food', auth, authorize('restaurant'), uploadFoodImage('image'), addFood);
router.get('/foods', auth, authorize('restaurant'), getFoods);
router.patch('/foods/:foodId/toggle-availability', auth, authorize('restaurant'), toggleFoodAvailability);
router.put('/food/:id', auth, authorize('restaurant'), uploadFoodImage('image'), updateFood);
router.delete('/food/:id', auth, authorize('restaurant'), deleteFood);

module.exports = router;