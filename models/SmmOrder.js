const mongoose = require('mongoose');

const smmOrderSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  orderId: { type: String, required: true }, // SMM Provider orderId or Local SMM-ID
  providerOrderId: { type: String, default: '' },
  userId: { type: String, default: 'guest' },
  userName: { type: String, required: true },
  userPhone: { type: String, default: '' },
  userEmail: { type: String, default: '' },
  platform: { type: String, required: true }, // youtube, instagram, facebook, telegram
  serviceKey: { type: String, required: true },
  serviceName: { type: String, required: true },
  serviceId: { type: Number, default: 0 },
  tier: { type: String, default: '' },
  targetUrl: { type: String, required: true },
  quantity: { type: Number, required: true },
  rate: { type: Number, required: true }, // rate per 1000
  totalCost: { type: Number, required: true },
  customComments: { type: String, default: '' },
  paymentMethod: { type: String, default: 'UPI' }, // UPI, BEP20, WEB3, WALLET, MANUAL
  paymentStatus: { type: String, default: 'PAID' }, // PAID, PENDING, PENDING_UPI_VERIFICATION
  txHash: { type: String, default: '' },
  utrId: { type: String, default: '' },
  status: { type: String, default: 'Processing' }, // Processing, In Progress, Completed, Partial, Canceled, Refunded
  remains: { type: Number, default: 0 },
  startCount: { type: Number, default: 0 },
  refillable: { type: Boolean, default: false },
  refillStatus: { type: String, default: 'Eligible' }, // Eligible, Requested, In Progress, Completed, Not Supported
  refillId: { type: String, default: '' },
  lastRefillAt: { type: Date },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('SmmOrder', smmOrderSchema);
