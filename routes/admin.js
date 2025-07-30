const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { uploadSingle } = require('../middlewares/upload');
const {
  createUser,
  updateUser,
  getUsers,
  deleteUser,
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurant,
  getStats
} = require('../controllers/adminController');
const Food = require('../models/Food');

const router = express.Router();

// User management routes
router.post('/users', auth, authorize('admin'), createUser);
router.get('/users', auth, authorize('admin'), getUsers);
router.put('/users/:userId', auth, authorize('admin'), updateUser);
router.delete('/users/:userId', auth, authorize('admin'), deleteUser);

// Restaurant management routes (ONLY ADMIN can create and delete restaurants)
// router.get('/restaurants', auth, authorize('admin'), getRestaurants);
// router.post('/restaurants', auth, authorize('admin'), uploadSingle('image'), createRestaurant); // ONLY ADMIN can create
// router.put('/restaurants/:restaurantId', auth, authorize('admin'), updateRestaurant);
// router.patch('/restaurants/:restaurantId/toggle-status', auth, authorize('admin'), toggleRestaurantStatus);
// router.delete('/restaurants/:restaurantId', auth, authorize('admin'), deleteRestaurant); // ONLY ADMIN can delete

// For admin to manage foods of any restaurant
router.get('/restaurants/:restaurantId/foods', auth, authorize('admin'), async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const foods = await Food.find({ restaurant: restaurantId })
      .populate('restaurant', 'name')
      .sort({ createdAt: -1 });
    
    res.json({
      success: true,
      foods
    });
  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
});

// Statistics route
router.get('/stats', auth, authorize('admin'), getStats);

module.exports = router;