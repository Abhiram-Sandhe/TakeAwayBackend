const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  // Razorpay identifiers
  razorpayOrderId: {
    type: String,
    required: true,
    unique: true
  },
  razorpayPaymentId: {
    type: String,
    sparse: true // Allows null/undefined but enforces uniqueness when present
  },
  razorpaySignature: {
    type: String
  },

  // User and restaurant references
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },

  // Payment details
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'INR'
  },
  status: {
    type: String,
    enum: ['created', 'pending', 'completed', 'failed', 'cancelled'],
    default: 'created'
  },

  // Timestamps
  paidAt: {
    type: Date
  },
  failureReason: {
    type: String
  },

  // Store cart data at the time of payment creation
  cartData: {
    items: [{
      foodId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Food',
        required: true
      },
      name: {
        type: String,
        required: true
      },
      price: {
        type: Number,
        required: true
      },
      quantity: {
        type: Number,
        required: true,
        min: 1
      },
    }],
    totalAmount: {
      type: Number,
      required: true
    },
    customerPhone: {
      type: String
    },
  },

  // Order reference (populated after successful payment)
  order: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order'
  },

  // Additional metadata
  metadata: {
    type: mongoose.Schema.Types.Mixed,
    default: {}
  }
}, {
  timestamps: true
});


// Virtual for payment age
paymentSchema.virtual('paymentAge').get(function() {
  return Date.now() - this.createdAt.getTime();
});

// Method to check if payment is expired (30 minutes)
paymentSchema.methods.isExpired = function() {
  const EXPIRY_TIME = 30 * 60 * 1000; // 30 minutes in milliseconds
  return this.paymentAge > EXPIRY_TIME && this.status === 'created';
};


// Pre-save middleware
paymentSchema.pre('save', function(next) {
  // Ensure amount is positive
  if (this.amount < 0) {
    throw new Error('Payment amount cannot be negative');
  }
  
  // Set paidAt when status changes to completed
  if (this.status === 'completed' && !this.paidAt) {
    this.paidAt = new Date();
  }
  
  next();
});

module.exports = mongoose.model('Payment', paymentSchema);