const mongoose = require('mongoose');

const restaurantApplicationSchema = new mongoose.Schema({
  // Restaurant Details
  name: {
    type: String,
    required: true,
    trim: true
  },
  description: {
    type: String,
    required: true
  },
  address: {
    type: String,
    required: true
  },
  phone: {
    type: String,
    required: true
  },
  cuisine: {
    type: String,
    default: 'General'
  },
  image: {
    type: String // Cloudinary URL
  },
  
  // Owner Details
  ownerName: {
    type: String,
    required: true
  },
  ownerEmail: {
    type: String,
    required: true,
    lowercase: true,
    trim: true
  },
  ownerPhone: {
    type: String
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
  
  // Admin Notes
  adminNotes: {
    type: String
  },
  
  // Timestamps
  appliedAt: {
    type: Date,
    default: Date.now
  },
  reviewedAt: {
    type: Date
  },
  reviewedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User' // Admin who reviewed
  }
}, {
  timestamps: true
});

module.exports = mongoose.model('RestaurantApplication', restaurantApplicationSchema);