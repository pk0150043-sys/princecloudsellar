const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  name: { type: String, required: true }, // Main Product, e.g. "Azure", "Gmail", "GCP"
  subProduct: { type: String, default: '' }, // Sub-Product, e.g. "Azure Pay As You Go Direct Acc"
  country: { type: String, default: '🌐 Global' }, // e.g. "🇺🇸 United States", "🇮🇳 India"
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  description: { type: String, default: '' },
  bep20Address: { type: String, default: '' },
  offer: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
});

module.exports = mongoose.model('Product', productSchema);
