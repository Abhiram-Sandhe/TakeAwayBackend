const mongoose = require('mongoose');

const cartItemSchema = new mongoose.Schema({
  food: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Food',
    required: true
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1,
    default: 1
  },
  price: {
    type: Number,
    required: true
  },
  specialInstructions: {
    type: String,
    maxlength: 500,
    default: ''
  }
}, {
  _id: false,
  timestamps: true
});

const cartSchema = new mongoose.Schema({
  user: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    default: null // null for guest users
  },
  sessionId: {
    type: String,
    required: function() {
      return !this.user; // sessionId required only for guest users
    },
    index: true
  },
  items: [cartItemSchema],
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    default: null // All items must be from same restaurant
  },
  totalAmount: {
    type: Number,
    default: 0
  },
  itemCount: {
    type: Number,
    default: 0
  },
  isActive: {
    type: Boolean,
    default: true
  },
  expiresAt: {
    type: Date,
    default: function() {
      // Guest carts expire after 24 hours, user carts after 7 days
      const hours = this.user ? 24 * 7 : 24;
      return new Date(Date.now() + hours * 60 * 60 * 1000);
    }
  }
}, {
  timestamps: true
});

// Index for automatic deletion of expired carts
cartSchema.index({ expiresAt: 1 }, { expireAfterSeconds: 0 });

// Compound indexes for efficient queries
cartSchema.index({ user: 1, isActive: 1 });
cartSchema.index({ sessionId: 1, isActive: 1 });

// Calculate totals before saving
cartSchema.pre('save', function(next) {
  this.itemCount = this.items.reduce((total, item) => total + item.quantity, 0);
  this.totalAmount = this.items.reduce((total, item) => total + (item.price * item.quantity), 0);
  
  // Set restaurant from first item
  if (this.items.length > 0 && !this.restaurant) {
    this.restaurant = this.items[0].restaurant;
  }
  
  next();
});

module.exports = mongoose.model('Cart', cartSchema);