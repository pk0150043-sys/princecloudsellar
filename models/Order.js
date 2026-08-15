const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
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
  paymentMethod: { type: String, default: 'BEP20' }, // 'BEP20', 'UPI', 'WEB3', 'MANUAL_DISPATCH'
  paymentStatus: { type: String, default: 'PAID' }, // 'PAID', 'PENDING', 'PENDING_UPI_VERIFICATION', 'PAID (UPI)', 'PAID (TELEGRAM BOT)', 'PAID (WHATSAPP BOT)', 'PAID (OWNER DIRECT DISPATCH)'
  utrId: { type: String, default: '' },
  txHash: { type: String, default: '' },
  deliveryStatus: { type: String, default: 'PENDING_DELIVERY' }, // 'DELIVERED', 'PENDING_DELIVERY', 'PENDING_APPROVAL', 'REJECTED'
  deliveredItem: { type: String, default: '' },
  source: { type: String, enum: ['WEB', 'TELEGRAM', 'WHATSAPP', 'OWNER_DIRECT'], default: 'WEB' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Order', orderSchema);
