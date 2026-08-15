const mongoose = require('mongoose');

const userSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  phone: { type: String, required: true },
  email: { type: String, required: true, unique: true },
  password: { type: String, required: true },
  telegramId: { type: String, default: '' },
  whatsappNumber: { type: String, default: '' },
  status: { type: String, enum: ['active', 'blocked'], default: 'active' },
  lastOtpVerifiedAt: { type: Date, default: null },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('User', userSchema);
