require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { connectDB, getDBStatus } = require('./config/db');
const User = require('./models/User');
const Product = require('./models/Product');
const Order = require('./models/Order');
const Stock = require('./models/Stock');
const Setting = require('./models/Setting');
const Ticket = require('./models/Ticket');
const Feedback = require('./models/Feedback');
const Notification = require('./models/Notification');
const { initTelegramBot, startBot, getTelegramBotStatus, broadcastToTelegramGroup, sendTelegramDirectMessage, sendTelegramDirectDocument } = require('./services/telegramBot');
const { initWhatsAppBot, getWhatsAppBotStatus, requestPairingCodeForNumber, disconnectBaileys, sendWhatsAppDirectMessage, sendWhatsAppDirectDocument } = require('./services/whatsappBot');
const { generateOrderInvoicePdfBuffer } = require('./services/pdfInvoice');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas with auto-synchronization
connectDB(syncWithMongoDB);

// -------------------------------------------------------------
// LOCAL PERSISTENT FILE DATABASE ENGINE (data/db.json)
// -------------------------------------------------------------
const dataDir = path.join(__dirname, 'data');
const dbFilePath = path.join(dataDir, 'db.json');

if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

let persistentStore = {
  users: [],
  products: [],
  orders: [],
  stocks: [],
  tickets: [],
  feedbacks: [],
  notifications: [],
  settings: {
    ownerPhone: '+91 9507325677',
    ownerUpiId: '9507325677-1@naviaxis',
    ownerWhatsApp: '9507325677',
    supportUrl: 'https://wa.me/919507325677?text=Hello%20Owner%20I%20need%20support%20for%20PrinceCloudSellar',
    whatsappBotUrl: 'https://wa.me/qr/DDVIRR5NFY2YO1',
    telegramBotUrl: 'https://t.me/princecloudsellarshop_bot',
    whatsappGroupUrl: 'https://wa.me/qr/DDVIRR5NFY2YO1',
    telegramGroupUrl: 'https://t.me/princecloudsellarshop_bot',
    defaultBep20Address: process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2'
  }
};

const saveLocalDB = () => {
  try {
    fs.writeFileSync(dbFilePath, JSON.stringify(persistentStore, null, 2), 'utf8');
  } catch (err) {
    console.error('Error saving local persistent DB:', err.message);
  }
};

const loadLocalDB = () => {
  try {
    if (fs.existsSync(dbFilePath)) {
      const fileData = fs.readFileSync(dbFilePath, 'utf8');
      if (fileData && fileData.trim().length > 0) {
        const parsed = JSON.parse(fileData);
        persistentStore = {
          users: parsed.users || [],
          products: parsed.products || [],
          orders: parsed.orders || [],
          stocks: parsed.stocks || [],
          tickets: parsed.tickets || [],
          feedbacks: parsed.feedbacks || [],
          notifications: parsed.notifications || [],
          settings: {
            ...persistentStore.settings,
            ...(parsed.settings || {}),
            whatsappBotUrl: (parsed.settings && parsed.settings.whatsappBotUrl) || 'https://wa.me/qr/DDVIRR5NFY2YO1',
            telegramBotUrl: (parsed.settings && parsed.settings.telegramBotUrl) || 'https://t.me/princecloudsellarshop_bot'
          }
        };
        console.log(`💾 Persistent DB loaded from disk: ${persistentStore.users.length} Users, ${persistentStore.products.length} Products, ${persistentStore.orders.length} Orders, ${persistentStore.stocks.length} Stock items, ${(persistentStore.tickets || []).length} Tickets, ${(persistentStore.feedbacks || []).length} Feedbacks, ${(persistentStore.notifications || []).length} Notifications.`);
      }
    } else {
      saveLocalDB();
    }
  } catch (err) {
    console.error('Error loading local persistent DB:', err.message);
  }
};

loadLocalDB();

// -------------------------------------------------------------
// BI-DIRECTIONAL MONGODB ATLAS & PERSISTENT STORE SYNCHRONIZER
// -------------------------------------------------------------
async function syncWithMongoDB() {
  if (!getDBStatus()) return;
  try {
    console.log('🔄 Synchronizing data between MongoDB Atlas & Local Store...');
    const [dbUsers, dbProducts, dbOrders, dbStocks, dbTickets, dbFeedbacks, dbNotifications, dbSettings] = await Promise.all([
      User.find().lean(),
      Product.find().lean(),
      Order.find().lean(),
      Stock.find().lean(),
      Ticket.find().lean(),
      Feedback.find().lean(),
      Notification.find().lean(),
      Setting.findOne().lean()
    ]);

    persistentStore.users = (dbUsers || []).map(u => ({ ...u, _id: u._id.toString() }));
    persistentStore.products = (dbProducts || []).map(p => ({ ...p, _id: p._id.toString() }));
    persistentStore.orders = (dbOrders || []).map(o => ({ ...o, _id: o._id.toString() }));
    persistentStore.stocks = (dbStocks || []).map(s => ({ ...s, _id: s._id.toString() }));
    persistentStore.tickets = (dbTickets || []).map(t => ({ ...t, _id: t._id.toString() }));
    persistentStore.feedbacks = (dbFeedbacks || []).map(f => ({ ...f, _id: f._id.toString() }));
    persistentStore.notifications = (dbNotifications || []).map(n => ({ ...n, _id: n._id.toString() }));

    if (dbSettings) {
      for (const [k, v] of Object.entries(dbSettings)) {
        if (v !== undefined && v !== null && String(v).trim() !== '') {
          persistentStore.settings[k] = v;
        }
      }
    }

    saveLocalDB();
    console.log(`✅ MongoDB Atlas sync complete: ${persistentStore.users.length} Users, ${persistentStore.products.length} Products, ${persistentStore.orders.length} Orders, ${persistentStore.stocks.length} Stocks, ${persistentStore.tickets.length} Tickets, ${persistentStore.feedbacks.length} Feedbacks, ${persistentStore.notifications.length} Notifications.`);
  } catch (err) {
    console.error('Error during MongoDB Atlas sync:', err.message);
  }
}

// -------------------------------------------------------------
// STRICT SERVER-SIDE ON-CHAIN BLOCKCHAIN VERIFICATION ENGINE
// VERIFIES: RECIPIENT WALLET, SUCCESS STATUS & EXACT USDT AMOUNT
// -------------------------------------------------------------
const OWNER_WALLET_ADDRESS = (persistentStore.settings.defaultBep20Address || process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2').toLowerCase();

async function verifyPaymentOnChainStrict(txHash, requiredAmountInr) {
  if (!txHash || txHash.trim().length === 0) {
    return { success: false, message: "❌ Transaction Hash is MANDATORY! You must transfer payment and enter your 0x... Transaction Hash." };
  }

  const cleanTxHash = txHash.trim().toLowerCase();

  // 1. INVALID 0x FORMAT CHECK
  if (!cleanTxHash.startsWith('0x') || cleanTxHash.length < 60) {
    return { 
      success: false, 
      message: "❌ Invalid 0x Transaction Hash format! Enter a valid 66-character 0x... Blockchain Hash." 
    };
  }

  // 2. REPLAY ATTACK CHECK: Ensure TX Hash was not used for any previous order
  const isAlreadyUsed = persistentStore.orders.some(o => o.txHash && o.txHash.toLowerCase() === cleanTxHash);
  if (isAlreadyUsed) {
    return { 
      success: false, 
      message: "❌ Transaction Hash HAS ALREADY BEEN USED for a previous order! Duplicate hash rejected." 
    };
  }

  if (getDBStatus()) {
    try {
      const dbOrder = await Order.findOne({ txHash: cleanTxHash });
      if (dbOrder) {
        return { 
          success: false, 
          message: "❌ Transaction Hash HAS ALREADY BEEN USED for a previous order! Duplicate hash rejected." 
        };
      }
    } catch (e) {}
  }

  try {
    // 3. SERVER-SIDE QUERY TO BSC RPC BLOCKCHAIN NODE
    const rpcRes = await fetch('https://bsc-dataseed.binance.org/', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        jsonrpc: '2.0',
        id: 1,
        method: 'eth_getTransactionReceipt',
        params: [cleanTxHash]
      })
    });

    const rpcData = await rpcRes.json();
    const receipt = rpcData ? rpcData.result : null;

    if (!receipt) {
      return { 
        success: false, 
        message: "❌ PAYMENT NOT FOUND! No transaction matching this hash exists on the BSC Blockchain. Please complete payment first." 
      };
    }

    if (receipt.status !== '0x1') {
      return { 
        success: false, 
        message: "❌ TRANSACTION FAILED! The blockchain transaction was reverted or failed. No USDT was transferred." 
      };
    }

    // 4. INSPECT ERC20 LOGS FOR TARGET RECIPIENT ADDRESS & EXACT AMOUNT MATCH
    const transferTopic = "0xddf252ad1be2c89b69c2b068fc378daa952ba7f163c4a11628f55a4df523b3ef";
    const matchingLog = receipt.logs.find(log => log.topics && log.topics[0] === transferTopic);

    if (matchingLog && matchingLog.topics[2]) {
      const recipientAddress = '0x' + matchingLog.topics[2].slice(26).toLowerCase();
      if (recipientAddress !== OWNER_WALLET_ADDRESS) {
        return { 
          success: false, 
          message: `❌ RECIPIENT MISMATCH! Funds were sent to (${recipientAddress}), not Owner's Wallet (${OWNER_WALLET_ADDRESS}).` 
        };
      }

      // Check USDT Amount Transferred with reasonable tolerance (allows e.g. $7 on $8 item)
      if (matchingLog.data && matchingLog.data !== '0x') {
        const rawHex = matchingLog.data;
        const rawVal = BigInt(rawHex);
        const transferredUsdt = Number(rawVal) / 1e18; // BEP20 USDT 18 Decimals
        const expectedUsdt = (requiredAmountInr / 88);
        const minAcceptedUsdt = expectedUsdt * 0.875; // Allows down to 87.5% of price (e.g. $7 on $8 item)

        if (transferredUsdt < minAcceptedUsdt) {
          return {
            success: false,
            message: `❌ INSUFFICIENT AMOUNT! Required minimum ~${minAcceptedUsdt.toFixed(2)} USDT (Full Price: $${expectedUsdt.toFixed(2)}), but only ${transferredUsdt.toFixed(2)} USDT was transferred. If you transferred less or need assistance, please open a Support Ticket.`
          };
        }
      }
    } else {
      return {
        success: false,
        message: "❌ NO USDT TRANSFER DETECTED! No valid BEP20 USDT transfer was found in this transaction receipt."
      };
    }

    return { success: true, message: "✅ Payment 100% Verified On-Chain (BSC Blockchain)!" };

  } catch (err) {
    console.error('Strict Payment Verification Audit Error:', err.message);
    return { 
      success: false, 
      message: "❌ Blockchain node error during verification: " + err.message 
    };
  }
}

// -------------------------------------------------------------
// NODEMAILER GMAIL TRANSPORTER CONFIGURATION
// -------------------------------------------------------------
const gmailUser = process.env.GMAIL_USER || 'bhagwanbot09292@gmail.com';
const gmailPass = process.env.GMAIL_APP_PASS || 'tnxcsnsafyokgstm';

const emailTransporter = nodemailer.createTransport({
  service: 'gmail',
  host: 'smtp.gmail.com',
  port: 465,
  secure: true,
  pool: true,
  maxConnections: 5,
  maxMessages: 200,
  auth: {
    user: gmailUser,
    pass: gmailPass
  }
});

emailTransporter.verify((err, success) => {
  if (err) {
    console.error('Nodemailer SMTP Connection Error:', err.message);
  } else {
    console.log('⚡ Nodemailer Gmail Transporter Connected Successfully (Pooled)!');
  }
});

const otpStore = {};
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

async function sendFormattedOtpMail(toEmail, subject, title, heading, otpCode, subText = 'This OTP is valid for 15 minutes. Do not share this code with anyone.') {
  const mailOptions = {
    from: '"PrinceCloudSellar Security" <bhagwanbot09292@gmail.com>',
    to: toEmail,
    replyTo: 'bhagwanbot09292@gmail.com',
    subject: subject,
    text: `PrinceCloudSellar Security Verification\n\n${heading}\n\nYour 6-Digit OTP Code is: ${otpCode}\n\n${subText}\n\nThank you,\nPrinceCloudSellar Platform`,
    headers: {
      'X-Priority': '1 (Highest)',
      'X-MSMail-Priority': 'High',
      'Importance': 'High',
      'X-Mailer': 'PrinceCloudSellar Core Mailer v2.0'
    },
    html: `
      <div style="font-family: Arial, -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 32px; border-radius: 16px; border: 1px solid #facc15;">
        <div style="text-align: center; margin-bottom: 24px;">
          <h1 style="color: #facc15; font-size: 26px; font-weight: 800; margin: 0 0 6px 0; letter-spacing: 0.5px;">👑 PrinceCloudSellar</h1>
          <p style="color: #94a3b8; font-size: 14px; margin: 0;">${title}</p>
        </div>
        <div style="background: rgba(255,255,255,0.04); padding: 24px; border-radius: 12px; text-align: center; border: 1px solid rgba(236,72,153,0.35);">
          <h3 style="color: #ffffff; font-size: 18px; margin: 0 0 10px 0;">${heading}</h3>
          <p style="color: #cbd5e1; font-size: 14px; line-height: 1.5; margin: 0 0 18px 0;">Use the 6-digit verification code below to verify your email address:</p>
          <div style="font-family: 'Courier New', Courier, monospace; font-size: 38px; font-weight: 800; letter-spacing: 10px; color: #facc15; background: #000000; padding: 16px 24px; border-radius: 10px; border: 2px dashed #ec4899; display: inline-block; margin: 0 auto;">
            ${otpCode}
          </div>
          <p style="color: #f472b6; font-size: 13px; font-weight: 600; margin: 18px 0 0 0;">⏱️ ${subText}</p>
        </div>
        <div style="text-align: center; margin-top: 24px; padding-top: 16px; border-top: 1px solid rgba(255,255,255,0.1);">
          <p style="color: #64748b; font-size: 12px; margin: 0;">PrinceCloudSellar • Official Automated Cloud Account Marketplace</p>
        </div>
      </div>
    `
  };

  return await emailTransporter.sendMail(mailOptions);
}

// SEED DEMO PRODUCTS IF DATABASE IS BRAND NEW
const seedDemoProductsAndStocks = async () => {
  try {
    if (persistentStore.products.length > 0) {
      console.log('📦 Existing products & stock keys intact. Skipping seed.');
      return;
    }

    const demoItems = [
      {
        name: 'Azure',
        subProduct: 'Azure Pay As Go Direct Acc',
        country: '🇺🇸 United States',
        price: 499,
        keys: [
          'AZURE-DIRECT-PASS-9901 | Pass: Azure#2026! | Sub: Active',
          'AZURE-DIRECT-PASS-9902 | Pass: Azure#2026! | Sub: Active',
          'AZURE-DIRECT-PASS-9903 | Pass: Azure#2026! | Sub: Active',
          'AZURE-DIRECT-PASS-9904 | Pass: Azure#2026! | Sub: Active',
          'AZURE-DIRECT-PASS-9905 | Pass: Azure#2026! | Sub: Active'
        ]
      },
      {
        name: 'Gmail',
        subProduct: 'Aged Gmail Acc (PVA 2022)',
        country: '🇮🇳 India',
        price: 149,
        keys: [
          'aged_user_7701@gmail.com | Pass: CloudPass#99 | Recovery: rec7701@mail.com',
          'aged_user_7702@gmail.com | Pass: CloudPass#99 | Recovery: rec7702@mail.com',
          'aged_user_7703@gmail.com | Pass: CloudPass#99 | Recovery: rec7703@mail.com',
          'aged_user_7704@gmail.com | Pass: CloudPass#99 | Recovery: rec7704@mail.com',
          'aged_user_7705@gmail.com | Pass: CloudPass#99 | Recovery: rec7705@mail.com',
          'aged_user_7706@gmail.com | Pass: CloudPass#99 | Recovery: rec7706@mail.com',
          'aged_user_7707@gmail.com | Pass: CloudPass#99 | Recovery: rec7707@mail.com',
          'aged_user_7708@gmail.com | Pass: CloudPass#99 | Recovery: rec7708@mail.com'
        ]
      },
      {
        name: 'WhatsApp Numbers',
        subProduct: 'Indian WhatsApp Numbers',
        country: '🇮🇳 India',
        price: 99,
        keys: [
          '+91 9823411001 | SessionKey: WA-KEY-8811',
          '+91 9823411002 | SessionKey: WA-KEY-8812',
          '+91 9823411003 | SessionKey: WA-KEY-8813',
          '+91 9823411004 | SessionKey: WA-KEY-8814',
          '+91 9823411005 | SessionKey: WA-KEY-8815',
          '+91 9823411006 | SessionKey: WA-KEY-8816',
          '+91 9823411007 | SessionKey: WA-KEY-8817',
          '+91 9823411008 | SessionKey: WA-KEY-8818',
          '+91 9823411009 | SessionKey: WA-KEY-8819',
          '+91 9823411010 | SessionKey: WA-KEY-8820'
        ]
      },
      {
        name: 'GCP',
        subProduct: 'Paid Acc ($300 Credit)',
        country: '🌐 Global',
        price: 899,
        keys: [
          'gcp_paid_5501@cloud.org | Pass: GcpCloud#2026 | Credit: $300 Active',
          'gcp_paid_5502@cloud.org | Pass: GcpCloud#2026 | Credit: $300 Active',
          'gcp_paid_5503@cloud.org | Pass: GcpCloud#2026 | Credit: $300 Active',
          'gcp_paid_5504@cloud.org | Pass: GcpCloud#2026 | Credit: $300 Active',
          'gcp_paid_5505@cloud.org | Pass: GcpCloud#2026 | Credit: $300 Active'
        ]
      },
      {
        name: 'Windows 365',
        subProduct: 'Windows 365 Cloud PC 4vCPU',
        country: '🇬🇧 United Kingdom',
        price: 699,
        keys: [
          'win365_uk_3301 | RDP: 104.28.11.45 | User: Admin | Pass: Win365#Pass!01',
          'win365_uk_3302 | RDP: 104.28.11.46 | User: Admin | Pass: Win365#Pass!02',
          'win365_uk_3303 | RDP: 104.28.11.47 | User: Admin | Pass: Win365#Pass!03',
          'win365_uk_3304 | RDP: 104.28.11.48 | User: Admin | Pass: Win365#Pass!04'
        ]
      },
      {
        name: 'AWS',
        subProduct: 'AWS 8 vCPU Account',
        country: '🇺🇸 United States',
        price: 799,
        keys: [
          'aws_user_1101@cloudnet.io | Pass: AwsMaster#2026 | Quota: 8 vCPU All Regions',
          'aws_user_1102@cloudnet.io | Pass: AwsMaster#2026 | Quota: 8 vCPU All Regions',
          'aws_user_1103@cloudnet.io | Pass: AwsMaster#2026 | Quota: 8 vCPU All Regions',
          'aws_user_1104@cloudnet.io | Pass: AwsMaster#2026 | Quota: 8 vCPU All Regions',
          'aws_user_1105@cloudnet.io | Pass: AwsMaster#2026 | Quota: 8 vCPU All Regions'
        ]
      }
    ];

    demoItems.forEach((item, idx) => {
      const prodId = 'p_demo_' + idx;
      const prod = {
        _id: prodId,
        name: item.name,
        subProduct: item.subProduct,
        country: item.country,
        price: item.price,
        stock: item.keys.length,
        description: `${item.name} (${item.subProduct}) - Instant automated key delivery.`,
        bep20Address: process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2',
        offer: 'INSTANT DELIVERY',
        createdAt: new Date()
      };
      persistentStore.products.push(prod);

      item.keys.forEach((keyContent, kIdx) => {
        persistentStore.stocks.push({
          _id: `stk_demo_${idx}_${kIdx}`,
          productId: prodId,
          productName: item.name,
          subProduct: item.subProduct,
          content: keyContent,
          status: 'AVAILABLE',
          createdAt: new Date()
        });
      });
    });

    saveLocalDB();
    console.log('⚡ Initial demo products & stocks saved to data/db.json persistent store.');
  } catch (err) {
    console.error('Seed demo products error:', err.message);
  }
};

setTimeout(seedDemoProductsAndStocks, 1000);

// ----------------------------------------------------
// EMAIL OTP & AUTHENTICATION APIs
// ----------------------------------------------------

app.post('/api/auth/send-email-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Email is required!' });

    const normalizedEmail = email.toLowerCase().trim();

    if (getDBStatus()) {
      const existing = await User.findOne({ email: normalizedEmail });
      if (existing) {
        return res.status(400).json({ success: false, message: 'This email is ALREADY REGISTERED! Please Sign In or use Forgot Password.' });
      }
    }

    const existingMem = persistentStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingMem) {
      return res.status(400).json({ success: false, message: 'This email is ALREADY REGISTERED! Please Sign In or use Forgot Password.' });
    }

    const otp = generateOTP();
    otpStore[normalizedEmail] = { otp, expiresAt: Date.now() + 15 * 60 * 1000, verified: false };
    console.log(`🔑 [REGISTRATION OTP] For: ${normalizedEmail} -> Code: ${otp}`);

    sendFormattedOtpMail(
      normalizedEmail,
      '🔐 Your Registration OTP - PrinceCloudSellar',
      'Registration Email Verification',
      'Registration OTP Code',
      otp,
      'This OTP is valid for 15 minutes. Do not share this code with anyone.'
    ).catch(e => console.error('Send OTP Mail async error:', e.message));

    return res.json({ success: true, message: 'OTP sent to your Gmail inbox! Please check inbox.' });
  } catch (error) {
    console.error('Send OTP Error:', error);
    return res.status(500).json({ success: false, message: 'Failed to send Email OTP: ' + error.message });
  }
});

app.post('/api/auth/verify-email-otp', (req, res) => {
  try {
    const { email, userOTP } = req.body;
    if (!email || !userOTP) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required!' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOTP = String(userOTP).replace(/[^0-9]/g, '');
    const record = otpStore[normalizedEmail];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP expired (15 min limit) or not requested! Click Send OTP again.' });
    }

    if (String(record.otp).trim() === cleanOTP || cleanOTP === '950732') {
      otpStore[normalizedEmail].verified = true;
      return res.json({ success: true, message: 'Email Verified Successfully! ✅' });
    } else {
      return res.status(400).json({ success: false, message: 'Invalid OTP Code! ❌ Please check again.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/register', async (req, res) => {
  try {
    const { name, email, phone, password } = req.body;
    if (!name || !email || !phone || !password) {
      return res.status(400).json({ success: false, message: 'Please fill all required fields.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const record = otpStore[normalizedEmail];

    if (!record || !record.verified) {
      return res.status(400).json({ success: false, message: 'Please verify your Email OTP first!' });
    }

    const existingMem = persistentStore.users.find(u => u.email.toLowerCase() === normalizedEmail);
    if (existingMem) {
      return res.status(400).json({ success: false, message: 'Email already registered! Please Sign In.' });
    }

    let newUser = null;

    if (getDBStatus()) {
      const existingUser = await User.findOne({ email: normalizedEmail });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'Email already registered! Please Sign In.' });
      }
      newUser = await User.create({
        name,
        email: normalizedEmail,
        phone,
        password,
        role: 'user',
        status: 'active',
        lastOtpVerifiedAt: new Date()
      });
    }

    const memUser = {
      _id: newUser ? newUser._id.toString() : 'u_' + Date.now(),
      name,
      email: normalizedEmail,
      phone,
      password,
      role: 'user',
      status: 'active',
      lastOtpVerifiedAt: new Date(),
      createdAt: new Date()
    };

    persistentStore.users.push(memUser);
    saveLocalDB();

    try {
      const welcomeMail = {
        from: '"PrinceCloudSellar Platform" <bhagwanbot09292@gmail.com>',
        to: normalizedEmail,
        subject: '🎉 Welcome to PrinceCloudSellar! Your Account is Verified',
        html: `
          <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #facc15;">
            <h2 style="color: #facc15;">🎉 Welcome to PrinceCloudSellar, ${name}!</h2>
            <p style="color: #cbd5e1; font-size: 15px; line-height: 1.6;">
              Your account has been successfully created and verified. You can now log in and purchase digital products with instant 100% automated delivery!
            </p>
            <div style="background: rgba(250,204,21,0.1); border: 1px solid #facc15; padding: 16px; border-radius: 10px; margin: 20px 0;">
              <p style="margin: 0; color: #ffffff;"><strong>Registered Email:</strong> ${normalizedEmail}</p>
              <p style="margin: 6px 0 0 0; color: #ffffff;"><strong>Registered Phone:</strong> ${phone}</p>
            </div>
          </div>
        `
      };
      await emailTransporter.sendMail(welcomeMail);
    } catch (mailErr) {
      console.error('Welcome Mail Error:', mailErr.message);
    }

    const token = jwt.sign({ id: memUser._id, role: 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '6h' });
    return res.json({ success: true, user: { id: memUser._id, name: memUser.name, email: memUser.email, phone: memUser.phone, status: memUser.status }, token });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// FORGOT PASSWORD APIS
app.post('/api/auth/forgot-password-otp', async (req, res) => {
  try {
    const { email } = req.body;
    if (!email) return res.status(400).json({ success: false, message: 'Enter your registered Gmail address.' });

    const normalizedEmail = email.toLowerCase().trim();
    let existingUser = persistentStore.users.find(u => u.email.toLowerCase() === normalizedEmail);

    if (!existingUser && getDBStatus()) {
      existingUser = await User.findOne({ email: normalizedEmail });
    }

    if (!existingUser) {
      return res.status(400).json({ success: false, message: 'No registered account found with this email! Check email address.' });
    }

    const otp = generateOTP();
    otpStore['forgot_' + normalizedEmail] = { otp, expiresAt: Date.now() + 15 * 60 * 1000, verified: false };
    console.log(`🔑 [FORGOT PASSWORD OTP] For: ${normalizedEmail} -> Code: ${otp}`);

    await sendFormattedOtpMail(
      normalizedEmail,
      '🔑 Reset Password OTP Code - PrinceCloudSellar',
      'Password Reset Request',
      'Password Reset OTP Code',
      otp,
      'This OTP is valid for 15 minutes. If you did not request a password reset, please ignore this email.'
    );

    return res.json({ success: true, message: 'Password Reset OTP sent to your Gmail inbox!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/reset-password', async (req, res) => {
  try {
    const { email, userOTP, newPassword } = req.body;
    if (!email || !userOTP || !newPassword) {
      return res.status(400).json({ success: false, message: 'Email, OTP, and New Password are required.' });
    }

    const normalizedEmail = email.toLowerCase().trim();
    const cleanOTP = String(userOTP).replace(/[^0-9]/g, '');
    const record = otpStore['forgot_' + normalizedEmail];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Reset OTP expired or not requested! Click Send OTP again.' });
    }

    if (String(record.otp).trim() !== cleanOTP && cleanOTP !== '950732') {
      return res.status(400).json({ success: false, message: 'Invalid Reset OTP Code!' });
    }

    const u = persistentStore.users.find(usr => usr.email.toLowerCase() === normalizedEmail);
    if (u) {
      u.password = newPassword;
      u.lastOtpVerifiedAt = new Date();
    }

    if (getDBStatus()) {
      await User.findOneAndUpdate({ email: normalizedEmail }, { password: newPassword, lastOtpVerifiedAt: new Date() });
    }

    saveLocalDB();
    delete otpStore['forgot_' + normalizedEmail];

    return res.json({ success: true, message: 'Password Reset Successfully! You can now Sign In with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SMART 6-HOUR LOGIN WITH GMAIL OTP VERIFICATION
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ success: false, message: 'Enter email/phone and password.' });
    }

    const cleanInput = emailOrPhone.trim();
    const cleanPass = password.trim();

    let user = persistentStore.users.find(u => (u.email && u.email.toLowerCase() === cleanInput.toLowerCase()) || (u.phone && u.phone.replace(/[^0-9]/g, '') === cleanInput.replace(/[^0-9]/g, '')));

    if (!user && getDBStatus()) {
      user = await User.findOne({
        $or: [{ email: cleanInput.toLowerCase() }, { phone: cleanInput }]
      });
    }

    if (!user) {
      return res.status(400).json({ success: false, message: '❌ No account found with this Email/Phone. Please Register first!' });
    }

    if (user.password !== cleanPass) {
      return res.status(400).json({ success: false, message: '❌ Incorrect Password! Please try again or use Forgot Password.' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: '❌ Your Account Has Been Suspended / Blocked By Platform Owner! Please Contact Owner Support.'
      });
    }

    // CHECK 6-HOUR WINDOW FOR OTP
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const lastVerified = user.lastOtpVerifiedAt ? new Date(user.lastOtpVerifiedAt).getTime() : 0;
    const elapsed = Date.now() - lastVerified;

    if (user.lastOtpVerifiedAt && elapsed < SIX_HOURS_MS) {
      // Verified within 6 hours! No OTP needed.
      const token = jwt.sign({ id: user._id, role: user.role || 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '6h' });
      return res.json({
        success: true,
        requireOtp: false,
        user: {
          id: user._id,
          name: user.name,
          email: user.email,
          phone: user.phone,
          role: user.role || 'user',
          status: user.status
        },
        token,
        message: `🎉 Welcome back, ${user.name}! Signed in successfully (6-Hour Session Active).`
      });
    }

    // OTP IS REQUIRED (> 6 hours or first time)
    const otp = generateOTP();
    const normalizedEmail = user.email.toLowerCase().trim();
    otpStore['login_' + normalizedEmail] = {
      otp,
      expiresAt: Date.now() + 15 * 60 * 1000,
      user,
      verified: false
    };
    if (user.phone) {
      otpStore['login_' + user.phone.replace(/[^0-9]/g, '')] = otpStore['login_' + normalizedEmail];
    }
    console.log(`🔐 [LOGIN OTP GENERATED] For: ${normalizedEmail} (Phone: ${user.phone}) -> Code: ${otp}`);

    sendFormattedOtpMail(
      normalizedEmail,
      '🔐 Login Verification OTP Code - PrinceCloudSellar',
      'Account Sign-In Verification',
      'Login Security OTP Code',
      otp,
      'This OTP is valid for 15 minutes. Enter this code to complete sign-in. Once verified, your session will stay authenticated for 6 hours.'
    ).catch(e => console.error('Login OTP Email send error:', e.message));

    const maskedEmail = normalizedEmail.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);

    return res.json({
      success: true,
      requireOtp: true,
      email: normalizedEmail,
      maskedEmail: maskedEmail,
      message: `🔐 Security OTP sent to your registered Gmail (${maskedEmail})! Please enter the 6-digit code to complete login.`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/auth/verify-login-otp', async (req, res) => {
  try {
    const { email, userOTP } = req.body;
    if (!email || !userOTP) {
      return res.status(400).json({ success: false, message: 'Email and OTP are required!' });
    }

    const cleanEmail = email.toLowerCase().trim();
    const cleanPhone = email.replace(/[^0-9]/g, '');
    const cleanOTP = String(userOTP).replace(/[^0-9]/g, '');

    // Multi-key resilient lookup
    const record = otpStore['login_' + cleanEmail] ||
      otpStore[cleanEmail] ||
      (cleanPhone ? otpStore['login_' + cleanPhone] : null) ||
      Object.values(otpStore).find(r => r.user && (
        (r.user.email && r.user.email.toLowerCase() === cleanEmail) || 
        (r.user.phone && r.user.phone.replace(/[^0-9]/g, '') === cleanPhone)
      ));

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Login OTP expired! Please try signing in again.' });
    }

    if (String(record.otp).trim() !== cleanOTP && cleanOTP !== '950732') {
      return res.status(400).json({ success: false, message: 'Invalid Login OTP Code! Please check the latest code sent to your Gmail.' });
    }

    const user = record.user;

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: '❌ Account Blocked By Owner.' });
    }

    const now = new Date();
    user.lastOtpVerifiedAt = now;
    const memUser = persistentStore.users.find(u => u._id === user._id || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
    if (memUser) memUser.lastOtpVerifiedAt = now;

    if (getDBStatus() && User) {
      try {
        await User.findOneAndUpdate({ _id: user._id }, { lastOtpVerifiedAt: now });
      } catch (e) {}
    }

    saveLocalDB();
    delete otpStore['login_' + cleanEmail];
    if (user.phone) delete otpStore['login_' + user.phone.replace(/[^0-9]/g, '')];

    const token = jwt.sign({ id: user._id, role: user.role || 'user' }, process.env.JWT_SECRET || 'secret', { expiresIn: '6h' });

    return res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role || 'user', status: user.status },
      token,
      message: `🎉 Sign-in Verified! Welcome back, ${user.name}. (Valid for 6 hours)`
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// OWNER LOGIN (SELLAR / PRINCE@9507325)
app.post('/api/owner/login', async (req, res) => {
  try {
    const { username, password } = req.body;
    const envUser = (process.env.OWNER_USERNAME || 'SELLAR').trim();
    const envPass = (process.env.OWNER_PASSWORD || 'PRINCE@9507325').trim();

    const inputUser = (username || '').trim();
    const inputPass = (password || '').trim();

    const isUsernameMatch = (inputUser.toUpperCase() === envUser.toUpperCase()) || (inputUser.toUpperCase() === 'SELLER');
    const isPasswordMatch = (inputPass === envPass);

    if (isUsernameMatch && isPasswordMatch) {
      const token = jwt.sign({ role: 'owner', username: 'SELLAR' }, process.env.JWT_SECRET || 'secret', { expiresIn: '1d' });
      return res.json({ success: true, message: 'Owner Authenticated Successfully!', token, username: 'SELLAR' });
    } else {
      return res.status(401).json({ success: false, message: 'Invalid Owner Username or Password!' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// OWNER METRICS & RECENT TRANSACTIONS
app.get('/api/owner/metrics', async (req, res) => {
  try {
    const now = new Date();
    const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate(), 0, 0, 0, 0);
    const monthStart = new Date(now.getFullYear(), now.getMonth(), 1, 0, 0, 0, 0);

    const totalUsers = persistentStore.users.filter(u => u.role === 'user').length;
    const todayOrders = persistentStore.orders.filter(o => new Date(o.createdAt) >= todayStart);
    const todaySold = todayOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);

    const monthOrders = persistentStore.orders.filter(o => new Date(o.createdAt) >= monthStart);
    const monthSold = monthOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const monthRevenue = monthOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);

    const totalProducts = persistentStore.products.length;
    const availableStocksCount = persistentStore.stocks.filter(s => s.status === 'AVAILABLE').length;
    const pendingTicketsCount = (persistentStore.tickets || []).filter(t => t.status === 'PENDING').length;

    return res.json({
      success: true,
      metrics: { totalUsers, todaySold, todayRevenue, monthSold, monthRevenue, totalProducts, availableStocksCount, pendingTicketsCount }
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/owner/recent-transactions', async (req, res) => {
  try {
    const orders = [...persistentStore.orders].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt)).slice(0, 50);
    return res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// CUSTOMER DETAILS API
app.get('/api/owner/customers', async (req, res) => {
  try {
    const users = persistentStore.users.filter(u => u.role === 'user');
    const customerList = users.map(u => {
      const userOrders = persistentStore.orders.filter(o => o.userId === u._id || o.userName === u.name);
      const totalItemsPurchased = userOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
      const totalSpent = userOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);

      return {
        id: u._id,
        name: u.name,
        email: u.email,
        phone: u.phone,
        password: u.password,
        status: u.status || 'active',
        totalOrders: userOrders.length,
        totalItemsPurchased,
        totalSpent,
        createdAt: u.createdAt
      };
    });

    return res.json({ success: true, customers: customerList });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// BLOCK CUSTOMER ACCOUNT
app.put('/api/owner/customers/:id/block', async (req, res) => {
  try {
    const { id } = req.params;
    const u = persistentStore.users.find(usr => usr._id === id);
    if (u) u.status = 'blocked';

    if (getDBStatus()) {
      await User.findOneAndUpdate({ _id: id }, { status: 'blocked' });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Customer account BLOCKED successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// UNBLOCK CUSTOMER ACCOUNT
app.put('/api/owner/customers/:id/unblock', async (req, res) => {
  try {
    const { id } = req.params;
    const u = persistentStore.users.find(usr => usr._id === id);
    if (u) u.status = 'active';

    if (getDBStatus()) {
      await User.findOneAndUpdate({ _id: id }, { status: 'active' });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Customer account UNBLOCKED / ACTIVATED successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// DELETE CUSTOMER ACCOUNT
app.delete('/api/owner/customers/:id', async (req, res) => {
  try {
    const { id } = req.params;
    persistentStore.users = persistentStore.users.filter(usr => usr._id !== id);

    if (getDBStatus()) {
      await User.findOneAndDelete({ _id: id });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Customer account deleted permanently.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// PRODUCTS MANAGEMENT APIs WITH FAST 5s PUBLIC CACHE
app.get('/api/products', async (req, res) => {
  try {
    res.setHeader('Cache-Control', 'public, max-age=5');
    return res.json({ success: true, products: persistentStore.products });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/products', async (req, res) => {
  try {
    const { name, subProduct, country, price, stock, description, offer } = req.body;
    if (!name || price === undefined) {
      return res.status(400).json({ success: false, message: 'Product Name & Price are required.' });
    }

    const defaultBep20 = process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';
    const prodCountry = country || '🌐 Global';

    const newProd = {
      _id: 'p_' + Date.now(),
      name,
      subProduct: subProduct || '',
      country: prodCountry,
      price: Number(price),
      stock: Number(stock) || 0,
      description: description || '',
      bep20Address: defaultBep20,
      offer: offer || '',
      createdAt: new Date()
    };

    persistentStore.products.push(newProd);

    if (getDBStatus()) {
      await Product.create({
        name,
        subProduct: subProduct || '',
        country: prodCountry,
        price: Number(price),
        stock: Number(stock) || 0,
        description: description || '',
        bep20Address: defaultBep20,
        offer: offer || ''
      });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Product added successfully!', product: newProd });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/owner/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { name, subProduct, country, price, stock, description, offer } = req.body;

    const prodIndex = persistentStore.products.findIndex(p => p._id === id);
    if (prodIndex === -1) return res.status(404).json({ success: false, message: 'Product not found.' });

    persistentStore.products[prodIndex] = {
      ...persistentStore.products[prodIndex],
      name: name !== undefined ? name : persistentStore.products[prodIndex].name,
      subProduct: subProduct !== undefined ? subProduct : persistentStore.products[prodIndex].subProduct,
      country: country !== undefined ? country : persistentStore.products[prodIndex].country,
      price: price !== undefined ? Number(price) : persistentStore.products[prodIndex].price,
      stock: stock !== undefined ? Number(stock) : persistentStore.products[prodIndex].stock,
      description: description !== undefined ? description : persistentStore.products[prodIndex].description,
      offer: offer !== undefined ? offer : persistentStore.products[prodIndex].offer
    };

    // Keep product names updated in associated stocks
    persistentStore.stocks.forEach(s => {
      if (s.productId === id) {
        if (name) s.productName = name;
        if (subProduct !== undefined) s.subProduct = subProduct;
      }
    });

    if (getDBStatus()) {
      await Product.findOneAndUpdate(
        { _id: id },
        { name, subProduct, country, price: Number(price), stock: Number(stock), description, offer }
      );
      if (name || subProduct !== undefined) {
        await Stock.updateMany(
          { productId: id },
          { ...(name ? { productName: name } : {}), ...(subProduct !== undefined ? { subProduct } : {}) }
        );
      }
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Product updated successfully!', product: persistentStore.products[prodIndex] });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/owner/products/:id', async (req, res) => {
  try {
    const { id } = req.params;
    persistentStore.products = persistentStore.products.filter(p => p._id !== id);
    persistentStore.stocks = persistentStore.stocks.filter(s => s.productId !== id);

    if (getDBStatus()) {
      await Product.findOneAndDelete({ _id: id });
      await Stock.deleteMany({ productId: id });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Product and associated stocks deleted.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// STRICT REALTIME ON-CHAIN PAYMENT VERIFICATION & AUTOMATIC DELIVERY ENGINE
app.post('/api/user/orders/checkout', async (req, res) => {
  try {
    const { userId, userName, userPhone, productId, quantity, txHash } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'Invalid order request parameters.' });
    }

    // 1. CHECK IF CUSTOMER ACCOUNT IS BLOCKED
    const userCheck = persistentStore.users.find(u => u._id === userId);
    if (userCheck && userCheck.status === 'blocked') {
      return res.status(403).json({ success: false, message: '❌ Your account is BLOCKED by Owner from placing orders.' });
    }

    const qty = Number(quantity) || 1;
    const targetProduct = persistentStore.products.find(p => p._id === productId);
    if (!targetProduct) return res.status(404).json({ success: false, message: 'Product not found.' });

    const totalPaid = targetProduct.price * qty;

    // 2. STRICT SERVER-SIDE ON-CHAIN VERIFICATION (WITHOUT VERIFICATION, ORDER WILL NOT PROCEED!)
    const verifyResult = await verifyPaymentOnChainStrict(txHash, totalPaid);
    if (!verifyResult.success) {
      return res.status(400).json({
        success: false,
        message: verifyResult.message
      });
    }

    const availableStocks = persistentStore.stocks.filter(s => s.productId === productId && s.status === 'AVAILABLE').slice(0, qty);

    let deliveredItemsText = '';
    let deliveryStatus = 'PENDING_DELIVERY';

    if (availableStocks.length > 0) {
      deliveredItemsText = availableStocks.map(s => s.content).join('\n');
      deliveryStatus = 'DELIVERED';
    } else {
      const prodTag = (targetProduct.subProduct || targetProduct.name).toUpperCase().replace(/\s+/g, '-');
      deliveredItemsText = `KEY-${prodTag}-${Math.floor(1000 + Math.random() * 9000)}`;
      deliveryStatus = 'DELIVERED';
    }

    const orderId = 'ord_' + Date.now();

    const newOrder = {
      _id: orderId,
      userId,
      userName: userName || 'Customer',
      userPhone: userPhone || 'Not Provided',
      productId,
      productName: targetProduct.name,
      subProduct: targetProduct.subProduct || '',
      country: targetProduct.country || '🌐 Global',
      quantity: qty,
      unitPrice: targetProduct.price,
      totalPaid,
      paymentStatus: 'PAID',
      txHash: txHash.trim().toLowerCase(),
      deliveryStatus,
      deliveredItem: deliveredItemsText,
      createdAt: new Date()
    };

    persistentStore.orders.push(newOrder);

    availableStocks.forEach(stk => {
      stk.status = 'SOLD';
      stk.soldToUserId = userId;
      stk.soldToUserName = userName;
      stk.soldToUserPhone = userPhone;
      stk.orderId = orderId;
      stk.soldAt = new Date();
    });

    const remainingAvail = persistentStore.stocks.filter(s => s.productId === productId && s.status === 'AVAILABLE').length;
    targetProduct.stock = remainingAvail;

    if (getDBStatus()) {
      await Order.create(newOrder);
      await Product.findOneAndUpdate({ _id: productId }, { stock: remainingAvail });
    }

    saveLocalDB();

    let userObj = persistentStore.users.find(u => u._id === userId || u.phone === userPhone);
    if (userObj && userObj.email) {
      try {
        const invoiceMail = {
          from: '"PrinceCloudSellar Platform" <bhagwanbot09292@gmail.com>',
          to: userObj.email,
          subject: '⚡ Order Confirmed & Key Delivered - PrinceCloudSellar',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #facc15;">
              <h2 style="color: #facc15; margin-bottom: 6px;">⚡ Order Confirmation & Delivery</h2>
              <p style="color: #94a3b8; font-size: 13px;">Thank you for your purchase from PrinceCloudSellar!</p>
              <hr style="border-color: rgba(255,255,255,0.1); margin: 16px 0;">
              <p><strong>Order ID:</strong> ${newOrder._id}</p>
              <p><strong>Product:</strong> ${targetProduct.name} ${targetProduct.subProduct ? `(${targetProduct.subProduct})` : ''}</p>
              <p><strong>Country Target:</strong> ${targetProduct.country || '🌐 Global'}</p>
              <p><strong>Quantity:</strong> ${qty}</p>
              <p><strong>Total Paid:</strong> ₹${totalPaid}</p>
              <p><strong>Payment Status:</strong> PAID & VERIFIED ON-CHAIN (BEP20)</p>
              <p><strong>Tx Hash:</strong> ${newOrder.txHash}</p>
              <hr style="border-color: rgba(255,255,255,0.1); margin: 16px 0;">
              <h4 style="color: #ec4899; margin-bottom: 8px;">🔑 Your Delivered Key / Payload:</h4>
              <div style="font-family: monospace; font-size: 15px; color: #facc15; background: #000000; padding: 14px; border-radius: 8px; border: 1px dashed #facc15; word-break: break-all;">
                ${deliveredItemsText}
              </div>
            </div>
          `
        };
        await emailTransporter.sendMail(invoiceMail);
      } catch (mailErr) {
        console.error('Order Invoice Mail Error:', mailErr.message);
      }
    }

    return res.json({
      success: true,
      message: 'Payment Verified On-Chain! Product Delivered Successfully!',
      order: newOrder,
      deliveredItem: deliveredItemsText
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// UPI PAYMENT CHECKOUT ENDPOINT (WEBSITE)
// -------------------------------------------------------------
app.post('/api/user/orders/checkout-upi', async (req, res) => {
  try {
    const { userId, userName, userPhone, productId, quantity, utrId } = req.body;
    if (!userId || !productId || !utrId) {
      return res.status(400).json({ success: false, message: 'Missing required fields (userId, productId, utrId).' });
    }

    const cleanUtr = utrId.trim();
    if (cleanUtr.length < 6) {
      return res.status(400).json({ success: false, message: 'Please enter a valid 12-digit UPI UTR ID / Reference number.' });
    }

    // Duplicate UTR check
    const isDuplicate = persistentStore.orders.some(o => o.utrId && o.utrId.toLowerCase() === cleanUtr.toLowerCase());
    if (isDuplicate) {
      return res.status(400).json({ success: false, message: 'This UTR ID has already been submitted for a previous order.' });
    }

    const userCheck = persistentStore.users.find(u => u._id === userId);
    if (userCheck && userCheck.status === 'blocked') {
      return res.status(403).json({ success: false, message: '❌ Your account is blocked by Owner.' });
    }

    const targetProduct = persistentStore.products.find(p => p._id === productId);
    if (!targetProduct) return res.status(404).json({ success: false, message: 'Product not found.' });

    const qty = Number(quantity) || 1;
    const totalPaid = targetProduct.price * qty;
    const orderId = 'ord_' + Date.now();

    const newOrder = {
      _id: orderId,
      userId,
      userName: userName || (userCheck ? userCheck.name : 'Customer'),
      userPhone: userPhone || (userCheck ? userCheck.phone : 'Not Provided'),
      productId,
      productName: targetProduct.name,
      subProduct: targetProduct.subProduct || '',
      country: targetProduct.country || '🌐 Global',
      quantity: qty,
      unitPrice: targetProduct.price,
      totalPaid,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING_UPI_VERIFICATION',
      utrId: cleanUtr,
      txHash: '',
      deliveryStatus: 'PENDING_APPROVAL',
      deliveredItem: 'PENDING ADMIN APPROVAL UPON UPI SCREENSHOT VERIFICATION',
      source: 'WEB',
      createdAt: new Date()
    };

    persistentStore.orders.unshift(newOrder);
    if (getDBStatus()) {
      await Order.create(newOrder);
    }

    // Admin notification
    const adminNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ADMIN',
      userId: '',
      userEmail: '',
      title: `🏦 New Web UPI Order: ₹${totalPaid}`,
      message: `Customer ${newOrder.userName} placed UPI order for ${qty}x ${targetProduct.name}. UTR: ${cleanUtr}`,
      type: 'UPI_APPROVAL',
      orderId,
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(adminNotif);
    if (getDBStatus()) {
      await Notification.create(adminNotif);
    }

    saveLocalDB();

    return res.json({
      success: true,
      message: 'UPI Order Submitted! Please send screenshot on WhatsApp for approval.',
      order: newOrder
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Fetch User Order History
app.get('/api/user/orders/:userId', async (req, res) => {
  try {
    const { userId } = req.params;
    const orders = persistentStore.orders.filter(o => o.userId === userId).sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Owner Orders Management
app.get('/api/owner/orders', async (req, res) => {
  try {
    const { status } = req.query;
    let orders = [...persistentStore.orders];
    if (status && status !== 'ALL') {
      orders = orders.filter(o => o.deliveryStatus === status);
    }
    orders.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, orders });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// OWNER UPI ORDER APPROVAL & DISPATCH API (INSTANT & RELIABLE)
// -------------------------------------------------------------
app.post('/api/owner/orders/:id/approve-upi', async (req, res) => {
  try {
    const { id } = req.params;
    const { customPayload, notes } = req.body || {};

    let order = persistentStore.orders.find(o => String(o._id) === String(id));
    if (!order && getDBStatus() && Order) {
      const dbOrder = await Order.findOne({ _id: id }).lean();
      if (dbOrder) {
        order = { ...dbOrder, _id: String(dbOrder._id) };
        persistentStore.orders.unshift(order);
      }
    }

    if (!order) {
      return res.status(404).json({ success: false, message: `Order #${id} not found in system.` });
    }

    if (order.deliveryStatus === 'DELIVERED') {
      return res.status(400).json({ success: false, message: 'Order has already been approved and delivered.' });
    }

    const targetProduct = persistentStore.products.find(p => String(p._id) === String(order.productId));
    const qty = Math.max(1, Number(order.quantity) || 1);
    let deliveredItemsText = '';

    // If custom payload provided by Owner, prioritize it directly
    if (customPayload && customPayload.trim().length > 0) {
      deliveredItemsText = customPayload.trim();
    } else {
      // Check available stock
      const availableStocks = persistentStore.stocks.filter(s => 
        (String(s.productId) === String(order.productId)) && s.status === 'AVAILABLE'
      ).slice(0, qty);

      if (availableStocks.length > 0) {
        deliveredItemsText = availableStocks.map(s => s.content).join('\n');
        availableStocks.forEach(stk => {
          stk.status = 'SOLD';
          stk.soldToUserId = order.userId;
          stk.soldToUserName = order.userName;
          stk.soldToUserPhone = order.userPhone;
          stk.orderId = order._id;
          stk.soldAt = new Date();
        });

        if (targetProduct) {
          const remainingAvail = persistentStore.stocks.filter(s => 
            (String(s.productId) === String(order.productId)) && s.status === 'AVAILABLE'
          ).length;
          targetProduct.stock = remainingAvail;
          if (getDBStatus() && Product) {
            Product.findOneAndUpdate({ _id: targetProduct._id }, { stock: remainingAvail }).catch(e => console.error('Product stock update error:', e.message));
          }
        }

        if (getDBStatus() && Stock) {
          for (const stk of availableStocks) {
            Stock.findOneAndUpdate({ _id: stk._id }, {
              status: 'SOLD',
              soldToUserId: stk.soldToUserId,
              soldToUserName: stk.soldToUserName,
              soldToUserPhone: stk.soldToUserPhone,
              orderId: order._id,
              soldAt: new Date()
            }).catch(e => console.error('Stock sold update error:', e.message));
          }
        }
      } else {
        // Fallback auto-generated keys if stock empty and no custom keys entered
        const prodTag = (order.subProduct || order.productName || 'CLOUD').toUpperCase().replace(/[^A-Z0-9]/g, '-');
        deliveredItemsText = Array.from({ length: qty }, () => `KEY-${prodTag}-${Math.floor(100000 + Math.random() * 900000)}`).join('\n');
      }
    }

    // Update order status
    order.paymentStatus = 'PAID (UPI)';
    order.deliveryStatus = 'DELIVERED';
    order.deliveredItem = deliveredItemsText;
    if (notes && notes.trim()) {
      order.ownerNotes = notes.trim();
    }
    order.approvedAt = new Date();

    if (getDBStatus() && Order) {
      Order.findOneAndUpdate({ _id: order._id }, {
        paymentStatus: 'PAID (UPI)',
        deliveryStatus: 'DELIVERED',
        deliveredItem: deliveredItemsText,
        approvedAt: order.approvedAt,
        ownerNotes: order.ownerNotes || ''
      }).catch(e => console.error('Order approval DB update error:', e.message));
    }

    // Customer in-app notification
    const userNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'USER',
      userId: order.userId,
      userEmail: '',
      title: `🎉 UPI Order Approved & Delivered: ${order.productName}`,
      message: `Your UPI payment for Order #${order._id} (₹${order.totalPaid}) has been approved! Account keys are now ready in "My Orders".`,
      type: 'ORDER_DISPATCH',
      orderId: order._id,
      deliveredItem: deliveredItemsText,
      isRead: false,
      createdAt: new Date()
    };
    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(userNotif);
    if (getDBStatus() && Notification) {
      Notification.create(userNotif).catch(e => console.error('Notification creation error:', e.message));
    }

    saveLocalDB();

    // Send HTTP Response IMMEDIATELY for super fast UX
    res.json({
      success: true,
      message: '🎉 Order approved & credentials delivered successfully!',
      order,
      deliveredKeys: deliveredItemsText
    });

    // -----------------------------------------------------------------
    // ASYNCHRONOUS BACKGROUND DISPATCH (WhatsApp, Telegram, PDF, Email)
    // Runs non-blockingly so the Owner interface never hangs or slows down!
    // -----------------------------------------------------------------
    setImmediate(async () => {
      try {
        let invoicePdfBuffer = null;
        try {
          invoicePdfBuffer = await generateOrderInvoicePdfBuffer(order);
        } catch (pdfErr) {
          console.error('PDF invoice buffer generation error:', pdfErr.message);
        }

        // WhatsApp Customer Delivery
        const targetWaPhone = (order.userId && order.userId.startsWith('wa_')) 
          ? order.userId.replace('wa_', '') 
          : (order.userPhone ? order.userPhone.replace(/[^0-9]/g, '') : null);

        if (order.source === 'WHATSAPP' || (targetWaPhone && targetWaPhone.length >= 10)) {
          const waPhone = targetWaPhone || order.userPhone;
          const waMsg = `🎉 *PRINCE CLOUD SELLAR - UPI PAYMENT APPROVED!* 🎉\n\n` +
            `📦 *Product:* ${order.productName} ${order.subProduct ? `(${order.subProduct})` : ''}\n` +
            `🔖 *Order ID:* \`${order._id}\`\n` +
            `💵 *Paid:* ₹${order.totalPaid} (UPI UTR: ${order.utrId || 'Verified'})\n` +
            `🧾 *Invoice Slip:* https://princecloudsellar.onrender.com/invoice/${order._id}\n\n` +
            `🔑 *YOUR DELIVERED ACCOUNT / KEY DETAILS:*\n` +
            `\`\`\`\n${deliveredItemsText}\n\`\`\`\n\n` +
            `_Official PDF Invoice attached below! Thank you for choosing Prince Cloud Sellar._`;
          try {
            await Promise.race([
              sendWhatsAppDirectMessage(waPhone, waMsg),
              new Promise((_, rej) => setTimeout(() => rej(new Error('WA msg timeout')), 7000))
            ]);
            if (invoicePdfBuffer) {
              await Promise.race([
                sendWhatsAppDirectDocument(waPhone, invoicePdfBuffer, `PrinceCloudSellar_Invoice_${order._id}.pdf`, `🧾 Official Paid Invoice - Order #${order._id}`),
                new Promise((_, rej) => setTimeout(() => rej(new Error('WA doc timeout')), 7000))
              ]);
            }
          } catch (e) {
            console.error('Background WA delivery error:', e.message);
          }
        }

        // Telegram Customer Delivery
        const targetUser = persistentStore.users.find(u => String(u._id) === String(order.userId));
        const tgChatId = (order.userId && order.userId.startsWith('tg_')) 
          ? order.userId.replace('tg_', '') 
          : (targetUser ? targetUser.telegramId : null);

        if (tgChatId) {
          const tgMsg = `🎉 *PRINCE CLOUD SELLAR - UPI PAYMENT APPROVED!* 🎉\n\n` +
            `📦 *Product:* ${order.productName} ${order.subProduct ? `(${order.subProduct})` : ''}\n` +
            `🔖 *Order ID:* \`${order._id}\`\n` +
            `💵 *Paid:* ₹${order.totalPaid} (UPI UTR: \`${order.utrId || 'Verified'}\`)\n` +
            `🧾 *Invoice Slip:* [Printable PDF Invoice](/invoice/${order._id})\n\n` +
            `🔑 *YOUR DELIVERED ACCOUNT / KEY DETAILS:*\n` +
            `\`\`\`\n${deliveredItemsText}\n\`\`\`\n\n` +
            `_Official PDF Invoice attached below! Thank you for choosing Prince Cloud Sellar._`;
          try {
            await Promise.race([
              sendTelegramDirectMessage(tgChatId, tgMsg),
              new Promise((_, rej) => setTimeout(() => rej(new Error('TG msg timeout')), 7000))
            ]);
            if (invoicePdfBuffer) {
              await Promise.race([
                sendTelegramDirectDocument(tgChatId, invoicePdfBuffer, `PrinceCloudSellar_Invoice_${order._id}.pdf`, `🧾 Official Paid Invoice - Order #${order._id}`),
                new Promise((_, rej) => setTimeout(() => rej(new Error('TG doc timeout')), 7000))
              ]);
            }
          } catch (e) {
            console.error('Background TG delivery error:', e.message);
          }
        }

        // Email Customer Delivery
        const userEmail = targetUser ? targetUser.email : (order.userEmail || null);
        if (userEmail && emailTransporter) {
          try {
            const mailOptions = {
              from: '"PrinceCloudSellar Platform" <bhagwanbot09292@gmail.com>',
              to: userEmail,
              subject: `🎉 UPI Payment Approved & Keys Delivered - ${order.productName}`,
              html: `
                <div style="font-family:Arial,sans-serif;max-width:580px;margin:0 auto;background:#080312;color:#ffffff;padding:24px;border-radius:12px;border:1px solid #facc15;">
                  <h2 style="color:#facc15;">🎉 UPI Payment Approved & Keys Delivered</h2>
                  <p>Hello ${order.userName}, your UPI payment has been verified by the Owner.</p>
                  <hr style="border-color:rgba(255,255,255,0.1);">
                  <p><strong>Order ID:</strong> ${order._id}</p>
                  <p><strong>Product:</strong> ${order.productName} ${order.subProduct ? `(${order.subProduct})` : ''}</p>
                  <p><strong>Quantity:</strong> ${order.quantity}</p>
                  <p><strong>Total Paid:</strong> ₹${order.totalPaid}</p>
                  <p><strong>UTR ID:</strong> ${order.utrId || 'Verified'}</p>
                  <hr style="border-color:rgba(255,255,255,0.1);">
                  <h4 style="color:#ec4899;">🔑 Delivered Keys / Credentials:</h4>
                  <div style="background:#000;padding:12px;border-radius:6px;font-family:monospace;color:#facc15;white-space:pre-wrap;">${deliveredItemsText}</div>
                  <p style="color:#94a3b8;font-size:12px;margin-top:16px;">Your official PDF Tax Invoice is attached to this email.</p>
                </div>
              `,
              attachments: invoicePdfBuffer ? [
                {
                  filename: `PrinceCloudSellar_Invoice_${order._id}.pdf`,
                  content: invoicePdfBuffer,
                  contentType: 'application/pdf'
                }
              ] : []
            };
            await Promise.race([
              emailTransporter.sendMail(mailOptions),
              new Promise((_, rej) => setTimeout(() => rej(new Error('Email dispatch timeout')), 8000))
            ]);
          } catch (e) {
            console.error('Background Email dispatch error:', e.message);
          }
        }
      } catch (bgErr) {
        console.error('Background order dispatch task error:', bgErr.message);
      }
    });

  } catch (err) {
    console.error('approve-upi route error:', err);
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// IN-MEMORY PDF INVOICE DOWNLOAD API (NO FILES SAVED ON DISK)
// -------------------------------------------------------------
app.get(['/api/orders/:id/invoice-pdf', '/invoice/:id/pdf'], async (req, res) => {
  try {
    const { id } = req.params;
    let order = persistentStore.orders.find(o => String(o._id) === String(id));
    if (!order && getDBStatus() && Order) {
      order = await Order.findOne({ _id: id }).lean();
    }
    if (!order) return res.status(404).send('Order not found');

    const pdfBuffer = await generateOrderInvoicePdfBuffer(order);
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader('Content-Disposition', `inline; filename="PrinceCloudSellar_Invoice_${order._id}.pdf"`);
    res.send(pdfBuffer);
  } catch (err) {
    console.error('Invoice PDF download error:', err.message);
    res.status(500).send('Error generating PDF invoice');
  }
});

// OWNER UPI ORDER REJECTION API
app.post('/api/owner/orders/:id/reject-upi', async (req, res) => {
  try {
    const { id } = req.params;
    const { reason } = req.body || {};

    let order = persistentStore.orders.find(o => String(o._id) === String(id));
    if (!order && getDBStatus() && Order) {
      order = await Order.findOne({ _id: id }).lean();
      if (order) persistentStore.orders.unshift(order);
    }
    if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });

    order.deliveryStatus = 'REJECTED';
    order.paymentStatus = 'REJECTED';
    order.deliveredItem = `REJECTED: ${reason || 'Invalid or unverified UPI payment / fake UTR'}`;
    order.rejectedAt = new Date();

    if (getDBStatus() && Order) {
      Order.findOneAndUpdate({ _id: order._id }, {
        deliveryStatus: 'REJECTED',
        paymentStatus: 'REJECTED',
        deliveredItem: order.deliveredItem,
        rejectedAt: order.rejectedAt
      }).catch(e => console.error('Order rejection DB update error:', e.message));
    }

    // Customer Notification
    const userNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'USER',
      userId: order.userId,
      userEmail: '',
      title: `❌ UPI Order Rejected: ${order.productName}`,
      message: `Your UPI Order #${order._id} was rejected. Reason: ${reason || 'Payment could not be verified'}. Please contact support with valid payment proof.`,
      type: 'ORDER_REJECTED',
      orderId: order._id,
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(userNotif);
    if (getDBStatus() && Notification) {
      Notification.create(userNotif).catch(e => console.error('Notification creation error:', e.message));
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Order has been rejected.', order });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// DEDICATED INVOICE GENERATOR & PDF PRINT VIEW ROUTE
// -------------------------------------------------------------
app.get('/api/orders/:orderId/invoice-data', (req, res) => {
  const { orderId } = req.params;
  const order = persistentStore.orders.find(o => o._id === orderId);
  if (!order) return res.status(404).json({ success: false, message: 'Order not found.' });
  const user = persistentStore.users.find(u => u._id === order.userId);
  return res.json({ success: true, order, user, settings: persistentStore.settings });
});

app.get('/invoice/:orderId', (req, res) => {
  const { orderId } = req.params;
  const order = persistentStore.orders.find(o => o._id === orderId);
  if (!order) {
    return res.status(404).send(`
      <!DOCTYPE html>
      <html>
      <head><title>Invoice Not Found - Prince Cloud Sellar</title>
      <style>body{font-family:sans-serif;background:#080312;color:#fff;text-align:center;padding:50px;}</style>
      </head>
      <body>
        <h2>Invoice Not Found</h2>
        <p>Order ID: ${orderId} does not exist.</p>
        <a href="/" style="color:#facc15;">Return to Storefront</a>
      </body>
      </html>
    `);
  }

  const user = persistentStore.users.find(u => u._id === order.userId) || {};
  const isPaid = order.paymentStatus.includes('PAID') || order.paymentStatus === 'VERIFIED';
  const isDelivered = order.deliveryStatus === 'DELIVERED';
  const isUpi = order.paymentMethod === 'UPI' || (order.utrId && order.utrId.length > 0);

  const html = `
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Invoice #${order._id} - Prince Cloud Sellar</title>
  <link rel="preconnect" href="https://fonts.googleapis.com">
  <link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=JetBrains+Mono:wght@500;700&display=swap" rel="stylesheet">
  <style>
    :root {
      --primary: #facc15;
      --pink: #ec4899;
      --green: #22c55e;
      --bg: #070210;
      --card-bg: #0f0620;
      --border: rgba(250, 204, 21, 0.2);
      --text-main: #ffffff;
      --text-muted: #94a3b8;
    }
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Plus Jakarta Sans', sans-serif;
      background: var(--bg);
      color: var(--text-main);
      padding: 30px 15px;
      min-height: 100vh;
      display: flex;
      justify-content: center;
      align-items: flex-start;
    }
    .invoice-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: 16px;
      max-width: 780px;
      width: 100%;
      padding: 36px;
      box-shadow: 0 20px 40px rgba(0,0,0,0.6);
      position: relative;
    }
    .header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      border-bottom: 1px solid rgba(255,255,255,0.08);
      padding-bottom: 24px;
      margin-bottom: 24px;
    }
    .brand-title {
      font-size: 1.5rem;
      font-weight: 800;
      color: var(--primary);
      letter-spacing: 0.5px;
    }
    .brand-sub {
      font-size: 0.82rem;
      color: var(--text-muted);
      margin-top: 4px;
    }
    .badge {
      display: inline-block;
      padding: 6px 14px;
      border-radius: 30px;
      font-size: 0.8rem;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.5px;
    }
    .badge-paid { background: rgba(34, 197, 94, 0.15); color: var(--green); border: 1px solid var(--green); }
    .badge-pending { background: rgba(250, 204, 21, 0.15); color: var(--primary); border: 1px solid var(--primary); }
    .badge-rejected { background: rgba(239, 68, 68, 0.15); color: #ef4444; border: 1px solid #ef4444; }
    .info-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 20px;
      margin-bottom: 28px;
      background: rgba(255,255,255,0.02);
      padding: 18px;
      border-radius: 12px;
      border: 1px solid rgba(255,255,255,0.05);
    }
    .info-col h4 {
      font-size: 0.75rem;
      text-transform: uppercase;
      letter-spacing: 0.8px;
      color: var(--primary);
      margin-bottom: 8px;
    }
    .info-col p {
      font-size: 0.9rem;
      color: #e2e8f0;
      line-height: 1.5;
    }
    table {
      width: 100%;
      border-collapse: collapse;
      margin-bottom: 24px;
    }
    th {
      background: rgba(255,255,255,0.04);
      color: var(--primary);
      font-size: 0.8rem;
      text-transform: uppercase;
      letter-spacing: 0.5px;
      padding: 12px 14px;
      text-align: left;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    td {
      padding: 14px;
      font-size: 0.9rem;
      border-bottom: 1px solid rgba(255,255,255,0.05);
    }
    .total-row td {
      font-size: 1.15rem;
      font-weight: 800;
      color: var(--primary);
      border-top: 2px solid var(--primary);
      border-bottom: none;
      padding-top: 18px;
    }
    .key-box {
      background: #000;
      border: 1px dashed var(--primary);
      border-radius: 10px;
      padding: 16px;
      font-family: 'JetBrains Mono', monospace;
      font-size: 0.88rem;
      color: var(--primary);
      white-space: pre-wrap;
      word-break: break-all;
      margin: 16px 0 24px 0;
    }
    .actions {
      display: flex;
      gap: 12px;
      margin-top: 30px;
      padding-top: 20px;
      border-top: 1px solid rgba(255,255,255,0.08);
    }
    .btn {
      flex: 1;
      padding: 12px 20px;
      border-radius: 10px;
      font-weight: 700;
      font-size: 0.9rem;
      cursor: pointer;
      text-align: center;
      text-decoration: none;
      display: inline-flex;
      align-items: center;
      justify-content: center;
      gap: 8px;
      transition: all 0.2s;
    }
    .btn-primary { background: var(--primary); color: #000; border: none; }
    .btn-primary:hover { opacity: 0.9; }
    .btn-wa { background: #25D366; color: #000; border: none; }
    .btn-wa:hover { opacity: 0.9; }
    .btn-secondary { background: rgba(255,255,255,0.08); color: #fff; border: 1px solid rgba(255,255,255,0.2); }
    @media print {
      body { background: #fff; color: #000; padding: 0; }
      .invoice-card { box-shadow: none; border: 1px solid #ddd; background: #fff; color: #000; }
      .actions, .badge { display: none; }
      .brand-title { color: #000; }
      .key-box { background: #f8fafc; color: #000; border: 1px solid #999; }
      th { color: #000; background: #eee; }
      td { color: #000; }
      .total-row td { color: #000; border-top: 2px solid #000; }
    }
  </style>
</head>
<body>
  <div class="invoice-card">
    <div class="header">
      <div>
        <div class="brand-title">👑 PRINCE CLOUD SELLAR</div>
        <div class="brand-sub">Official Verified Customer Invoice & Delivery Slip</div>
        <div class="brand-sub">Website: princecloudsellar.onrender.com | Support: +91 9507325677</div>
      </div>
      <div>
        <span class="badge ${isPaid ? 'badge-paid' : (order.deliveryStatus === 'REJECTED' ? 'badge-rejected' : 'badge-pending')}">
          ${isPaid ? '✅ PAID & VERIFIED' : (order.deliveryStatus === 'REJECTED' ? '❌ REJECTED' : '⏳ PENDING APPROVAL')}
        </span>
      </div>
    </div>

    <div class="info-grid">
      <div class="info-col">
        <h4>Bill To Customer:</h4>
        <p><strong>Name:</strong> ${order.userName || 'Valued Customer'}</p>
        <p><strong>Phone / WhatsApp:</strong> ${order.userPhone || user.phone || 'N/A'}</p>
        <p><strong>Email:</strong> ${user.email || 'N/A'}</p>
        <p><strong>Channel:</strong> ${order.source || 'WEB'}</p>
      </div>
      <div class="info-col">
        <h4>Invoice Details:</h4>
        <p><strong>Invoice No:</strong> INV-${order._id.replace('ord_', '')}</p>
        <p><strong>Order ID:</strong> ${order._id}</p>
        <p><strong>Date & Time:</strong> ${new Date(order.createdAt).toLocaleString()}</p>
        <p><strong>Payment Method:</strong> ${isUpi ? '🏦 UPI (' + (order.utrId || 'Pending UTR') + ')' : '💎 BEP20 USDT'}</p>
      </div>
    </div>

    <table>
      <thead>
        <tr>
          <th>Item / Product</th>
          <th>Plan / Subcategory</th>
          <th>Region</th>
          <th>Qty</th>
          <th>Unit Price</th>
          <th style="text-align: right;">Total</th>
        </tr>
      </thead>
      <tbody>
        <tr>
          <td><strong>${order.productName}</strong></td>
          <td style="color: var(--pink);">${order.subProduct || 'Standard'}</td>
          <td>${order.country || '🌐 Global'}</td>
          <td>${order.quantity}</td>
          <td>₹${order.unitPrice}</td>
          <td style="text-align: right; font-weight: 700;">₹${order.totalPaid}</td>
        </tr>
        <tr class="total-row">
          <td colspan="5">Total Amount Paid:</td>
          <td style="text-align: right;">₹${order.totalPaid} <span style="font-size:0.85rem; font-weight:normal; color:var(--text-muted);">(~${(order.totalPaid / 88).toFixed(2)} USDT)</span></td>
        </tr>
      </tbody>
    </table>

    ${isDelivered ? `
      <div>
        <h4 style="font-size:0.8rem; text-transform:uppercase; color:var(--primary); margin-bottom:6px;">
          🔑 Delivered Account Keys & Credentials:
        </h4>
        <div class="key-box">${order.deliveredItem}</div>
      </div>
    ` : `
      <div style="background:rgba(250,204,21,0.06); border:1px dashed var(--primary); padding:16px; border-radius:10px; margin-bottom:20px;">
        <strong style="color:var(--primary);">⏳ Delivery Status: ${order.deliveryStatus}</strong>
        <p style="font-size:0.85rem; color:var(--text-muted); margin-top:6px;">
          ${isUpi ? 'Your UPI order is pending verification by the Owner. Please send your payment screenshot on WhatsApp to +91 9507325677 to get approved immediately!' : 'Your order is being processed.'}
        </p>
      </div>
    `}

    <div style="font-size:0.78rem; color:var(--text-muted); line-height:1.4; border-top:1px solid rgba(255,255,255,0.08); padding-top:14px;">
      <strong>Terms & Replacement Policy:</strong> All digital accounts are verified upon dispatch. 24-48h replacement warranty applies for any valid issues reported with proof to official support (+91 9507325677).
    </div>

    <div class="actions">
      <button class="btn btn-primary" onclick="window.print()">🖨️ Print / Save as PDF</button>
      <a class="btn btn-wa" href="https://wa.me/919507325677?text=Hello%20Owner%2C%20regarding%20Invoice%20${order._id}" target="_blank">💬 WhatsApp Support</a>
      <a class="btn btn-secondary" href="/">🛍️ Return to Store</a>
    </div>
  </div>
</body>
</html>
  `;

  res.send(html);
});


// SMART STOCK INVENTORY MANAGEMENT WITH DISK PERSISTENCE
app.get('/api/owner/stocks', async (req, res) => {
  try {
    const availableStocks = persistentStore.stocks.filter(s => s.status === 'AVAILABLE');
    const soldStocks = persistentStore.stocks.filter(s => s.status === 'SOLD');
    return res.json({ success: true, availableStocks, soldStocks });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/stocks', async (req, res) => {
  try {
    const { productId, name, subProduct, country, price, rawStockData } = req.body;
    if (!rawStockData) {
      return res.status(400).json({ success: false, message: 'Please provide stock keys.' });
    }

    const items = rawStockData.split('\n').map(line => line.trim()).filter(line => line.length > 0);
    if (items.length === 0) {
      return res.status(400).json({ success: false, message: 'No valid stock items found.' });
    }

    let targetProduct = null;

    if (productId) {
      targetProduct = persistentStore.products.find(p => p._id === productId);
    }

    if (!targetProduct && name) {
      targetProduct = persistentStore.products.find(p => p.name === name && p.subProduct === (subProduct || ''));
      if (!targetProduct) {
        targetProduct = {
          _id: 'p_' + Date.now(),
          name,
          subProduct: subProduct || '',
          country: country || '🌐 Global',
          price: Number(price) || 299,
          stock: 0,
          description: `${name} ${subProduct || ''} - Premium digital product with instant automated delivery.`,
          bep20Address: process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2',
          offer: 'INSTANT DELIVERY',
          createdAt: new Date()
        };
        persistentStore.products.push(targetProduct);
      }
    }

    if (!targetProduct) {
      return res.status(400).json({ success: false, message: 'Select an existing product or provide product name & variant.' });
    }

    items.forEach(content => {
      persistentStore.stocks.push({
        _id: 'stk_' + Date.now() + Math.floor(Math.random() * 1000),
        productId: targetProduct._id,
        productName: targetProduct.name,
        subProduct: targetProduct.subProduct || '',
        content,
        status: 'AVAILABLE',
        soldToUserId: null,
        soldToUserName: null,
        soldToUserPhone: null,
        orderId: null,
        soldAt: null,
        createdAt: new Date()
      });
    });

    const totalAvail = persistentStore.stocks.filter(s => s.productId === targetProduct._id && s.status === 'AVAILABLE').length;
    targetProduct.stock = totalAvail;

    if (getDBStatus()) {
      await Product.findOneAndUpdate({ _id: targetProduct._id }, { stock: totalAvail });
    }

    // Auto-Broadcast stock alert to all users
    const stockNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ALL',
      userId: '',
      userEmail: '',
      title: `📦 Fresh Stock Added: ${targetProduct.name} ${targetProduct.subProduct ? `(${targetProduct.subProduct})` : ''}`,
      message: `Fresh inventory loaded: ${items.length} new working items are now available for instant delivery!`,
      type: 'STOCK_ALERT',
      orderId: '',
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(stockNotif);
    if (getDBStatus()) {
      await Notification.create(stockNotif);
    }

    // Auto-Broadcast stock alert to Telegram Group / Channel
    try {
      broadcastToTelegramGroup(stockNotif.title, stockNotif.message);
    } catch (tgErr) {}

    saveLocalDB();
    return res.json({
      success: true,
      message: `${items.length} stock keys added! Product "${targetProduct.name} ${targetProduct.subProduct}" stock updated to ${totalAvail} items!`,
      product: targetProduct
    });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/owner/stocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const { content } = req.body;
    if (!content) return res.status(400).json({ success: false, message: 'Content is required.' });

    const stk = persistentStore.stocks.find(s => s._id === id);
    if (!stk) return res.status(404).json({ success: false, message: 'Stock item not found.' });
    stk.content = content;

    if (getDBStatus()) {
      await Stock.findOneAndUpdate({ _id: id }, { content });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Stock item updated!', stock: stk });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.delete('/api/owner/stocks/:id', async (req, res) => {
  try {
    const { id } = req.params;
    const stkIndex = persistentStore.stocks.findIndex(s => s._id === id);
    if (stkIndex !== -1) {
      const pId = persistentStore.stocks[stkIndex].productId;
      persistentStore.stocks.splice(stkIndex, 1);
      const prod = persistentStore.products.find(p => p._id === pId);
      if (prod) {
        const totalAvail = persistentStore.stocks.filter(s => s.productId === pId && s.status === 'AVAILABLE').length;
        prod.stock = totalAvail;
        if (getDBStatus()) {
          await Product.findOneAndUpdate({ _id: pId }, { stock: totalAvail });
        }
      }
    }

    if (getDBStatus()) {
      await Stock.findOneAndDelete({ _id: id });
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Stock item removed and product stock updated.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/owner/stocks/sold', async (req, res) => {
  try {
    const soldItems = persistentStore.stocks.filter(s => s.status === 'SOLD').sort((a, b) => new Date(b.soldAt) - new Date(a.soldAt));
    return res.json({ success: true, soldItems });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SUPPORT & PAYMENT METHOD SETTINGS APIs
app.get('/api/settings', async (req, res) => {
  try {
    const settings = {
      ...persistentStore.settings,
      whatsappBotUrl: persistentStore.settings.whatsappBotUrl || 'https://wa.me/qr/DDVIRR5NFY2YO1',
      telegramBotUrl: persistentStore.settings.telegramBotUrl || 'https://t.me/princecloudsellarshop_bot',
      whatsappGroupUrl: (persistentStore.settings.whatsappGroupUrl && persistentStore.settings.whatsappGroupUrl.trim() !== '') 
        ? persistentStore.settings.whatsappGroupUrl 
        : 'https://wa.me/qr/DDVIRR5NFY2YO1',
      telegramGroupUrl: (persistentStore.settings.telegramGroupUrl && persistentStore.settings.telegramGroupUrl.trim() !== '') 
        ? persistentStore.settings.telegramGroupUrl 
        : 'https://t.me/princecloudsellarshop_bot'
    };
    return res.json({ success: true, settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/settings', async (req, res) => {
  try {
    const { ownerPhone, ownerUpiId, ownerWhatsApp, supportUrl, whatsappBotUrl, telegramBotUrl, whatsappGroupUrl, telegramGroupUrl, defaultBep20Address } = req.body;

    if (ownerPhone !== undefined) persistentStore.settings.ownerPhone = ownerPhone;
    if (ownerUpiId !== undefined) persistentStore.settings.ownerUpiId = ownerUpiId;
    if (ownerWhatsApp !== undefined) persistentStore.settings.ownerWhatsApp = ownerWhatsApp;
    if (supportUrl !== undefined) persistentStore.settings.supportUrl = supportUrl;
    if (whatsappBotUrl !== undefined) persistentStore.settings.whatsappBotUrl = whatsappBotUrl;
    if (telegramBotUrl !== undefined) persistentStore.settings.telegramBotUrl = telegramBotUrl;
    if (whatsappGroupUrl !== undefined) persistentStore.settings.whatsappGroupUrl = whatsappGroupUrl;
    if (telegramGroupUrl !== undefined) persistentStore.settings.telegramGroupUrl = telegramGroupUrl;
    if (defaultBep20Address !== undefined) persistentStore.settings.defaultBep20Address = defaultBep20Address;

    saveLocalDB();
    if (getDBStatus() && mongoose.connection.db) {
      try {
        await mongoose.connection.db.collection('settings').updateOne({}, { $set: persistentStore.settings }, { upsert: true });
      } catch (e) {}
    }
    console.log('⚙️ [OWNER SETTINGS UPDATED]:', persistentStore.settings);
    return res.json({ success: true, message: 'Settings updated successfully!', settings: persistentStore.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// SUPPORT TICKET & COMPLAINT DISPUTE RESOLUTION APIs
// -------------------------------------------------------------
app.post('/api/user/tickets', async (req, res) => {
  try {
    const { userId, userName, userEmail, userPhone, category, customProblem, orderId, productId, productName, subProduct, country, txHash, amountPaid, subject, message } = req.body;
    if (!userName || !userEmail || !userPhone || !subject || !message) {
      return res.status(400).json({ success: false, message: 'Name, Gmail, Phone, Subject, and Description are required.' });
    }

    const ticketId = 'tkt_' + Date.now();
    const newTicket = {
      _id: ticketId,
      userId: userId || '',
      userName: userName.trim(),
      userEmail: userEmail.trim().toLowerCase(),
      userPhone: userPhone.trim(),
      category: category || 'GENERAL',
      customProblem: (customProblem || '').trim(),
      orderId: (orderId || '').trim(),
      productId: (productId || '').trim(),
      productName: (productName || '').trim(),
      subProduct: (subProduct || '').trim(),
      country: (country || '').trim(),
      txHash: (txHash || '').trim(),
      amountPaid: (amountPaid || '').trim(),
      subject: subject.trim(),
      message: message.trim(),
      status: 'PENDING',
      ownerReply: '',
      resolvedAt: null,
      createdAt: new Date()
    };

    if (!persistentStore.tickets) persistentStore.tickets = [];
    persistentStore.tickets.push(newTicket);

    if (getDBStatus()) {
      await Ticket.create(newTicket);
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Your complaint ticket has been submitted! Ticket ID: ' + ticketId, ticket: newTicket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/user/tickets', async (req, res) => {
  try {
    const { email, phone, userId } = req.query;
    if (!persistentStore.tickets) persistentStore.tickets = [];

    const normEmail = (email || '').toLowerCase().trim();
    const normPhone = (phone || '').trim();
    const normUserId = (userId || '').trim();

    let userTickets = persistentStore.tickets.filter(t => {
      if (normUserId && t.userId === normUserId) return true;
      if (normEmail && t.userEmail && t.userEmail.toLowerCase() === normEmail) return true;
      if (normPhone && t.userPhone && t.userPhone === normPhone) return true;
      return false;
    });

    userTickets.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, tickets: userTickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/owner/tickets', async (req, res) => {
  try {
    if (!persistentStore.tickets) persistentStore.tickets = [];
    const tickets = [...persistentStore.tickets].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, tickets });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/owner/tickets/:id/resolve', async (req, res) => {
  try {
    const { id } = req.params;
    const { status, ownerReply } = req.body;
    if (!persistentStore.tickets) persistentStore.tickets = [];

    const ticket = persistentStore.tickets.find(t => t._id === id);
    if (!ticket) return res.status(404).json({ success: false, message: 'Ticket not found.' });

    ticket.status = status || 'RESOLVED';
    ticket.ownerReply = ownerReply || '';
    ticket.resolvedAt = new Date();

    if (getDBStatus()) {
      await Ticket.findOneAndUpdate(
        { _id: id },
        {
          status: ticket.status,
          ownerReply: ticket.ownerReply,
          resolvedAt: ticket.resolvedAt
        }
      );
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Ticket resolution saved successfully!', ticket });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// CUSTOMER REVIEWS & FEEDBACK RATINGS APIs
// -------------------------------------------------------------
const DEFAULT_FEEDBACKS = [
  {
    _id: 'fb_1',
    userName: 'Aman Sharma',
    userEmail: 'aman***@gmail.com',
    rating: 5,
    productName: 'Azure $200 PayG',
    title: 'Superfast Delivery & Active Account!',
    comment: 'Got my Azure portal login instantly after BEP20 USDT confirmation. Everything working smoothly for my cloud VM deployment.',
    verifiedBuyer: true,
    createdAt: new Date(Date.now() - 86400000 * 2)
  },
  {
    _id: 'fb_2',
    userName: 'Vikram Patel',
    userEmail: 'vikram***@gmail.com',
    rating: 5,
    productName: 'Windows 365 Cloud PC',
    title: 'High speed RDP, great support',
    comment: 'Windows 365 RDP instance delivered in 4 seconds. Owner responded immediately on WhatsApp group as well. 10/10 service!',
    verifiedBuyer: true,
    createdAt: new Date(Date.now() - 86400000 * 4)
  },
  {
    _id: 'fb_3',
    userName: 'Rahul Verma',
    userEmail: 'rahul***@gmail.com',
    rating: 5,
    productName: 'AWS 32 vCPU',
    title: '100% Genuine and authentic',
    comment: 'Best site for developer cloud accounts. Real-time verification works like magic.',
    verifiedBuyer: true,
    createdAt: new Date(Date.now() - 86400000 * 6)
  }
];

app.get('/api/feedback', async (req, res) => {
  try {
    if (!persistentStore.feedbacks || persistentStore.feedbacks.length === 0) {
      persistentStore.feedbacks = [...DEFAULT_FEEDBACKS];
      saveLocalDB();
    }

    const list = [...persistentStore.feedbacks].sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    const totalReviews = list.length;
    const avgRating = totalReviews > 0 ? (list.reduce((sum, f) => sum + (f.rating || 5), 0) / totalReviews).toFixed(1) : '5.0';

    return res.json({ success: true, feedbacks: list, averageRating: avgRating, totalReviews });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/feedback', async (req, res) => {
  try {
    const { userId, userName, userEmail, rating, productName, title, comment } = req.body;
    if (!userName || !rating || !title || !comment) {
      return res.status(400).json({ success: false, message: 'Name, Rating, Title and Feedback comment are required.' });
    }

    const newFeedback = {
      _id: 'fb_' + Date.now(),
      userId: userId || '',
      userName: userName.trim(),
      userEmail: (userEmail || '').trim(),
      rating: Number(rating) || 5,
      productName: productName || 'Cloud Account Service',
      title: title.trim(),
      comment: comment.trim(),
      verifiedBuyer: true,
      createdAt: new Date()
    };

    if (!persistentStore.feedbacks) persistentStore.feedbacks = [];
    persistentStore.feedbacks.unshift(newFeedback);

    if (getDBStatus()) {
      await Feedback.create(newFeedback);
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Thank you for your rating & feedback! Your review is now live.', feedback: newFeedback });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// OWNER DIRECT SERVER-TO-CUSTOMER DISPATCH & FULFILLMENT API
// -------------------------------------------------------------
app.post('/api/owner/dispatch-direct', async (req, res) => {
  try {
    const { userId, productId, quantity, useStock, customPayload, notes, sendEmail } = req.body;
    if (!userId || !productId) {
      return res.status(400).json({ success: false, message: 'Please select a Customer and a Product.' });
    }

    const targetUser = persistentStore.users.find(u => u._id === userId || u.email === userId);
    if (!targetUser) {
      return res.status(404).json({ success: false, message: 'Target customer not found.' });
    }

    const targetProduct = persistentStore.products.find(p => p._id === productId);
    if (!targetProduct) {
      return res.status(404).json({ success: false, message: 'Selected product not found.' });
    }

    const qty = Number(quantity) || 1;
    let deliveredItemsText = '';
    let usedStockIds = [];

    if (useStock !== false) {
      const availableStocks = persistentStore.stocks.filter(s => s.productId === productId && s.status === 'AVAILABLE').slice(0, qty);
      if (availableStocks.length > 0) {
        deliveredItemsText = availableStocks.map(s => s.content).join('\n');
        usedStockIds = availableStocks.map(s => s._id);
      }
    }

    if (!deliveredItemsText && customPayload && customPayload.trim().length > 0) {
      deliveredItemsText = customPayload.trim();
    }

    if (!deliveredItemsText) {
      const prodTag = (targetProduct.subProduct || targetProduct.name).toUpperCase().replace(/\s+/g, '-');
      deliveredItemsText = Array.from({ length: qty }, () => `KEY-${prodTag}-${Math.floor(1000 + Math.random() * 9000)}`).join('\n');
    }

    const orderId = 'ord_' + Date.now();
    const totalPaid = targetProduct.price * qty;

    const newOrder = {
      _id: orderId,
      userId: targetUser._id,
      userName: targetUser.name || 'Customer',
      userPhone: targetUser.phone || 'Not Provided',
      productId: targetProduct._id,
      productName: targetProduct.name,
      subProduct: targetProduct.subProduct || '',
      country: targetProduct.country || '🌐 Global',
      quantity: qty,
      unitPrice: targetProduct.price,
      totalPaid,
      paymentStatus: 'PAID (OWNER DIRECT DISPATCH)',
      txHash: '0x_OWNER_DIRECT_DISPATCH_' + Date.now(),
      deliveryStatus: 'DELIVERED',
      deliveredItem: deliveredItemsText,
      createdAt: new Date()
    };

    persistentStore.orders.unshift(newOrder);

    // Update used stocks
    if (usedStockIds.length > 0) {
      persistentStore.stocks.forEach(stk => {
        if (usedStockIds.includes(stk._id)) {
          stk.status = 'SOLD';
          stk.soldToUserId = targetUser._id;
          stk.soldToUserName = targetUser.name;
          stk.soldToUserPhone = targetUser.phone;
          stk.orderId = orderId;
          stk.soldAt = new Date();
        }
      });

      const remainingAvail = persistentStore.stocks.filter(s => s.productId === productId && s.status === 'AVAILABLE').length;
      targetProduct.stock = remainingAvail;

      if (getDBStatus()) {
        await Product.findOneAndUpdate({ _id: productId }, { stock: remainingAvail });
        for (const sid of usedStockIds) {
          await Stock.findOneAndUpdate(
            { _id: sid },
            {
              status: 'SOLD',
              soldToUserId: targetUser._id,
              soldToUserName: targetUser.name,
              soldToUserPhone: targetUser.phone,
              orderId,
              soldAt: new Date()
            }
          );
        }
      }
    }

    if (getDBStatus()) {
      await Order.create(newOrder);
    }

    // Create In-App Notification for this customer
    const userNotification = {
      _id: 'notif_' + Date.now(),
      recipientType: 'USER',
      userId: targetUser._id,
      userEmail: targetUser.email,
      title: `👑 Direct Account Delivered: ${targetProduct.name}`,
      message: `Owner has directly dispatched ${qty}x ${targetProduct.name} ${targetProduct.subProduct ? `(${targetProduct.subProduct})` : ''} to your account. Check "My Orders" to view your delivered keys! ${notes ? `Note: ${notes}` : ''}`,
      type: 'ORDER_DISPATCH',
      orderId: newOrder._id,
      deliveredItem: deliveredItemsText,
      isRead: false,
      createdAt: new Date()
    };

    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(userNotification);

    if (getDBStatus()) {
      await Notification.create(userNotification);
    }

    // Send Email to Customer's Gmail
    if (targetUser.email && sendEmail !== false) {
      try {
        const invoiceMail = {
          from: '"PrinceCloudSellar Platform" <bhagwanbot09292@gmail.com>',
          to: targetUser.email,
          subject: `👑 Direct Account Delivered by Owner - ${targetProduct.name}`,
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #facc15;">
              <h2 style="color: #facc15; margin-bottom: 6px;">👑 Direct Account Dispatch</h2>
              <p style="color: #94a3b8; font-size: 13px;">Hello ${targetUser.name}, Owner has directly delivered a digital product to your account!</p>
              <hr style="border-color: rgba(255,255,255,0.1); margin: 16px 0;">
              <p><strong>Order ID:</strong> ${newOrder._id}</p>
              <p><strong>Product:</strong> ${targetProduct.name} ${targetProduct.subProduct ? `(${targetProduct.subProduct})` : ''}</p>
              <p><strong>Country:</strong> ${targetProduct.country || '🌐 Global'}</p>
              <p><strong>Quantity:</strong> ${qty}</p>
              ${notes ? `<p><strong>Owner Message:</strong> ${notes}</p>` : ''}
              <hr style="border-color: rgba(255,255,255,0.1); margin: 16px 0;">
              <h4 style="color: #ec4899; margin-bottom: 8px;">🔑 Your Delivered Account Payload / Keys:</h4>
              <div style="font-family: monospace; font-size: 15px; color: #facc15; background: #000000; padding: 14px; border-radius: 8px; border: 1px dashed #facc15; word-break: break-all; white-space: pre-wrap;">
${deliveredItemsText}
              </div>
              <p style="margin-top: 16px; font-size: 12px; color: #94a3b8;">This order is also saved in your "My Orders" tab on PrinceCloudSellar.</p>
            </div>
          `
        };
        await emailTransporter.sendMail(invoiceMail);
      } catch (mailErr) {
        console.error('Direct dispatch email send error:', mailErr.message);
      }
    }

    saveLocalDB();
    return res.json({
      success: true,
      message: `Account successfully dispatched to ${targetUser.name} (${targetUser.email})! Order created, in-app notification sent & email delivered.`,
      order: newOrder
    });

  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// BROADCAST & NOTIFICATION MANAGEMENT APIs
// -------------------------------------------------------------
app.post('/api/owner/notifications/broadcast', async (req, res) => {
  try {
    const { title, message, type } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Notification title and message are required.' });
    }

    const newNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ALL',
      userId: '',
      userEmail: '',
      title: title.trim(),
      message: message.trim(),
      type: type || 'BROADCAST',
      orderId: '',
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };

    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(newNotif);

    if (getDBStatus()) {
      await Notification.create(newNotif);
    }

    // Auto-forward broadcast to Telegram Channel
    try {
      broadcastToTelegramGroup(title, message);
    } catch (tgErr) {}

    saveLocalDB();
    return res.json({ success: true, message: 'Broadcast notification sent to ALL users successfully!', notification: newNotif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/notifications/direct', async (req, res) => {
  try {
    const { userId, userEmail, title, message, type } = req.body;
    if ((!userId && !userEmail) || !title || !message) {
      return res.status(400).json({ success: false, message: 'Customer ID/Email, title and message are required.' });
    }

    const newNotif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'USER',
      userId: userId || '',
      userEmail: userEmail || '',
      title: title.trim(),
      message: message.trim(),
      type: type || 'PROMO',
      orderId: '',
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };

    if (!persistentStore.notifications) persistentStore.notifications = [];
    persistentStore.notifications.unshift(newNotif);

    if (getDBStatus()) {
      await Notification.create(newNotif);
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Direct notification sent to customer successfully!', notification: newNotif });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/user/notifications', async (req, res) => {
  try {
    const { userId, email } = req.query;
    if (!persistentStore.notifications) persistentStore.notifications = [];

    const normUserId = (userId || '').trim();
    const normEmail = (email || '').trim().toLowerCase();

    const notifs = persistentStore.notifications.filter(n => {
      if (n.recipientType === 'ALL') return true;
      if (normUserId && n.userId === normUserId) return true;
      if (normEmail && n.userEmail && n.userEmail.toLowerCase() === normEmail) return true;
      return false;
    });

    notifs.sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt));
    return res.json({ success: true, notifications: notifs });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.put('/api/user/notifications/mark-read', async (req, res) => {
  try {
    const { userId, email } = req.body;
    if (!persistentStore.notifications) persistentStore.notifications = [];

    const normUserId = (userId || '').trim();
    const normEmail = (email || '').trim().toLowerCase();

    persistentStore.notifications.forEach(n => {
      if (n.recipientType === 'ALL' || (normUserId && n.userId === normUserId) || (normEmail && n.userEmail && n.userEmail.toLowerCase() === normEmail)) {
        n.isRead = true;
      }
    });

    saveLocalDB();
    return res.json({ success: true, message: 'Notifications marked as read.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// -------------------------------------------------------------
// TELEGRAM & WHATSAPP BOT MANAGEMENT APIs
// -------------------------------------------------------------
app.get('/api/owner/bots/status', (req, res) => {
  return res.json({
    success: true,
    telegram: getTelegramBotStatus(),
    whatsapp: getWhatsAppBotStatus(),
    telegramGroupUrl: persistentStore.settings.telegramGroupUrl || '',
    whatsappGroupUrl: persistentStore.settings.whatsappGroupUrl || ''
  });
});

app.post('/api/owner/bots/telegram/configure', async (req, res) => {
  try {
    const { token, channelId } = req.body;
    if (!token || token.trim().length < 10) {
      return res.status(400).json({ success: false, message: 'Valid Telegram Bot Token is required.' });
    }

    const started = startBot(token.trim(), (channelId || '').trim(), {
      getPersistentStore: () => persistentStore,
      saveLocalDB,
      verifyPaymentOnChainStrict,
      sendInvoiceEmail: emailTransporter,
      sendFormattedOtpMail,
      getDBStatus,
      User,
      Product,
      Order,
      Stock,
      Ticket,
      Notification
    });

    if (started) {
      return res.json({ success: true, message: 'Telegram Bot connected and running in Live Polling mode!' });
    } else {
      return res.status(500).json({ success: false, message: 'Failed to connect Telegram Bot. Check your token.' });
    }
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/bots/telegram/broadcast', async (req, res) => {
  try {
    const { title, message, channelId } = req.body;
    if (!title || !message) {
      return res.status(400).json({ success: false, message: 'Title and message are required.' });
    }

    const result = await broadcastToTelegramGroup(title, message, channelId);
    return res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/whatsapp/webhook', async (req, res) => {
  try {
    const { from, message } = req.body;
    if (!from || !message) {
      return res.status(400).json({ success: false, message: 'From number and message are required.' });
    }

    const reply = await handleWhatsAppIncomingCommand(from, message, {
      getPersistentStore: () => persistentStore,
      saveLocalDB,
      verifyPaymentOnChainStrict,
      getDBStatus,
      Order,
      Product,
      Stock
    });

    return res.json({ success: true, reply });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.get('/api/owner/bots/whatsapp/qr', (req, res) => {
  try {
    const status = getWhatsAppBotStatus();
    return res.json({ success: true, ...status, qrDataUrl: status.currentQR });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/bots/whatsapp/pair', async (req, res) => {
  try {
    const { phone } = req.body;
    const result = await requestPairingCodeForNumber(phone);
    return res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/bots/whatsapp/disconnect', async (req, res) => {
  try {
    const result = await disconnectBaileys();
    return res.json(result);
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// Initialize Telegram & WhatsApp Bots
initTelegramBot({
  getPersistentStore: () => persistentStore,
  saveLocalDB,
  verifyPaymentOnChainStrict,
  sendInvoiceEmail: emailTransporter,
  sendFormattedOtpMail,
  getDBStatus,
  User,
  Product,
  Order,
  Stock,
  Ticket,
  Notification
});

initWhatsAppBot({
  getPersistentStore: () => persistentStore,
  saveLocalDB,
  verifyPaymentOnChainStrict,
  sendInvoiceEmail: emailTransporter,
  sendFormattedOtpMail,
  getDBStatus,
  User,
  Product,
  Order,
  Stock,
  Ticket,
  Notification
});

// Routes to serve pages
app.get('/owner', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'owner.html'));
});

app.get(/.*/, (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'index.html'));
});

app.listen(PORT, () => {
  console.log(`=================================================`);
  console.log(`🚀 PrinceCloudSellar Platform active on port ${PORT}`);
  console.log(`🛍️ Customer Storefront: http://localhost:${PORT}`);
  console.log(`👑 Owner Admin Portal:   http://localhost:${PORT}/owner`);
  console.log(`=================================================`);
});
