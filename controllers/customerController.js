const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const Order = require('../models/Order');
const User = require('../models/User');
const Category = require('../models/Category');
const mongoose = require('mongoose');

const getRestaurants = async (req, res) => {
  try {
    const restaurants = await Restaurant.find({ isActive: true });
    res.json(restaurants);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getFeaturedRestaurants = async (req, res) => {
  try {
    const featuredRestaurants = await Restaurant.find({ 
      isActive: true, 
      isFeatured: true 
    }).limit(6); // Limit to 6 for homepage
    
    res.json(featuredRestaurants);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getFoodsByRestaurant = async (req, res) => {
  try {
    const { id } = req.params;
    
    // Validate ObjectId format
    if (!mongoose.Types.ObjectId.isValid(id)) {
      return res.status(400).json({ 
        success: false,
        message: 'Invalid restaurant ID format',
        data: []
      });
    }
    
    // Find foods by restaurant ID and only available ones
    const foods = await Food.find({ 
      restaurant: id, 
      isAvailable: true 
    })
    .populate({
      path: 'restaurant', 
      select: 'name address phone isOpen isActive'
    })
    .populate({
      path: 'category',
      select: 'name isActive'
    })
    .exec();

    // Filter foods with active categories
    const validFoods = foods.filter(food => 
      food.category && food.category.isActive
    );

    if (!validFoods || validFoods.length === 0) {
      return res.status(404).json({ 
        success: false,
        message: 'No foods found for this restaurant with active categories',
        data: []
      });
    }

    // Group foods by category name
    const groupedFoods = validFoods.reduce((acc, food) => {
      const categoryName = food.category.name;
      
      if (!acc[categoryName]) {
        acc[categoryName] = [];
      }
      
      acc[categoryName].push({
        id: food._id,
        name: food.name,
        description: food.description,
        price: food.price,
        image: food.image,
        category: categoryName,
        isAvailable: food.isAvailable,
        restaurant: {
          id: food.restaurant._id,
          name: food.restaurant.name,
          address: food.restaurant.address,
          phone: food.restaurant.phone,
          isOpen: food.restaurant.isOpen,
          isActive: food.restaurant.isActive
        }
      });
      return acc;
    }, {});

    // Convert to array format matching frontend structure
    const menuData = Object.keys(groupedFoods).map(category => ({
      category,
      items: groupedFoods[category]
    }));

    res.status(200).json({
      success: true,
      data: menuData,
      restaurant: {
        id: validFoods[0].restaurant._id,
        name: validFoods[0].restaurant.name,
        address: validFoods[0].restaurant.address,
        phone: validFoods[0].restaurant.phone,
        isOpen: validFoods[0].restaurant.isOpen,
        isActive: validFoods[0].restaurant.isActive
      }
    });

  } catch (error) {
    console.error('Error fetching foods by restaurant:', error);
    res.status(500).json({ 
      success: false,
      message: 'Server error while fetching restaurant foods', 
      error: error.message 
    });
  }
};
const addToCart = async (req, res) => {
  try {
    const { foodId, quantity } = req.body;
    
    const user = await User.findById(req.user._id);
    const existingItem = user.cart.find(item => item.foodId.toString() === foodId);
    
    if (existingItem) {
      existingItem.quantity += quantity;
    } else {
      user.cart.push({ foodId, quantity });
    }
    
    await user.save();
    res.json({ message: 'Item added to cart' });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getCart = async (req, res) => {
  try {
    const user = await User.findById(req.user._id).populate('cart.foodId');
    res.json(user.cart);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const placeOrder = async (req, res) => {
  try {
    const { items, restaurantId, deliveryAddress, customerPhone } = req.body;
    
    let totalAmount = 0;
    const orderItems = [];
    
    for (const item of items) {
      const food = await Food.findById(item.foodId);
      if (!food) {
        return res.status(404).json({ message: 'Food item not found' });
      }
      
      const itemTotal = food.price * item.quantity;
      totalAmount += itemTotal;
      
      orderItems.push({
        food: food._id,
        quantity: item.quantity,
        price: food.price
      });
    }
    
    const order = new Order({
      customer: req.user._id,
      restaurant: restaurantId,
      items: orderItems,
      totalAmount,
      deliveryAddress,
      customerPhone
    });
    
    await order.save();
    
    await User.findByIdAndUpdate(req.user._id, { cart: [] });
    
    res.status(201).json({ message: 'Order placed successfully', order });
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

const getOrderHistory = async (req, res) => {
  try {
    const orders = await Order.find({ customer: req.user._id })
      .populate('restaurant', 'name')
      .populate('items.food', 'name')
      .sort({ createdAt: -1 });
    res.json(orders);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
  }
};

module.exports = {
  getRestaurants,
  getFeaturedRestaurants,
  getFoodsByRestaurant,
  addToCart,
  getCart,
  placeOrder,
  getOrderHistory
};