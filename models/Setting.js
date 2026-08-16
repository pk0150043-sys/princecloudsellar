const mongoose = require('mongoose');

const settingSchema = new mongoose.Schema({
  ownerPhone: { type: String, default: '+91 9507325677' },
  ownerUpiId: { type: String, default: '9507325677-1@naviaxis' },
  ownerWhatsApp: { type: String, default: '9507325677' },
  supportUrl: { type: String, default: 'https://wa.me/919507325677' },
  whatsappBotUrl: { type: String, default: '' },
  telegramBotUrl: { type: String, default: '' },
  whatsappGroupUrl: { type: String, default: '' },
  telegramGroupUrl: { type: String, default: '' },
  smmProviderUrl: { type: String, default: 'https://indiansmmhub.com/api/v2' },
  smmApiKey: { type: String, default: 'be0066920ea511dc79addd45a1c7bb554fca5798' },
  smmProfitMargin: { type: Number, default: 1.30 },
  customServiceRates: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Setting', settingSchema);
