// routes/public.js
const express = require('express');
const router = express.Router();
const { getRestaurants, getFeaturedRestaurants, getFoodsByRestaurant } = require('../controllers/customerController');

// Public routes
router.get('/restaurants', getRestaurants);
router.get('/restaurants/featured', getFeaturedRestaurants);
router.get('/restaurant/:id', getFoodsByRestaurant);
// Add other public routes here as needed

module.exports = router;