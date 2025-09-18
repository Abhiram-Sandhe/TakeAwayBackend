const Category = require("../models/Category");
const Food = require("../models/Food");
const Restaurant = require("../models/Restaurant");
const { auth, authorize } = require("../middlewares/auth");

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

      const categories = await Category.find(query).sort({ name: 1 });

      res.json({
        success: true,
        data: {
          categories: categories.map((category) => ({
            _id: category._id,
            name: category.name,
          })),
          count: categories.length,
        },
      });
    } catch (error) {
      console.error("Error fetching categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch categories",
        error: error.message,
      });
    }
  },

  // Create a new category (Admin only)
  createCategory: async (req, res) => {
    try {
      const { restaurantId } = req.params;
      const { name } = req.body;

      if (!name || name.trim() === "") {
        return res.status(400).json({
          success: false,
          message: "Category name is required",
        });
      }

      // Validate restaurant exists
      const restaurant = await Restaurant.findById(restaurantId);
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found",
        });
      }

      // Create category
      const category = new Category({
        name: name.trim(),
        restaurant: restaurantId,
      });

      await category.save();

      res.status(201).json({
        success: true,
        message: "Category created successfully",
        data: { category },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists for this restaurant",
        });
      }

      console.error("Error creating category:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create category",
        error: error.message,
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
          message: "Category not found",
        });
      }

      // Update fields
      if (name !== undefined) category.name = name.trim();
      if (isActive !== undefined) category.isActive = isActive;

      await category.save();

      res.json({
        success: true,
        message: "Category updated successfully",
        data: { category },
      });
    } catch (error) {
      if (error.code === 11000) {
        return res.status(400).json({
          success: false,
          message: "Category with this name already exists for this restaurant",
        });
      }

      console.error("Error updating category:", error);
      res.status(500).json({
        success: false,
        message: "Failed to update category",
        error: error.message,
      });
    }
  },

  getAllRestaurantsWithCategories: async (req, res) => {
    try {
      const { includeInactive = false } = req.query;

      // Aggregation to fetch restaurants with categories
      const restaurants = await Restaurant.aggregate([
        { $match: includeInactive ? {} : { isActive: true } },
        {
          $lookup: {
            from: "categories",
            let: { restaurantId: "$_id" },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ["$restaurant", "$$restaurantId"] },
                  ...(includeInactive ? {} : { isActive: true }),
                },
              },
              { $sort: { name: 1 } },
            ],
            as: "categories",
          },
        },
        { $sort: { name: 1 } },
      ]);

      // Format the response as required
      const formattedData = restaurants.map((restaurant) => ({
        id: restaurant._id,
        name: restaurant.name,
        categories: restaurant.categories.map((category) => ({
          id: category._id,
          name: category.name,
        })),
      }));

      // Calculate total categories across all restaurants
      const totalCategories = restaurants.reduce(
        (sum, r) => sum + r.categories.length,
        0
      );

      res.json({
        success: true,
        data: {
          restaurants: formattedData,
          totalRestaurants: restaurants.length,
          totalCategories,
        },
      });
    } catch (error) {
      console.error("Error fetching restaurants with categories:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch restaurants with categories",
        error: error.message,
      });
    }
  },

  getRestaurantByOwner: async (req, res) => {
    try {
      const { ownerId } = req.params;

      const restaurant = await Restaurant.findOne({ owner: ownerId });

      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found for this owner",
        });
      }

      res.json({
        success: true,
        data: restaurant,
      });
    } catch (error) {
      console.error("Error fetching restaurant by owner:", error);
      res.status(500).json({
        success: false,
        message: "Failed to fetch restaurant",
        error: error.message,
      });
    }
  },
};
module.exports = categoryController;
