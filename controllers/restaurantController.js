const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const User = require('../models/User');

const getProfile = async (req, res) => {
  try {
    let restaurant;

    if (req.user.role === 'admin') {
      // Admin must provide restaurantId
      const { restaurantId } = req.query;

      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }

      restaurant = await Restaurant.findById(restaurantId)
        .populate('owner', 'name email phone');
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner gets their own profile
      restaurant = await Restaurant.findOne({ owner: req.user._id })
        .populate('owner', 'name email phone');
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only admins and restaurant owners can view profiles.'
      });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    res.status(200).json({
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
//update restaurant
const updateRestaurant = async (req, res) => {
  try {
    const { name, description, address, phone, cuisine } = req.body;
    
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
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner updates their own restaurant only
      restaurant = await Restaurant.findOne({ owner: req.user._id });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can update restaurants.'
      });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    // Update basic fields if provided
    if (name) restaurant.name = name;
    if (description) restaurant.description = description;
    if (address) restaurant.address = address;
    if (phone) restaurant.phone = phone;
    if (cuisine) restaurant.cuisine = cuisine;

    // Handle image upload
    let imageUrl = restaurant.image; // Keep existing image by default
    let imageWarning = null;

    if (req.file) {
      if (req.file.path) {
        // New image uploaded successfully to Cloudinary
        imageUrl = req.file.path;
      } else {
        // Image was uploaded but Cloudinary is not available
        imageWarning = 'Image was uploaded but Cloudinary is not available. Image not updated.';
      }
    }

    // Update image if a new one was provided
    if (req.file && req.file.path) {
      restaurant.image = imageUrl;
    }

    await restaurant.save();
    await restaurant.populate('owner', 'name email phone');

    const response = {
      success: true,
      message: 'Restaurant updated successfully.',
      restaurant
    };

    // Add warning if image upload had issues
    if (imageWarning) {
      response.warning = imageWarning;
    }

    res.json(response);

  } catch (error) {
    console.error('Update restaurant error:', error);

    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        errors: Object.keys(error.errors).map(key => ({
          field: key,
          message: error.errors[key].message
        }))
      });
    }

    // Handle duplicate entry errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Duplicate entry found',
        field: Object.keys(error.keyPattern || {})[0]
      });
    }

    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};

const toggleRestaurantStatus = async (req, res) => {
  try {
    let restaurant;
    
    if (req.user.role === 'admin') {
      // Admin can toggle any restaurant status
      const { restaurantId } = req.body;
      if (!restaurantId) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant ID is required for admin.'
        });
      }
      restaurant = await Restaurant.findById(restaurantId);
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner toggles their own restaurant status
      restaurant = await Restaurant.findOne({ owner: req.user._id });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can toggle restaurant status.'
      });
    }

    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found.'
      });
    }

    // Toggle the status
    restaurant.isOpen = !restaurant.isOpen;
    await restaurant.save();

    res.json({
      success: true,
      message: `Restaurant is now ${restaurant.isOpen ? 'open' : 'closed'}.`,
      isOpen: restaurant.isOpen
    });

  } catch (error) {
    console.error('Toggle restaurant status error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error occurred',
      error: error.message
    });
  }
};

// Add food item
const addFood = async (req, res) => {
  try {
    const { name, description, price, category } = req.body;
    
    // Get image URL from uploaded file (if any)
    const imageUrl = req.file ? req.file.path : null;
    
    // Validate required fields
    if (!name || !description || !price || !category) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, description, price, category.'
      });
    }
    
    // Validate price
    if (price <= 0) {
      return res.status(400).json({
        success: false,
        message: 'Price must be greater than 0.'
      });
    }
    
    // Find restaurant owned by the current user
    const restaurant = await Restaurant.findOne({ owner: req.user._id });
    if (!restaurant) {
      return res.status(404).json({
        success: false,
        message: 'Restaurant not found. Please create a restaurant first before adding food items.'
      });
    }

    // Create food item with restaurant ID
    const food = new Food({
      name: name.trim(),
      description: description.trim(),
      price: parseFloat(price),
      category: category.trim(),
      image: imageUrl, // Use uploaded image URL
      restaurant: restaurant._id // Explicitly setting restaurant ID
    });

    // Save the food item
    await food.save();
    
    // Populate restaurant details for response
    await food.populate('restaurant', 'name location');

    // Verify that restaurant ID was properly set
    if (!food.restaurant) {
      throw new Error('Failed to associate food item with restaurant');
    }

    res.status(201).json({
      success: true,
      message: 'Food item added successfully.',
      food: {
        _id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        category: food.category,
        image: food.image,
        restaurant: food.restaurant,
        isAvailable: food.isAvailable,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt
      }
    });
    
  } catch (error) {
    console.error('Add food error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error.',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Food item with this name already exists in your restaurant.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while adding food item.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
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
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found.'
        });
      }
    } else if (req.user.role === 'restaurant') {
      // Restaurant role gets their own foods (same logic as addFood)
      restaurant = await Restaurant.findOne({ owner: req.user._id });
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found. Please create a restaurant first.'
        });
      }
    } else {
      // Other roles are not authorized to access this endpoint
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can access food items.'
      });
    }

    // Get foods for the restaurant with populated restaurant details
    const foods = await Food.find({ restaurant: restaurant._id })
      .populate('restaurant', 'name location')
      .sort({ createdAt: -1 });

    res.status(200).json({
      success: true,
      message: 'Foods retrieved successfully.',
      foods: foods.map(food => ({
        _id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        category: food.category,
        image: food.image,
        restaurant: food.restaurant,
        isAvailable: food.isAvailable
        // createdAt: food.createdAt,
        // updatedAt: food.updatedAt
      })),
      count: foods.length
    });
    
  } catch (error) {
    console.error('Get foods error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error while retrieving food items.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};


const toggleFoodAvailability = async (req, res) => {
  try {
    const { foodId } = req.params;
    const { isAvailable } = req.body;

    // Validate foodId
    if (!foodId) {
      return res.status(400).json({
        success: false,
        message: 'Food ID is required.'
      });
    }

    // Validate isAvailable
    if (typeof isAvailable !== 'boolean') {
      return res.status(400).json({
        success: false,
        message: 'isAvailable must be a boolean value.'
      });
    }

    let food;

    if (req.user.role === 'admin') {
      // Admin can toggle any food item
      food = await Food.findById(foodId).populate('restaurant', 'name location');
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner can only toggle their own food items
      const restaurant = await Restaurant.findOne({ owner: req.user._id });
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found.'
        });
      }

      food = await Food.findOne({ 
        _id: foodId, 
        restaurant: restaurant._id 
      }).populate('restaurant', 'name location');
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can toggle food availability.'
      });
    }

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to modify it.'
      });
    }

    // Update availability
    food.isAvailable = isAvailable;
    await food.save();

    res.status(200).json({
      success: true,
      message: `Food item ${isAvailable ? 'marked as available' : 'marked as unavailable'} successfully.`,
      food: {
        _id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        category: food.category,
        image: food.image,
        isAvailable: food.isAvailable,
        restaurant: food.restaurant,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt
      }
    });

  } catch (error) {
    console.error('Toggle food availability error:', error);
    
    res.status(500).json({
      success: false,
      message: 'Server error while toggling food availability.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Update food
const updateFood = async (req, res) => {
  try {
    const foodId = req.params.id;
    const { name, description, price, category, isAvailable } = req.body;

    // Get new image URL from uploaded file (if any)
    const imageUrl = req.file ? req.file.path : undefined;

    // Validate foodId
    if (!foodId) {
      return res.status(400).json({
        success: false,
        message: 'Food ID is required.'
      });
    }

    let food;

    if (req.user.role === 'admin') {
      // Admin can update any food item
      food = await Food.findById(foodId);
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner can only update their own food items
      const restaurant = await Restaurant.findOne({ owner: req.user._id });
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found.'
        });
      }

      food = await Food.findOne({ 
        _id: foodId, 
        restaurant: restaurant._id 
      });
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can update food items.'
      });
    }

    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to modify it.'
      });
    }

    // Update fields if provided
    if (name !== undefined) food.name = name.trim();
    if (description !== undefined) food.description = description.trim();
    if (price !== undefined) {
      if (price <= 0) {
        return res.status(400).json({
          success: false,
          message: 'Price must be greater than 0.'
        });
      }
      food.price = parseFloat(price);
    }
    if (category !== undefined) food.category = category.trim();
    if (imageUrl !== undefined) food.image = imageUrl;
    if (isAvailable !== undefined) food.isAvailable = Boolean(isAvailable);

    // Save the updated food item
    await food.save();
    
    // Populate restaurant details for response
    await food.populate('restaurant', 'name location');

    res.status(200).json({
      success: true,
      message: 'Food item updated successfully.',
      food: {
        _id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        category: food.category,
        image: food.image,
        isAvailable: food.isAvailable,
        restaurant: food.restaurant,
        createdAt: food.createdAt,
        updatedAt: food.updatedAt
      }
    });

  } catch (error) {
    console.error('Update food error:', error);
    
    // Handle validation errors
    if (error.name === 'ValidationError') {
      return res.status(400).json({
        success: false,
        message: 'Validation error.',
        errors: Object.values(error.errors).map(err => err.message)
      });
    }
    
    // Handle duplicate key errors
    if (error.code === 11000) {
      return res.status(400).json({
        success: false,
        message: 'Food item with this name already exists in your restaurant.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while updating food item.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

// Delete food
const deleteFood = async (req, res) => {
  try {
    // Fix: Extract 'id' parameter (assuming route is /food/:id)
    const foodId = req.params.id; // or const { id: foodId } = req.params;

    // Validate foodId
    if (!foodId) {
      return res.status(400).json({
        success: false,
        message: 'Food ID is required.'
      });
    }

    // Validate ObjectId format
    if (!foodId.match(/^[0-9a-fA-F]{24}$/)) {
      return res.status(400).json({
        success: false,
        message: 'Invalid food ID format.'
      });
    }

    let food;

    if (req.user.role === 'admin') {
      // Admin can delete any food item
      food = await Food.findById(foodId).populate('restaurant');
    } else if (req.user.role === 'restaurant') {
      // Restaurant owner can only delete their own food items
      const restaurant = await Restaurant.findOne({ owner: req.user._id });
      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: 'Restaurant not found.'
        });
      }

      food = await Food.findOne({ 
        _id: foodId, 
        restaurant: restaurant._id 
      }).populate('restaurant');
    } else {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Only restaurant owners and admins can delete food items.'
      });
    }
    
    if (!food) {
      return res.status(404).json({
        success: false,
        message: 'Food item not found or you do not have permission to delete it.'
      });
    }

    // Store food details for response (optional)
    const deletedFoodInfo = {
      _id: food._id,
      name: food.name,
      restaurant: food.restaurant.name
    };

    // Delete the food item
    await Food.findByIdAndDelete(foodId);

    res.status(200).json({
      success: true,
      message: 'Food item deleted successfully.',
      deletedFood: deletedFoodInfo
    });

  } catch (error) {
    console.error('Delete food error:', error);
    
    // Handle specific error types
    if (error.name === 'CastError') {
      return res.status(400).json({
        success: false,
        message: 'Invalid food ID format.'
      });
    }
    
    res.status(500).json({
      success: false,
      message: 'Server error while deleting food item.',
      error: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error'
    });
  }
};

module.exports = {
  getProfile,
  updateRestaurant, // Only update function - no create
  toggleRestaurantStatus,
  addFood,
  getFoods,
  toggleFoodAvailability,
  updateFood,
  deleteFood
};