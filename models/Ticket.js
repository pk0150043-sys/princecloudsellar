const mongoose = require('mongoose');

const ticketSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  userId: { type: String, default: '' },
  userName: { type: String, required: true },
  userPhone: { type: String, required: true },
  userEmail: { type: String, required: true },
  category: { 
    type: String, 
    enum: ['KEY_REPLACEMENT', 'LOGIN_CREDENTIALS', 'CONFIG_HELP', 'PAYMENT_UNDERPAID', 'PAYMENT_OVERPAID', 'KEY_NOT_DELIVERED', 'CUSTOM_PROBLEM'],
    default: 'KEY_REPLACEMENT'
  },
  customProblem: { type: String, default: '' },
  orderId: { type: String, default: '' },
  productId: { type: String, default: '' },
  productName: { type: String, default: '' },
  subProduct: { type: String, default: '' },
  country: { type: String, default: '' },
  amountPaid: { type: String, default: '' },
  txHash: { type: String, default: '' },
  subject: { type: String, required: true },
  message: { type: String, required: true },
  status: { type: String, enum: ['PENDING', 'IN_PROGRESS', 'RESOLVED', 'REJECTED'], default: 'PENDING' },
  ownerReply: { type: String, default: '' },
  resolvedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Ticket', ticketSchema);
