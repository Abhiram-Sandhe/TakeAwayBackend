const Restaurant = require('../models/Restaurant');
const Food = require('../models/Food');
const Order = require('../models/Order');
const User = require('../models/User');

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
    const foods = await Food.find({ 
      restaurant: req.params.id, 
      isAvailable: true 
    }).populate('restaurant', 'name');
    res.json(foods);
  } catch (error) {
    res.status(500).json({ message: 'Server error', error: error.message });
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