const User = require('../models/User');
const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const bcrypt = require('bcrypt');

// Create a new user (Admin only)
const createUser = async (req, res) => {
  try {
    // Optional: Validate admin role
    if (req.user?.role !== 'admin') {
      return res.status(403).json({
        success: false,
        message: 'Access denied. Admins only.',
      });
    }

    const { name, email, phone, password, role, status } = req.body;

    if (!name || !email || !phone || !password || !role || !status) {
      return res.status(400).json({
        success: false,
        message: 'All fields are required.',
      });
    }

    // Check for existing user
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(409).json({
        success: false,
        message: 'User with this email already exists.',
      });
    }

    // Hash password
    const hashedPassword = await bcrypt.hash(password, 10);

    const newUser = new User({
      name,
      email,
      phone,
      password: hashedPassword,
      role,
      status,
    });

    await newUser.save();

    res.status(201).json({
      success: true,
      message: 'User created successfully.',
      user: {
        id: newUser._id,
        name: newUser.name,
        email: newUser.email,
        role: newUser.role,
        status: newUser.status,
      },
    });
  } catch (error) {
    console.error('Create user error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message,
    });
  }
};

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

// Delete user
const deleteUser = async (req, res) => {
  try {
    const { userId } = req.params;

    const user = await User.findById(userId);
    if (!user) {
      return res.status(404).json({ 
        success: false,
        message: 'User not found.' 
      });
    }

    // If user is restaurant owner, delete restaurant and its foods
    if (user.role === 'restaurant') {
      const restaurant = await Restaurant.findOne({ owner: userId });
      if (restaurant) {
        await Food.deleteMany({ restaurant: restaurant._id });
        await Restaurant.findByIdAndDelete(restaurant._id);
      }
    }

    await User.findByIdAndDelete(userId);

    res.json({
      success: true,
      message: 'User deleted successfully.'
    });
  } catch (error) {
    console.error('Delete user error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

// Get all restaurants
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

const createRestaurant = async (req, res) => {
  try {
    const { 
      name, 
      description, 
      address, 
      phone, 
      cuisine, 
    //   openingHours,
      ownerName,
      ownerEmail,
      ownerPhone,
      ownerPassword
    } = req.body;

    // Validate required fields
    if (!name || !description || !address || !phone || !ownerName || !ownerEmail || !ownerPassword) {
      return res.status(400).json({
        success: false,
        message: 'Please provide all required fields: name, description, address, phone, ownerName, ownerEmail, ownerPassword.'
      });
    }

    // Check if owner email already exists
    const existingUser = await User.findOne({ email: ownerEmail });
    if (existingUser) {
      return res.status(400).json({
        success: false,
        message: 'A user with this email already exists.'
      });
    }

    // Create restaurant owner account
    // const hashedPassword = await bcrypt.hash(ownerPassword, 10);
    const owner = new User({
      name: ownerName,
      email: ownerEmail,
      password: ownerPassword,
      phone: ownerPhone,
      role: 'restaurant'
    });

    await owner.save();

    // Create restaurant
    const restaurant = new Restaurant({
      name,
      description,
      address,
      phone,
      cuisine: cuisine || 'General',
      owner: owner._id,
    //   openingHours: openingHours || {
    //     monday: { open: '09:00', close: '22:00', isOpen: true },
    //     tuesday: { open: '09:00', close: '22:00', isOpen: true },
    //     wednesday: { open: '09:00', close: '22:00', isOpen: true },
    //     thursday: { open: '09:00', close: '22:00', isOpen: true },
    //     friday: { open: '09:00', close: '22:00', isOpen: true },
    //     saturday: { open: '09:00', close: '22:00', isOpen: true },
    //     sunday: { open: '09:00', close: '22:00', isOpen: true }
    //   }
    });

    await restaurant.save();
    await restaurant.populate('owner', 'name email phone');

    res.status(201).json({
      success: true,
      message: 'Restaurant and owner created successfully.',
      restaurant,
      owner: {
        id: owner._id,
        name: owner.name,
        email: owner.email,
        phone: owner.phone
      }
    });
  } catch (error) {
    console.error('Create restaurant error:', error);
    res.status(500).json({
      success: false,
      message: 'Server error.',
      error: error.message
    });
  }
};

// Update restaurant
const updateRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;
    const { 
      name, 
      description, 
      address, 
      phone, 
      cuisine, 
      image, 
      openingHours, 
      isActive 
    } = req.body;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found.' 
      });
    }

    // Update fields if provided
    if (name) restaurant.name = name;
    if (description) restaurant.description = description;
    if (address) restaurant.address = address;
    if (phone) restaurant.phone = phone;
    if (cuisine) restaurant.cuisine = cuisine;
    if (image) restaurant.image = image;
    if (openingHours) restaurant.openingHours = openingHours;
    if (isActive !== undefined) restaurant.isActive = isActive;

    await restaurant.save();

    const populatedRestaurant = await Restaurant.findById(restaurant._id)
      .populate('owner', 'name email phone');

    res.json({
      success: true,
      message: 'Restaurant updated successfully.',
      restaurant: populatedRestaurant
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

// Toggle restaurant status
const toggleRestaurantStatus = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found.' 
      });
    }

    restaurant.isActive = !restaurant.isActive;
    await restaurant.save();

    const populatedRestaurant = await Restaurant.findById(restaurant._id)
      .populate('owner', 'name email phone');

    res.json({
      success: true,
      message: `Restaurant ${restaurant.isActive ? 'activated' : 'deactivated'} successfully.`,
      restaurant: populatedRestaurant
    });
  } catch (error) {
    console.error('Toggle restaurant status error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

// Delete restaurant
const deleteRestaurant = async (req, res) => {
  try {
    const { restaurantId } = req.params;

    const restaurant = await Restaurant.findById(restaurantId);
    if (!restaurant) {
      return res.status(404).json({ 
        success: false,
        message: 'Restaurant not found.' 
      });
    }

    // Delete all foods belonging to this restaurant
    await Food.deleteMany({ restaurant: restaurantId });

    // Delete the restaurant
    await Restaurant.findByIdAndDelete(restaurantId);

    res.json({
      success: true,
      message: 'Restaurant and all its food items deleted successfully.'
    });
  } catch (error) {
    console.error('Delete restaurant error:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error.',
      error: error.message 
    });
  }
};

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
  createUser,
  getUsers,
  deleteUser,
  getRestaurants,
  createRestaurant,
  updateRestaurant,
  toggleRestaurantStatus,
  deleteRestaurant,
  getStats
};