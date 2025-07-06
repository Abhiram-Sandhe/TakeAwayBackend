const mongoose = require('mongoose');

const restaurantSchema = new mongoose.Schema({
  name: { 
    type: String, 
    required: true,
    trim: true
  },
  owner: { 
    type: mongoose.Schema.Types.ObjectId, 
    ref: 'User', 
    required: true 
  },
  description: {
    type: String,
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
    trim: true
  },
  image: {
    type: String,
    trim: true
  },
  rating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  isActive: { 
    type: Boolean, 
    default: true 
  },
  // openingHours: {
  //   open: {
  //     type: String,
  //     default: '09:00'
  //   },
  //   close: {
  //     type: String,
  //     default: '22:00'
  //   }
  // }
}, { 
  timestamps: true 
});

module.exports = mongoose.model('Restaurant', restaurantSchema);