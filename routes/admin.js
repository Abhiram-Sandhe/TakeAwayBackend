const express = require('express');
const { auth, authorize } = require('../middlewares/auth.js');
const { uploadSingle } = require('../middlewares/upload');
const {
  getUsers,
  getRestaurants,
  toggleRestaurantFeaturedStatus,
  getStats
} = require('../controllers/adminController');
const Food = require('../models/Food');

const router = express.Router();

// User management routes
router.get('/users', auth, authorize('admin'), getUsers);

// Restaurant management routes (ONLY ADMIN can create and delete restaurants)
router.get('/restaurants', auth, authorize('admin'), getRestaurants);
router.patch('/feature-status/:restaurantId', auth, authorize('admin'), toggleRestaurantFeaturedStatus);

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