// socket/orderSocket.js
const Order = require('../models/Order');
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Socket authentication middleware
const authenticateSocket = async (socket, next) => {
  try {
    console.log('Authenticating socket connection...');
    const token = socket.handshake.auth.token;
    if (!token) {
      console.log('No token provided');
      return next(new Error('Authentication error: No token provided'));
    }

    const decoded = jwt.verify(token, process.env.JWT_SECRET || 'secret');
    const user = await User.findById(decoded.userId);
    
    if (!user || user.tokenBlacklist.includes(token)) {
      console.log('Invalid user or blacklisted token');
      return next(new Error('Authentication error: Invalid user'));
    }

    socket.user = user;
    console.log('Socket authenticated for user:', user.email, 'Role:', user.role);
    next();
  } catch (error) {
    console.error('Socket authentication error:', error.message);
    next(new Error('Authentication error: ' + error.message));
  }
};

const handleOrderSocket = (io) => {
  console.log('Setting up WebSocket handlers...');
  
  // Apply authentication middleware
  io.use(authenticateSocket);

  io.on('connection', (socket) => {
    console.log(`${socket.user.role} connected:`, socket.id, 'User:', socket.user.email);

    // Send welcome message
    socket.emit('welcome', { 
      message: 'Connected successfully', 
      userId: socket.user._id,
      role: socket.user.role,
      timestamp: new Date()
    });

    // Auto-join role-based rooms
    if (socket.user.role === 'admin') {
      socket.join('admin');
      console.log('Admin joined admin room');
    } else if (socket.user.role === 'customer') {
      socket.join(`customer_${socket.user._id}`);
      console.log('Customer joined customer room');
    } else if (socket.user.role === 'restaurant') {
      // Join restaurant rooms for all restaurants owned by this user
      socket.join(`restaurant_owner_${socket.user._id}`);
      console.log('Restaurant owner joined owner room');
    }

    // Test event handler
    socket.on('test', (data) => {
      console.log('Test event received:', data);
      socket.emit('test-response', { 
        message: 'Test received successfully', 
        originalData: data,
        timestamp: new Date()
      });
    });

    // Join specific restaurant room (for restaurant owners)
    socket.on('joinRestaurant', async (restaurantId) => {
      console.log('Join restaurant request:', restaurantId, 'from user:', socket.user.email);
      
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
            console.log(`Restaurant owner joined restaurant room: ${restaurantId}`);
            socket.emit('restaurant-joined', { restaurantId, restaurantName: restaurant.name });
          } else {
            console.log('Restaurant not found or user not owner');
            socket.emit('error', { message: 'Restaurant not found or access denied' });
          }
        } catch (error) {
          console.error('Error joining restaurant:', error);
          socket.emit('error', { message: 'Failed to join restaurant room' });
        }
      }
    });

    // Join specific order room (for customers)
    socket.on('joinOrder', async (orderNumber) => {
      console.log('Join order request:', orderNumber, 'from user:', socket.user.email);
      
      if (socket.user.role === 'customer') {
        try {
          const order = await Order.findOne({ 
            orderNumber, 
            customer: socket.user._id 
          });
          
          if (order) {
            socket.join(`order_${orderNumber}`);
            console.log(`Customer joined order room: ${orderNumber}`);
            socket.emit('order-joined', { orderNumber });
          } else {
            console.log('Order not found or access denied');
            socket.emit('error', { message: 'Order not found or access denied' });
          }
        } catch (error) {
          console.error('Error joining order:', error);
          socket.emit('error', { message: 'Failed to join order room' });
        }
      }
    });

    // Handle real-time order status requests
    socket.on('getOrderStatus', async (orderNumber) => {
      console.log('Get order status request:', orderNumber);
      
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
        console.error('Error fetching order status:', error);
        socket.emit('error', { message: 'Failed to fetch order status' });
      }
    });

    // Handle kitchen status updates (restaurant and admin only)
    socket.on('updateKitchenStatus', async (data) => {
      console.log('Update kitchen status request:', data, 'from user:', socket.user.email);
      
      if (!['restaurant', 'admin'].includes(socket.user.role)) {
        console.log('Unauthorized status update attempt');
        return socket.emit('error', { message: 'Unauthorized' });
      }

      try {
        const { orderId, status } = data;
        
        // Verify access for restaurant users
        if (socket.user.role === 'restaurant') {
          const existingOrder = await Order.findById(orderId);
          if (!existingOrder) {
            console.log('Order not found:', orderId);
            return socket.emit('error', { message: 'Order not found' });
          }

          const Restaurant = require('../models/Restaurant');
          const restaurant = await Restaurant.findOne({ 
            _id: existingOrder.restaurant,
            owner: socket.user._id 
          });
          
          if (!restaurant) {
            console.log('Unauthorized order access attempt');
            return socket.emit('error', { message: 'Unauthorized' });
          }
        }

        const order = await Order.findByIdAndUpdate(
          orderId,
          { status },
          { new: true }
        ).populate('customer restaurant');

        if (order) {
          console.log('Order status updated successfully:', orderId, 'to', status);
          
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

          console.log('Status update notifications sent');
        } else {
          console.log('Failed to update order');
          socket.emit('error', { message: 'Failed to update order' });
        }
      } catch (error) {
        console.error('Error updating order status:', error);
        socket.emit('error', { message: 'Failed to update order status: ' + error.message });
      }
    });

    // Handle disconnection
    socket.on('disconnect', (reason) => {
      console.log(`${socket.user.role} disconnected:`, socket.id, 'Reason:', reason);
    });

    // Handle errors
    socket.on('error', (error) => {
      console.error('Socket error:', error);
    });
  });

  // Log when socket server is ready
  console.log('WebSocket order handler initialized');
};

module.exports = handleOrderSocket;