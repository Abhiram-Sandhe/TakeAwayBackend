const express = require('express');
const router = express.Router();
const CartController = require('../controllers/cartController');
const { auth } = require('../middlewares/auth');

// Optional auth middleware - allows both guest and authenticated users
const optionalAuth = async (req, res, next) => {
  
  const token = req.header('Authorization')?.replace('Bearer ', '');
  
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const User = require('../models/User.js');
      
      const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
      const user = await User.findById(decoded.userId);
      
      if (user && !user.tokenBlacklist.includes(token)) {
        req.user = user;
        req.token = token;
      } else {
        req.user = null;
      }
    } catch (error) {
      console.log('Token verification error:', error.message); // Debug log
      req.user = null;
    }
  } else {
    req.user = null;
  }
  next(); // Make sure next() is always called
};


// Get cart
router.post('/get', optionalAuth, CartController.getCart);

// Add item to cart
router.post('/add', optionalAuth, CartController.addToCart);

// Update cart item
router.put('/update', optionalAuth, CartController.updateCartItem);

// Remove item from cart
router.delete('/remove', optionalAuth, CartController.removeFromCart);

// Clear cart
router.delete('/clear', optionalAuth, CartController.clearCart);

// Merge guest cart with user cart (requires authentication)
router.post('/merge', auth, CartController.mergeCart);

// Get cart count
router.get('/count', optionalAuth, CartController.getCartCount);

module.exports = router;