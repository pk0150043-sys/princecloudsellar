const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  recipientType: { type: String, enum: ['ALL', 'USER'], default: 'ALL' },
  userId: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  title: { type: String, required: true },
  message: { type: String, required: true },
  type: { type: String, enum: ['BROADCAST', 'ORDER_DISPATCH', 'STOCK_ALERT', 'TICKET_REPLY', 'PROMO'], default: 'BROADCAST' },
  orderId: { type: String, default: '' },
  deliveredItem: { type: String, default: '' },
  isRead: { type: Boolean, default: false },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Notification', notificationSchema);
