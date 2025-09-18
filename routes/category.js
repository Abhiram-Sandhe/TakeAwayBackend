const express = require('express');
const router = express.Router();
const categoryController = require('../controllers/categoryController');
const { auth, authorize } = require('../middlewares/auth');

// Public routes
router.get('/restaurant/:restaurantId', categoryController.getCategories);

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

// router.delete('/:categoryId', 
//   authorize('admin'), 
//   categoryController.deleteCategory
// );

module.exports = router;