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
  defaultBep20Address: { type: String, default: '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2' },
  smmProviderUrl: { type: String, default: 'https://peakerr.com/api/v2' },
  smmApiKey: { type: String, default: '' },
  peakerrProfitMargin: { type: Number, default: 1.45 },
  peakerrUsdToInr: { type: Number, default: 88.0 },
  customServiceRates: { type: mongoose.Schema.Types.Mixed, default: {} },
  updatedAt: { type: Date, default: Date.now }
}, { strict: false });

module.exports = mongoose.model('Setting', settingSchema);
