const Category = require('../models/Category');
const Food = require('../models/Food');
const Restaurant = require('../models/Restaurant');
const { auth, authorize } = require('../middlewares/auth');

const categoryController = {
  // Get all categories for a restaurant
  getCategories: async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { includeInactive = false } = req.query;

      // Build query
      const query = { restaurant: restaurantId };
      if (!includeInactive) {
        query.isActive = true;
      }

      const categories = await Category.find(query)
        .sort({ name: 1 });

      res.json({
        success: true,
        data: {
          categories: categories.map(category => category.name),
          count: categories.length
        }
      });
    } catch (error) {
      console.error('Error fetching categories:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to fetch categories',
        error: error.message
      });
    }
  },

  // Create a new category (Admin only)
  createCategory: async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { name } = req.body;

      if (!name || name.trim() === '') {
        return res.status(400).json({
          success: false,
          message: 'Category name is required'
        });
      }

      // Validate restaurant exists
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found'
        });
      }

      // Create category
      const category = new Category({
        name: name.trim(),
        restaurant: restaurantId
      });

      await category.save();

      res.status(201).json({
        success: true,
        message: 'Category created successfully',
        data: { category }
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists for this restaurant'
        });
      }
      
      console.error('Error creating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to create category',
        error: error.message
      });
    }
  },

  // Update a category (Admin only)
  updateCategory: async (req, res) => {
    try {
      const { categoryId } = req.params;
      const { name, isActive } = req.body;

      const category = await Category.findById(categoryId);
      if (!category) {
        return res.status(404).json({
          success: false,
          message: 'Category not found'
        });
      }

      // Update fields
      if (name !== undefined) category.name = name.trim();
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();

      res.json({
        success: true,
        message: 'Category updated successfully',
        data: { category }
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: 'Category with this name already exists for this restaurant'
        });
      }

      console.error('Error updating category:', error);
      res.status(500).json({
        success: false,
        message: 'Failed to update category',
        error: error.message
      });
    }
  }
}
  module.exports = categoryController;