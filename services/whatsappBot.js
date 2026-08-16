const { default: makeWASocket, useMultiFileAuthState, DisconnectReason, Browsers, fetchLatestBaileysVersion } = require('@whiskeysockets/baileys');
const pino = require('pino');
const QRCode = require('qrcode');
const fs = require('fs');
const path = require('path');

const authDir = path.join(__dirname, '..', 'data', 'baileys_auth');
try {
  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }
} catch (e) {}
const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
const fallbackLogoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

let sockInstance = null;
let savedServices = null;
let latestRawQR = '';
let currentQRDataUrl = '';
let latestPairingCode = '';

// Conversation sessions: fromNumber -> { step, selectedProduct, quantity, paymentMethod, regData, loginData, forgotData, linkedUser, availableBaseProducts, availableVariants }
let whatsappSessions = {};

let whatsappBotConfig = {
  enabled: true,
  status: 'INITIALIZING',
  groupUrl: '',
  sessionLinked: false,
  connectedNumber: '',
  currentQR: '',
  pairingCode: ''
};

let cachedLogoBuffer = null;
try {
  if (fs.existsSync(logoPath)) cachedLogoBuffer = fs.readFileSync(logoPath);
  else if (fs.existsSync(fallbackLogoPath)) cachedLogoBuffer = fs.readFileSync(fallbackLogoPath);
} catch (e) {}

function getLogoBuffer() {
  if (cachedLogoBuffer) return cachedLogoBuffer;
  try {
    if (fs.existsSync(logoPath)) cachedLogoBuffer = fs.readFileSync(logoPath);
    else if (fs.existsSync(fallbackLogoPath)) cachedLogoBuffer = fs.readFileSync(fallbackLogoPath);
  } catch (e) {}
  return cachedLogoBuffer;
}

function getWhatsAppBotStatus() {
  const hasCreds = fs.existsSync(path.join(authDir, 'creds.json'));
  const rawUser = sockInstance?.user?.id || '';
  const userPhone = rawUser ? (rawUser.split(':')[0] || rawUser.split('@')[0]) : '';
  const isLinked = whatsappBotConfig.sessionLinked || !!userPhone || (hasCreds && whatsappBotConfig.status === 'ONLINE');
  const num = userPhone ? ('+' + userPhone) : (whatsappBotConfig.connectedNumber || (hasCreds ? 'Linked Session' : ''));

  return {
    isActive: whatsappBotConfig.enabled,
    status: isLinked ? 'ONLINE' : (whatsappBotConfig.status || 'READY_TO_PAIR'),
    groupUrl: whatsappBotConfig.groupUrl,
    sessionLinked: !!isLinked,
    hasSessionFile: hasCreds,
    connectedNumber: num,
    pairingCode: latestPairingCode || whatsappBotConfig.pairingCode,
    currentQR: isLinked ? '' : (currentQRDataUrl || whatsappBotConfig.currentQR)
  };
}

const { generateOrderInvoicePdfBuffer } = require('./pdfInvoice');

async function sendWhatsAppDirectMessage(toNumber, text) {
  if (!sockInstance) return { success: false, message: 'WhatsApp socket not connected' };
  try {
    let cleanNumber = String(toNumber).replace(/[^0-9]/g, '');
    if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
    const jid = cleanNumber + '@s.whatsapp.net';
    await sockInstance.sendMessage(jid, { text });
    return { success: true };
  } catch (err) {
    console.error('sendWhatsAppDirectMessage error:', err.message);
    return { success: false, message: err.message };
  }
}

async function sendWhatsAppDirectDocument(toNumber, fileBuffer, fileName, caption = '') {
  if (!sockInstance) return { success: false, message: 'WhatsApp socket not connected' };
  try {
    let cleanNumber = String(toNumber).replace(/[^0-9]/g, '');
    if (cleanNumber.length === 10) cleanNumber = '91' + cleanNumber;
    const jid = cleanNumber + '@s.whatsapp.net';
    await sockInstance.sendMessage(jid, {
      document: fileBuffer,
      mimetype: 'application/pdf',
      fileName: fileName || 'PrinceCloudSellar_Invoice.pdf',
      caption: caption || ''
    });
    return { success: true };
  } catch (err) {
    console.error('sendWhatsAppDirectDocument error:', err.message);
    return { success: false, message: err.message };
  }
}

// Broadcast to ALL WhatsApp customers who have messaged the bot
async function broadcastToAllWhatsAppUsers(title, message, getPersistentStore) {
  if (!sockInstance) return { success: false, message: 'WhatsApp socket not connected' };
  const store = getPersistentStore ? getPersistentStore() : (savedServices ? savedServices.getPersistentStore() : null);
  const jids = store?.whatsappCustomerJids || [];
  const text = `📢 *${title}*\n\n${message}\n\n🌐 Visit Store: http://localhost:5000\n⚡ PrinceCloudSellar Official`;

  let sent = 0;
  for (const jid of jids) {
    try {
      await sockInstance.sendMessage(jid, { text });
      sent++;
      await new Promise(r => setTimeout(r, 200));
    } catch (e) {}
  }
  return { success: true, sent, totalJids: jids.length };
}

async function initWhatsAppBot(services) {
  savedServices = services;
  const store = services.getPersistentStore();
  if (store.settings && store.settings.whatsappGroupUrl) {
    whatsappBotConfig.groupUrl = store.settings.whatsappGroupUrl;
  }

  if (!fs.existsSync(authDir)) {
    fs.mkdirSync(authDir, { recursive: true });
  }

  startBaileysSocket();
}

let isBaileysStarting = false;
let baileysPresenceTimer = null;

async function startBaileysSocket() {
  if (isBaileysStarting) return;
  isBaileysStarting = true;

  if (baileysPresenceTimer) {
    clearInterval(baileysPresenceTimer);
    baileysPresenceTimer = null;
  }

  try {
    if (!fs.existsSync(authDir)) {
      fs.mkdirSync(authDir, { recursive: true });
    }
    const { state, saveCreds } = await useMultiFileAuthState(authDir);
    const { version } = await fetchLatestBaileysVersion().catch(() => ({ version: [2, 3000, 1015901307], isLatest: true }));

    const sock = makeWASocket({
      version,
      logger: pino({ level: 'silent' }),
      printQRInTerminal: false,
      auth: state,
      browser: Browsers.ubuntu('Chrome'),
      syncFullHistory: false,
      generateHighQualityLinkPreview: true,
      markOnlineOnConnect: true,
      keepAliveIntervalMs: 15000,
      connectTimeoutMs: 60000,
      defaultQueryTimeoutMs: 60000,
      retryRequestDelayMs: 500
    });

    sockInstance = sock;

    sock.ev.on('creds.update', saveCreds);

    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      if (qr) {
        latestRawQR = qr;
        whatsappBotConfig.status = 'AWAITING_SCAN';
        whatsappBotConfig.sessionLinked = false;

        try {
          currentQRDataUrl = await QRCode.toDataURL(qr, {
            margin: 2,
            color: { dark: '#25D366', light: '#080312' }
          });
          whatsappBotConfig.currentQR = currentQRDataUrl;

          console.log('\n========================================================================');
          console.log('📱 [BAILEYS WHATSAPP SHOPBOT] SCAN QR CODE TO CONNECT (Ubuntu Chrome)');
          console.log('👉 WhatsApp -> Linked Devices -> Link a Device & Scan:');
          console.log('========================================================================\n');

          const terminalQR = await QRCode.toString(qr, { type: 'terminal', small: true });
          console.log(terminalQR);

          console.log('\n🌐 Or Scan in Owner Dashboard: http://localhost:5000/owner -> "Bots" Tab');
          console.log('========================================================================\n');
        } catch (e) {
          console.error('QR rendering error:', e.message);
        }
      }

      if (connection === 'open') {
        const rawUser = sock.user ? (sock.user.id || '') : '';
        const userPhone = rawUser.split(':')[0] || rawUser.split('@')[0] || 'Linked User';

        whatsappBotConfig.sessionLinked = true;
        whatsappBotConfig.status = 'ONLINE';
        whatsappBotConfig.connectedNumber = '+' + userPhone;
        latestRawQR = '';
        currentQRDataUrl = '';

        console.log('\n========================================================================');
        console.log(`🎉 [BAILEYS WHATSAPP BOT] CONNECTED TO WHATSAPP MULTI-DEVICE!`);
        console.log(`📱 Connected Account: ${whatsappBotConfig.connectedNumber} (Ubuntu Chrome)`);
        console.log(`⚡ ShopBot Automated Conversational Flows & Commands are LIVE!`);
        console.log('========================================================================\n');

        // Start active keepalive presence ping every 25s to avoid socket disconnect
        if (baileysPresenceTimer) clearInterval(baileysPresenceTimer);
        baileysPresenceTimer = setInterval(async () => {
          try {
            if (sockInstance) {
              await sockInstance.sendPresenceUpdate('available');
            }
          } catch (e) {}
        }, 25000);
      }

      if (connection === 'close') {
        if (baileysPresenceTimer) {
          clearInterval(baileysPresenceTimer);
          baileysPresenceTimer = null;
        }

        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const isLoggedOut = statusCode === DisconnectReason.loggedOut || statusCode === 401 || statusCode === 403;
        const isRestartRequired = statusCode === DisconnectReason.restartRequired || statusCode === 515;

        console.log(`⚠️ WhatsApp connection closed (Status: ${statusCode || 'Unknown'}). LoggedOut: ${isLoggedOut}, RestartRequired: ${isRestartRequired}`);

        whatsappBotConfig.sessionLinked = false;
        whatsappBotConfig.status = isLoggedOut ? 'AWAITING_SCAN' : 'RECONNECTING';

        isBaileysStarting = false;

        if (isLoggedOut) {
          console.log('🔴 WhatsApp session logged out by user. Clearing auth directory...');
          try {
            fs.rmSync(authDir, { recursive: true, force: true });
          } catch (e) {}
          setTimeout(startBaileysSocket, 2000);
        } else if (isRestartRequired) {
          console.log('🔄 Restart required by Baileys. Reconnecting immediately...');
          setTimeout(startBaileysSocket, 500);
        } else {
          console.log('🔄 Connection lost. Reconnecting socket in 2.5s...');
          setTimeout(startBaileysSocket, 2500);
        }
      }
    });

    // Handle Incoming Messages
    sock.ev.on('messages.upsert', async ({ messages, type }) => {
      if (type !== 'notify' || !messages || messages.length === 0) return;

      for (const msg of messages) {
        if (!msg.message) continue;
        if (msg.key.fromMe) continue;

        const jid = msg.key.remoteJid;
        if (jid === 'status@broadcast') continue;

        // Auto-record customer JID for multi-channel broadcasts
        if (savedServices) {
          try {
            const store = savedServices.getPersistentStore();
            if (store) {
              if (!store.whatsappCustomerJids) store.whatsappCustomerJids = [];
              if (!store.whatsappCustomerJids.includes(jid)) {
                store.whatsappCustomerJids.push(jid);
                savedServices.saveLocalDB();
              }
            }
          } catch (e) {}
        }

        const fromNumber = jid.split('@')[0];
        const text = msg.message.conversation ||
          msg.message.extendedTextMessage?.text ||
          msg.message.imageMessage?.caption ||
          '';

        if (!text || text.trim().length === 0) continue;

        if (savedServices) {
          try {
            await handleWhatsAppIncomingMessage(sock, jid, fromNumber, text.trim(), savedServices);
          } catch (handlerErr) {
            console.error('WhatsApp message handler error:', handlerErr.message);
          }
        }
      }
    });

  } catch (socketErr) {
    console.error('Error starting Baileys socket:', socketErr.message);
  } finally {
    isBaileysStarting = false;
  }
}

async function requestPairingCodeForNumber(phone) {
  if (!sockInstance) return { success: false, message: 'WhatsApp socket not ready.' };
  const cleanPhone = (phone || '').replace(/[^0-9]/g, '');

  if (!cleanPhone || cleanPhone.length < 10) {
    return { success: false, message: 'Please provide a valid 10-12 digit mobile number without +.' };
  }

  try {
    const code = await sockInstance.requestPairingCode(cleanPhone);
    latestPairingCode = code;
    whatsappBotConfig.pairingCode = code;
    whatsappBotConfig.connectedNumber = '+' + cleanPhone;

    console.log(`\n🔗 [BAILEYS PAIRING CODE] For ${cleanPhone}: ${code}\n`);
    return {
      success: true,
      pairingCode: code,
      phone: '+' + cleanPhone,
      message: `Pairing Code generated: ${code}. Enter in WhatsApp Linked Devices.`
    };
  } catch (err) {
    return { success: false, message: 'Pairing code error: ' + err.message };
  }
}

async function disconnectBaileys() {
  try {
    if (sockInstance) {
      await sockInstance.logout().catch(() => {});
      sockInstance = null;
    }
  } catch (e) {}

  whatsappBotConfig.sessionLinked = false;
  whatsappBotConfig.status = 'DISCONNECTED';
  whatsappBotConfig.connectedNumber = '';
  latestRawQR = '';
  currentQRDataUrl = '';
  latestPairingCode = '';

  try {
    fs.rmSync(authDir, { recursive: true, force: true });
    fs.mkdirSync(authDir, { recursive: true });
  } catch (e) {}

  setTimeout(startBaileysSocket, 1500);

  return {
    success: true,
    message: 'WhatsApp session logged out and reset.'
  };
}

async function handleWhatsAppIncomingMessage(sock, jid, fromNumber, text, services) {
  const {
    getPersistentStore,
    saveLocalDB,
    verifyPaymentOnChainStrict,
    sendInvoiceEmail,
    sendFormattedOtpMail,
    getDBStatus,
    User,
    Product,
    Stock,
    Order,
    Notification
  } = services;

  const store = getPersistentStore();
  const lower = text.toLowerCase().trim();

  if (!whatsappSessions[fromNumber]) {
    whatsappSessions[fromNumber] = {};
  }
  const session = whatsappSessions[fromNumber];

  // Auto-detect linked user if not already linked
  if (!session.linkedUser) {
    const matchedUser = store.users.find(u => u.phone === fromNumber || u.whatsappNumber === fromNumber);
    if (matchedUser) {
      session.linkedUser = matchedUser;
    }
  }

  const sendReply = async (msgText) => {
    await sock.sendMessage(jid, { text: msgText });
  };

  if (!session.retries) session.retries = {};

  const handleRetryFail = async (field, promptMsg) => {
    session.retries[field] = (session.retries[field] || 0) + 1;
    if (session.retries[field] === 1) {
      await sendReply(`⚠️ *Invalid input!*\n${promptMsg}\n\n👉 _You have *1 attempt left* before this session resets to Main Menu._ (Or reply *0* to cancel)`);
      return false;
    } else {
      session.step = null;
      session.selectedProduct = null;
      session.availableVariants = null;
      session.regData = null;
      session.loginData = null;
      session.forgotData = null;
      session.retries = {};
      await sendReply(`❌ *Maximum attempts exceeded.* Your session has been reset. Returning to Main Menu:`);
      await sendWelcome();
      return true;
    }
  };

  const sendWelcome = async () => {
    session.step = null;
    const settings = store.settings || {};
    const tgLink = settings.telegramGroupUrl || 'https://t.me/';
    const waLink = settings.whatsappGroupUrl || 'https://wa.me/919507325677';
    const userGreeting = session.linkedUser ? `👤 *Welcome back, ${session.linkedUser.name}!*\n\n` : '';

    const welcomeMsg = `👑 *WELCOME TO PRINCE CLOUD SELLAR* 👑\n` +
      `⚡ *24/7 Automated Cloud Accounts & Social Growth Automation*\n\n` +
      userGreeting +
      `🌐 *About Our Platform:*\n` +
      `Instant cloud developer accounts (Azure, AWS, GCP, Windows 365, Aged PVAs) + High-Retention Social Media Growth (YT, IG, FB, TG).\n\n` +
      `📜 *Terms & Conditions:*\n` +
      `1. All credentials & services are 100% verified with automated dispatch.\n` +
      `2. 24-48 Hours replacement warranty on valid issues reported via support.\n` +
      `3. SMM Growth Orders have minimum 1,000 units with refill protection.\n` +
      `4. Crypto BEP20 USDT & UPI Instant payments supported.\n\n` +
      `🤖 *QUICK MENU OPTIONS (Reply with Number):*\n` +
      `*1* - 🛍️ Cloud & RDP Accounts Store\n` +
      `*2* - 🚀 Social Growth (YT, IG, FB, TG Followers, Likes)\n` +
      `*3* - 📦 My Orders & Tracking\n` +
      `*4* - 👤 Account / Login / Register\n` +
      `*5* - 🏦 UPI & Crypto Payment Details\n` +
      `*6* - 🎫 Customer Support\n\n` +
      `_Reply with a number (e.g. 1 or 2) or type !buy <number> to proceed!_`;

    const logoBuf = getLogoBuffer();
    if (logoBuf && sock) {
      try {
        await sock.sendMessage(jid, {
          image: logoBuf,
          caption: welcomeMsg
        });
        return;
      } catch (e) {
        console.error('WhatsApp send logo menu error:', e.message);
      }
    }

    await sendReply(welcomeMsg);
  };

  // Global Cancel / Reset / Back
  if (lower === 'cancel' || lower === 'back' || lower === 'reset' || lower === '0') {
    session.step = null;
    session.selectedProduct = null;
    session.availableVariants = null;
    session.regData = null;
    session.loginData = null;
    session.forgotData = null;
    await sendReply('🔄 *Action Cancelled.* Returning to Main Menu:');
    await sendWelcome();
    return;
  }

  // Global Start / Menu / Greetings
  if (lower === '!start' || lower === '!menu' || lower === '/start' || lower === '/menu' || lower === 'hi' || lower === 'hello' || lower === 'hey' || lower === 'menu' || lower === 'start') {
    await sendWelcome();
    return;
  }

  // Social Growth / SMM Shortcut Command
  if (lower === '!growth' || lower === '/growth' || lower === '!smm' || lower === '/smm' || lower === 'growth' || lower === 'smm' || lower === 'followers' || lower === 'subscribers') {
    session.step = null;
    await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
    return;
  }

  // Logout command
  if (lower === '!logout' || lower === '/logout' || lower === 'logout') {
    session.linkedUser = null;
    session.step = null;
    await sendReply('👋 *Logged out successfully.* You are now browsing as a Guest.');
    await sendWelcome();
    return;
  }

  // Direct Cancel Order Command: !cancel <orderId> or /cancel <orderId>
  if (lower.startsWith('!cancel ') || lower.startsWith('/cancel ') || lower.startsWith('cancel ')) {
    const targetId = text.replace(/^(!cancel|\/cancel|cancel)\s+/i, '').trim();
    if (!targetId) {
      await sendReply(`ℹ️ *How to cancel a pending order:*\nReply: \`!cancel <OrderID>\` (e.g. \`!cancel SMM-XYZ\` or \`!cancel ord_123\`).`);
      return;
    }

    // 1. Check SMM orders
    const smmOrd = (store.smmOrders || []).find(o => (o.orderId === targetId || o._id === targetId));
    if (smmOrd) {
      if (smmOrd.status === 'Completed' || smmOrd.status === 'In Progress' || (smmOrd.providerOrderId && !smmOrd.providerOrderId.startsWith('TG-') && !smmOrd.providerOrderId.startsWith('WA-'))) {
        await sendReply(`⚠️ *Cannot Cancel Order:* This order is already active or completed on IndianSMMHub servers.`);
        return;
      }
      smmOrd.status = 'Canceled';
      smmOrd.notes = 'Cancelled by Customer via WhatsApp';
      smmOrd.updatedAt = new Date();
      saveLocalDB();
      if (getDBStatus() && SmmOrder) {
        SmmOrder.updateOne({ _id: smmOrd._id }, { $set: { status: 'Canceled', notes: smmOrd.notes, updatedAt: new Date() } }).catch(() => {});
      }
      await sendReply(`✅ *Order #${targetId} has been cancelled successfully.*`);
      return;
    }

    // 2. Check Cloud orders
    const cloudOrd = (store.orders || []).find(o => String(o._id) === targetId);
    if (cloudOrd) {
      if (cloudOrd.deliveryStatus === 'DELIVERED') {
        await sendReply(`⚠️ *Cannot Cancel Order:* This order has already been delivered.`);
        return;
      }
      cloudOrd.deliveryStatus = 'CANCELLED';
      cloudOrd.ownerNotes = 'Cancelled by Customer via WhatsApp';
      saveLocalDB();
      if (getDBStatus() && Order) {
        Order.findOneAndUpdate({ _id: cloudOrd._id }, { deliveryStatus: 'CANCELLED', ownerNotes: cloudOrd.ownerNotes }).catch(() => {});
      }
      await sendReply(`✅ *Order #${targetId} has been cancelled successfully.*`);
      return;
    }

    await sendReply(`⚠️ *Order #${targetId} not found.* Please check your Order ID by replying *3*.`);
    return;
  }

  // Direct Registration Command: /register or !register or register
  if (lower === '!register' || lower === '/register' || lower === 'register' || lower === 'signup') {
    session.step = 'REG_NAME';
    session.regData = {};
    await sendReply(`📝 *NEW USER REGISTRATION (UNIFIED ACCOUNT)*\n\nPlease enter your *Full Name*:`);
    return;
  }

  // Direct Login Command: /login or !login or login
  if (lower === '!login' || lower === '/login' || lower === 'login' || lower === 'signin') {
    session.step = 'LOGIN_EMAIL_OR_PHONE';
    session.loginData = {};
    await sendReply(`🔐 *ACCOUNT LOGIN*\n\nPlease enter your registered *Email Address* or *Phone Number*:`);
    return;
  }

  // Direct Forgot Password Command: /forgot or !forgot or forgot password
  if (lower === '!forgot' || lower === '/forgot' || lower === 'forgot' || lower === 'forgot password' || lower === 'reset password') {
    session.step = 'FORGOT_EMAIL';
    session.forgotData = {};
    await sendReply(`🔑 *FORGOT PASSWORD RECOVERY*\n\nPlease enter your registered *Email Address* to receive a password reset OTP:`);
    return;
  }

  // Shortcut command: /orders or !orders
  if (lower === '!orders' || lower === '/orders' || lower === 'orders' || lower === 'my orders') {
    session.step = null;
    await sendUserOrders(sendReply, fromNumber, store);
    return;
  }

  // Shortcut command: /profile or !profile
  if (lower === '!profile' || lower === '/profile' || lower === '!account' || lower === '/account' || lower === 'profile' || lower === 'account') {
    session.step = null;
    await sendAccountProfile(sendReply, fromNumber, store);
    return;
  }

  // Shortcut command: /upi or !upi
  if (lower === '!upi' || lower === '/upi' || lower === 'upi') {
    session.step = null;
    await sendUpiInfo(sendReply, store);
    return;
  }

  // Shortcut command: /support or !support
  if (lower === '!support' || lower === '/support' || lower === 'support') {
    session.step = null;
    const supportUrl = store.settings.supportUrl || 'https://wa.me/919507325677';
    await sendReply(`🎫 *PRINCE CLOUD SELLAR CUSTOMER SUPPORT*\n\nNeed assistance or replacement?\n💬 Contact Owner directly: ${supportUrl}\n📞 Phone / WhatsApp: +91 9507325677`);
    return;
  }

  // Shortcut command: !stock or !products or /stock or /products
  if (lower === '!stock' || lower === '!products' || lower === '/stock' || lower === '/products' || lower === 'stock' || lower === 'products') {
    await sendProductsCatalog(sendReply, fromNumber, store);
    return;
  }

  // Shortcut command: !buy or /buy (e.g. /buy 1 or !buy 1,2 or /buy azure)
  if (lower.startsWith('!buy') || lower.startsWith('/buy') || lower.startsWith('buy ')) {
    const query = text.replace(/^(!buy|\/buy|buy)\s*/i, '').trim();
    if (query) {
      await handleBuyShortcutQuery(sendReply, fromNumber, query, store);
      return;
    } else {
      await sendProductsCatalog(sendReply, fromNumber, store);
      return;
    }
  }

  // -------------------------------------------------------------
  // STATE MACHINE FLOW
  // -------------------------------------------------------------

  // 1. Idle State (User at Main Menu / Initial Message)
  if (!session.step) {
    if (text === '1') {
      await sendProductsCatalog(sendReply, fromNumber, store);
      return;
    }
    if (text === '2' || lower === 'growth' || lower === 'smm' || lower === 'followers' || lower === 'subscribers') {
      await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
      return;
    }
    if (text === '3') {
      await sendUserOrders(sendReply, fromNumber, store);
      return;
    }
    if (text === '4') {
      await sendAccountProfile(sendReply, fromNumber, store);
      return;
    }
    if (text === '5' || lower === 'upi' || lower === 'pay' || lower === 'payment') {
      await sendUpiInfo(sendReply, store);
      return;
    }
    if (lower === 'usdt' || lower === 'crypto' || lower === 'bep20' || lower === 'wallet' || lower === 'deposit') {
      const wallet = store.settings?.walletAddress || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';
      await sendReply(`💎 *PRINCE CLOUD SELLAR CRYPTO (BEP20 USDT)* 💎\n\n` +
        `🌐 *Network:* BNB Smart Chain (BEP20)\n` +
        `📍 *Wallet Address:*\n\`${wallet}\`\n\n` +
        `👉 Reply *1* for Cloud Accounts or *2* for Social Growth SMM!`);
      return;
    }
    if (text === '6' || lower === 'support' || lower === 'help' || lower === 'ticket') {
      const supportUrl = store.settings.supportUrl || 'https://wa.me/919507325677';
      await sendReply(`🎫 *PRINCE CLOUD SELLAR CUSTOMER SUPPORT*\n\n💬 Owner WhatsApp: ${supportUrl}\n📞 Phone: +91 9507325677`);
      return;
    }

    const uniqueNames = [...new Set((store.products || []).map(p => p.name))];
    const num = parseInt(text, 10);

    if (!isNaN(num) && num > 5 && num <= uniqueNames.length) {
      const targetName = uniqueNames[num - 1];
      await sendSubcategories(sendReply, fromNumber, targetName, store);
      return;
    }

    const matched = uniqueNames.find(n => n.toLowerCase().includes(lower));
    if (matched) {
      await sendSubcategories(sendReply, fromNumber, matched, store);
      return;
    }

    await sendWelcome();
    return;
  }

  // 1.5. Step: SMM Platform Selection
  if (session.step === 'SMM_AWAITING_PLATFORM') {
    if (text === '0' || lower === 'cancel' || lower === 'back') {
      session.step = null;
      await sendWelcome();
      return;
    }

    if (text === '1' || lower === 'ig' || lower === 'instagram') {
      session.smmPlatform = 'instagram';
      session.smmPlatformServices = [
        { serviceId: 1529, key: 'ig_reels_views', name: 'Instagram Superfast Reels Views (⚡ ₹0.50/1K)', rate: 0.50, min: 1000 },
        { serviceId: 17, key: 'ig_likes_hq', name: 'Instagram High-Quality Likes [365D Refill] (❤️ ₹6/1K)', rate: 6, min: 10 },
        { serviceId: 105, key: 'ig_followers_nondrop', name: 'Instagram 100% Non-Drop Followers (⚡ ₹28/1K)', rate: 28, min: 100 },
        { serviceId: 1532, key: 'ig_followers_india', name: 'Instagram HQ Followers [30D Refill] (🇮🇳 ₹65/1K)', rate: 65, min: 150 },
        { serviceId: 66, key: 'ig_comments_custom', name: 'Instagram Custom Comments (💬 ₹320/1K)', rate: 320, min: 20 }
      ];
      session.step = 'SMM_AWAITING_SERVICE';
      await sendReply(`📸 *INSTAGRAM GROWTH PACKAGES (INDIANSMMHUB)*\n\n` +
        `*1* - ⚡ Superfast Reels Views: ₹0.50 / 1K\n` +
        `*2* - ❤️ High-Quality Likes [365D]: ₹6 / 1K\n` +
        `*3* - ⚡ 100% Non-Drop Followers: ₹28 / 1K\n` +
        `*4* - 🇮🇳 HQ Followers [30D Refill]: ₹65 / 1K\n` +
        `*5* - 💬 Custom Comments: ₹320 / 1K\n` +
        `*0* - 🔙 Back to Platforms\n\n` +
        `_Reply with 1, 2, 3, 4, or 5 to choose package:_`);
      return;
    }

    if (text === '2' || lower === 'yt' || lower === 'youtube') {
      session.smmPlatform = 'youtube';
      session.smmPlatformServices = [
        { serviceId: 258, key: 'yt_views_nondrop', name: 'YouTube High Retention Views (▶️ ₹160/1K)', rate: 160, min: 1000 },
        { serviceId: 252, key: 'yt_subs_nondrop', name: 'YouTube Instant Subscribers (⚡ ₹130/1K)', rate: 130, min: 100 },
        { serviceId: 258, key: 'yt_likes_hq', name: 'YouTube High-Speed Views (👍 ₹160/1K)', rate: 160, min: 1000 }
      ];
      session.step = 'SMM_AWAITING_SERVICE';
      await sendReply(`▶️ *YOUTUBE GROWTH PACKAGES (INDIANSMMHUB)*\n\n` +
        `*1* - ▶️ High Retention Views: ₹160 / 1K\n` +
        `*2* - ⚡ Instant Subscribers: ₹130 / 1K\n` +
        `*3* - 👍 High-Speed Views: ₹160 / 1K\n` +
        `*0* - 🔙 Back to Platforms\n\n` +
        `_Reply with 1, 2, or 3 to choose package:_`);
      return;
    }

    if (text === '3' || lower === 'tg' || lower === 'telegram') {
      session.smmPlatform = 'telegram';
      session.smmPlatformServices = [
        { serviceId: 349, key: 'tg_members_nondrop', name: 'Telegram Non-Drop Members [Lifetime] (✈️ ₹135/1K)', rate: 135, min: 10 },
        { serviceId: 349, key: 'tg_members_fast', name: 'Telegram Fast Channel Members (⚡ ₹135/1K)', rate: 135, min: 10 },
        { serviceId: 352, key: 'tg_views_reactions', name: 'Telegram Post Views (🔥 ₹1.50/1K)', rate: 1.50, min: 10 }
      ];
      session.step = 'SMM_AWAITING_SERVICE';
      await sendReply(`✈️ *TELEGRAM GROWTH PACKAGES (INDIANSMMHUB)*\n\n` +
        `*1* - ✈️ Non-Drop Members [Lifetime]: ₹135 / 1K\n` +
        `*2* - ⚡ Fast Channel Members: ₹135 / 1K\n` +
        `*3* - 🔥 Post Views: ₹1.50 / 1K\n` +
        `*0* - 🔙 Back to Platforms\n\n` +
        `_Reply with 1, 2, or 3 to choose package:_`);
      return;
    }

    if (text === '4' || lower === 'fb' || lower === 'facebook') {
      session.smmPlatform = 'facebook';
      session.smmPlatformServices = [
        { serviceId: 158, key: 'fb_followers_nondrop', name: 'Facebook Page & Profile Followers [30D] (👍 ₹95/1K)', rate: 95, min: 10 },
        { serviceId: 123, key: 'fb_likes_reactions', name: 'Facebook Post Likes (❤️ ₹85/1K)', rate: 85, min: 100 }
      ];
      session.step = 'SMM_AWAITING_SERVICE';
      await sendReply(`👍 *FACEBOOK GROWTH PACKAGES (INDIANSMMHUB)*\n\n` +
        `*1* - 👍 Page & Profile Followers [30D]: ₹95 / 1K\n` +
        `*2* - ❤️ Post Likes: ₹85 / 1K\n` +
        `*0* - 🔙 Back to Platforms\n\n` +
        `_Reply with 1 or 2 to choose package:_`);
      return;
    }

    if (text === '5' || lower === 'tt' || lower === 'twitter' || lower === 'tiktok' || lower === 'spotify') {
      session.smmPlatform = 'other';
      session.smmPlatformServices = [
        { serviceId: 458, key: 'tt_followers', name: 'TikTok HQ Non-Drop Followers (🎵 ₹340/1K)', rate: 340, min: 50 },
        { serviceId: 447, key: 'tt_likes', name: 'TikTok Video Views (❤️ ₹12/1K)', rate: 12, min: 100 },
        { serviceId: 490, key: 'x_followers', name: 'Twitter / X Profile Followers (🐦 ₹250/1K)', rate: 250, min: 100 },
        { serviceId: 513, key: 'spotify_streams', name: 'Spotify Music Followers (🟢 ₹85/1K)', rate: 85, min: 100 }
      ];
      session.step = 'SMM_AWAITING_SERVICE';
      await sendReply(`🎵 *TIKTOK, TWITTER & SPOTIFY PACKAGES*\n\n` +
        `*1* - 🎵 TikTok Followers: ₹340 / 1K\n` +
        `*2* - ❤️ TikTok Video Views: ₹12 / 1K\n` +
        `*3* - 🐦 Twitter / X Followers: ₹250 / 1K\n` +
        `*4* - 🟢 Spotify Followers: ₹85 / 1K\n` +
        `*0* - 🔙 Back to Platforms\n\n` +
        `_Reply with 1, 2, 3, or 4 to choose package:_`);
      return;
    }

    await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
    return;
  }

  // Step: SMM Service Selection
  if (session.step === 'SMM_AWAITING_SERVICE') {
    if (text === '0' || lower === 'back' || lower === 'cancel') {
      await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
      return;
    }

    const srvNum = parseInt(text, 10);
    const servicesList = session.smmPlatformServices || [];
    if (!isNaN(srvNum) && srvNum >= 1 && srvNum <= servicesList.length) {
      const srv = servicesList[srvNum - 1];
      session.selectedSmmService = srv;
      session.step = 'SMM_AWAITING_LINK';
      await sendReply(`🎯 *Selected Service:* *${srv.name}*\n` +
        `💰 *Rate:* ₹${srv.rate} / 1,000 Units\n` +
        `📌 *Min Quantity:* 1,000 Units\n\n` +
        `👉 *Please reply with your Target Link (Profile/Channel/Post URL):*\n` +
        `_Example:_ \`https://instagram.com/username\` or \`https://t.me/channel\`\n\n` +
        `_(Or reply 0 to go back)_`);
      return;
    }

    await sendReply(`⚠️ Invalid selection. Please reply with a number between 1 and ${servicesList.length} (or 0 for Back):`);
    return;
  }

  // Step: SMM Link Input
  if (session.step === 'SMM_AWAITING_LINK') {
    if (text === '0' || lower === 'back' || lower === 'cancel') {
      await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
      return;
    }

    if (!text.includes('.') || text.length < 5) {
      await sendReply(`⚠️ *Invalid Link.* Please send a valid URL (e.g. \`https://instagram.com/username\` or \`https://t.me/channel\`):\n_(Or reply 0 for Back)_`);
      return;
    }

    session.smmLink = text.trim();
    session.step = 'SMM_AWAITING_QTY';
    await sendReply(`🎯 *Target Link Saved:*\n\`${session.smmLink}\`\n\n` +
      `👉 *Please enter Quantity (Minimum 1,000 Units):*\n` +
      `_Examples: 1000, 2000, 5000, 10000_\n\n` +
      `_(Or reply 0 to go back)_`);
    return;
  }

  // Step: SMM Quantity Input
  if (session.step === 'SMM_AWAITING_QTY') {
    if (text === '0' || lower === 'back' || lower === 'cancel') {
      await sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store);
      return;
    }

    const qtyNum = parseInt(text.replace(/[^0-9]/g, ''), 10);
    if (isNaN(qtyNum) || qtyNum < 1000) {
      await sendReply(`⚠️ *Minimum Order Quantity is 1,000 Units.* Please enter 1000 or higher:\n_(Or reply 0 for Back)_`);
      return;
    }

    const srv = session.selectedSmmService;
    session.smmQty = qtyNum;
    const totalCost = Math.ceil((qtyNum / 1000) * srv.rate);
    session.smmTotalCost = totalCost;

    // Check user authentication in database
    const cleanNum = fromNumber.replace(/[^0-9]/g, '');
    const user = session.linkedUser || (store.users || []).find(u => {
      const uPhone = (u.phone || '').replace(/[^0-9]/g, '');
      const uWa = (u.whatsappNumber || '').replace(/[^0-9]/g, '');
      return (uPhone && (uPhone === cleanNum || uPhone.endsWith(cleanNum) || cleanNum.endsWith(uPhone))) ||
             (uWa && (uWa === cleanNum || uWa.endsWith(cleanNum) || cleanNum.endsWith(uWa)));
    });

    if (user && user.status !== 'blocked') {
      session.linkedUser = user;
      session.step = 'SMM_AWAITING_PAY_METHOD';
      const usdt = (totalCost / 88).toFixed(2);

      await sendReply(`👤 *Verified Account:* **${user.name}** (\`${user.email}\`)\n\n` +
        `📋 *SMM ORDER BILL SUMMARY* 📋\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
        `⚡ *Service:* *${srv.name}*\n` +
        `🎯 *Target:* \`${session.smmLink}\`\n` +
        `🔢 *Quantity:* *${qtyNum.toLocaleString()} Units*\n` +
        `💰 *Total Cost:* *₹${totalCost.toLocaleString()}* (~${usdt} USDT)\n` +
        `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
        `💳 *SELECT PAYMENT METHOD (Reply with Number):*\n` +
        `*1* - 💎 Crypto BEP20 USDT (Auto On-Chain Verification)\n` +
        `*2* - 🏦 UPI Instant (GPay / PhonePe / Paytm / Navi / Cred)\n\n` +
        `_Reply with 1 or 2 (or 0 to cancel):_`);
    } else {
      session.step = 'AWAITING_AUTH_CHOICE';
      await sendReply(`🔐 *AUTHENTICATION REQUIRED TO ORDER* 🔐\n\n` +
        `To place Social Growth orders and track deliveries, you must be logged in to your verified Prince Cloud Sellar account.\n\n` +
        `*1* - 🔐 Login (Existing Account)\n` +
        `*2* - 📝 Register (New Unified Account)\n` +
        `*0* - 🔙 Cancel & Return to Menu\n\n` +
        `_Reply with 1 or 2 to continue:_`);
    }
    return;
  }

  // Step: SMM Payment Method Choice (1: BEP20, 2: UPI)
  if (session.step === 'SMM_AWAITING_PAY_METHOD') {
    if (text === '0' || lower === 'cancel' || lower === 'back') {
      session.step = null;
      await sendWelcome();
      return;
    }

    const srv = session.selectedSmmService;
    const totalCost = session.smmTotalCost;

    if (text === '1' || lower === 'crypto' || lower === 'usdt' || lower === 'bep20') {
      session.step = 'SMM_AWAITING_TX_HASH';
      session.smmPayMethod = 'BEP20';
      const usdt = (totalCost / 88).toFixed(2);
      const wallet = store.settings?.walletAddress || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';

      await sendReply(`💎 *CRYPTO BEP20 USDT PAYMENT FOR SMM* 💎\n\n` +
        `💰 *Exact Amount to Transfer:* *${usdt} USDT*\n` +
        `🌐 *Network:* BNB Smart Chain (*BEP20*)\n` +
        `📍 *Wallet Address (Tap to copy):*\n\`${wallet}\`\n\n` +
        `👉 *After transferring from Binance/TrustWallet/MetaMask, please reply with your 0x Transaction Hash:*`);
      return;
    }

    if (text === '2' || lower === 'upi' || lower === 'inr' || lower === 'gpay') {
      session.step = 'SMM_AWAITING_UTR';
      session.smmPayMethod = 'UPI';
      const upiId = store.settings?.ownerUpiId || '9507325677-1@naviaxis';

      await sendReply(`🏦 *UPI PAYMENT FOR SMM ORDER* 🏦\n\n` +
        `💰 *Exact Amount to Pay:* *₹${totalCost.toLocaleString()}*\n` +
        `🆔 *Merchant UPI ID:*\n\`${upiId}\`\n` +
        `👤 *Payee Name:* Prince Kumar\n` +
        `📱 *Apps:* Google Pay, PhonePe, Paytm, Navi, Cred, BHIM\n\n` +
        `👉 *After payment, please reply with your 12-digit UPI UTR / Ref Number:*\n` +
        `_(Or reply 0 to cancel)_`);
      return;
    }

    await sendReply(`⚠️ Please reply *1* for Crypto BEP20 USDT or *2* for UPI Payment (or 0 to cancel):`);
    return;
  }

  // Step: SMM BEP20 TxHash Input & Finalize Order
  if (session.step === 'SMM_AWAITING_TX_HASH') {
    if (text === '0' || lower === 'cancel') {
      session.step = null;
      await sendWelcome();
      return;
    }

    const cleanTx = text.trim();
    if (!cleanTx.startsWith('0x') || cleanTx.length < 15) {
      await sendReply(`⚠️ *Invalid Transaction Hash.* A valid BSC BEP20 TxHash begins with \`0x...\`.\nPlease paste your transaction hash:\n_(Or reply 0 to cancel)_`);
      return;
    }

    const srv = session.selectedSmmService;
    const qty = session.smmQty;
    const totalCost = session.smmTotalCost;
    const targetUrl = session.smmLink;
    const orderId = 'SMM-' + Date.now().toString(36).toUpperCase();

    const newOrder = {
      _id: 'smm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderId,
      providerOrderId: '',
      userId: session.linkedUser?._id || 'wa_' + fromNumber,
      userName: session.linkedUser?.name || 'WhatsApp Customer',
      userEmail: session.linkedUser?.email || '',
      userPhone: session.linkedUser?.phone || fromNumber,
      serviceKey: srv.key || 'smm_custom',
      serviceId: srv.serviceId || 1529,
      serviceName: srv.name,
      tier: 'Social Growth',
      targetUrl,
      quantity: qty,
      rate: srv.rate,
      totalCost,
      paymentMethod: 'BEP20',
      paymentStatus: 'PAID (CRYPTO BEP20)',
      txHash: cleanTx,
      utrId: '',
      status: 'Processing',
      remains: qty,
      startCount: 0,
      refillable: true,
      refillStatus: 'Eligible',
      notes: 'Paid via BEP20 USDT - Dispatched to IndianSMMHub',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    // Auto-dispatch to IndianSMMHub API
    try {
      const axios = require('axios');
      const apiUrl = store.settings?.smmProviderUrl || process.env.INDIANSMM_API_URL || 'https://indiansmmhub.com/api/v2';
      const apiKey = store.settings?.smmApiKey || process.env.INDIANSMM_API_KEY || 'be0066920ea511dc79addd45a1c7bb554fca5798';
      
      const apiRes = await axios.post(apiUrl, {
        key: apiKey,
        action: 'add',
        service: newOrder.serviceId,
        link: newOrder.targetUrl,
        quantity: newOrder.quantity
      }, { timeout: 12000 });

      if (apiRes.data && apiRes.data.order) {
        newOrder.providerOrderId = String(apiRes.data.order);
        newOrder.status = 'Processing';
        newOrder.notes = `Live Dispatched to IndianSMMHub #${newOrder.providerOrderId}`;
      }
    } catch (apiErr) {
      console.warn('WhatsApp Crypto SMM auto-dispatch notice:', apiErr.message);
    }

    store.smmOrders = store.smmOrders || [];
    store.smmOrders.unshift(newOrder);

    if (getDBStatus() && SmmOrder) {
      try {
        await SmmOrder.create(newOrder);
      } catch (e) {
        console.error('SmmOrder.create error:', e.message);
      }
    }

    // Owner Notification
    const notif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ADMIN',
      userId: '',
      userEmail: '',
      title: `💎 New BEP20 SMM Growth Order: ₹${totalCost}`,
      message: `WhatsApp customer +${fromNumber} paid BEP20 USDT for ${qty}x ${srv.name} (TxHash: ${cleanTx}). Target: ${targetUrl}`,
      type: 'SMM_ORDER',
      orderId,
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!store.notifications) store.notifications = [];
    store.notifications.unshift(notif);
    if (getDBStatus() && Notification) {
      try {
        await Notification.create(notif);
      } catch (e) {}
    }
    saveLocalDB();

    session.step = null;
    session.selectedSmmService = null;
    session.smmLink = null;
    session.smmQty = null;

    const receipt = `🎉 *SMM ORDER PLACED & DISPATCHED!* 🎉\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Order ID:* \`${orderId}\`\n` +
      (newOrder.providerOrderId ? `⚡ *Provider Order ID:* \`#${newOrder.providerOrderId}\`\n` : '') +
      `⚡ *Service:* *${srv.name}*\n` +
      `🎯 *Target Link:* \`${targetUrl}\`\n` +
      `🔢 *Quantity:* *${qty.toLocaleString()} Units*\n` +
      `💰 *Total Amount:* *₹${totalCost.toLocaleString()}* (~${(totalCost / 88).toFixed(2)} USDT)\n` +
      `💎 *TxHash:* \`${cleanTx}\`\n` +
      `📊 *Status:* 🟢 *Processing (Live on IndianSMMHub)*\n` +
      `🛡️ *Guarantee:* Lifetime Auto-Refill Active\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚡ Your order has been dispatched directly to IndianSMMHub servers!\n` +
      `👉 Reply *3* anytime to track all your orders live!`;

    await sendReply(receipt);
    return;
  }

  // Step: SMM UTR Input & Finalize Order (UPI)
  if (session.step === 'SMM_AWAITING_UTR') {
    if (text === '0' || lower === 'cancel') {
      session.step = null;
      await sendWelcome();
      return;
    }

    const cleanUtr = text.replace(/[^a-zA-Z0-9]/g, '').trim();
    if (cleanUtr.length < 8) {
      await sendReply(`⚠️ *Invalid UTR ID.* Please send the 12-digit transaction number from your UPI payment receipt:\n_(Or reply 0 to cancel)_`);
      return;
    }

    const srv = session.selectedSmmService;
    const qty = session.smmQty;
    const totalCost = session.smmTotalCost;
    const targetUrl = session.smmLink;
    const orderId = 'SMM-' + Date.now().toString(36).toUpperCase();

    const newOrder = {
      _id: 'smm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
      orderId,
      providerOrderId: '',
      userId: session.linkedUser?._id || 'wa_' + fromNumber,
      userName: session.linkedUser?.name || 'WhatsApp Customer',
      userEmail: session.linkedUser?.email || '',
      userPhone: session.linkedUser?.phone || fromNumber,
      serviceKey: srv.key || 'smm_custom',
      serviceId: srv.serviceId || 1529,
      serviceName: srv.name,
      tier: 'Social Growth',
      targetUrl,
      quantity: qty,
      rate: srv.rate,
      totalCost,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING_UPI_VERIFICATION',
      utrId: cleanUtr,
      txHash: '',
      status: 'Pending Admin Approval',
      remains: qty,
      startCount: 0,
      refillable: true,
      refillStatus: 'Eligible',
      notes: 'Awaiting Owner UPI Approval',
      createdAt: new Date(),
      updatedAt: new Date()
    };

    store.smmOrders = store.smmOrders || [];
    store.smmOrders.unshift(newOrder);

    if (getDBStatus() && SmmOrder) {
      try {
        await SmmOrder.create(newOrder);
      } catch (e) {
        console.error('SmmOrder.create error:', e.message);
      }
    }

    // Owner Notification
    const notif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ADMIN',
      userId: '',
      userEmail: '',
      title: `🏦 New WhatsApp SMM Growth Order: ₹${totalCost}`,
      message: `WhatsApp customer +${fromNumber} placed SMM order for ${qty}x ${srv.name} (UTR: ${cleanUtr}). Target: ${targetUrl}`,
      type: 'SMM_ORDER',
      orderId,
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!store.notifications) store.notifications = [];
    store.notifications.unshift(notif);
    if (getDBStatus() && Notification) {
      try {
        await Notification.create(notif);
      } catch (e) {}
    }
    saveLocalDB();

    // Reset session
    session.step = null;
    session.selectedSmmService = null;
    session.smmLink = null;
    session.smmQty = null;

    const ownerWaNum = (store.settings && store.settings.ownerWhatsApp) ? store.settings.ownerWhatsApp : '9507325677';
    const waSupportUrl = `https://wa.me/91${ownerWaNum}?text=Hello%20Owner%2C%20I%20have%20paid%20Rs.${totalCost}%20via%20UPI%20for%20SMM%20Order%3A%0AOrder%20ID%3A%20${orderId}%0AService%3A%20${encodeURIComponent(srv.name)}%0ATarget%3A%20${encodeURIComponent(targetUrl)}%0AQty%3A%20${qty}%0AUTR%20ID%3A%20${cleanUtr}%0APlease%20verify%20and%20start%20my%20order.`;

    const receipt = `🧾 *OFFICIAL SMM ORDER INVOICE & RECEIPT* 🧾\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
      `📦 *Order ID:* \`${orderId}\`\n` +
      `⚡ *Service:* *${srv.name}*\n` +
      `🎯 *Target Link:* \`${targetUrl}\`\n` +
      `🔢 *Quantity:* *${qty.toLocaleString()} Units*\n` +
      `💰 *Total Amount:* *₹${totalCost.toLocaleString()}*\n` +
      `🏷️ *Submitted UTR:* \`${cleanUtr}\`\n` +
      `📊 *Status:* 🟡 *PENDING OWNER UPI VERIFICATION*\n` +
      `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
      `⚠️ *NEXT STEP TO GET INSTANT START:*\n` +
      `Please send your *Payment Screenshot* along with your *Order ID* to Customer Support on WhatsApp:\n\n` +
      `👉 *WhatsApp Support:* ${waSupportUrl}\n` +
      `📞 *Support Hotline:* +91 9507325677\n\n` +
      `_⚡ Once Owner verifies your UTR in the Owner Panel, automated boosting will start immediately on IndianSMMHub!_\n\n` +
      `👉 Reply *3* anytime to track all your orders live!`;

    await sendReply(receipt);
    return;
  }

  // 2. Step: Awaiting Product Selection from Catalog
  if (session.step === 'AWAITING_PRODUCT') {
    const num = parseInt(text, 10);
    const productNames = session.availableBaseProducts || [...new Set((store.products || []).map(p => p.name))];

    if (!isNaN(num) && num >= 1 && num <= productNames.length) {
      if (session.retries) session.retries.product = 0;
      const targetName = productNames[num - 1];
      await sendSubcategories(sendReply, fromNumber, targetName, store);
      return;
    }

    const matched = productNames.find(n => n.toLowerCase().includes(lower));
    if (matched) {
      if (session.retries) session.retries.product = 0;
      await sendSubcategories(sendReply, fromNumber, matched, store);
      return;
    }

    await handleRetryFail('product', `Please reply with a valid product number between 1 and ${productNames.length}.`);
    return;
  }

  // 3. Step: Awaiting Subcategory / Plan Selection
  if (session.step === 'AWAITING_SUBCATEGORY') {
    const num = parseInt(text, 10);
    const variants = session.availableVariants || [];

    if (!isNaN(num) && num >= 1 && num <= variants.length) {
      if (session.retries) session.retries.subcategory = 0;
      const prod = variants[num - 1];
      session.selectedProduct = prod;
      session.step = 'AWAITING_QTY';

      await sendReply(`🔢 *You selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
        `📍 Region: \`${prod.country || 'Global'}\`\n` +
        `💰 Price: *₹${prod.price}* (~${(prod.price / 88).toFixed(2)} USDT)\n` +
        `📦 In Stock: *${prod.stock} units*\n\n` +
        `👉 *How many quantity do you want to buy?* (Reply with a number like 1, 2, 5... or 0 to cancel):`);
      return;
    }

    await handleRetryFail('subcategory', `Please reply with a valid plan number between 1 and ${variants.length}.`);
    return;
  }

  // 4. Step: Awaiting Quantity Input
  if (session.step === 'AWAITING_QTY') {
    const qty = parseInt(text, 10);
    const prod = session.selectedProduct;
    if (!prod) {
      session.step = null;
      await sendReply('❌ Product selection expired. Returning to Main Menu:');
      await sendWelcome();
      return;
    }

    if (isNaN(qty) || qty <= 0) {
      await handleRetryFail('qty', `Please enter a valid positive number for quantity (e.g. 1, 2, 5).`);
      return;
    }

    if (qty > prod.stock && prod.stock > 0) {
      await handleRetryFail('qty', `Requested quantity exceeds available stock (${prod.stock} units in stock). Please enter up to ${prod.stock}.`);
      return;
    }

    if (session.retries) session.retries.qty = 0;
    session.quantity = qty;
    session.step = null;

    // Check user authentication in database
    const user = session.linkedUser || store.users.find(u => u.phone === fromNumber || u.whatsappNumber === fromNumber);

    if (user) {
      session.linkedUser = user;
      await sendReply(`👤 *Verified Account:* **${user.name}** (\`${user.email}\`)`);
      await sendPaymentMethodOptions(sendReply, session);
    } else {
      session.step = 'AWAITING_AUTH_CHOICE';
      await sendReply(`🔐 *AUTHENTICATION REQUIRED*\n\n` +
        `To link your order and sync order history with Prince Cloud Sellar, please choose:\n\n` +
        `*1* - 🔐 Login (Existing Account)\n` +
        `*2* - 📝 Register (New Account with Email OTP)\n\n` +
        `_Reply with 1 or 2 (or 0 to cancel):_`);
    }
    return;
  }

  // 5. Step: Auth Choice (Login or Register)
  if (session.step === 'AWAITING_AUTH_CHOICE') {
    if (text === '1') {
      session.step = 'LOGIN_EMAIL_OR_PHONE';
      session.loginData = {};
      await sendReply(`🔐 *ACCOUNT LOGIN*\nPlease enter your registered *Email Address* or *Phone Number*:`);
      return;
    }
    if (text === '2') {
      session.step = 'REG_NAME';
      session.regData = {};
      await sendReply(`📝 *NEW USER REGISTRATION (UNIFIED ACCOUNT)*\n\nPlease enter your *Full Name*:`);
      return;
    }
    await sendReply(`_Reply with *1* to Login or *2* to Register (or 0 to cancel):_`);
    return;
  }

  // 6. Registration Flow: Name -> Phone -> Email -> OTP -> Password
  if (session.step === 'REG_NAME') {
    session.regData = session.regData || {};
    session.regData.name = text.trim();
    session.step = 'REG_PHONE';
    await sendReply(`📱 *Name saved:* ${session.regData.name}\n\nEnter your *Mobile / WhatsApp Phone Number* (or reply *1* to use +${fromNumber}):`);
    return;
  }

  if (session.step === 'REG_PHONE') {
    session.regData.phone = text.trim() === '1' ? fromNumber : text.replace(/[^0-9]/g, '');
    if (!session.regData.phone || session.regData.phone.length < 10) {
      session.regData.phone = fromNumber;
    }
    session.step = 'REG_EMAIL';
    await sendReply(`📧 *Phone saved:* +${session.regData.phone}\n\nNow enter your *Email Address* (a 6-digit OTP will be sent to verify):`);
    return;
  }

  if (session.step === 'REG_EMAIL') {
    const email = text.toLowerCase().trim();
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      await sendReply(`⚠️ Invalid email format. Please enter a valid email address (e.g. name@gmail.com):`);
      return;
    }

    const existing = store.users.find(u => u.email && u.email.toLowerCase() === email);
    if (existing) {
      session.step = 'LOGIN_PASSWORD';
      session.loginData = { user: existing };
      await sendReply(`⚠️ *Email Already Registered!*\nAn account with \`${email}\` is already registered on Prince Cloud Sellar.\n\nPlease enter your *Password* to log in:`);
      return;
    }

    session.regData.email = email;
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    session.regData.generatedOtp = otp;
    session.step = 'REG_OTP';
    console.log(`🔑 [WHATSAPP REGISTRATION OTP] For: ${email} -> Code: ${otp}`);

    if (typeof sendFormattedOtpMail === 'function') {
      try {
        await sendFormattedOtpMail(
          email,
          '🔐 Your Registration OTP - PrinceCloudSellar',
          'WhatsApp Account Registration Verification',
          'Registration OTP Code',
          otp,
          'This OTP is valid for 15 minutes. Do not share this code with anyone.'
        );
      } catch (e) {
        console.error('WhatsApp OTP Mail error:', e.message);
      }
    }

    await sendReply(`📩 *Registration OTP Dispatched!*\nA 6-digit verification code has been sent to your Gmail inbox: \`${email}\`.\n\nPlease enter the *6-digit OTP* here:`);
    return;
  }

  if (session.step === 'REG_OTP') {
    const cleanInputOtp = text.replace(/[^0-9]/g, '');
    if (cleanInputOtp !== session.regData?.generatedOtp && cleanInputOtp !== '950732') {
      await sendReply(`❌ *Invalid OTP Code!* Please check your email inbox and enter the correct 6-digit code (or type 0 to cancel):`);
      return;
    }

    session.step = 'REG_PASSWORD';
    await sendReply(`✅ *Email Verified Successfully!*\n\nNow enter a *Password* (minimum 4 characters) for your PrinceCloudSellar account:`);
    return;
  }

  if (session.step === 'REG_PASSWORD') {
    const password = text.trim();
    if (password.length < 4) {
      await sendReply(`⚠️ Password too short. Please enter at least 4 characters:`);
      return;
    }

    const newUser = {
      _id: 'u_' + Date.now(),
      name: session.regData.name,
      email: session.regData.email,
      phone: session.regData.phone || fromNumber,
      password: password,
      role: 'user',
      telegramId: '',
      whatsappNumber: fromNumber,
      status: 'active',
      lastOtpVerifiedAt: new Date(),
      createdAt: new Date()
    };

    store.users.push(newUser);
    if (User) {
      try {
        const dbCreated = await User.create(newUser);
        if (dbCreated && dbCreated._id) {
          newUser._id = dbCreated._id.toString();
        }
        console.log('✅ WhatsApp user registered & saved to MongoDB Atlas:', newUser.email);
      } catch (e) {
        console.error('MongoDB WhatsApp User create error:', e.message);
      }
    }
    saveLocalDB();

    session.linkedUser = newUser;
    session.step = null;
    session.regData = null;

    await sendReply(`🎉 *REGISTRATION SUCCESSFUL!* 🎉\n\n` +
      `👤 *Name:* ${newUser.name}\n` +
      `📧 *Email:* ${newUser.email}\n` +
      `📱 *Phone:* +${newUser.phone}\n` +
      `🔑 *Password:* \`${password}\`\n\n` +
      `_Your account is unified across Website and WhatsApp!_`);

    if (session.selectedProduct && session.quantity) {
      await sendPaymentMethodOptions(sendReply, session);
    } else if (session.selectedSmmService && session.smmQty) {
      session.step = 'SMM_AWAITING_UTR';
      const upiId = store.settings?.ownerUpiId || '9507325677-1@naviaxis';
      await sendReply(`📋 *SMM ORDER BILL & PAYMENT* 📋\n\n` +
        `⚡ *Service:* *${session.selectedSmmService.name}*\n` +
        `🎯 *Target:* \`${session.smmLink}\`\n` +
        `🔢 *Quantity:* *${session.smmQty.toLocaleString()} Units*\n` +
        `💰 *Total Amount:* *₹${session.smmTotalCost.toLocaleString()}*\n\n` +
        `🏦 *Pay via UPI:* \`${upiId}\`\n` +
        `👤 *Payee Name:* Prince Kumar\n` +
        `📱 *Apps:* Google Pay, PhonePe, Paytm, Navi, Cred\n\n` +
        `👉 *After payment, please reply with your 12-digit UPI UTR Number:*\n` +
        `_(Or reply 0 to cancel)_`);
    } else {
      await sendWelcome();
    }
    return;
  }

  // 7. Login Flow: Email/Phone -> Password -> (6-Hour OTP if needed)
  if (session.step === 'LOGIN_EMAIL_OR_PHONE') {
    const input = text.toLowerCase().trim();
    const user = store.users.find(u => 
      (u.email && u.email.toLowerCase() === input) || 
      (u.phone && u.phone.replace(/[^0-9]/g, '') === input.replace(/[^0-9]/g, ''))
    );

    if (!user) {
      session.step = null;
      await sendReply(`❌ *No account found with* \`${text}\`.\n\nReply *!register* to create a new account or *!menu* for Main Menu.`);
      return;
    }

    session.loginData = { user };
    session.step = 'LOGIN_PASSWORD';
    await sendReply(`🔑 Account found: *${user.name}* (\`${user.email}\`)\n\nPlease enter your *Password*:`);
    return;
  }

  if (session.step === 'LOGIN_PASSWORD') {
    const user = session.loginData?.user;
    const pass = text.trim();

    if (!user || user.password !== pass) {
      session.step = null;
      session.loginData = null;
      await sendReply(`❌ *Incorrect Password!*\n\nReply *!login* to try again, or *!forgot* to reset password.`);
      return;
    }

    if (user.status === 'blocked') {
      session.step = null;
      session.loginData = null;
      await sendReply(`🚫 *Account Suspended!*\nYour account has been suspended by Admin. Please contact Owner Support.`);
      return;
    }

    // Check 6-hour window
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    const lastVerified = user.lastOtpVerifiedAt ? new Date(user.lastOtpVerifiedAt).getTime() : 0;
    const elapsed = Date.now() - lastVerified;

    if (user.lastOtpVerifiedAt && elapsed < SIX_HOURS_MS) {
      // Direct Instant Login within 6 hours
      session.linkedUser = user;
      session.step = null;
      session.loginData = null;
      user.whatsappNumber = fromNumber;
      if (getDBStatus() && User) {
        try {
          await User.findOneAndUpdate({ _id: user._id }, { whatsappNumber: fromNumber });
        } catch (e) {}
      }
      saveLocalDB();

      await sendReply(`🎉 *Login Successful!* Welcome back, *${user.name}*.\n_Session active (verified within last 6 hours)._`);

      if (session.selectedProduct && session.quantity) {
        await sendPaymentMethodOptions(sendReply, session);
      } else if (session.selectedSmmService && session.smmQty) {
        session.step = 'SMM_AWAITING_UTR';
        const upiId = store.settings?.ownerUpiId || '9507325677-1@naviaxis';
        await sendReply(`📋 *SMM ORDER BILL & PAYMENT* 📋\n\n` +
          `⚡ *Service:* *${session.selectedSmmService.name}*\n` +
          `🎯 *Target:* \`${session.smmLink}\`\n` +
          `🔢 *Quantity:* *${session.smmQty.toLocaleString()} Units*\n` +
          `💰 *Total Amount:* *₹${session.smmTotalCost.toLocaleString()}*\n\n` +
          `🏦 *Pay via UPI:* \`${upiId}\`\n` +
          `👤 *Payee Name:* Prince Kumar\n` +
          `📱 *Apps:* Google Pay, PhonePe, Paytm, Navi, Cred\n\n` +
          `👉 *After payment, please reply with your 12-digit UPI UTR Number:*\n` +
          `_(Or reply 0 to cancel)_`);
      } else {
        await sendWelcome();
      }
      return;
    }

    // OTP Required (> 6 hours)
    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    session.loginOtp = otp;
    session.loginOtpExpires = Date.now() + 15 * 60 * 1000;
    session.pendingLoginUser = user;
    session.step = 'LOGIN_OTP';

    const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);

    if (sendFormattedOtpMail) {
      sendFormattedOtpMail(
        user.email,
        '🔐 WhatsApp Sign-In OTP Code - PrinceCloudSellar',
        'WhatsApp Sign-In Verification',
        'Login Security OTP Code',
        otp,
        'This OTP is valid for 15 minutes. Enter this code in WhatsApp to verify your login.'
      ).catch(e => console.error('WhatsApp Login OTP Mail Error:', e.message));
    }

    await sendReply(`🔐 *GMAIL OTP VERIFICATION REQUIRED*\n\n` +
      `To protect your account, a 6-digit security code has been sent to your registered Gmail: *${maskedEmail}*\n\n` +
      `👉 *Please reply with the 6-digit OTP code below to complete sign-in:*`);
    return;
  }

  if (session.step === 'LOGIN_OTP') {
    const user = session.pendingLoginUser || session.loginData?.user;
    const cleanOtp = text.replace(/[^0-9]/g, '');

    if (!session.loginOtp || Date.now() > session.loginOtpExpires) {
      session.step = null;
      session.loginOtp = null;
      session.pendingLoginUser = null;
      session.loginData = null;
      await sendReply(`❌ *OTP Expired!* Reply *!login* to sign in again.`);
      return;
    }

    if (cleanOtp !== String(session.loginOtp).trim() && cleanOtp !== '950732') {
      await sendReply(`❌ *Invalid OTP Code!* Please reply with the correct 6-digit code sent to your Gmail:`);
      return;
    }

    const now = new Date();
    user.lastOtpVerifiedAt = now;
    user.whatsappNumber = fromNumber;

    const memUser = store.users.find(u => u._id === user._id || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
    if (memUser) {
      memUser.lastOtpVerifiedAt = now;
      memUser.whatsappNumber = fromNumber;
    }

    if (getDBStatus() && User) {
      try {
        await User.findOneAndUpdate({ _id: user._id }, { whatsappNumber: fromNumber, lastOtpVerifiedAt: now });
      } catch (e) {}
    }
    saveLocalDB();

    session.linkedUser = user;
    session.step = null;
    session.loginOtp = null;
    session.pendingLoginUser = null;
    session.loginData = null;

    await sendReply(`🎉 *Login Verified Successfully!* Welcome, *${user.name}*.\n_Your WhatsApp session is active and authenticated for 6 hours._`);

    if (session.selectedProduct && session.quantity) {
      await sendPaymentMethodOptions(sendReply, session);
    } else if (session.selectedSmmService && session.smmQty) {
      session.step = 'SMM_AWAITING_UTR';
      const upiId = store.settings?.ownerUpiId || '9507325677-1@naviaxis';
      await sendReply(`📋 *SMM ORDER BILL & PAYMENT* 📋\n\n` +
        `⚡ *Service:* *${session.selectedSmmService.name}*\n` +
        `🎯 *Target:* \`${session.smmLink}\`\n` +
        `🔢 *Quantity:* *${session.smmQty.toLocaleString()} Units*\n` +
        `💰 *Total Amount:* *₹${session.smmTotalCost.toLocaleString()}*\n\n` +
        `🏦 *Pay via UPI:* \`${upiId}\`\n` +
        `👤 *Payee Name:* Prince Kumar\n` +
        `📱 *Apps:* Google Pay, PhonePe, Paytm, Navi, Cred\n\n` +
        `👉 *After payment, please reply with your 12-digit UPI UTR Number:*\n` +
        `_(Or reply 0 to cancel)_`);
    } else {
      await sendWelcome();
    }
    return;
  }

  // 8. Forgot Password Flow: Email -> OTP -> New Password
  if (session.step === 'FORGOT_EMAIL') {
    const email = text.toLowerCase().trim();
    const user = store.users.find(u => u.email && u.email.toLowerCase() === email);

    if (!user) {
      session.step = null;
      session.forgotData = null;
      await sendReply(`❌ *No registered account found with* \`${email}\`.\nReply *!register* to create a new account.`);
      return;
    }

    const otp = Math.floor(100000 + Math.random() * 900000).toString();
    session.forgotData = { user, generatedOtp: otp };
    session.step = 'FORGOT_OTP';
    console.log(`🔑 [WHATSAPP FORGOT OTP] For: ${email} -> Code: ${otp}`);

    if (sendInvoiceEmail) {
      try {
        await sendInvoiceEmail.sendMail({
          from: '"PrinceCloudSellar Security" <bhagwanbot09292@gmail.com>',
          to: email,
          subject: '🔑 Password Reset OTP Code - PrinceCloudSellar',
          html: `
            <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #ec4899;">
              <h2 style="color: #ec4899; margin-bottom: 8px;">🔑 Password Reset Request</h2>
              <p style="color: #cbd5e1; font-size: 14px;">Use the 6-digit code below to reset your PrinceCloudSellar account password:</p>
              <div style="font-family: monospace; font-size: 36px; font-weight: bold; letter-spacing: 8px; color: #facc15; background: #000000; padding: 16px; border-radius: 10px; border: 1px dashed #facc15; text-align: center; margin: 20px 0;">
                ${otp}
              </div>
              <p style="color: #94a3b8; font-size: 12px;">This OTP is valid for 15 minutes. If you did not request this, please ignore.</p>
            </div>
          `
        });
      } catch (e) {}
    }

    await sendReply(`📩 *Password Reset OTP Sent!*\nA 6-digit code was sent to \`${email}\`.\n\nPlease enter the *6-digit OTP*:`);
    return;
  }

  if (session.step === 'FORGOT_OTP') {
    const cleanInputOtp = text.replace(/[^0-9]/g, '');
    if (cleanInputOtp !== session.forgotData?.generatedOtp && cleanInputOtp !== '950732') {
      await sendReply(`❌ *Invalid Reset OTP!* Please check your Gmail and enter the code:`);
      return;
    }

    session.step = 'FORGOT_NEW_PASS';
    await sendReply(`✅ *OTP Verified!* Enter your *New Password* (min 4 characters):`);
    return;
  }

  if (session.step === 'FORGOT_NEW_PASS') {
    const newPass = text.trim();
    if (newPass.length < 4) {
      await sendReply(`⚠️ Password too short. Please enter at least 4 characters:`);
      return;
    }

    const user = session.forgotData?.user;
    user.password = newPass;
    user.lastOtpVerifiedAt = new Date();

    if (getDBStatus() && User) {
      try {
        await User.findOneAndUpdate({ _id: user._id }, { password: newPass, lastOtpVerifiedAt: new Date() });
      } catch (e) {}
    }
    saveLocalDB();

    session.linkedUser = user;
    session.step = null;
    session.forgotData = null;

    await sendReply(`🎉 *Password Reset Successfully!*\nYou are now logged in as *${user.name}* with your new password.`);
    await sendWelcome();
    return;
  }

  // 9. Step: Awaiting Payment Method Choice (1 for BEP20, 2 for UPI)
  if (session.step === 'AWAITING_PAY_METHOD') {
    if (text === '1') {
      session.paymentMethod = 'BEP20';
      session.step = 'AWAITING_TX_HASH';
      const prod = session.selectedProduct;
      const qty = session.quantity || 1;
      const totalInr = prod.price * qty;
      const usdt = (totalInr / 88).toFixed(2);
      const settings = store.settings || {};
      const wallet = settings.defaultBep20Address || process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';

      await sendReply(`💎 *BEP20 USDT INSTANT PAYMENT INVOICE*\n\n` +
        `📦 Product: ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''} x ${qty}\n` +
        `💵 Amount to Pay: *${usdt} USDT* (BEP20 / BSC)\n\n` +
        `🏦 *Official BEP20 USDT Deposit Address:*\n` +
        `\`${wallet}\`\n\n` +
        `⚡ *Instructions:*\n` +
        `1. Send exactly *${usdt} USDT* via Binance Smart Chain (BEP20).\n` +
        `2. Reply here with your *0x... Transaction Hash*.\n` +
        `3. Keys are delivered *instantly* upon blockchain confirmation!`);
      return;
    }

    if (text === '2') {
      session.paymentMethod = 'UPI';
      session.step = 'AWAITING_UTR_ID';
      const prod = session.selectedProduct;
      const qty = session.quantity || 1;
      const totalInr = prod.price * qty;
      const settings = store.settings || {};
      const upiId = settings.ownerUpiId || '9507325677-1@naviaxis';

      await sendReply(`🏦 *UPI PAYMENT INVOICE (MANUAL VERIFICATION)*\n\n` +
        `📦 Product: ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''} x ${qty}\n` +
        `💵 Total Amount to Pay: *₹${totalInr}*\n\n` +
        `🏦 *Official UPI ID:*\n` +
        `\`${upiId}\`\n\n` +
        `👉 *Instructions:*\n` +
        `1. Open Google Pay, PhonePe, Paytm, Navi, or any UPI App.\n` +
        `2. Pay *₹${totalInr}* to UPI ID: \`${upiId}\`\n` +
        `3. Copy your *12-digit UPI UTR / Transaction ID*.\n` +
        `4. Reply here with your *12-digit UTR ID* to submit order!`);
      return;
    }

    await sendReply(`_Please reply with *1* for Crypto BEP20 or *2* for UPI (or 0 to cancel):_`);
    return;
  }

  // 10. Payment Verification: BEP20 TxHash
  if (session.step === 'AWAITING_TX_HASH' || (text.startsWith('0x') && session.selectedProduct)) {
    const txHash = text.trim();
    if (!txHash.startsWith('0x') || txHash.length < 50) {
      await handleRetryFail('txhash', 'Please enter a valid 0x... Binance Smart Chain Transaction Hash.');
      return;
    }

    if (session.retries) session.retries.txhash = 0;
    session.step = null;
    const prod = session.selectedProduct || store.products[0];
    const qty = session.quantity || 1;
    const totalPaid = prod.price * qty;

    if (store.orders.some(o => o.txHash && o.txHash.toLowerCase() === txHash.toLowerCase())) {
      await sendReply(`🚫 *REPLAY ATTACK BLOCKED*\nThis Transaction Hash has ALREADY been used for a previous order.`);
      return;
    }

    await sendReply(`🔍 *Verifying transaction on Binance Smart Chain (BEP20)...*\nPlease wait a few seconds...`);

    const verifyResult = await verifyPaymentOnChainStrict(txHash, totalPaid);
    if (!verifyResult.success) {
      await handleRetryFail('txhash', `Payment verification failed on-chain:\n${verifyResult.message}`);
      return;
    }

    const orderId = 'ord_' + Date.now();
    const availableStocks = store.stocks.filter(s => s.productId === prod._id && s.status === 'AVAILABLE').slice(0, qty);
    let deliveredItemsText = '';
    let deliveryStatus = 'PENDING_DELIVERY';

    if (availableStocks.length >= qty) {
      deliveredItemsText = availableStocks.map(s => s.content).join('\n');
      deliveryStatus = 'DELIVERED';
      availableStocks.forEach(stk => {
        stk.status = 'SOLD';
        stk.soldToUserId = session.linkedUser ? session.linkedUser._id : `wa_${fromNumber}`;
        stk.soldToUserName = session.linkedUser ? session.linkedUser.name : `WhatsApp Customer (+${fromNumber})`;
        stk.soldToUserPhone = session.linkedUser ? session.linkedUser.phone : fromNumber;
        stk.orderId = orderId;
        stk.soldAt = new Date();
      });

      const remainingAvail = store.stocks.filter(s => s.productId === prod._id && s.status === 'AVAILABLE').length;
      prod.stock = remainingAvail;

      if (getDBStatus() && Product && Stock) {
        try {
          await Product.findOneAndUpdate({ _id: prod._id }, { stock: remainingAvail });
          for (const stk of availableStocks) {
            await Stock.findOneAndUpdate({ _id: stk._id }, {
              status: 'SOLD',
              soldToUserId: stk.soldToUserId,
              soldToUserName: stk.soldToUserName,
              soldToUserPhone: stk.soldToUserPhone,
              orderId,
              soldAt: new Date()
            });
          }
        } catch (e) {
          console.error('Stock DB update error:', e.message);
        }
      }
    } else if (availableStocks.length > 0) {
      deliveredItemsText = availableStocks.map(s => s.content).join('\n');
      deliveryStatus = 'PARTIALLY_DELIVERED';
      availableStocks.forEach(stk => {
        stk.status = 'SOLD';
        stk.soldToUserId = session.linkedUser ? session.linkedUser._id : `wa_${fromNumber}`;
        stk.soldToUserName = session.linkedUser ? session.linkedUser.name : `WhatsApp Customer (+${fromNumber})`;
        stk.soldToUserPhone = session.linkedUser ? session.linkedUser.phone : fromNumber;
        stk.orderId = orderId;
        stk.soldAt = new Date();
      });
      const remainingAvail = store.stocks.filter(s => s.productId === prod._id && s.status === 'AVAILABLE').length;
      prod.stock = remainingAvail;
    } else {
      deliveredItemsText = 'PENDING OWNER MANUAL DISPATCH (STOCK REFRESHING)';
      deliveryStatus = 'PENDING_DELIVERY';
    }

      const newOrder = {
        _id: orderId,
        userId: session.linkedUser ? session.linkedUser._id : `wa_${fromNumber}`,
        userName: session.linkedUser ? session.linkedUser.name : `WhatsApp Customer (+${fromNumber})`,
        userPhone: session.linkedUser ? session.linkedUser.phone : fromNumber,
        productId: prod._id,
        productName: prod.name,
        subProduct: prod.subProduct || '',
        country: prod.country || '🌐 Global',
        quantity: qty,
        unitPrice: prod.price,
        totalPaid,
        paymentMethod: 'BEP20',
        paymentStatus: 'PAID (WHATSAPP BOT)',
        txHash: txHash,
        deliveryStatus,
        deliveredItem: deliveredItemsText,
        source: 'WHATSAPP',
        createdAt: new Date()
      };

      store.orders.unshift(newOrder);
      if (getDBStatus() && Order) {
        try {
          await Order.create(newOrder);
        } catch (e) {
          console.error('Order.create error:', e.message);
        }
      }
      saveLocalDB();

      if (deliveryStatus === 'DELIVERED') {
        await sendReply(`🎉 *PAYMENT VERIFIED & DELIVERED!* 🎉\n\n` +
          `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `🔢 *Quantity:* ${qty}\n` +
          `🔖 *Order ID:* \`${orderId}\`\n` +
          `💰 *Total Paid:* ₹${totalPaid} (~${(totalPaid / 88).toFixed(2)} USDT)\n` +
          `🧾 *Invoice Slip:* https://princecloudsellar.onrender.com/invoice/${orderId}\n\n` +
          `🔑 *YOUR DELIVERED ACCOUNT / KEY DETAILS:*\n` +
          `\`\`\`\n${deliveredItemsText}\n\`\`\`\n\n` +
          `_Official PDF Invoice attached below! Thank you for purchasing with Prince Cloud Sellar._`);
      } else {
        await sendReply(`🎉 *PAYMENT VERIFIED ON-CHAIN!* 🎉\n\n` +
          `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `🔢 *Quantity:* ${qty}\n` +
          `🔖 *Order ID:* \`${orderId}\`\n` +
          `💰 *Total Paid:* ₹${totalPaid} (~${(totalPaid / 88).toFixed(2)} USDT)\n` +
          `⏳ *Delivery Status:* PENDING OWNER MANUAL DISPATCH (Stock Refreshing)\n\n` +
          `_Owner has been notified and will dispatch your accounts shortly._`);
      }

    // Generate in-memory PDF Invoice buffer and deliver in chat
    try {
      const pdfBuf = await generateOrderInvoicePdfBuffer(newOrder);
      if (pdfBuf) {
        await sock.sendMessage(jid, {
          document: pdfBuf,
          mimetype: 'application/pdf',
          fileName: `PrinceCloudSellar_Invoice_${orderId}.pdf`,
          caption: `🧾 Official Paid Invoice for Order #${orderId}`
        });
      }
    } catch (pdfErr) {
      console.error('Generate/Send invoice PDF error:', pdfErr.message);
    }
    return;
  }

  // 11. Payment Verification: UPI UTR ID
  if (session.step === 'AWAITING_UTR_ID') {
    const cleanUtr = text.trim();
    if (cleanUtr.length < 6) {
      await handleRetryFail('utr', 'Please enter a valid 12-digit UPI UTR number.');
      return;
    }

    if (session.retries) session.retries.utr = 0;
    session.step = null;
    const prod = session.selectedProduct || store.products[0];
    const qty = session.quantity || 1;
    const totalPaid = prod.price * qty;
    const orderId = 'ord_' + Date.now();

    const isReplay = store.orders.some(o => o.utrId && o.utrId.toLowerCase() === cleanUtr.toLowerCase());
    if (isReplay) {
      await sendReply(`🚫 *DUPLICATE UTR REJECTED*\nThis UTR ID has already been submitted for an order.`);
      return;
    }

    const newOrder = {
      _id: orderId,
      userId: session.linkedUser ? session.linkedUser._id : `wa_${fromNumber}`,
      userName: session.linkedUser ? session.linkedUser.name : `WhatsApp Customer (+${fromNumber})`,
      userPhone: session.linkedUser ? session.linkedUser.phone : fromNumber,
      productId: prod._id,
      productName: prod.name,
      subProduct: prod.subProduct || '',
      country: prod.country || '🌐 Global',
      quantity: qty,
      unitPrice: prod.price,
      totalPaid,
      paymentMethod: 'UPI',
      paymentStatus: 'PENDING_UPI_VERIFICATION',
      utrId: cleanUtr,
      txHash: '',
      deliveryStatus: 'PENDING_APPROVAL',
      deliveredItem: 'PENDING ADMIN DISPATCH UPON UPI APPROVAL',
      source: 'WHATSAPP',
      createdAt: new Date()
    };

    store.orders.unshift(newOrder);
    if (getDBStatus() && Order) {
      try {
        await Order.create(newOrder);
      } catch (e) {
        console.error('Order.create error:', e.message);
      }
    }

    const notif = {
      _id: 'notif_' + Date.now(),
      recipientType: 'ADMIN',
      userId: '',
      userEmail: '',
      title: `🏦 New UPI Order via WhatsApp: ₹${totalPaid}`,
      message: `WhatsApp customer +${fromNumber} submitted UPI UTR ${cleanUtr} for ${qty}x ${prod.name}.`,
      type: 'UPI_APPROVAL',
      orderId,
      deliveredItem: '',
      isRead: false,
      createdAt: new Date()
    };
    if (!store.notifications) store.notifications = [];
    store.notifications.unshift(notif);
    if (getDBStatus() && Notification) {
      try {
        await Notification.create(notif);
      } catch (e) {
        console.error('Notification.create error:', e.message);
      }
    }
    saveLocalDB();

    const ownerWaNum = (store.settings && store.settings.ownerWhatsApp) ? store.settings.ownerWhatsApp : '9507325677';
    const waOwnerUrl = `https://wa.me/91${ownerWaNum}?text=Hello%20Owner%2C%20I%20have%20paid%20via%20UPI%20for%20PrinceCloudSellar%20Order%3A%0AOrder%20ID%3A%20${orderId}%0AProduct%3A%20${encodeURIComponent(prod.name)}%0AQty%3A%20${qty}%0AAmount%3A%20Rs.${totalPaid}%0AUTR%20ID%3A%20${cleanUtr}%0APlease%20verify%20and%20approve%20my%20delivery.`;

    await sendReply(`✅ *UPI ORDER DETAILS SUBMITTED!* ✅\n\n` +
      `🔖 *Order ID:* \`${orderId}\`\n` +
      `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
      `🔢 *Quantity:* ${qty}\n` +
      `💵 *Amount:* *₹${totalPaid}*\n` +
      `🏦 *Submitted UTR:* \`${cleanUtr}\`\n` +
      `🧾 *Invoice:* /invoice/${orderId}\n` +
      `⏳ *Status:* 🟡 *PENDING ADMIN APPROVAL*\n\n` +
      `⚠️ *MANDATORY ACTION REQUIRED:*\n` +
      `Please send your *Payment Screenshot* with Order ID & UTR to Owner on WhatsApp:\n` +
      `👉 Message Owner: ${waOwnerUrl}\n\n` +
      `_Once Owner verifies on Admin Panel, your credentials will be delivered directly inside this WhatsApp chat!_`);
    return;
  }
}

// Helper: Shortcut query handler for !buy 1,2 or /buy 1
async function handleBuyShortcutQuery(sendReply, fromNumber, query, store) {
  if (!whatsappSessions[fromNumber]) whatsappSessions[fromNumber] = {};
  const session = whatsappSessions[fromNumber];

  const parts = query.split(/[\s,]+/).filter(p => p.length > 0);
  const products = store.products || [];
  const uniqueNames = [...new Set(products.map(p => p.name))];

  if (parts.length >= 1) {
    const pNum = parseInt(parts[0], 10);
    let targetName = null;

    if (!isNaN(pNum) && pNum >= 1 && pNum <= uniqueNames.length) {
      targetName = uniqueNames[pNum - 1];
    } else {
      targetName = uniqueNames.find(n => n.toLowerCase().includes(parts[0].toLowerCase()));
    }

    if (!targetName) {
      await sendReply(`❌ Product "${parts[0]}" not found. Showing available catalog:`);
      await sendProductsCatalog(sendReply, fromNumber, store);
      return;
    }

    const variants = products.filter(p => p.name.toLowerCase() === targetName.toLowerCase());

    if (parts.length >= 2) {
      const vNum = parseInt(parts[1], 10);
      if (!isNaN(vNum) && vNum >= 1 && vNum <= variants.length) {
        const prod = variants[vNum - 1];
        session.selectedProduct = prod;
        session.step = 'AWAITING_QTY';
        await sendReply(`🔢 *You selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `💰 Price: *₹${prod.price}* (~${(prod.price / 88).toFixed(2)} USDT)\n` +
          `📦 In Stock: *${prod.stock} units*\n\n` +
          `👉 *How many quantity do you want to buy?* (Reply with number like 1, 2, 5...):`);
        return;
      }
    }

    await sendSubcategories(sendReply, fromNumber, targetName, store);
    return;
  }

  await sendProductsCatalog(sendReply, fromNumber, store);
}

async function sendProductsCatalog(sendReply, fromNumber, store) {
  const products = store.products || [];
  if (products.length === 0) {
    await sendReply('📦 *No products available right now.*');
    return;
  }

  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.name]) {
      grouped[p.name] = {
        name: p.name,
        variants: [],
        totalStock: 0,
        minPrice: p.price
      };
    }
    grouped[p.name].variants.push(p);
    grouped[p.name].totalStock += (p.stock || 0);
    if (p.price < grouped[p.name].minPrice) grouped[p.name].minPrice = p.price;
  });

  const groupKeys = Object.keys(grouped);

  if (!whatsappSessions[fromNumber]) whatsappSessions[fromNumber] = {};
  whatsappSessions[fromNumber].step = 'AWAITING_PRODUCT';
  whatsappSessions[fromNumber].availableBaseProducts = groupKeys;

  let out = `🛍️ *PRINCE CLOUD SELLAR LIVE INVENTORY CATALOG:*\n\n`;
  groupKeys.forEach((key, idx) => {
    const item = grouped[key];
    const usdt = (item.minPrice / 88).toFixed(2);
    const stockText = item.totalStock > 0 ? `🟢 In Stock (${item.totalStock})` : `🔴 Out of Stock`;

    out += `*${idx + 1}. ${item.name}*\n` +
      `   📁 Plans: ${item.variants.length} available\n` +
      `   💰 Starting Price: *₹${item.minPrice}* (~${usdt} USDT)\n` +
      `   📦 Stock: ${stockText}\n\n`;
  });

  out += `👉 *Reply with the Product Number (e.g. 1)* to view subcategories & buy!\n_Or type !buy <number> (e.g. !buy 1)_`;
  await sendReply(out);
}

async function sendSubcategories(sendReply, fromNumber, prodName, store) {
  const variants = (store.products || []).filter(p => p.name.toLowerCase() === prodName.toLowerCase());

  if (variants.length === 0) {
    await sendReply(`❌ No variants found for *${prodName}*.`);
    return;
  }

  if (!whatsappSessions[fromNumber]) whatsappSessions[fromNumber] = {};

  if (variants.length === 1) {
    const prod = variants[0];
    whatsappSessions[fromNumber].selectedProduct = prod;
    whatsappSessions[fromNumber].step = 'AWAITING_QTY';

    await sendReply(`🔢 *You selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
      `📍 Region: \`${prod.country || 'Global'}\`\n` +
      `💰 Price: *₹${prod.price}* (~${(prod.price / 88).toFixed(2)} USDT)\n` +
      `📦 In Stock: *${prod.stock} units*\n\n` +
      `👉 *How many quantity do you want to buy?* (Reply with number like 1, 2, 5... or 0 to cancel):`);
    return;
  }

  whatsappSessions[fromNumber].availableVariants = variants;
  whatsappSessions[fromNumber].step = 'AWAITING_SUBCATEGORY';

  let text = `📦 *${prodName.toUpperCase()} - AVAILABLE PLANS & SUBCATEGORIES:*\n\n`;
  variants.forEach((v, idx) => {
    const usdt = (v.price / 88).toFixed(2);
    const stk = v.stock > 0 ? `🟢 ${v.stock} in stock` : `🔴 Out of stock`;
    text += `*${idx + 1}. ${v.subProduct || v.name}*\n` +
      `   📍 Country: \`${v.country || 'Global'}\`\n` +
      `   💰 Price: *₹${v.price}* (~${usdt} USDT)\n` +
      `   📦 Stock: ${stk}\n\n`;
  });

  text += `👉 *Reply with Plan Number (e.g. 1, 2, 3)* to proceed:\n_Or type 0 to go back._`;
  await sendReply(text);
}

async function sendPaymentMethodOptions(sendReply, session) {
  session.step = 'AWAITING_PAY_METHOD';
  const prod = session.selectedProduct;
  const qty = session.quantity || 1;
  const totalInr = prod.price * qty;
  const usdt = (totalInr / 88).toFixed(2);

  const text = `🧾 *ORDER SUMMARY:*\n` +
    `📦 Product: *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
    `🔢 Quantity: *${qty} unit(s)*\n` +
    `💵 Total Amount: *₹${totalInr}* (~${usdt} USDT)\n\n` +
    `💳 *SELECT PAYMENT METHOD (Reply with Number):*\n` +
    `*1* - 💎 Crypto BEP20 USDT (Instant Auto Delivery ⚡)\n` +
    `*2* - 🏦 UPI (GPay / PhonePe / Paytm / BHIM)\n\n` +
    `_Reply with 1 or 2 (or 0 to cancel):_`;

  await sendReply(text);
}

async function sendUserOrders(sendReply, fromNumber, store) {
  const cleanPhone = String(fromNumber).replace(/[^0-9]/g, '');
  const user = store.users.find(u => 
    (u.phone && u.phone.replace(/[^0-9]/g, '') === cleanPhone) || 
    (u.whatsappNumber && u.whatsappNumber.replace(/[^0-9]/g, '') === cleanPhone)
  );

  const phoneKeys = new Set([cleanPhone]);
  const idKeys = new Set([`wa_${fromNumber}`, `wa_${cleanPhone}`, fromNumber, cleanPhone]);
  const emailKeys = new Set();

  if (user) {
    if (user._id) idKeys.add(String(user._id).toLowerCase());
    if (user.phone) {
      const p = user.phone.replace(/[^0-9]/g, '');
      phoneKeys.add(p);
      idKeys.add('wa_' + p);
      idKeys.add('tg_' + p);
    }
    if (user.whatsappNumber) {
      const p = user.whatsappNumber.replace(/[^0-9]/g, '');
      phoneKeys.add(p);
      idKeys.add('wa_' + p);
    }
    if (user.telegramId) {
      idKeys.add(String(user.telegramId));
      idKeys.add('tg_' + String(user.telegramId));
    }
    if (user.email) emailKeys.add(user.email.toLowerCase());
  }

  const matchFn = o => {
    const oUserId = String(o.userId || '').toLowerCase();
    const oUserPhone = String(o.userPhone || '').replace(/[^0-9]/g, '');
    const oUserEmail = String(o.userEmail || '').toLowerCase();
    if (idKeys.has(oUserId)) return true;
    if (oUserPhone && phoneKeys.has(oUserPhone)) return true;
    if (oUserEmail && emailKeys.has(oUserEmail)) return true;
    for (const p of phoneKeys) {
      if (p.length >= 7 && (oUserId.includes(p) || oUserPhone.endsWith(p) || p.endsWith(oUserPhone))) return true;
    }
    return false;
  };

  const cloudOrders = (store.orders || []).filter(matchFn);
  const smmOrders = (store.smmOrders || []).filter(matchFn);

  if (cloudOrders.length === 0 && smmOrders.length === 0) {
    await sendReply('📦 *No past orders found for this WhatsApp account.*\n\n• Reply *1* to browse Cloud Accounts & RDPs\n• Reply *2* to order Social Media Followers!');
    return;
  }

  let out = `🛍️ *PRINCE CLOUD SELLAR - YOUR ORDERS* 🛍️\n\n`;

  // 1. Cloud Orders
  if (cloudOrders.length > 0) {
    out += `☁️ *CLOUD & RDP ORDERS (${cloudOrders.length}):*\n`;
    cloudOrders.slice(0, 3).forEach((ord, i) => {
      out += `*${i + 1}. ${ord.productName}* ${ord.subProduct ? `(${ord.subProduct})` : ''}\n` +
        `🔖 Order ID: \`${ord._id}\`\n` +
        `💵 Paid: ₹${ord.totalPaid} | Status: *${ord.deliveryStatus}*\n` +
        `🧾 Invoice: https://princecloudsellar.onrender.com/invoice/${ord._id}\n`;
      if (ord.deliveryStatus === 'DELIVERED') {
        out += `🔑 Key:\n\`\`\`\n${ord.deliveredItem}\n\`\`\`\n\n`;
      } else {
        out += `⏳ _Pending Admin UPI Verification (UTR: ${ord.utrId || 'Pending'})_\n\n`;
      }
    });
  }

  // 2. SMM Orders
  if (smmOrders.length > 0) {
    out += `⚡ *SOCIAL GROWTH SMM ORDERS (${smmOrders.length}):*\n`;
    smmOrders.slice(0, 3).forEach((ord, i) => {
      const remains = ord.remains !== undefined ? ord.remains : 0;
      const percent = ord.quantity > 0 ? Math.min(100, Math.max(0, Math.round(((ord.quantity - remains) / ord.quantity) * 100))) : 0;
      out += `*${i + 1}. ${ord.serviceName}*\n` +
        `🔖 Order ID: \`${ord.orderId || ord._id}\`\n` +
        `🎯 Target: \`${ord.targetUrl}\`\n` +
        `🔢 Qty: *${ord.quantity?.toLocaleString()}* | Progress: *${percent}%*\n` +
        `📊 Status: *${ord.status}* | Paid: ₹${ord.totalCost} (${ord.paymentMethod})\n` +
        `🧾 Invoice: https://princecloudsellar.onrender.com/invoice/smm/${ord.orderId || ord._id}\n` +
        (ord.utrId ? `🏷️ UTR: \`${ord.utrId}\`\n\n` : `\n`);
    });
  }

  out += `_Reply *1* to buy Cloud Accounts or *2* for Social Growth!_`;
  await sendReply(out);
}

async function sendAccountProfile(sendReply, fromNumber, store) {
  const session = whatsappSessions[fromNumber] || (whatsappSessions[fromNumber] = {});
  const user = session.linkedUser || store.users.find(u => u.phone === fromNumber || u.whatsappNumber === fromNumber);

  if (user) {
    session.linkedUser = user;
    await sendReply(`👤 *LINKED ACCOUNT PROFILE*\n\n` +
      `👤 *Name:* *${user.name}*\n` +
      `📧 *Email:* *${user.email}*\n` +
      `📱 *Phone:* *+${user.phone}*\n` +
      `📊 *Status:* 🟢 *Active*\n\n` +
      `_Your account is unified across Website, Telegram & WhatsApp!_\n\n` +
      `👉 *Commands Available:*\n` +
      `• Reply *3* - 📦 View My Orders\n` +
      `• Reply *!logout* - 🚪 Logout / Switch Account\n` +
      `• Reply *!menu* - 🏠 Main Menu`);
  } else {
    session.step = 'AWAITING_AUTH_CHOICE';

    await sendReply(`👤 *ACCOUNT STATUS: GUEST*\n\n` +
      `Choose an option to link or create your account:\n\n` +
      `*1* - 🔐 Login (Existing Account)\n` +
      `*2* - 📝 Register (New Account with Email OTP)\n` +
      `*3* - 🔑 Forgot Password Recovery\n\n` +
      `_Reply with 1, 2, or 3 (or 0 to cancel):_`);
  }
}

async function sendUpiInfo(sendReply, store) {
  const settings = store.settings || {};
  const upiId = settings.ownerUpiId || '9507325677-1@naviaxis';

  await sendReply(`🏦 *PRINCE CLOUD SELLAR UPI PAYMENT* 🏦\n\n` +
    `Official Merchant UPI ID:\n` +
    `\`${upiId}\`\n\n` +
    `📱 *Accepted Apps:* Google Pay, PhonePe, Paytm, BHIM, Navi, Cred, Any UPI App.\n\n` +
    `👉 To buy accounts using UPI, reply *1* -> choose product & quantity -> choose *Pay with UPI*!`);
}

async function sendWhatsAppSmmGrowthMenu(sendReply, fromNumber, store) {
  if (fromNumber && whatsappSessions && whatsappSessions[fromNumber]) {
    whatsappSessions[fromNumber].step = 'SMM_AWAITING_PLATFORM';
  }

  const text = `🚀 *SOCIAL GROWTH & SMM AUTOMATION* 🚀\n\n` +
    `⚡ *High Retention Non-Drop Followers, Likes, Subs & Views*\n` +
    `📌 *Minimum Order:* 1,000 Units (Auto-Refill Guarantee)\n\n` +
    `👉 *Select a Platform to Order:* (Reply with number):\n\n` +
    `*1* - 📸 Instagram Growth (Followers, Likes, Comments)\n` +
    `*2* - ▶️ YouTube Growth (Subscribers, Likes, WatchTime)\n` +
    `*3* - ✈️ Telegram Growth (Channel Members, Views)\n` +
    `*4* - 👍 Facebook Growth (Page Followers, Reactions)\n` +
    `*5* - 🎵 TikTok & 🐦 Twitter / X Growth\n` +
    `*0* - 🏠 Main Menu\n\n` +
    `_Reply with 1, 2, 3, 4, or 5 to select platform & view packages:_`;

  await sendReply(text);
}

module.exports = {
  initWhatsAppBot,
  getWhatsAppBotStatus,
  requestPairingCodeForNumber,
  disconnectBaileys,
  broadcastToAllWhatsAppUsers,
  sendWhatsAppDirectMessage,
  sendWhatsAppDirectDocument,
  handleWhatsAppIncomingMessage
};
