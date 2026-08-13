const mongoose = require('mongoose');

const stockSchema = new mongoose.Schema({
  productId: { type: String, required: true },
  productName: { type: String, default: '' },
  subProduct: { type: String, default: '' },
  content: { type: String, required: true },
  status: { type: String, enum: ['AVAILABLE', 'SOLD'], default: 'AVAILABLE' },
  soldToUserId: { type: String, default: null },
  soldToUserName: { type: String, default: null },
  soldToUserPhone: { type: String, default: null },
  orderId: { type: String, default: null },
  soldAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Stock', stockSchema);
