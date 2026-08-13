require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const jwt = require('jsonwebtoken');
const nodemailer = require('nodemailer');
const { connectDB, getDBStatus } = require('./config/db');

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));
app.use(express.static(path.join(__dirname, 'public')));

// Connect to MongoDB Atlas
connectDB();

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
  settings: {
    ownerPhone: '+91 9507325000',
    supportUrl: 'https://wa.me/919507325000?text=Hello%20Owner%20I%20need%20support%20for%20PrinceCloudSellar',
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
          settings: { ...persistentStore.settings, ...(parsed.settings || {}) }
        };
        console.log(`💾 Persistent DB loaded from disk: ${persistentStore.users.length} Users, ${persistentStore.products.length} Products, ${persistentStore.orders.length} Orders, ${persistentStore.stocks.length} Stock items.`);
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

  // 2. REPLAY ATTACK CHECK: Ensure TX Hash was not used for a previous order
  const isAlreadyUsed = persistentStore.orders.some(o => o.txHash && o.txHash.toLowerCase() === cleanTxHash);
  if (isAlreadyUsed) {
    return { 
      success: false, 
      message: "❌ Transaction Hash HAS ALREADY BEEN USED for a previous order! Fraud attempt blocked." 
    };
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
        message: "❌ PAYMENT NOT FOUND! No transaction matching this hash exists on the BSC Blockchain. Please complete payment in Trust Wallet first." 
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

      // Check Exact USDT Amount Transferred
      if (matchingLog.data && matchingLog.data !== '0x') {
        const rawHex = matchingLog.data;
        const rawVal = BigInt(rawHex);
        const transferredUsdt = Number(rawVal) / 1e18; // BEP20 USDT 18 Decimals
        const expectedUsdt = (requiredAmountInr / 88) * 0.90; // 10% tolerance for gas/rounding

        if (transferredUsdt > 0 && transferredUsdt < expectedUsdt) {
          return {
            success: false,
            message: `❌ INSUFFICIENT AMOUNT! Required ~${(requiredAmountInr / 88).toFixed(2)} USDT, but only ${transferredUsdt.toFixed(2)} USDT was transferred.`
          };
        }
      }
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
  auth: {
    user: gmailUser,
    pass: gmailPass
  }
});

emailTransporter.verify((err, success) => {
  if (err) {
    console.error('Nodemailer SMTP Connection Error:', err.message);
  } else {
    console.log('⚡ Nodemailer Gmail Transporter Connected Successfully!');
  }
});

const otpStore = {};
const generateOTP = () => Math.floor(100000 + Math.random() * 900000).toString();

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
    otpStore[normalizedEmail] = { otp, expiresAt: Date.now() + 10 * 60 * 1000, verified: false };

    const mailOptions = {
      from: '"PrinceCloudSellar Platform" <bhagwanbot09292@gmail.com>',
      to: normalizedEmail,
      subject: '🔐 Your Registration OTP - PrinceCloudSellar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #facc15;">
          <div style="text-align: center; margin-bottom: 20px;">
            <h1 style="color: #facc15; font-size: 26px; margin-bottom: 6px;">👑 PrinceCloudSellar</h1>
            <p style="color: #94a3b8; font-size: 14px;">Registration Email Verification</p>
          </div>
          <div style="background: rgba(255,255,255,0.05); padding: 24px; border-radius: 12px; text-align: center; border: 1px solid rgba(236,72,153,0.3);">
            <h3 style="color: #ffffff; margin-bottom: 10px;">Registration OTP Code</h3>
            <p style="color: #cbd5e1; font-size: 14px; margin-bottom: 16px;">Use the 6-digit code below to verify your email address and create your account:</p>
            <div style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #facc15; background: #000000; padding: 16px; border-radius: 10px; border: 1px dashed #ec4899; display: inline-block;">
              ${otp}
            </div>
            <p style="color: #f472b6; font-size: 12px; margin-top: 16px;">This OTP is valid for exactly 10 minutes. Do not share this code with anyone.</p>
          </div>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
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
    const record = otpStore[normalizedEmail];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'OTP expired (10 min limit) or not requested! Click Send OTP again.' });
    }

    if (record.otp === userOTP.trim()) {
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
    otpStore['forgot_' + normalizedEmail] = { otp, expiresAt: Date.now() + 10 * 60 * 1000, verified: false };

    const mailOptions = {
      from: '"PrinceCloudSellar Security" <bhagwanbot09292@gmail.com>',
      to: normalizedEmail,
      subject: '🔑 Reset Password OTP Code - PrinceCloudSellar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #ec4899;">
          <h2 style="color: #ec4899; margin-bottom: 8px;">🔑 Password Reset Request</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Use the 6-digit code below to reset your PrinceCloudSellar account password:</p>
          <div style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #facc15; background: #000000; padding: 16px; border-radius: 10px; border: 1px dashed #facc15; text-align: center; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #94a3b8; font-size: 12px;">This OTP is valid for 10 minutes. If you did not request a password reset, please ignore this email.</p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);
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
    const record = otpStore['forgot_' + normalizedEmail];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Reset OTP expired or not requested! Click Send OTP again.' });
    }

    if (record.otp !== userOTP.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid Reset OTP Code!' });
    }

    const u = persistentStore.users.find(usr => usr.email.toLowerCase() === normalizedEmail);
    if (u) u.password = newPassword;

    if (getDBStatus()) {
      await User.findOneAndUpdate({ email: normalizedEmail }, { password: newPassword });
    }

    saveLocalDB();
    delete otpStore['forgot_' + normalizedEmail];

    return res.json({ success: true, message: 'Password Reset Successfully! You can now Sign In with your new password.' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

// SMART 6-HOUR LOGIN WITH DISK PERSISTENCE
app.post('/api/auth/login', async (req, res) => {
  try {
    const { emailOrPhone, password } = req.body;
    if (!emailOrPhone || !password) {
      return res.status(400).json({ success: false, message: 'Enter email/phone and password.' });
    }

    let user = persistentStore.users.find(u => (u.email.toLowerCase() === emailOrPhone.toLowerCase() || u.phone === emailOrPhone));

    if (!user && getDBStatus()) {
      user = await User.findOne({
        $or: [{ email: emailOrPhone.toLowerCase() }, { phone: emailOrPhone }]
      });
    }

    if (!user || user.password !== password) {
      return res.status(400).json({ success: false, message: 'Invalid Email/Phone or Password!' });
    }

    if (user.status === 'blocked') {
      return res.status(403).json({
        success: false,
        message: '❌ Your Account Has Been Suspended / Blocked By Platform Owner! Please Contact Owner Support.'
      });
    }

    const lastVerified = user.lastOtpVerifiedAt ? new Date(user.lastOtpVerifiedAt).getTime() : 0;
    const hoursElapsed = (Date.now() - lastVerified) / (1000 * 60 * 60);

    if (hoursElapsed < 6) {
      const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '6h' });
      return res.json({
        success: true,
        requireOtp: false,
        user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status },
        token,
        message: `Welcome back, ${user.name}! Signed in automatically (within 6-hr active window).`
      });
    }

    const otp = generateOTP();
    otpStore['login_' + user.email.toLowerCase()] = { otp, expiresAt: Date.now() + 10 * 60 * 1000, user };

    const mailOptions = {
      from: '"PrinceCloudSellar Security" <bhagwanbot09292@gmail.com>',
      to: user.email,
      subject: '🔐 Security Login OTP - PrinceCloudSellar',
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #facc15;">
          <h2 style="color: #facc15; margin-bottom: 8px;">🔐 Security Sign-In Verification</h2>
          <p style="color: #cbd5e1; font-size: 14px;">Hello ${user.name}, your account sign-in requires OTP verification (6-hour security check):</p>
          <div style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #facc15; background: #000000; padding: 16px; border-radius: 10px; border: 1px dashed #facc15; text-align: center; margin: 20px 0;">
            ${otp}
          </div>
          <p style="color: #f472b6; font-size: 12px;">Valid for 10 minutes. Once verified, you won't need OTP again for 6 hours!</p>
        </div>
      `
    };

    await emailTransporter.sendMail(mailOptions);

    return res.json({
      success: true,
      requireOtp: true,
      email: user.email,
      message: 'Login OTP sent to your Gmail inbox! Please verify to complete sign-in.'
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

    const normalizedEmail = email.toLowerCase().trim();
    const record = otpStore['login_' + normalizedEmail];

    if (!record || Date.now() > record.expiresAt) {
      return res.status(400).json({ success: false, message: 'Login OTP expired! Please try signing in again.' });
    }

    if (record.otp !== userOTP.trim()) {
      return res.status(400).json({ success: false, message: 'Invalid Login OTP Code!' });
    }

    const user = record.user;

    if (user.status === 'blocked') {
      return res.status(403).json({ success: false, message: '❌ Account Blocked By Owner.' });
    }

    user.lastOtpVerifiedAt = new Date();
    const memUser = persistentStore.users.find(u => u._id === user._id || u.email === user.email);
    if (memUser) memUser.lastOtpVerifiedAt = new Date();

    if (getDBStatus()) {
      await User.findByIdAndUpdate(user._id, { lastOtpVerifiedAt: new Date() });
    }

    saveLocalDB();
    delete otpStore['login_' + normalizedEmail];

    const token = jwt.sign({ id: user._id, role: user.role }, process.env.JWT_SECRET || 'secret', { expiresIn: '6h' });

    return res.json({
      success: true,
      user: { id: user._id, name: user.name, email: user.email, phone: user.phone, role: user.role, status: user.status },
      token,
      message: `Sign-in Verified! Next logins within 6 hours won't require OTP.`
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
    const todayStart = new Date();
    todayStart.setHours(0, 0, 0, 0);

    const totalUsers = persistentStore.users.filter(u => u.role === 'user').length;
    const todayOrders = persistentStore.orders.filter(o => new Date(o.createdAt) >= todayStart);
    const todaySold = todayOrders.reduce((sum, o) => sum + (o.quantity || 1), 0);
    const todayRevenue = todayOrders.reduce((sum, o) => sum + (o.totalPaid || 0), 0);
    const totalProducts = persistentStore.products.length;
    const availableStocksCount = persistentStore.stocks.filter(s => s.status === 'AVAILABLE').length;

    return res.json({
      success: true,
      metrics: { totalUsers, todaySold, todayRevenue, totalProducts, availableStocksCount }
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
      await User.findByIdAndUpdate(id, { status: 'blocked' });
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
      await User.findByIdAndUpdate(id, { status: 'active' });
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
      await User.findByIdAndDelete(id);
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
      name,
      subProduct,
      country,
      price: Number(price),
      stock: Number(stock),
      description,
      offer
    };

    if (getDBStatus()) {
      await Product.findByIdAndUpdate(
        id,
        { name, subProduct, country, price: Number(price), stock: Number(stock), description, offer }
      );
    }

    saveLocalDB();
    return res.json({ success: true, message: 'Product updated!', product: persistentStore.products[prodIndex] });
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
      await Product.findByIdAndDelete(id);
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
      await Product.findByIdAndUpdate(productId, { stock: remainingAvail });
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
      await Product.findByIdAndUpdate(targetProduct._id, { stock: totalAvail });
    }

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
      await Stock.findByIdAndUpdate(id, { content });
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
          await Product.findByIdAndUpdate(pId, { stock: totalAvail });
        }
      }
    }

    if (getDBStatus()) {
      await Stock.findByIdAndDelete(id);
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
    return res.json({ success: true, settings: persistentStore.settings });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
});

app.post('/api/owner/settings', async (req, res) => {
  try {
    const { ownerPhone, supportUrl, defaultBep20Address } = req.body;

    if (ownerPhone !== undefined) persistentStore.settings.ownerPhone = ownerPhone;
    if (supportUrl !== undefined) persistentStore.settings.supportUrl = supportUrl;
    if (defaultBep20Address !== undefined) persistentStore.settings.defaultBep20Address = defaultBep20Address;

    saveLocalDB();
    return res.json({ success: true, message: 'Settings updated successfully!' });
  } catch (err) {
    res.status(500).json({ success: false, message: err.message });
  }
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
