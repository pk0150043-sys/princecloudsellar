const mongoose = require('mongoose');

const smmServiceSchema = new mongoose.Schema({
  _id: { type: String, required: true }, // e.g. "yt_subs_nondrop"
  serviceKey: { type: String, required: true, unique: true },
  serviceId: { type: Number, required: true }, // SMM Provider numeric ID
  platform: { type: String, required: true, enum: ['youtube', 'instagram', 'facebook', 'telegram', 'other'] },
  category: { type: String, required: true }, // Subscribers, Followers, Likes, Comments, Members
  name: { type: String, required: true },
  tier: { type: String, required: true }, // Tier 1: 100% Non-Drop, Tier 2: 5% Low Drop, Tier 3: 10% Standard Drop
  rate: { type: Number, required: true }, // Rate per 1000 in INR
  min: { type: Number, required: true, default: 50 },
  max: { type: Number, required: true, default: 100000 },
  refill: { type: Boolean, default: false },
  refillDays: { type: Number, default: 0 }, // 0 = lifetime/none, 30, 60, 365
  description: { type: String, default: '' },
  active: { type: Boolean, default: true },
  createdAt: { type: Date, default: Date.now },
  updatedAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('SmmService', smmServiceSchema);
