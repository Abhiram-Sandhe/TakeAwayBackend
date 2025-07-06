const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  customer: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  restaurant: { type: mongoose.Schema.Types.ObjectId, ref: 'Restaurant', required: true },
  items: [{
    food: { type: mongoose.Schema.Types.ObjectId, ref: 'Food', required: true },
    quantity: { type: Number, required: true },
    price: { type: Number, required: true }
  }],
  totalAmount: { type: Number, required: true },
  status: { type: String, enum: ['pending', 'accepted', 'preparing', 'ready', 'delivered', 'rejected'], default: 'pending' },
  deliveryAddress: { type: String, required: true },
  customerPhone: { type: String, required: true }
}, { timestamps: true });

module.exports = mongoose.model('Order', orderSchema);