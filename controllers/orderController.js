const Order = require("../models/Order");
const Food = require("../models/Food");
const User = require("../models/User");
const Cart = require("../models/Cart");

// Change stream instance will be injected
let orderChangeStream;

const initializeOrderChangeStream = (io) => {
  if (!io) {
    console.error("Socket.IO instance not provided");
    return;
  }

  // Watch for changes in the Order collection
  orderChangeStream = Order.watch(
    [
      {
        $match: {
          operationType: { $in: ["insert", "update", "replace"] },
        },
      },
    ],
    {
      fullDocument: "updateLookup",
    }
  );

  orderChangeStream.on("change", async (change) => {
    try {
      const { operationType, fullDocument } = change;

      if (!fullDocument) return;

      // Populate necessary fields for the order
      const populatedOrder = await Order.findById(fullDocument._id)
        .populate("customer", "name email phone")
        .populate("restaurant", "name address phone owner")
        .populate("items.foodId", "name category image");

      if (!populatedOrder) return;

      const orderData = {
        _id: populatedOrder._id,
        orderNumber: populatedOrder.orderNumber,
        customerName: populatedOrder.customerName,
        customerPhone: populatedOrder.customerPhone,
        items: populatedOrder.items.map((item) => ({
          name: item.name,
          price: item.price,
          quantity: item.quantity,
        })),
        status: populatedOrder.status,
        createdAt: populatedOrder.createdAt,
        totalAmount: populatedOrder.totalAmount,
        timestamp: populatedOrder.updatedAt || populatedOrder.createdAt,
      };

      // Handle new order creation
      if (operationType === "insert") {
        const roomsToNotify = [
          `restaurant_${populatedOrder.restaurant._id}`,
          `restaurant_owner_${populatedOrder.restaurant.owner}`,
          "admin",
        ];

        roomsToNotify.forEach((room) => {
          if (!room.includes("undefined")) {
            io.to(room).emit("newOrder", orderData);
          }
        });

        // Fallback broadcast
        io.emit("newOrderBroadcast", {
          ...orderData,
          targetRestaurant: populatedOrder.restaurant._id.toString(),
          targetOwner: populatedOrder.restaurant.owner?.toString(),
        });
      }

      // Handle order updates (status changes)
      if (operationType === "update" || operationType === "replace") {
        // Check if status was updated
        const statusUpdateData = {
          orderId: populatedOrder._id,
          orderNumber: populatedOrder.orderNumber,
          status: populatedOrder.status,
          estimatedTime: populatedOrder.estimatedTime,
          timestamp: populatedOrder.updatedAt,
        };

        // Notify customer
        io.to(`customer_${populatedOrder.customer._id}`).emit(
          "orderStatusUpdate",
          {
            ...statusUpdateData,
            message: `Your order ${populatedOrder.orderNumber} is now ${populatedOrder.status}`,
          }
        );

        // Notify restaurant
        io.to(`restaurant_${populatedOrder.restaurant._id}`).emit(
          "orderStatusUpdate",
          {
            ...statusUpdateData,
            customerName: populatedOrder.customerName,
            type: "status_update",
          }
        );

        // Notify admin
        io.to("admin").emit("orderStatusUpdate", {
          ...statusUpdateData,
          customerName: populatedOrder.customerName,
          restaurantName: populatedOrder.restaurant.name,
        });

        // Handle cancellation specifically
        if (populatedOrder.status === "cancelled") {
          io.to(`customer_${populatedOrder.customer._id}`).emit(
            "orderCancelled",
            {
              orderId: populatedOrder._id,
              orderNumber: populatedOrder.orderNumber,
              reason: "Order cancelled",
            }
          );

          io.to(`restaurant_${populatedOrder.restaurant._id}`).emit(
            "orderCancelled",
            {
              orderId: populatedOrder._id,
              orderNumber: populatedOrder.orderNumber,
              customerName: populatedOrder.customerName,
              reason: "Order cancelled",
            }
          );
        }
      }
    } catch (error) {
      console.error("Error processing order change stream:", error);
    }
  });

  orderChangeStream.on("error", (error) => {
    console.error("Order change stream error:", error);
    // Attempt to restart the change stream
    setTimeout(() => {
      initializeOrderChangeStream(io);
    }, 5000);
  });

  console.log("Order change stream initialized");
};

const closeOrderChangeStream = () => {
  if (orderChangeStream) {
    orderChangeStream.close();
    console.log("Order change stream closed");
  }
};

// Create new order (Customer only)
// const createOrder = async (req, res) => {
//   try {
//     if (!req.user || !req.user._id) {
//       return res.status(401).json({
//         success: false,
//         message: "Unauthorized. Please log in to place an order.",
//       });
//     }

//     const { customerPhone, customerAddress } = req.body;
//     const userId = req.user._id;

//     // Get cart data instead of items from request body
//     const cart = await Cart.findOne({ user: userId, isActive: true })
//       .populate("items.food", "name price isAvailable")
//       .populate("items.restaurant", "name isOpen")
//       .populate("restaurant", "name isOpen restaurantCode"); // Added 'code' to populate

//     if (!cart || cart.items.length === 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Cart is empty",
//       });
//     }

//     if (!cart.restaurant.isOpen) {
//       return res.status(400).json({
//         success: false,
//         message: "Restaurant is currently closed",
//       });
//     }

//     // Check if all items are still available
//     const unavailableItems = cart.items.filter(
//       (item) => !item.food.isAvailable
//     );
//     if (unavailableItems.length > 0) {
//       return res.status(400).json({
//         success: false,
//         message: "Some items in your cart are no longer available",
//         unavailableItems: unavailableItems.map((item) => item.food.name),
//       });
//     }

//     // Convert cart items to order items format
//     const orderItems = cart.items.map((item) => ({
//       foodId: item.food._id,
//       name: item.food.name,
//       price: item.price, // Use cart price (in case food price changed)
//       quantity: item.quantity,
//       specialInstructions: item.specialInstructions || "",
//     }));

//     // Get today's order count for this restaurant to generate order number
//     const today = new Date();
//     today.setHours(0, 0, 0, 0);
//     const tomorrow = new Date(today);
//     tomorrow.setDate(tomorrow.getDate() + 1);

//     const todayOrderCount = await Order.countDocuments({
//       restaurant: cart.restaurant._id,
//       createdAt: {
//         $gte: today,
//         $lt: tomorrow
//       }
//     });

//     const generateOrderNumber = (restaurantCode, count) => {
//       const today = new Date();
//       const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
//       const date = String(today.getDate()).padStart(2, "0");
//       const formattedCount = String(count + 1).padStart(2, "0"); // +1 because this will be the next order

//       return `${restaurantCode}${dayOfWeek}${date}${formattedCount}`;
//     };

//     const newOrder = new Order({
//       orderNumber: generateOrderNumber(cart.restaurant.code, todayOrderCount), // Using 'code' instead of 'restaurantCode'
//       customer: userId,
//       restaurant: cart.restaurant._id,
//       customerName: req.user.name,
//       customerPhone: customerPhone || req.user.phone,
//       customerAddress: customerAddress || req.user.address,
//       items: orderItems,
//       totalAmount: cart.totalAmount, // Use cart total
//     });

//     const savedOrder = await newOrder.save();

//     // Populate order details for response
//     await savedOrder.populate([
//       { path: "customer", select: "name email phone" },
//       { path: "restaurant", select: "name address phone owner" },
//       { path: "items.foodId", select: "name category image" },
//     ]);

//     // Clear cart after successful order
//     cart.items = [];
//     cart.restaurant = null;
//     await cart.save();

//     // Note: Real-time notifications are now handled by the change stream
//     // The change stream will automatically detect the new order and emit events

//     res.status(201).json({
//       success: true,
//       message: "Order created successfully",
//       data: savedOrder,
//     });
//   } catch (error) {
//     console.error("Create order error:", error);
//     res.status(500).json({
//       success: false,
//       message: "Failed to create order",
//       error: error.message,
//     });
//   }
// };

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

    // Updated valid statuses to match new model
    const validStatuses = ["new", "delivered"];
    
    if (!validStatuses.includes(status)) {
      return res.status(400).json({
        success: false,
        message: "Invalid status. Valid statuses are: new, delivered",
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

    // Note: Real-time notifications are now handled by the change stream
    // The change stream will automatically detect the order update and emit events

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
          (order.notes || "") +
          (reason ? ` | Cancellation reason: ${reason}` : " | Order cancelled"),
      },
      { new: true }
    ).populate([
      { path: "customer", select: "name email phone" },
      { path: "restaurant", select: "name address phone" },
    ]);

    // Note: Real-time notifications are now handled by the change stream
    // The change stream will automatically detect the order update and emit events

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

const getUserOrders = async (req, res) => {
  try {
    const userId = req.user._id;

    const orders = await Order.find({ customer: userId })
      .populate("restaurant", "name address phone image")
      .populate("items.foodId", "name category image")
      .populate("paymentId", "razorpayPaymentId razorpayOrderId")
      .sort({ createdAt: -1 });

    // Format the orders data for frontend
    const formattedOrders = orders.map((order) => ({
      id: order._id,
      orderNumber: order.orderNumber,
      date: order.createdAt,
      restaurant: order.restaurant?.name || "Unknown Restaurant",
      items: order.items.map((item) => ({
        name: item.name,
        price: item.price,
        quantity: item.quantity,
      })),
      totalAmount: order.totalAmount,
      transactionId: order.paymentId.razorpayPaymentId,
    }));

    res.json({
      success: true,
      data: formattedOrders,
    });
  } catch (error) {
    console.error("Get user orders error:", error);
    res.status(500).json({
      success: false,
      message: "Failed to fetch orders",
      error: error.message,
    });
  }
};

const getTransactionDetails = async (req, res) => {
  try {
    const userId = req.user._id;
    const userRole = req.user.role;

    // Build filter
    let filter = {};
    if (userRole === "customer") {
      filter.customer = userId;
    } else if (userRole === "restaurant") {
      const Restaurant = require("../models/Restaurant");
      const restaurants = await Restaurant.find({ owner: userId }).select("_id");
      const restaurantIds = restaurants.map(r => r._id);
      filter.restaurant = { $in: restaurantIds };
    }

    // Fetch orders
    const orders = await Order.find(filter)
      .populate("paymentId", "razorpayPaymentId razorpayOrderId")
      .sort({ createdAt: -1 });
    if (!orders.length) {
      return res.json({ success: true, data: [], count: 0, monthlyRevenue: 0 });
    }

    const transactionDetails = orders.map(order => {
      const itemCount = order.items?.reduce(
        (total, item) => total + item.quantity,
        0
      ) || 0;

      return {
        orderId: order.orderNumber,
        transactionId: order.paymentId?.razorpayPaymentId || null,
        itemCount,
        total: order.totalAmount,
        orderTime: order.createdAt,
      };
    });

    // Monthly revenue calculation
    const now = new Date();
    const currentMonth = now.getMonth();
    const currentYear = now.getFullYear();

    const monthlyRevenue = orders
      .filter(order => {
        const orderDate = new Date(order.createdAt);
        return (
          orderDate.getMonth() === currentMonth &&
          orderDate.getFullYear() === currentYear 
          // && order.status === "delivered"
        );
      })
      .reduce((total, order) => total + order.totalAmount, 0);

    return res.json({
      success: true,
      data: transactionDetails,
      count: transactionDetails.length,
      monthlyRevenue,
      currentMonth: `${currentYear}-${String(currentMonth + 1).padStart(2, "0")}`,
    });

  } catch (error) {
    console.error("Error fetching transaction details:", error);
    return res.status(500).json({
      success: false,
      message: "Failed to fetch transaction details",
      error: error.message,
    });
  }
};

module.exports = {
  //createOrder,
  getAllOrders,
  getOrder,
  updateOrderStatus,
  getOrderStats,
  cancelOrder,
  initializeOrderChangeStream,
  closeOrderChangeStream,
  getUserOrders,
  getTransactionDetails,
};
