// socket/orderSocket.js
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    const token = socket.handshake.auth.token;
    if (!token) {
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.tokenBlacklist.includes(token)) {
      return next(new Error('Authentication error: Invalid user'));
    }

    socket.user = user;
    next();
  } catch (error) {
    next(new Error('Authentication error: ' + error.message));
  }
};

const handleOrderSocket = (io) => {
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    // Auto-join role-based rooms
    if (socket.user.role === 'admin') {
      socket.join('admin');
    } else if (socket.user.role === 'customer') {
      socket.join(`customer_${socket.user._id}`);
    } else if (socket.user.role === 'restaurant') {
      // Join restaurant rooms for all restaurants owned by this user
      socket.join(`restaurant_owner_${socket.user._id}`);
    }

    // Join specific restaurant room (for restaurant owners)
    socket.on('joinRestaurant', async (restaurantId) => {
      if (socket.user.role === 'restaurant') {
        try {
          // Verify ownership
          const Restaurant = require('../models/Restaurant');
          const restaurant = await Restaurant.findOne({ 
            _id: restaurantId, 
            owner: socket.user._id 
          });
          
          if (restaurant) {
            socket.join(`restaurant_${restaurantId}`);
            socket.emit('restaurant-joined', { restaurantId, restaurantName: restaurant.name });
          } else {
            socket.emit('error', { message: 'Restaurant not found or access denied' });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to join restaurant room' });
        }
      }
    });

    // Join specific order room (for customers)
    socket.on('joinOrder', async (orderNumber) => {
      if (socket.user.role === 'customer') {
        try {
          const order = await Order.findOne({ 
            orderNumber, 
            customer: socket.user._id 
          });
          
          if (order) {
            socket.join(`order_${orderNumber}`);
            socket.emit('order-joined', { orderNumber });
          } else {
            socket.emit('error', { message: 'Order not found or access denied' });
          }
        } catch (error) {
          socket.emit('error', { message: 'Failed to join order room' });
        }
      }
    });

    // Handle real-time order status requests
    socket.on('getOrderStatus', async (orderNumber) => {
      try {
        let order;
        
        if (socket.user.role === 'customer') {
          order = await Order.findOne({ 
            orderNumber, 
            customer: socket.user._id 
          }).populate('items.foodId');
        } else if (socket.user.role === 'restaurant') {
          const Restaurant = require('../models/Restaurant');
          const restaurants = await Restaurant.find({ owner: socket.user._id }).select('_id');
          const restaurantIds = restaurants.map(r => r._id);
          
          order = await Order.findOne({ 
            orderNumber,
            restaurant: { $in: restaurantIds }
          }).populate('items.foodId');
        } else if (socket.user.role === 'admin') {
          order = await Order.findOne({ orderNumber }).populate('items.foodId');
        }

        if (order) {
          socket.emit('orderStatus', order);
        } else {
          socket.emit('orderNotFound', { orderNumber });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to fetch order status' });
      }
    });

    // Handle kitchen status updates (restaurant and admin only)
    socket.on('updateKitchenStatus', async (data) => {
      if (!['restaurant', 'admin'].includes(socket.user.role)) {
        return socket.emit('error', { message: 'Unauthorized' });
      }

      try {
        const { orderId, status } = data;
        
        // Verify access for restaurant users
        if (socket.user.role === 'restaurant') {
          const existingOrder = await Order.findById(orderId);
          if (!existingOrder) {
            return socket.emit('error', { message: 'Order not found' });
          }

          const Restaurant = require('../models/Restaurant');
          const restaurant = await Restaurant.findOne({ 
            _id: existingOrder.restaurant,
            owner: socket.user._id 
          });
          
          if (!restaurant) {
            return socket.emit('error', { message: 'Unauthorized' });
          }
        }

        const order = await Order.findByIdAndUpdate(
          orderId,
          { status },
          { new: true }
        ).populate('customer restaurant');

        if (order) {
          // Notify admin dashboard
          io.to('admin').emit('orderStatusUpdate', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerName: order.customerName,
            timestamp: new Date()
          });

          // Notify specific customer
          io.to(`customer_${order.customer._id}`).emit('yourOrderUpdate', {
            orderNumber: order.orderNumber,
            status: order.status,
            estimatedTime: order.estimatedTime,
            timestamp: new Date()
          });

          // Notify restaurant
          io.to(`restaurant_${order.restaurant._id}`).emit('orderStatusUpdate', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerName: order.customerName,
            type: 'status_update',
            timestamp: new Date()
          });

          // Notify all restaurant owners
          io.to(`restaurant_owner_${socket.user._id}`).emit('orderStatusUpdate', {
            orderId: order._id,
            orderNumber: order.orderNumber,
            status: order.status,
            customerName: order.customerName,
            type: 'status_update',
            timestamp: new Date()
          });

          // Confirm update to sender
          socket.emit('statusUpdateConfirmed', {
            orderId: order._id,
            status: order.status,
            timestamp: new Date()
          });
        } else {
          socket.emit('error', { message: 'Failed to update order' });
        }
      } catch (error) {
        socket.emit('error', { message: 'Failed to update order status: ' + error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      // Silent disconnect handling
    });

    // Handle errors
    socket.on('error', (error) => {
      // Silent error handling
    });
  });
};

module.exports = handleOrderSocket;