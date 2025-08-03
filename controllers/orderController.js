const Order = require("../models/Order");
const Food = require("../models/Food");
const User = require("../models/User");

// WebSocket instance will be injected
let io;

const setSocketIO = (socketIO) => {
  io = socketIO;
};

// Create new order (Customer only)
const createOrder = async (req, res) => {
  try {
    if (!req.user || !req.user._id) {
      return res.status(401).json({
        success: false,
        message: "Unauthorized. Please log in to place an order.",
      });
    }

    const {
      items,
      customerPhone,
      customerAddress,
    } = req.body;
    const userId = req.user._id;

    // Validate items and calculate total
    let totalAmount = 0;
    const orderItems = [];
    let restaurantId = null;

    for (const item of items) {
      const food = await Food.findById(item.foodId).populate("restaurant");
      if (!food) {
        return res.status(400).json({
          success: false,
          message: `Food item with ID ${item.foodId} not found`,
        });
      }

      if (!food.isAvailable) {
        return res.status(400).json({
          success: false,
          message: `${food.name} is currently unavailable`,
        });
      }

      // Ensure all items are from the same restaurant
      if (!restaurantId) {
        restaurantId = food.restaurant._id;
      } else if (restaurantId.toString() !== food.restaurant._id.toString()) {
        return res.status(400).json({
          success: false,
          message: "All items must be from the same restaurant",
        });
      }

      const itemTotal = food.price * item.quantity;
      totalAmount += itemTotal;

      orderItems.push({
        foodId: food._id,
        name: food.name,
        price: food.price,
        quantity: item.quantity,
        specialInstructions: item.specialInstructions || "",
      });
    }

    const generateOrderNumber = () => {
      const random = Math.floor(1000 + Math.random() * 9000);
      return `ORD-${random}`;
    };

    const newOrder = new Order({
      orderNumber: generateOrderNumber(),
      customer: userId,
      restaurant: restaurantId,
      customerName: req.user.name,
      customerPhone: req.user.phone,
      customerAddress: req.user.address,
      items: orderItems,
      totalAmount,
    });

    const savedOrder = await newOrder.save();

    // Populate order details
    await savedOrder.populate([
      { path: "customer", select: "name email phone" },
      { path: "restaurant", select: "name address phone owner" },
      { path: "items.foodId", select: "name category image" },
    ]);

    // Get restaurant owner if populate didn't work
    let restaurantOwner = savedOrder.restaurant?.owner;
    if (!restaurantOwner) {
      const Restaurant = require('../models/Restaurant');
      const restaurant = await Restaurant.findById(restaurantId).select('owner');
      restaurantOwner = restaurant?.owner;
    }

    // Clear customer's cart after successful order
    await User.findByIdAndUpdate(userId, { $set: { cart: [] } });

    // Emit real-time update via WebSocket
    if (io) {
      const orderData = {
        _id: savedOrder._id,
        orderNumber: savedOrder.orderNumber,
        customerName: savedOrder.customerName,
        customerPhone: savedOrder.customerPhone,
        items: savedOrder.items.map(item => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity
        })),
        status: savedOrder.status,
        createdAt: savedOrder.createdAt,
        totalAmount: savedOrder.totalAmount,
        timestamp: savedOrder.createdAt
      };

      // Emit to specific rooms
      const roomsToNotify = [
        `restaurant_${restaurantId}`,
        `restaurant_owner_${restaurantOwner}`,
        'admin'
      ];

      roomsToNotify.forEach(room => {
        if (!room.includes('undefined')) {
          io.to(room).emit("newOrder", orderData);
        }
      });

      // Fallback broadcast to all connected sockets
      io.emit('newOrderBroadcast', {
        ...orderData,
        targetRestaurant: restaurantId.toString(),
        targetOwner: restaurantOwner?.toString()
      });
    }

    res.status(201).json({
      success: true,
      message: "Order created successfully",
      data: savedOrder,
    });
  } catch (error) {
    console.error("Create order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to create order",
      error: error.message,
    });
  }
};

// Get all orders with role-based access
const getAllOrders = async (req, res) => {
  try {
    const { status, date, page = 1, limit = 20 } = req.query;
    const userRole = req.user.role;
    const userId = req.user._id;

    let filter = {};

    // Role-based filtering
    if (userRole === "customer") {
      filter.customer = userId;
    } else if (userRole === "restaurant") {
      // For restaurant users, we need to find orders for restaurants they own
      // This assumes you have a Restaurant model where owner field references User
      const Restaurant = require("../models/Restaurant");
      const restaurants = await Restaurant.find({ owner: userId }).select(
        "_id"
      );
      const restaurantIds = restaurants.map((r) => r._id);
      filter.restaurant = { $in: restaurantIds };
    }
    // Admin can see all orders (no additional filter)

    // Filter by status
    if (status && status !== "all") {
      filter.status = status;
    }

    // Filter by date
    if (date) {
      const startDate = new Date(date);
      const endDate = new Date(date);
      endDate.setHours(23, 59, 59, 999);
      filter.createdAt = { $gte: startDate, $lte: endDate };
    }

    const orders = await Order.find(filter)
      .populate("customer", "name email phone")
      .populate("restaurant", "name address phone")
      .populate("items.foodId", "name category image")
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);

    const totalOrders = await Order.countDocuments(filter);

    res.json({
      success: true,
      data: orders,
      pagination: {
        current: page,
        total: Math.ceil(totalOrders / limit),
        count: orders.length,
        totalOrders,
      },
    });
  } catch (error) {
    console.error("Get orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

// Get single order with access control
const getOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const userRole = req.user.role;
    const userId = req.user._id;

    let order;
    if (id.startsWith("ORD-")) {
      order = await Order.findOne({ orderNumber: id })
        .populate("customer", "name email phone address")
        .populate("restaurant", "name address phone")
        .populate("items.foodId", "name category image description");
    } else {
      order = await Order.findById(id)
        .populate("customer", "name email phone address")
        .populate("restaurant", "name address phone")
        .populate("items.foodId", "name category image description");
    }

    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Access control
    if (
      userRole === "customer" &&
      order.customer._id.toString() !== userId.toString()
    ) {
      return res.status(403).json({
        success: false,
        message: "Access denied: You can only view your own orders",
      });
    }

    if (userRole === "restaurant") {
      // Check if user owns the restaurant for this order
      const Restaurant = require("../models/Restaurant");
      const restaurant = await Restaurant.findOne({
        _id: order.restaurant._id,
        owner: userId,
      });

      if (!restaurant) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only view orders for your restaurant",
        });
      }
    }

    res.json({
      success: true,
      data: order,
    });
  } catch (error) {
    console.error("Get order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch order",
      error: error.message,
    });
  }
};

// Update order status (Restaurant and Admin only)
const updateOrderStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status, estimatedTime } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    const validStatuses = [
      "pending",
      "confirmed",
      "preparing",
      "ready",
      "delivered",
      "cancelled",
    ];
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status",
      });
    }

    // Find the order first for access control
    const existingOrder = await Order.findById(id);
    if (!existingOrder) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Access control for restaurant users
    if (userRole === "restaurant") {
      const Restaurant = require("../models/Restaurant");
      const restaurant = await Restaurant.findOne({
        _id: existingOrder.restaurant,
        owner: userId,
      });

      if (!restaurant) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only update orders for your restaurant",
        });
      }
    }

    const updateData = { status };
    if (estimatedTime) {
      updateData.estimatedTime = estimatedTime;
    }

    const order = await Order.findByIdAndUpdate(id, updateData, {
      new: true,
    }).populate([
      { path: "customer", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
      { path: "items.foodId", select: "name category" },
    ]);

    // Emit status update to relevant parties
    if (io) {
      // Notify customer
      io.to(`customer_${order.customer._id}`).emit("orderStatusUpdate", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        estimatedTime: order.estimatedTime,
        message: `Your order ${order.orderNumber} is now ${status}`,
      });

      // Notify restaurant
      io.to(`restaurant_${order.restaurant._id}`).emit("orderStatusUpdate", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        type: "status_update",
      });

      // Notify admin
      io.to("admin").emit("orderStatusUpdate", {
        orderId: order._id,
        orderNumber: order.orderNumber,
        status: order.status,
        customerName: order.customerName,
        restaurantName: order.restaurant.name,
      });
    }

    res.json({
      success: true,
      message: "Order status updated successfully",
      data: order,
    });
  } catch (error) {
    console.error("Update order status error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to update order status",
      error: error.message,
    });
  }
};

// Get order statistics with role-based filtering
const getOrderStats = async (req, res) => {
  try {
    const userRole = req.user.role;
    const userId = req.user._id;

    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1);

    let matchFilter = {
      createdAt: { $gte: today, $lt: tomorrow },
    };

    // Role-based filtering
    if (userRole === "restaurant") {
      const Restaurant = require("../models/Restaurant");
      const restaurants = await Restaurant.find({ owner: userId }).select(
        "_id"
      );
      const restaurantIds = restaurants.map((r) => r._id);
      matchFilter.restaurant = { $in: restaurantIds };
    } else if (userRole === "customer") {
      matchFilter.customer = userId;
    }

    const stats = await Order.aggregate([
      { $match: matchFilter },
      {
        $group: {
          _id: "$status",
          count: { $sum: 1 },
          totalAmount: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalRevenue = await Order.aggregate([
      {
        $match: {
          ...matchFilter,
          paymentStatus: "paid",
        },
      },
      {
        $group: {
          _id: null,
          total: { $sum: "$totalAmount" },
        },
      },
    ]);

    const totalOrders = await Order.countDocuments(matchFilter);

    res.json({
      success: true,
      data: {
        ordersByStatus: stats,
        totalRevenue: totalRevenue[0]?.total || 0,
        totalOrders,
        date: today.toISOString().split("T")[0],
      },
    });
  } catch (error) {
    console.error("Get stats error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch statistics",
      error: error.message,
    });
  }
};

// Cancel order (Customer can cancel pending orders, Restaurant/Admin can cancel any)
const cancelOrder = async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body;
    const userRole = req.user.role;
    const userId = req.user._id;

    const order = await Order.findById(id);
    if (!order) {
      return res.status(404).json({
        success: false,
        message: "Order not found",
      });
    }

    // Access control
    if (userRole === "customer") {
      if (order.customer.toString() !== userId.toString()) {
        return res.status(403).json({
          success: false,
          message: "Access denied: You can only cancel your own orders",
        });
      }

      if (!["pending", "confirmed"].includes(order.status)) {
        return res.status(400).json({
          success: false,
          message: "Order cannot be cancelled at this stage",
        });
      }
    }

    if (userRole === "restaurant") {
      const Restaurant = require("../models/Restaurant");
      const restaurant = await Restaurant.findOne({
        _id: order.restaurant,
        owner: userId,
      });

      if (!restaurant) {
        return res.status(403).json({
          success: false,
          message:
            "Access denied: You can only cancel orders for your restaurant",
        });
      }
    }

    const updatedOrder = await Order.findByIdAndUpdate(
      id,
      {
        status: "cancelled",
        notes:
          order.notes +
          (reason ? ` | Cancellation reason: ${reason}` : " | Order cancelled"),
      },
      { new: true }
    ).populate([
      { path: "customer", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
    ]);

    // Emit cancellation notification
    if (io) {
      io.to(`customer_${updatedOrder.customer._id}`).emit("orderCancelled", {
        orderId: updatedOrder._id,
        orderNumber: updatedOrder.orderNumber,
        reason: reason || "Order cancelled",
      });

      io.to(`restaurant_${updatedOrder.restaurant._id}`).emit(
        "orderCancelled",
        {
          orderId: updatedOrder._id,
          orderNumber: updatedOrder.orderNumber,
          customerName: updatedOrder.customerName,
          reason: reason || "Order cancelled",
        }
      );
    }

    res.json({
      success: true,
      message: "Order cancelled successfully",
      data: updatedOrder,
    });
  } catch (error) {
    console.error("Cancel order error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to cancel order",
      error: error.message,
    });
  }
};

module.exports = {
  createOrder,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  getOrderStats,
  cancelOrder,
  setSocketIO,
};
