const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  userId: { type: String, required: true },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  productId: { type: String, required: true },
  productName: { type: String, required: true },
  subProduct: { type: String, default: '' },
  country: { type: String, default: '🌐 Global' },
  quantity: { type: Number, required: true, default: 1 },
  unitPrice: { type: Number, required: true },
  totalPaid: { type: Number, required: true },
  paymentStatus: { type: String, enum: ['PAID', 'PENDING', 'VERIFIED'], default: 'PAID' },
  txHash: { type: String, default: '' },
  deliveryStatus: { type: String, enum: ['DELIVERED', 'PENDING_DELIVERY'], default: 'PENDING_DELIVERY' },
  deliveredItem: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Order', orderSchema);
