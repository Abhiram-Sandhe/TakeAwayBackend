const Razorpay = require("razorpay");
const crypto = require("crypto");
const Order = require("../models/Order");
const Cart = require("../models/Cart");
const Payment = require("../models/Payment");
const { sendEmail } = require("../config/email");

const generateOrderEmailHTML = (orderData, paymentData) => {
  const itemsHTML = orderData.items
    .map(
      (item) => `
    <tr>
      <td style="padding: 8px; border-bottom: 1px solid #eee;">${item.name}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: center;">${
        item.quantity
      }</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${item.price.toFixed(
        2
      )}</td>
      <td style="padding: 8px; border-bottom: 1px solid #eee; text-align: right;">₹${(
        item.price * item.quantity
      ).toFixed(2)}</td>
    </tr>
  `
    )
    .join("");

  return `
    <!DOCTYPE html>
    <html>
    <head>
      <meta charset="utf-8">
      <title>Order Confirmation</title>
    </head>
    <body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
      <div style="background: linear-gradient(135deg, #667eea 0%, #764ba2 100%); color: white; padding: 30px; text-align: center; border-radius: 10px 10px 0 0;">
        <h1 style="margin: 0; font-size: 28px;">Thank You for Your Order!</h1>
        <p style="margin: 10px 0 0 0; font-size: 16px; opacity: 0.9;">Your order has been confirmed and is being prepared</p>
      </div>
      
      <div style="background: white; padding: 30px; border: 1px solid #ddd; border-top: none; border-radius: 0 0 10px 10px;">
        <div style="background: #f8f9fa; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
          <h2 style="margin: 0 0 15px 0; color: #495057;">Order Details</h2>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Order Number:</strong></span>
            <span>#${orderData.orderNumber}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Restaurant:</strong></span>
            <span>${orderData.restaurant?.name || "Restaurant Name"}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Order Date:</strong></span>
            <span>${new Date(orderData.createdAt).toLocaleString()}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-bottom: 8px;">
            <span><strong>Payment Status:</strong></span>
            <span style="color: #28a745; font-weight: bold;">PAID</span>
          </div>
        </div>

        <h3 style="color: #495057; margin-bottom: 15px;">Items Ordered</h3>
        <table style="width: 100%; border-collapse: collapse; margin-bottom: 25px;">
          <thead>
            <tr style="background: #e9ecef;">
              <th style="padding: 12px 8px; text-align: left; border-bottom: 2px solid #dee2e6;">Item</th>
              <th style="padding: 12px 8px; text-align: center; border-bottom: 2px solid #dee2e6;">Qty</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Price</th>
              <th style="padding: 12px 8px; text-align: right; border-bottom: 2px solid #dee2e6;">Total</th>
            </tr>
          </thead>
          <tbody>
            ${itemsHTML}
          </tbody>
        </table>

        <div style="background: #e8f5e8; padding: 20px; border-radius: 8px; border-left: 4px solid #28a745;">
          <div style="display: flex; justify-content: space-between; align-items: center;">
            <span style="font-size: 18px; font-weight: bold; color: #155724;">Total Amount:</span>
            <span style="font-size: 24px; font-weight: bold; color: #155724;">₹${orderData.totalAmount.toFixed(
              2
            )}</span>
          </div>
          <div style="display: flex; justify-content: space-between; margin-top: 10px; font-size: 14px; color: #155724;">
            <span>Payment ID:</span>
            <span>${paymentData.razorpayPaymentId}</span>
          </div>
        </div>

        <div style="background: #fff3cd; padding: 20px; border-radius: 8px; margin-top: 25px; border-left: 4px solid #ffc107;">
          <h4 style="margin: 0 0 10px 0; color: #856404;">Delivery Information</h4>
          <p style="margin: 0; color: #856404;">
            <strong>Phone:</strong> ${orderData.customerPhone}<br>
            <strong>Address:</strong> ${orderData.customerAddress}
          </p>
        </div>

        <div style="text-align: center; margin-top: 30px; padding: 20px; background: #f8f9fa; border-radius: 8px;">
          <p style="margin: 0 0 10px 0; color: #6c757d;">Thank you for choosing us!</p>
          <p style="margin: 0; color: #6c757d; font-size: 14px;">You will receive updates about your order status via phone.</p>
        </div>
      </div>
    </body>
    </html>
  `;
};

// Initialize Razorpay instance
const razorpay = new Razorpay({
  key_id: process.env.RAZORPAY_KEY_ID,
  key_secret: process.env.RAZORPAY_KEY_SECRET,
});

class PaymentController {
  static async createPaymentOrder(req, res) {
    try {
      const { customerPhone } = req.body; // Removed customerAddress as it's not used
      const userId = req.user._id;

      // Get user details
      const User = require("../models/User");
      const user = await User.findById(userId).select("name email phone");

      if (!user) {
        return res.status(401).json({
          success: false,
          message: "User not found",
        });
      }

      // Get cart data
      const cart = await Cart.findOne({ user: userId, isActive: true })
        .populate("items.food", "name price isAvailable")
        .populate("items.restaurant", "name isOpen")
        .populate("restaurant", "name isOpen");

      if (!cart || cart.items.length === 0) {
        return res.status(400).json({
          success: false,
          message: "Cart is empty",
        });
      }

      if (!cart.restaurant.isOpen) {
        return res.status(400).json({
          success: false,
          message: "Restaurant is currently closed",
        });
      }

      // Check if all items are still available
      const unavailableItems = cart.items.filter(
        (item) => !item.food.isAvailable
      );
      if (unavailableItems.length > 0) {
        return res.status(400).json({
          success: false,
          message: "Some items in your cart are no longer available",
          unavailableItems: unavailableItems.map((item) => item.food.name),
        });
      }

      const finalCustomerPhone = customerPhone || user.phone;

      if (!finalCustomerPhone) {
        return res.status(400).json({
          success: false,
          message:
            "Phone number is required. Please provide it or update your profile.",
        });
      }

      // Validate phone number
      if (!/^[6-9]\d{9}$/.test(finalCustomerPhone)) {
        return res.status(400).json({
          success: false,
          message: "Please provide a valid 10-digit phone number",
        });
      }

      // Create Razorpay order
      const amount = Math.round(cart.totalAmount * 100);
      const currency = "INR";

      // Generate a shorter receipt ID (max 40 characters)
      const timestamp = Date.now().toString().slice(-8); // Last 8 digits
      const userIdShort = userId.toString().slice(-6); // Last 6 chars of userId
      const shortReceipt = `rcpt_${timestamp}_${userIdShort}`; // Max ~20 chars

      const razorpayOrderOptions = {
        amount,
        currency,
        receipt: shortReceipt,
        notes: {
          user_id: userId.toString(),
          user_name: user.name,
          user_email: user.email,
          restaurant_id: cart.restaurant._id.toString(),
          restaurant_name: cart.restaurant.name,
          customer_phone: finalCustomerPhone,
          item_count: cart.items.length.toString(),
        },
      };

      const razorpayOrder = await razorpay.orders.create(razorpayOrderOptions);

      // Create payment record
      const payment = new Payment({
        razorpayOrderId: razorpayOrder.id,
        user: userId,
        restaurant: cart.restaurant._id,
        amount: cart.totalAmount,
        currency,
        status: "created",
        cartData: {
          items: cart.items.map((item) => ({
            foodId: item.food._id,
            name: item.food.name,
            price: item.price,
            quantity: item.quantity,
            specialInstructions: item.specialInstructions || "",
          })),
          totalAmount: cart.totalAmount,
          customerPhone: finalCustomerPhone,
        },
      });

      await payment.save();

      res.json({
        success: true,
        data: {
          orderId: razorpayOrder.id,
          amount,
          currency,
          key: process.env.RAZORPAY_KEY_ID,
          name: "Your Restaurant App",
          description: `Payment for order from ${cart.restaurant.name}`,
          prefill: {
            name: user.name,
            email: user.email,
            contact: finalCustomerPhone,
          },
          theme: {
            color: "#3399cc",
          },
          paymentId: payment._id,
          notes: {
            restaurant: cart.restaurant.name,
            items: cart.items.length,
            totalAmount: cart.totalAmount,
          },
        },
      });
    } catch (error) {
      console.error("Create payment order error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to create payment order",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  static async verifyPayment(req, res) {
    try {
      const {
        razorpay_order_id,
        razorpay_payment_id,
        razorpay_signature,
        paymentId,
      } = req.body;

      if (
        !razorpay_order_id ||
        !razorpay_payment_id ||
        !razorpay_signature ||
        !paymentId
      ) {
        return res.status(400).json({
          success: false,
          message: "Missing required payment verification parameters",
        });
      }

      // Verify signature
      const body = razorpay_order_id + "|" + razorpay_payment_id;
      const expectedSignature = crypto
        .createHmac("sha256", process.env.RAZORPAY_KEY_SECRET)
        .update(body.toString())
        .digest("hex");

      if (expectedSignature !== razorpay_signature) {
        return res.status(400).json({
          success: false,
          message: "Payment verification failed - Invalid signature",
        });
      }

      // Find payment record
      const payment = await Payment.findById(paymentId);
      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment record not found",
        });
      }

      // Check if payment is already processed
      if (payment.status === "completed") {
        return res.status(400).json({
          success: false,
          message: "Payment already processed",
        });
      }

      // Get user details
      const User = require("../models/User");
      const user = await User.findById(payment.user).select(
        "name email phone address"
      );

      if (!user) {
        return res.status(404).json({
          success: false,
          message: "User not found",
        });
      }

      const Restaurant = require("../models/Restaurant");
      const restaurant = await Restaurant.findById(payment.restaurant).select(
        "name isOpen restaurantCode"
      );

      if (!restaurant) {
        return res.status(404).json({
          success: false,
          message: "Restaurant not found",
        });
      }

      // Update payment status
      payment.razorpayPaymentId = razorpay_payment_id;
      payment.razorpaySignature = razorpay_signature;
      payment.status = "completed";
      payment.paidAt = new Date();
      await payment.save();

      const cartData = payment.cartData;

      // This ensures order count resets every day at midnight
      const today = new Date();
      today.setHours(0, 0, 0, 0); // Set to start of today (00:00:00)
      const tomorrow = new Date(today);
      tomorrow.setDate(tomorrow.getDate() + 1); // Set to start of tomorrow (00:00:00)

      // Count only orders created today for this specific restaurant
      const todayOrderCount = await Order.countDocuments({
        restaurant: payment.restaurant,
        createdAt: {
          $gte: today, // Greater than or equal to today 00:00:00
          $lt: tomorrow, // Less than tomorrow 00:00:00 (so only today's orders)
        },
      });

      // Generate restaurant-based order number with daily reset
      const generateOrderNumber = (restaurantCode, count) => {
        const today = new Date();
        const dayOfWeek = today.getDay() === 0 ? 7 : today.getDay();
        const date = String(today.getDate()).padStart(2, "0");
        const formattedCount = String(count + 1).padStart(2, "0"); // +1 because this will be the next order

        return `${restaurantCode}${dayOfWeek}${date}${formattedCount}`;
      };

      // Create order
      const newOrder = new Order({
        orderNumber: generateOrderNumber(
          restaurant.restaurantCode,
          todayOrderCount
        ),
        customer: payment.user,
        restaurant: payment.restaurant,
        customerName: user.name,
        customerPhone: cartData.customerPhone,
        customerAddress:
          cartData.customerAddress || user.address || "Address not provided",
        items: cartData.items,
        totalAmount: cartData.totalAmount,
        paymentId: payment._id,
        paymentStatus: "paid",
        paymentMethod: "online",
      });

      const savedOrder = await newOrder.save();

      // Populate order details
      await savedOrder.populate([
        { path: "customer", select: "name email phone address role" },
        { path: "restaurant", select: "name address phone owner" },
        { path: "items.foodId", select: "name category image" },
        { path: "paymentId", select: "razorpayPaymentId amount status paidAt" },
      ]);

      // Update payment with order reference
      payment.order = savedOrder._id;
      await payment.save();

      // Clear user's cart
      const cart = await Cart.findOne({ user: payment.user, isActive: true });
      if (cart) {
        cart.items = [];
        cart.restaurant = null;
        cart.totalAmount = 0;
        await cart.save();
      }

      try {
        if (user.email) {
          const emailHTML = generateOrderEmailHTML(savedOrder, payment);
          const emailSent = await sendEmail(
            user.email,
            `Order Confirmation - #${savedOrder.orderNumber}`,
            emailHTML
          );

          if (emailSent) {
            console.log(`Order confirmation email sent to ${user.email}`);
          } else {
            console.log(`Failed to send email to ${user.email}`);
          }
        }
      } catch (emailError) {
        console.error("Email sending error:", emailError);
        // Don't fail the order creation if email fails
      }

      // Socket.IO notification (with safety checks)
      try {
        if (global.io && typeof global.io.emit === "function") {
          const orderData = {
            _id: savedOrder._id,
            orderNumber: savedOrder.orderNumber,
            customerName: savedOrder.customerName,
            customerPhone: savedOrder.customerPhone,
            customerAddress: savedOrder.customerAddress,
            items: savedOrder.items.map((item) => ({
              name: item.name,
              price: item.price,
              quantity: item.quantity,
              specialInstructions: item.specialInstructions,
            })),
            status: savedOrder.status,
            paymentStatus: savedOrder.paymentStatus,
            paymentMethod: savedOrder.paymentMethod,
            createdAt: savedOrder.createdAt,
            totalAmount: savedOrder.totalAmount,
            timestamp: savedOrder.createdAt,
          };

          const restaurantOwner = savedOrder.restaurant?.owner;

          if (restaurantOwner) {
            global.io
              .to(`restaurant_${payment.restaurant}`)
              .emit("newOrder", orderData);
            global.io
              .to(`restaurant_owner_${restaurantOwner}`)
              .emit("newOrder", orderData);
          }

          global.io.to("admin").emit("newOrder", orderData);
        }
      } catch (socketError) {
        console.error("Socket.IO error:", socketError);
        // Don't fail the entire request for socket errors
      }

      res.json({
        success: true,
        message: "Payment verified and order created successfully",
        data: {
          order: {
            _id: savedOrder._id,
            orderNumber: savedOrder.orderNumber,
            status: savedOrder.status,
            paymentStatus: savedOrder.paymentStatus,
            totalAmount: savedOrder.totalAmount,
            createdAt: savedOrder.createdAt,
            estimatedDeliveryTime: savedOrder.estimatedDeliveryTime,
          },
          payment: {
            id: payment._id,
            status: payment.status,
            amount: payment.amount,
            paidAt: payment.paidAt,
            razorpayPaymentId: payment.razorpayPaymentId,
          },
        },
      });
    } catch (error) {
      console.error("Verify payment error:", error);
      res.status(500).json({
        success: false,
        message: "Payment verification failed",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  static async handlePaymentFailure(req, res) {
    try {
      const { paymentId, error } = req.body;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: "Payment ID is required",
        });
      }

      const payment = await Payment.findById(paymentId);
      if (payment && payment.status !== "completed") {
        payment.status = "failed";
        payment.failureReason =
          error?.description || error?.reason || "Payment failed";
        await payment.save();
      }

      res.json({
        success: true,
        message: "Payment failure recorded",
      });
    } catch (error) {
      console.error("Handle payment failure error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to handle payment failure",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  static async getPaymentStatus(req, res) {
    try {
      const { paymentId } = req.params;

      if (!paymentId) {
        return res.status(400).json({
          success: false,
          message: "Payment ID is required",
        });
      }

      const payment = await Payment.findById(paymentId)
        .populate("user", "name email")
        .populate("restaurant", "name")
        .populate("order", "orderNumber status");

      if (!payment) {
        return res.status(404).json({
          success: false,
          message: "Payment not found",
        });
      }

      res.json({
        success: true,
        data: payment,
      });
    } catch (error) {
      console.error("Get payment status error:", error);
      res.status(500).json({
        success: false,
        message: "Failed to get payment status",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }

  static async handleWebhook(req, res) {
    try {
      const webhookSignature = req.headers["x-razorpay-signature"];
      const webhookSecret = process.env.RAZORPAY_WEBHOOK_SECRET;

      if (webhookSecret && webhookSignature) {
        const expectedSignature = crypto
          .createHmac("sha256", webhookSecret)
          .update(JSON.stringify(req.body))
          .digest("hex");

        if (expectedSignature !== webhookSignature) {
          return res.status(400).json({
            success: false,
            message: "Invalid webhook signature",
          });
        }
      }

      const event = req.body.event;
      const paymentEntity = req.body.payload?.payment?.entity;

      if (!paymentEntity) {
        return res.status(400).json({
          success: false,
          message: "Invalid webhook payload",
        });
      }

      // Handle different webhook events
      switch (event) {
        case "payment.captured":
          await Payment.findOneAndUpdate(
            { razorpayPaymentId: paymentEntity.id },
            {
              status: "completed",
              paidAt: new Date(paymentEntity.created_at * 1000),
            }
          );
          break;

        case "payment.failed":
          await Payment.findOneAndUpdate(
            { razorpayOrderId: paymentEntity.order_id },
            {
              status: "failed",
              failureReason:
                paymentEntity.error_description || "Payment failed",
            }
          );
          break;

        default:
          console.log("Unhandled webhook event:", event);
      }

      res.json({ success: true });
    } catch (error) {
      console.error("Webhook error:", error);
      res.status(500).json({
        success: false,
        message: "Webhook processing failed",
        error:
          process.env.NODE_ENV === "development"
            ? error.message
            : "Internal server error",
      });
    }
  }
}

module.exports = PaymentController;
