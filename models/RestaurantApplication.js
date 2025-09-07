const mongoose = require('mongoose');

const restaurantApplicationSchema = new mongoose.Schema({
  // Restaurant Information
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true,
    trim: true
  },
  address: {
    type: String,
    required: true,
    trim: true
  },
  phone: {
    type: String,
    required: true,
    trim: true
  },
  cuisine: {
    type: String,
    trim: true,
    default: 'General'
  },
  image: {
    type: String,
    trim: true
  },

  // Owner Information
  ownerName: {
    type: String,
    required: true,
    trim: true
  },
  ownerEmail: {
    type: String,
    required: true,
    trim: true,
    lowercase: true
  },
  ownerPhone: {
    type: String,
    trim: true
  },
  ownerPassword: {
    type: String,
    required: true
  },

  // Application Status
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected'],
    default: 'pending'
  },
  
  // Timestamps
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },

  // Admin Review Information
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Reference to admin who reviewed
  },
  adminNotes: {
    type: String,
    trim: true
  },

  // References to created entities (when approved)
  createdUser: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Reference to the User created when application is approved
  },
  createdRestaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant' // Reference to the Restaurant created when application is approved
  }
}, {
  timestamps: true // This adds createdAt and updatedAt automatically
});

module.exports = mongoose.model('RestaurantApplication', restaurantApplicationSchema);