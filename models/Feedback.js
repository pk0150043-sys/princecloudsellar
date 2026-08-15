const mongoose = require('mongoose');

const feedbackSchema = new mongoose.Schema({
  _id: { type: String, default: () => new mongoose.Types.ObjectId().toString() },
  userId: { type: String, default: '' },
  userName: { type: String, required: true },
  userEmail: { type: String, default: '' },
  rating: { type: Number, required: true, min: 1, max: 5, default: 5 },
  productName: { type: String, default: '' },
  title: { type: String, required: true },
  comment: { type: String, required: true },
  createdAt: { type: Date, default: Date.now }
}, { _id: false });

module.exports = mongoose.model('Feedback', feedbackSchema);
