const Cart = require('../models/Cart');
const Food = require('../models/Food');
const Restaurant = require('../models/Restaurant');
const User = require('../models/User');
const { v4: uuidv4 } = require('uuid');


class CartController {
  
  // Get cart for user or session
  static async getCart(req, res) {
    try {
      const { sessionId } = req.body;
      const userId = req.user?.id;

      let cart;
      
      if (userId) {
        // Get cart for logged-in user
        cart = await Cart.findOne({ user: userId, isActive: true })
          .populate('items.food', 'name price image isAvailable')
          .populate('items.restaurant', 'name isOpen')
          .populate('restaurant', 'name address phone');
      } else if (sessionId) {
        // Get cart for guest user
        cart = await Cart.findOne({ sessionId, isActive: true })
          .populate('items.food', 'name price image isAvailable')
          .populate('items.restaurant', 'name isOpen')
          .populate('restaurant', 'name address phone image');
      }

      if (!cart) {
        return res.json({
          success: true,
          data: {
            items: [],
            totalAmount: 0,
            itemCount: 0,
            restaurant: null
          }
        });
      }

      // Filter out unavailable items
      const availableItems = cart.items.filter(item => 
        item.food && item.food.isAvailable && 
        item.restaurant && item.restaurant.isOpen
      );

      if (availableItems.length !== cart.items.length) {
        cart.items = availableItems;
        await cart.save();
      }

      res.json({
        success: true,
        data: {
          _id: cart._id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount,
          restaurant: cart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching cart',
        error: error.message
      });
    }
  }

  // Add item to cart
  static async addToCart(req, res) {
    try {
      const { foodId, quantity = 1, sessionId } = req.body;
      const userId = req.user?.id;

      // Validate food item
      const food = await Food.findById(foodId).populate('restaurant');
      if (!food) {
        return res.status(404).json({
          success: false,
          message: 'Food item not found'
        });
      }

      if (!food.isAvailable) {
        return res.status(400).json({
          success: false,
          message: 'Food item is not available'
        });
      }

      if (!food.restaurant.isOpen) {
        return res.status(400).json({
          success: false,
          message: 'Restaurant is currently closed'
        });
      }

      let cart;
      
      // Find or create cart
      if (userId) {
        cart = await Cart.findOne({ user: userId, isActive: true });
      } else if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true });
      } else {
        return res.status(400).json({
          success: false,
          message: 'Session ID is required for guest users'
        });
      }

      if (!cart) {
        // Create new cart
        cart = new Cart({
          user: userId || null,
          sessionId: !userId ? sessionId : undefined,
          items: [],
          restaurant: food.restaurant._id
        });
      }

      // Check if cart has items from different restaurant
      if (cart.restaurant && cart.restaurant.toString() !== food.restaurant._id.toString()) {
        return res.status(400).json({
          success: false,
          message: 'You can only order from one restaurant at a time. Clear your cart to order from a different restaurant.',
          differentRestaurant: true,
          currentRestaurant: cart.restaurant,
          newRestaurant: food.restaurant._id
        });
      }

      // Check if item already exists in cart
      const existingItemIndex = cart.items.findIndex(
        item => item.food.toString() === foodId
      );

      if (existingItemIndex > -1) {
        // Update quantity of existing item
        cart.items[existingItemIndex].quantity += parseInt(quantity);
        // cart.items[existingItemIndex].specialInstructions = specialInstructions;
      } else {
        // Add new item to cart
        cart.items.push({
          food: foodId,
          restaurant: food.restaurant._id,
          quantity: parseInt(quantity),
          price: food.price,
          // specialInstructions
        });
      }

      cart.restaurant = food.restaurant._id;
      await cart.save();

      // Populate and return updated cart
      await cart.populate('items.food', 'name price image isAvailable');
      await cart.populate('items.restaurant', 'name isOpen');
      await cart.populate('restaurant', 'name address phone');

      res.json({
        success: true,
        message: 'Item added to cart successfully',
        data: {
          _id: cart._id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount,
          restaurant: cart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error adding item to cart',
        error: error.message
      });
    }
  }

  // Update item quantity in cart
  static async updateCartItem(req, res) {
    try {
      const { foodId, quantity, sessionId } = req.body;
      const userId = req.user?.id;

      if (quantity < 1) {
        return res.status(400).json({
          success: false,
          message: 'Quantity must be at least 1'
        });
      }

      let cart;
      
      if (userId) {
        cart = await Cart.findOne({ user: userId, isActive: true });
      } else if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true });
      }

      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      const itemIndex = cart.items.findIndex(
        item => item.food.toString() === foodId
      );

      if (itemIndex === -1) {
        return res.status(404).json({
          success: false,
          message: 'Item not found in cart'
        });
      }

      cart.items[itemIndex].quantity = parseInt(quantity);
      await cart.save();

      await cart.populate('items.food', 'name price image isAvailable');
      await cart.populate('items.restaurant', 'name isOpen');
      await cart.populate('restaurant', 'name address phone');

      res.json({
        success: true,
        message: 'Cart item updated successfully',
        data: {
          _id: cart._id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount,
          restaurant: cart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error updating cart item',
        error: error.message
      });
    }
  }

  // Remove item from cart
  static async removeFromCart(req, res) {
    try {
      const { foodId, sessionId } = req.body;
      const userId = req.user?.id;

      let cart;
      
      if (userId) {
        cart = await Cart.findOne({ user: userId, isActive: true });
      } else if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true });
      }

      if (!cart) {
        return res.status(404).json({
          success: false,
          message: 'Cart not found'
        });
      }

      cart.items = cart.items.filter(
        item => item.food.toString() !== foodId
      );

      // If cart is empty, reset restaurant
      if (cart.items.length === 0) {
        cart.restaurant = null;
      }

      await cart.save();

      await cart.populate('items.food', 'name price image isAvailable');
      await cart.populate('items.restaurant', 'name isOpen');
      await cart.populate('restaurant', 'name address phone');

      res.json({
        success: true,
        message: 'Item removed from cart successfully',
        data: {
          _id: cart._id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount,
          restaurant: cart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error removing item from cart',
        error: error.message
      });
    }
  }

  // Clear entire cart
  static async clearCart(req, res) {
    try {
      const { sessionId } = req.body;
      const userId = req.user?.id;

      let cart;
      
      if (userId) {
        cart = await Cart.findOne({ user: userId, isActive: true });
      } else if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true });
      }

      if (!cart) {
        return res.json({
          success: true,
          message: 'Cart is already empty',
          data: {
            items: [],
            totalAmount: 0,
            itemCount: 0,
            restaurant: null
          }
        });
      }

      cart.items = [];
      cart.restaurant = null;
      await cart.save();

      res.json({
        success: true,
        message: 'Cart cleared successfully',
        data: {
          _id: cart._id,
          items: cart.items,
          totalAmount: cart.totalAmount,
          itemCount: cart.itemCount,
          restaurant: cart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error clearing cart',
        error: error.message
      });
    }
  }

  // Merge guest cart with user cart on login
  static async mergeCart(req, res) {
    try {
      const { sessionId } = req.body;
      const userId = req.user.id;

      // Find guest cart
      const guestCart = await Cart.findOne({ sessionId, isActive: true });
      if (!guestCart || guestCart.items.length === 0) {
        return res.json({
          success: true,
          message: 'No guest cart to merge'
        });
      }

      // Find or create user cart
      let userCart = await Cart.findOne({ user: userId, isActive: true });
      
      if (!userCart) {
        // Convert guest cart to user cart
        guestCart.user = userId;
        guestCart.sessionId = undefined;
        await guestCart.save();
        
        await guestCart.populate('items.food', 'name price image isAvailable');
        await guestCart.populate('items.restaurant', 'name isOpen');
        await guestCart.populate('restaurant', 'name address phone');

        return res.json({
          success: true,
          message: 'Guest cart converted to user cart',
          data: {
            _id: guestCart._id,
            items: guestCart.items,
            totalAmount: guestCart.totalAmount,
            itemCount: guestCart.itemCount,
            restaurant: guestCart.restaurant
          }
        });
      }

      // Check if both carts have items from different restaurants
      if (userCart.restaurant && guestCart.restaurant && 
          userCart.restaurant.toString() !== guestCart.restaurant.toString()) {
        // Deactivate guest cart and keep user cart
        guestCart.isActive = false;
        await guestCart.save();

        await userCart.populate('items.food', 'name price image isAvailable');
        await userCart.populate('items.restaurant', 'name isOpen');
        await userCart.populate('restaurant', 'name address phone');

        return res.json({
          success: true,
          message: 'Kept existing user cart. Guest cart had items from different restaurant.',
          data: {
            _id: userCart._id,
            items: userCart.items,
            totalAmount: userCart.totalAmount,
            itemCount: userCart.itemCount,
            restaurant: userCart.restaurant
          }
        });
      }

      // Merge carts
      for (const guestItem of guestCart.items) {
        const existingItemIndex = userCart.items.findIndex(
          item => item.food.toString() === guestItem.food.toString()
        );

        if (existingItemIndex > -1) {
          userCart.items[existingItemIndex].quantity += guestItem.quantity;
        } else {
          userCart.items.push(guestItem);
        }
      }

      userCart.restaurant = guestCart.restaurant;
      await userCart.save();

      // Deactivate guest cart
      guestCart.isActive = false;
      await guestCart.save();

      await userCart.populate('items.food', 'name price image isAvailable');
      await userCart.populate('items.restaurant', 'name isOpen');
      await userCart.populate('restaurant', 'name address phone');

      res.json({
        success: true,
        message: 'Carts merged successfully',
        data: {
          _id: userCart._id,
          items: userCart.items,
          totalAmount: userCart.totalAmount,
          itemCount: userCart.itemCount,
          restaurant: userCart.restaurant
        }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error merging carts',
        error: error.message
      });
    }
  }

  // Get cart count (for header display)
  static async getCartCount(req, res) {
    try {
      const { sessionId } = req.query;
      const userId = req.user?.id;

      let cart;
      
      if (userId) {
        cart = await Cart.findOne({ user: userId, isActive: true });
      } else if (sessionId) {
        cart = await Cart.findOne({ sessionId, isActive: true });
      }

      const count = cart ? cart.itemCount : 0;

      res.json({
        success: true,
        data: { count }
      });

    } catch (error) {
      res.status(500).json({
        success: false,
        message: 'Error fetching cart count',
        error: error.message
      });
    }
  }
}

module.exports = CartController;