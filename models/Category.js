const mongoose = require('mongoose');

const categorySchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    trim: true,
    maxlength: 50
  },
  restaurant: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Restaurant',
    required: true
  },
  isActive: {
    type: Boolean,
    default: true
  }
}, {
  timestamps: true
});

// Compound index to ensure unique category names per restaurant
categorySchema.index({ name: 1, restaurant: 1 }, { unique: true });

// Index for better query performance
categorySchema.index({ restaurant: 1, isActive: 1 });

module.exports = mongoose.model('Category', categorySchema);