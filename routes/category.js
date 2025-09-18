const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, authorize } = require('../middlewares/auth');

// Public routes
router.get('/restaurant/:restaurantId', auth, authorize('restaurant'), categoryController.getCategories);

router.get('/by-owner/:ownerId', auth, authorize('restaurant'), categoryController.getRestaurantByOwner);

// Protected routes - Admin only
router.use(auth); // Apply auth middleware to all routes below

router.post('/restaurant/:restaurantId', 
  authorize('admin'), 
  categoryController.createCategory
);

router.put('/:categoryId', 
  authorize('admin'), 
  categoryController.updateCategory
);

router.get('/admin/restaurantscategories', 
  auth,
  authorize('admin'), 
  categoryController.getAllRestaurantsWithCategories
);

// router.delete('/:categoryId', 
//   authorize('admin'), 
//   categoryController.deleteCategory
// );

module.exports = router;