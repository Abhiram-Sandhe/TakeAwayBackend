const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const User = require('../models/User');

const getProfile = async (req, res) => {
  try {
    let restaurant;
    
    if (req.user.role === 'admin') {
      // Admin can get any restaurant profile
      const { restaurantId } = req.query;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }
      restaurant = await Restaurant.findById(restaurantId).populate('owner', 'name email phone');
    } else {
      // Restaurant owner gets their own profile
      restaurant = await Restaurant.findOne({ owner: req.user._id }).populate('owner', 'name email phone');
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    res.json({
      success: true,
      restaurant
    });
  } catch (error) {
    console.error('Get restaurant profile error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Update restaurant (restaurant owners can only update their own restaurant)
const updateRestaurant = async (req, res) => {
  try {
    const { name, description, address, phone, cuisine, openingHours } = req.body;
    
    let restaurant;
    
    if (req.user.role === 'admin') {
      // Admin can update any restaurant
      const { restaurantId } = req.body;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }
      restaurant = await Restaurant.findById(restaurantId);
    } else {
      // Restaurant owner updates their own restaurant only
      restaurant = await Restaurant.findOne({ owner: req.user._id });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    // Update fields
    if (name) restaurant.name = name;
    if (description) restaurant.description = description;
    if (address) restaurant.address = address;
    if (phone) restaurant.phone = phone;
    if (cuisine) restaurant.cuisine = cuisine;
    if (openingHours) restaurant.openingHours = openingHours;

    await restaurant.save();
    await restaurant.populate('owner', 'name email phone');

    res.json({
      success: true,
      message: 'Restaurant updated successfully.',
      restaurant
    });
  } catch (error) {
    console.error('Update restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Add food item
const addFood = async (req, res) => {
  try {
    const { name, description, price, category, isVegetarian, isVegan, preparationTime, ingredients } = req.body;

    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, description, price, category.'
      });
    }

    let restaurant;
    
    if (req.user.role === 'admin') {
      // Admin can add food to any restaurant
      const { restaurantId } = req.body;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }
      restaurant = await Restaurant.findById(restaurantId);
    } else {
      // Restaurant owner adds food to their own restaurant
      restaurant = await Restaurant.findOne({ owner: req.user._id });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    const food = new Food({
      name,
      description,
      price: parseFloat(price),
      category,
      isVegetarian: isVegetarian || false,
      isVegan: isVegan || false,
      preparationTime: preparationTime || 30,
      ingredients: ingredients || [],
      restaurant: restaurant._id
    });

    await food.save();
    await food.populate('restaurant', 'name');

    res.status(201).json({
      success: true,
      message: 'Food item added successfully.',
      food
    });
  } catch (error) {
    console.error('Add food error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Get foods
const getFoods = async (req, res) => {
  try {
    let restaurant;
    
    if (req.user.role === 'admin') {
      // Admin can get foods from any restaurant
      const { restaurantId } = req.query;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }
      restaurant = await Restaurant.findById(restaurantId);
    } else {
      // Restaurant owner gets their own foods
      restaurant = await Restaurant.findOne({ owner: req.user._id });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    const foods = await Food.find({ restaurant: restaurant._id })
      .populate('restaurant', 'name')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      foods
    });
  } catch (error) {
    console.error('Get foods error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Update food
const updateFood = async (req, res) => {
  try {
    const { foodId } = req.params;
    const { name, description, price, category, isVegetarian, isVegan, preparationTime, ingredients, isAvailable } = req.body;

    const food = await Food.findById(foodId).populate('restaurant');
    
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found.'
      });
    }

    // Check if user has permission to update this food
    if (req.user.role !== 'admin' && food.restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to update this food item.'
      });
    }

    // Update fields
    if (name) food.name = name;
    if (description) food.description = description;
    if (price) food.price = parseFloat(price);
    if (category) food.category = category;
    if (isVegetarian !== undefined) food.isVegetarian = isVegetarian;
    if (isVegan !== undefined) food.isVegan = isVegan;
    if (preparationTime) food.preparationTime = preparationTime;
    if (ingredients) food.ingredients = ingredients;
    if (isAvailable !== undefined) food.isAvailable = isAvailable;

    await food.save();
    await food.populate('restaurant', 'name');

    res.json({
      success: true,
      message: 'Food item updated successfully.',
      food
    });
  } catch (error) {
    console.error('Update food error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Delete food
const deleteFood = async (req, res) => {
  try {
    const { foodId } = req.params;

    const food = await Food.findById(foodId).populate('restaurant');
    
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found.'
      });
    }

    // Check if user has permission to delete this food
    if (req.user.role !== 'admin' && food.restaurant.owner.toString() !== req.user._id.toString()) {
      return res.status(403).json({
        success: false,
        message: 'You do not have permission to delete this food item.'
      });
    }

    await Food.findByIdAndDelete(foodId);

    res.json({
      success: true,
      message: 'Food item deleted successfully.'
    });
  } catch (error) {
    console.error('Delete food error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

module.exports = {
  getProfile,
  updateRestaurant, // Only update function - no create
  addFood,
  getFoods,
  updateFood,
  deleteFood
};