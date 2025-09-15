const Cart = require('../models/Cart');

const validateCartForOrder = async (req, res, next) => {
  try {
    const userId = req.user.id;
    
    const cart = await Cart.findOne({ user: userId, isActive: true })
      .populate('items.food', 'name price isAvailable')
      .populate('items.restaurant', 'name isOpen')
      .populate('restaurant', 'name isOpen');

    if (!cart || cart.items.length === 0) {
      return res.status(400).json({
        success: false,
        message: 'Cart is empty'
      });
    }

    if (!cart.restaurant.isOpen) {
      return res.status(400).json({
        success: false,
        message: 'Restaurant is currently closed'
      });
    }

    // Check if all items are still available
    const unavailableItems = cart.items.filter(item => !item.food.isAvailable);
    if (unavailableItems.length > 0) {
      return res.status(400).json({
        success: false,
        message: 'Some items in your cart are no longer available',
        unavailableItems: unavailableItems.map(item => item.food.name)
      });
    }

    // Attach cart to request for order creation
    req.cart = cart;
    next();

  } catch (error) {
    res.status(500).json({
      success: false,
      message: 'Error validating cart',
      error: error.message
    });
  }
};

module.exports = { validateCartForOrder };