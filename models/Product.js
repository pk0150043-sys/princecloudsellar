const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  name: { type: String, required: true },
  subProduct: { type: String, default: '' },
  country: { type: String, default: '🌐 Global' },
  price: { type: Number, required: true },
  stock: { type: Number, default: 0 },
  description: { type: String, default: '' },
  bep20Address: { type: String, default: '' },
  offer: { type: String, default: '' },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Product', productSchema);
