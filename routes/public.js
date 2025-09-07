// routes/public.js
const express = require('express');
const router = express.Router();
const { getRestaurants, getFeaturedRestaurants } = require('../controllers/customerController');

// Public routes
router.get('/restaurants', getRestaurants);
router.get('/restaurants/featured', getFeaturedRestaurants);
// Add other public routes here as needed

module.exports = router;