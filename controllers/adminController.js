const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const bcrypt = require('bcrypt');
// Get all users
const getUsers = async (req, res) => {
  try {
    const users = await User.find().select('-password').sort({ createdAt: -1 });
    
    res.json({
      success: true,
      users
    });
  } catch (error) {
    console.error('Get users error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

//Get all restaurants
const getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find()
      .populate('owner', 'name email phone')
      .sort({ createdAt: -1 });

    res.json({
      success: true,
      restaurants
    });
  } catch (error) {
    console.error('Get restaurants error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

const toggleRestaurantFeaturedStatus = async (req, res) => {
  try {
    // Check if user is admin
    if (!req.user || req.user.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admin privileges required.'
      });
    }

    // Get restaurantId from URL parameters
    const { restaurantId } = req.params;

    if (!restaurantId) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant ID is required.'
      });
    }

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found.' 
      });
    }

    restaurant.isFeatured = !restaurant.isFeatured;
    await restaurant.save();

    const populatedRestaurant = await Restaurant.findById(restaurant._id)
      .populate('owner', 'name email phone');

    res.json({
      success: true,
      message: `Restaurant ${restaurant.isFeatured ? 'featured' : 'unfeatured'} successfully.`,
      restaurant: populatedRestaurant
    });
  } catch (error) {
    console.error('Toggle restaurant featured status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

// const updateRestaurant = async (req, res) => {
//   try {
//     const { restaurantId } = req.params;
//     const { 
//       name, 
//       description, 
//       address, 
//       phone, 
//       cuisine, 
//       image, 
//       openingHours, 
//       isActive 
//     } = req.body;

//     const restaurant = await Restaurant.findById(restaurantId);
//     if (!restaurant) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'Restaurant not found.' 
//       });
//     }

//     // Update fields if provided
//     if (name) restaurant.name = name;
//     if (description) restaurant.description = description;
//     if (address) restaurant.address = address;
//     if (phone) restaurant.phone = phone;
//     if (cuisine) restaurant.cuisine = cuisine;
//     if (image) restaurant.image = image;
//     if (openingHours) restaurant.openingHours = openingHours;
//     if (isActive !== undefined) restaurant.isActive = isActive;

//     await restaurant.save();

//     const populatedRestaurant = await Restaurant.findById(restaurant._id)
//       .populate('owner', 'name email phone');

//     res.json({
//       success: true,
//       message: 'Restaurant updated successfully.',
//       restaurant: populatedRestaurant
//     });
//   } catch (error) {
//     console.error('Update restaurant error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error.',
//       error: error.message 
//     });
//   }
// };

// // Toggle restaurant status
// const toggleRestaurantStatus = async (req, res) => {
//   try {
//     const { restaurantId } = req.params;

//     const restaurant = await Restaurant.findById(restaurantId);
//     if (!restaurant) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'Restaurant not found.' 
//       });
//     }

//     restaurant.isActive = !restaurant.isActive;
//     await restaurant.save();

//     const populatedRestaurant = await Restaurant.findById(restaurant._id)
//       .populate('owner', 'name email phone');

//     res.json({
//       success: true,
//       message: `Restaurant ${restaurant.isActive ? 'activated' : 'deactivated'} successfully.`,
//       restaurant: populatedRestaurant
//     });
//   } catch (error) {
//     console.error('Toggle restaurant status error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error.',
//       error: error.message 
//     });
//   }
// };

// Delete restaurant
// const deleteRestaurant = async (req, res) => {
//   try {
//     const { restaurantId } = req.params;

//     const restaurant = await Restaurant.findById(restaurantId);
//     if (!restaurant) {
//       return res.status(404).json({ 
//         success: false,
//         message: 'Restaurant not found.' 
//       });
//     }

//     // Delete all foods belonging to this restaurant
//     await Food.deleteMany({ restaurant: restaurantId });

//     // Delete the restaurant
//     await Restaurant.findByIdAndDelete(restaurantId);

//     res.json({
//       success: true,
//       message: 'Restaurant and all its food items deleted successfully.'
//     });
//   } catch (error) {
//     console.error('Delete restaurant error:', error);
//     res.status(500).json({ 
//       success: false,
//       message: 'Server error.',
//       error: error.message 
//     });
//   }
// };

// Get system statistics
const getStats = async (req, res) => {
  try {
    const totalUsers = await User.countDocuments();
    const totalRestaurants = await Restaurant.countDocuments();
    const activeRestaurants = await Restaurant.countDocuments({ isActive: true });
    const totalFoodItems = await Food.countDocuments();
    const availableFoodItems = await Food.countDocuments({ isAvailable: true });

    res.json({
      success: true,
      stats: {
        totalUsers,
        totalRestaurants,
        activeRestaurants,
        totalFoodItems,
        availableFoodItems
      }
    });
  } catch (error) {
    console.error('Get stats error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

module.exports = {
  getUsers,
  getRestaurants,
  toggleRestaurantFeaturedStatus,
  getStats
};