// const mongoose = require('mongoose');

// const orderItemSchema = new mongoose.Schema({
//   foodId: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Food',
//     required: true
//   },
//   name: {
//     type: String,
//     required: true
//   },
//   price: {
//     type: Number,
//     required: true
//   },
//   quantity: {
//     type: Number,
//     required: true,
//     min: 1
//   }
// });

// const orderSchema = new mongoose.Schema({
//   orderNumber: {
//     type: String,
//     required: true,
//     unique: true
//   },
//   customer: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'User',
//     required: true
//   },
//   restaurant: {
//     type: mongoose.Schema.Types.ObjectId,
//     ref: 'Restaurant',
//     required: true
//   },
//   customerName: {
//     type: String,
//     required: true
//   },
//   customerPhone: {
//     type: String,
//     required: true
//   },
//   customerAddress: {
//     type: String
//   },
//   items: [orderItemSchema],
//   totalAmount: {
//     type: Number,
//     required: true
//   },
//   status: {
//     type: String,
//     enum: ['pending', 'preparing', 'ready', 'delivered', 'cancelled'],
//     default: 'pending'
//   },
//   // orderType: {
//   //   type: String,
//   //   enum: ['dine-in', 'takeaway', 'delivery'],
//   //   default: 'dine-in'
//   // }
// }, {
//   timestamps: true
// });

// // Generate order number before saving
// orderSchema.pre('save', async function(next) {
//   if (!this.orderNumber) {
//     const date = new Date();
//     const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
//     const count = await mongoose.model('Order').countDocuments({
//       createdAt: {
//         $gte: new Date(date.setHours(0, 0, 0, 0)),
//         $lt: new Date(date.setHours(23, 59, 59, 999))
//       }
//     });
//     this.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;
//   }
//   next();
// });

// module.exports = mongoose.model('Order', orderSchema);

const mongoose = require("mongoose");

const orderItemSchema = new mongoose.Schema({
  foodId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: "Food",
    required: true,
  },
  name: {
    type: String,
    required: true,
  },
  price: {
    type: Number,
    required: true,
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
  },
});

const orderSchema = new mongoose.Schema(
  {
    orderNumber: {
      type: String,
      required: true,
      unique: true,
    },
    customer: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "User",
      required: true,
    },
    restaurant: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Restaurant",
      required: true,
    },
    customerName: {
      type: String,
      required: true,
    },
    customerPhone: {
      type: String,
      required: true,
    },
    customerAddress: {
      type: String,
    },
    items: [orderItemSchema],
    totalAmount: {
      type: Number,
      required: true,
    },
    status: {
      type: String,
      enum: ["new", "delivered"],
      default: "new",
    },

    // Payment related fields
    paymentId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: "Payment",
    },
    paymentStatus: {
      type: String,
      enum: ["pending", "paid", "failed", "refunded"],
      default: "pending",
    },
    paymentMethod: {
      type: String,
      enum: ["online", "cod"], // cash on delivery or online
      default: "online",
    },

    // Order type (if you want to add this later)
    // orderType: {
    //   type: String,
    //   enum: ['dine-in', 'takeaway', 'delivery'],
    //   default: 'dine-in'
    // }
  },
  {
    timestamps: true,
  }
);

// Generate order number before saving
// orderSchema.pre('save', async function(next) {
//   if (!this.orderNumber) {
//     const date = new Date();
//     const dateStr = date.toISOString().slice(0, 10).replace(/-/g, '');
//     const count = await mongoose.model('Order').countDocuments({
//       createdAt: {
//         $gte: new Date(date.setHours(0, 0, 0, 0)),
//         $lt: new Date(date.setHours(23, 59, 59, 999))
//       }
//     });
//     this.orderNumber = `ORD-${dateStr}-${String(count + 1).padStart(3, '0')}`;
//   }
//   next();
// });

// Method to update status with timestamp tracking
orderSchema.methods.updateStatus = function (newStatus) {
  this.status = newStatus;

  if (newStatus === "delivered") {
    this.actualDeliveryTime = new Date();
  }

  return this.save();
};

module.exports = mongoose.model("Order", orderSchema);
