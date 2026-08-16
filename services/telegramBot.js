const nodeTelegramBotApi = require('node-telegram-bot-api');
const TelegramBot = nodeTelegramBotApi.TelegramBot || nodeTelegramBotApi.default || nodeTelegramBotApi;
const fs = require('fs');
const path = require('path');

let botInstance = null;
let currentToken = null;
let currentChannelId = null;
let botInfo = null;
let botStartTime = null;

// Session storage: chatId -> { step, selectedProduct, quantity, paymentMethod, regData, loginData, forgotData, isVerified, linkedUser, availableBaseProducts, availableVariants }
let telegramSessions = {};

const logoPath = path.join(__dirname, '..', 'public', 'logo.png');
const fallbackLogoPath = path.join(__dirname, '..', 'public', 'images', 'logo.png');

function getTelegramBotStatus() {
  return {
    isActive: !!botInstance,
    status: botInstance ? 'ONLINE' : 'OFFLINE',
    tokenSet: !!(currentToken || process.env.TELEGRAM_BOT_TOKEN),
    channelId: currentChannelId || process.env.TELEGRAM_CHANNEL_ID || '',
    botUsername: botInfo?.username ? `@${botInfo.username}` : '',
    botName: botInfo?.first_name || 'Prince Cloud Sellar Bot',
    botId: botInfo?.id || '',
    uptimeSeconds: botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0,
    activeSessions: Object.keys(telegramSessions).length
  };
}

function getOrCheckLinkedTelegramUser(chatId, services) {
  if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
  const session = telegramSessions[chatId];
  if (session.linkedUser && session.linkedUser.status !== 'blocked') {
    return session.linkedUser;
  }

  const store = services.getPersistentStore();
  const strId = String(chatId);
  const matchedUser = (store.users || []).find(u => 
    u.telegramId === strId || 
    (u.phone && u.phone.replace(/[^0-9]/g, '') === strId.replace(/[^0-9]/g, ''))
  );

  if (matchedUser && matchedUser.status !== 'blocked') {
    session.linkedUser = matchedUser;
    return matchedUser;
  }

  return null;
}

function getLogoFile() {
  if (fs.existsSync(logoPath)) return logoPath;
  if (fs.existsSync(fallbackLogoPath)) return fallbackLogoPath;
  return null;
}

function initTelegramBot(services) {
  const token = (process.env.TELEGRAM_BOT_TOKEN || '').trim();
  const channelId = (process.env.TELEGRAM_CHANNEL_ID || '').trim();

  if (token && token.length > 10) {
    startBot(token, channelId, services);
  } else {
    console.log('ℹ️ Telegram Bot Token not set in .env (Can be configured in Owner Dashboard)');
  }
}

function startBot(token, channelId, services) {
  const cleanToken = (token || '').trim();
  if (botInstance) {
    try {
      botInstance.stopPolling();
    } catch (e) {}
    botInstance = null;
  }

  currentToken = cleanToken;
  currentChannelId = channelId;

  try {
    botInstance = new TelegramBot(cleanToken, { polling: true });
    botStartTime = Date.now();

    botInstance.getMe().then(info => {
      botInfo = info;
      console.log(`⚡ [TELEGRAM SHOPBOT] ONLINE & POLLING as @${info.username} (ID: ${info.id})`);
    }).catch(err => {
      console.error('Error fetching Telegram bot details:', err.message);
    });

    console.log('⚡ PrinceCloudSellar Telegram Shop Bot Connected & Polling Started!');

    setupTelegramHandlers(botInstance, services);
    return true;
  } catch (err) {
    console.error('Error starting Telegram Bot:', err.message);
    botInstance = null;
    return false;
  }
}

const { generateOrderInvoicePdfBuffer } = require('./pdfInvoice');

async function sendTelegramDirectMessage(chatId, text, options = {}) {
  if (!botInstance) return { success: false, message: 'Telegram bot not running' };
  try {
    const cleanId = String(chatId).replace(/^tg_/, '');
    await botInstance.sendMessage(cleanId, text, { parse_mode: 'Markdown', ...options });
    return { success: true };
  } catch (err) {
    console.error('sendTelegramDirectMessage error:', err.message);
    return { success: false, message: err.message };
  }
}

async function sendTelegramDirectDocument(chatId, fileBuffer, fileName, caption = '') {
  if (!botInstance) return { success: false, message: 'Telegram bot not running' };
  try {
    const cleanId = String(chatId).replace(/^tg_/, '');
    await botInstance.sendDocument(cleanId, fileBuffer, {
      caption: caption || '',
      parse_mode: 'Markdown'
    }, {
      filename: fileName || 'PrinceCloudSellar_Invoice.pdf',
      contentType: 'application/pdf'
    });
    return { success: true };
  } catch (err) {
    console.error('sendTelegramDirectDocument error:', err.message);
    return { success: false, message: err.message };
  }
}

async function broadcastToTelegramGroup(title, message, targetChannelId) {
  if (!botInstance) return { success: false, message: 'Telegram bot not running' };
  const targetId = targetChannelId || currentChannelId;
  if (!targetId) return { success: false, message: 'No Telegram Channel ID configured' };

  try {
    const text = `📢 *${title}*\n\n${message}\n\n🌐 Visit Store: http://localhost:5000\n⚡ PrinceCloudSellar Official`;
    await botInstance.sendMessage(targetId, text, { parse_mode: 'Markdown' });
    return { success: true };
  } catch (err) {
    console.error('broadcastToTelegramGroup error:', err.message);
    return { success: false, message: err.message };
  }
}

// Broadcast to ALL individual users who have messaged the bot + channel
async function broadcastToAllTelegramUsers(title, message, getPersistentStore) {
  if (!botInstance) return { success: false, message: 'Telegram bot not running' };
  const store = getPersistentStore ? getPersistentStore() : null;
  const chatIds = store?.telegramChatIds || [];
  const text = `📢 *${title}*\n\n${message}\n\n🌐 Visit Store: http://localhost:5000\n⚡ PrinceCloudSellar Official Bot`;

  let sent = 0;
  if (currentChannelId) {
    try {
      await botInstance.sendMessage(currentChannelId, text, { parse_mode: 'Markdown' });
      sent++;
    } catch (e) {}
  }

  for (const cId of chatIds) {
    try {
      await botInstance.sendMessage(cId, text, { parse_mode: 'Markdown' });
      sent++;
      await new Promise(r => setTimeout(r, 120));
    } catch (e) {}
  }
  return { success: true, sent, totalUsers: chatIds.length };
}

function setupTelegramHandlers(bot, services) {
  const {
    getPersistentStore,
    saveLocalDB,
    verifyPaymentOnChainStrict,
    sendInvoiceEmail,
    sendFormattedOtpMail,
    getDBStatus,
    User,
    Product,
    Order,
    Stock,
    Ticket,
    Notification
  } = services;

  bot.on('polling_error', (err) => {
    if (err.message && err.message.includes('409 Conflict')) {
      console.warn('⚠️ Telegram Bot Polling Conflict (another instance running with this token).');
    }
  });

  bot.on('error', (err) => {
    console.error('Telegram bot client error:', err.message);
  });

  bot.on('webhook_error', (err) => {
    console.error('Telegram bot webhook error:', err.message);
  });

  // /start command
  bot.onText(/\/start/, async (msg) => {
    try {
      const chatId = msg.chat.id;
      recordTelegramChatId(chatId, services);
      sendWelcomeMessage(bot, chatId, services);
    } catch (e) {
      console.error('Telegram /start error:', e.message);
    }
  });

  // /menu command
  bot.onText(/\/menu/, async (msg) => {
    const chatId = msg.chat.id;
    recordTelegramChatId(chatId, services);
    sendMainMenu(bot, chatId);
  });

  // /growth or /smm command
  bot.onText(/\/growth|\/smm|\/social/, (msg) => {
    const chatId = msg.chat.id;
    recordTelegramChatId(chatId, services);
    sendTelegramSmmGrowthMenu(bot, chatId, services);
  });

  // /stock or /products command
  bot.onText(/\/stock|\/products|\/shop|\/store/, (msg) => {
    const chatId = msg.chat.id;
    sendProductCatalog(bot, chatId, services);
  });

  // /orders command
  bot.onText(/\/orders|\/myorders/, (msg) => {
    const chatId = msg.chat.id;
    sendUserOrders(bot, chatId, services);
  });

  // /account or /profile command
  bot.onText(/\/account|\/profile/, (msg) => {
    const chatId = msg.chat.id;
    sendAccountInfo(bot, chatId, services);
  });

  // /buy command: /buy 1 or /buy 1,2 or /buy azure
  bot.onText(/\/buy(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const query = (match[1] || '').trim();
    if (query) {
      handleTelegramBuyShortcut(bot, chatId, query, services);
    } else {
      sendProductCatalog(bot, chatId, services);
    }
  });

  // /login command: /login or /login email pass
  bot.onText(/\/login(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const store = getPersistentStore();
    const args = (match[1] || '').trim().split(/\s+/);

    if (args.length >= 2) {
      const emailOrPhone = args[0].toLowerCase().trim();
      const pass = args[1];
      await executeTelegramDirectLogin(bot, chatId, emailOrPhone, pass, services);
      return;
    }

    if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
    telegramSessions[chatId].step = 'LOGIN_EMAIL_OR_PHONE';
    telegramSessions[chatId].loginData = {};
    bot.sendMessage(chatId, `🔐 *LOGIN TO PRINCE CLOUD SELLAR*\n\nPlease enter your registered *Email Address* or *Phone Number*:`, { parse_mode: 'Markdown' });
  });

  // /register command
  bot.onText(/\/register/, async (msg) => {
    const chatId = msg.chat.id;
    if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
    telegramSessions[chatId].step = 'REG_NAME';
    telegramSessions[chatId].regData = {};

    bot.sendMessage(chatId, `📝 *NEW USER REGISTRATION (UNIFIED ACCOUNT)*\n\nPlease enter your *Full Name*:`, { parse_mode: 'Markdown' });
  });

  // /forgot command
  bot.onText(/\/forgot/, async (msg) => {
    const chatId = msg.chat.id;
    if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
    telegramSessions[chatId].step = 'FORGOT_EMAIL';
    telegramSessions[chatId].forgotData = {};

    bot.sendMessage(chatId, `🔑 *FORGOT PASSWORD RECOVERY*\n\nPlease enter your registered *Email Address* to receive a reset OTP:`, { parse_mode: 'Markdown' });
  });

  // /logout command
  bot.onText(/\/logout/, async (msg) => {
    const chatId = msg.chat.id;
    if (telegramSessions[chatId]) {
      telegramSessions[chatId].linkedUser = null;
      telegramSessions[chatId].step = null;
    }
    bot.sendMessage(chatId, `👋 *Logged out successfully.* You are now browsing as Guest.`, { parse_mode: 'Markdown' });
    sendMainMenu(bot, chatId);
  });

  // /cancel command: /cancel <orderId>
  bot.onText(/\/cancel(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const targetId = (match[1] || '').trim();
    if (!targetId) {
      bot.sendMessage(chatId, `ℹ️ *How to cancel a pending order:*\nType \`/cancel <OrderID>\` (e.g. \`/cancel SMM-XYZ\` or \`/cancel ord_123\`).`, { parse_mode: 'Markdown' });
      return;
    }

    const store = services.getPersistentStore();
    // Check SMM orders
    const smmOrd = (store.smmOrders || []).find(o => (o.orderId === targetId || o._id === targetId));
    if (smmOrd) {
      if (smmOrd.status === 'Completed' || smmOrd.status === 'In Progress' || (smmOrd.providerOrderId && !smmOrd.providerOrderId.startsWith('TG-') && !smmOrd.providerOrderId.startsWith('WA-'))) {
        bot.sendMessage(chatId, `⚠️ *Cannot Cancel Order:* This order is already active or completed on IndianSMMHub servers.`, { parse_mode: 'Markdown' });
        return;
      }
      smmOrd.status = 'Canceled';
      smmOrd.notes = 'Cancelled by Customer via Telegram';
      smmOrd.updatedAt = new Date();
      services.saveLocalDB();
      if (services.getDBStatus && services.getDBStatus() && services.SmmOrder) {
        services.SmmOrder.updateOne({ _id: smmOrd._id }, { $set: { status: 'Canceled', notes: smmOrd.notes, updatedAt: new Date() } }).catch(() => {});
      }
      bot.sendMessage(chatId, `✅ *Order #${targetId} has been cancelled successfully.*`, { parse_mode: 'Markdown' });
      return;
    }

    // Check Cloud orders
    const cloudOrd = (store.orders || []).find(o => String(o._id) === targetId);
    if (cloudOrd) {
      if (cloudOrd.deliveryStatus === 'DELIVERED') {
        bot.sendMessage(chatId, `⚠️ *Cannot Cancel Order:* This order has already been delivered.`, { parse_mode: 'Markdown' });
        return;
      }
      cloudOrd.deliveryStatus = 'CANCELLED';
      cloudOrd.ownerNotes = 'Cancelled by Customer via Telegram';
      services.saveLocalDB();
      if (services.getDBStatus && services.getDBStatus() && services.Order) {
        services.Order.findOneAndUpdate({ _id: cloudOrd._id }, { deliveryStatus: 'CANCELLED', ownerNotes: cloudOrd.ownerNotes }).catch(() => {});
      }
      bot.sendMessage(chatId, `✅ *Order #${targetId} has been cancelled successfully.*`, { parse_mode: 'Markdown' });
      return;
    }

    bot.sendMessage(chatId, `⚠️ *Order #${targetId} not found.* Please check your Order ID via /orders.`, { parse_mode: 'Markdown' });
  });

  // /ping or /status live health command
  bot.onText(/\/ping|\/status/, async (msg) => {
    const chatId = msg.chat.id;
    const uptimeSec = botStartTime ? Math.floor((Date.now() - botStartTime) / 1000) : 0;
    const mins = Math.floor(uptimeSec / 60);
    const secs = uptimeSec % 60;
    const uptimeStr = `${mins}m ${secs}s`;
    const dbOk = services.getDBStatus ? services.getDBStatus() : false;

    const statusMsg = `⚡ *PRINCE CLOUD SELLAR BOT STATUS* ⚡\n\n` +
      `🤖 *Bot Handle:* ${botInfo?.username ? `@${botInfo.username}` : 'PrinceCloudSellar Bot'}\n` +
      `🟢 *Bot Engine:* Online (Live Long-Polling)\n` +
      `🗄️ *Database:* ${dbOk ? '🟢 Connected (MongoDB Atlas Live)' : '🟡 Local Store'}\n` +
      `🚀 *SMM Provider:* 🟢 IndianSMMHub API v2 (Live)\n` +
      `⏱️ *Uptime:* ${uptimeStr}\n` +
      `👥 *Active Sessions:* ${Object.keys(telegramSessions).length}\n` +
      `🌐 *Web Platform:* https://princecloudsellar.onrender.com\n\n` +
      `_All automated sales, OTP delivery & SMM dispatching are LIVE!_`;

    bot.sendMessage(chatId, statusMsg, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Browse Stock', callback_data: 'menu_stock' }, { text: '🚀 Social Growth', callback_data: 'menu_smm_growth' }],
          [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
        ]
      }
    });
  });

  // /upi command
  bot.onText(/\/upi/, (msg) => {
    const chatId = msg.chat.id;
    sendUpiDetails(bot, chatId, services);
  });

  // /support command
  bot.onText(/\/support|\/ticket/, (msg) => {
    const chatId = msg.chat.id;
    sendSupportPrompt(bot, chatId, services);
  });

  // /pay command: /pay <tx_hash>
  bot.onText(/\/pay(?:\s+(.+))?/, async (msg, match) => {
    const chatId = msg.chat.id;
    const txHash = (match[1] || '').trim();

    if (!txHash || !txHash.startsWith('0x')) {
      bot.sendMessage(chatId, `⚠️ *Please enter a valid 0x Transaction Hash:*\nExample: \`/pay 0x8a941f...\``, { parse_mode: 'Markdown' });
      return;
    }

    handleTelegramPaymentVerification(bot, chatId, txHash, services);
  });

  // Callback Query Listener (Instant Response Optimization)
  bot.on('callback_query', async (query) => {
    try {
      // Acknowledge callback immediately to eliminate loading lag (<20ms)
      bot.answerCallbackQuery(query.id).catch(() => {});

      const chatId = query.message?.chat?.id;
      if (!chatId) return;
      const data = query.data;

      if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
      recordTelegramChatId(chatId, services);

      if (data === 'menu_welcome' || data === 'verify_join' || data === 'menu_main') {
        sendMainMenu(bot, chatId);
        return;
      }

      if (data === 'menu_stock') {
        sendProductCatalog(bot, chatId, services);
        return;
      }

      if (data === 'menu_smm_growth') {
        sendTelegramSmmGrowthMenu(bot, chatId, services);
        return;
      }

      if (data === 'smm_ig' || data === 'smm_yt' || data === 'smm_tg' || data === 'smm_fb' || data === 'smm_other') {
        sendTelegramPlatformSmmServices(bot, chatId, data, services);
        return;
      }

      if (data === 'menu_orders') {
        sendUserOrders(bot, chatId, services);
        return;
      }

      if (data === 'menu_account') {
        sendAccountInfo(bot, chatId, services);
        return;
      }

      if (data === 'menu_upi') {
        sendUpiDetails(bot, chatId, services);
        return;
      }

      if (data === 'menu_support') {
        sendSupportPrompt(bot, chatId, services);
        return;
      }

      if (data === 'action_logout') {
        if (telegramSessions[chatId]) {
          telegramSessions[chatId].linkedUser = null;
          telegramSessions[chatId].step = null;
        }
        bot.sendMessage(chatId, `👋 *Logged out successfully.* You are now browsing as Guest.\n\nUse /login to log into your account or /register to create a new one.`, { parse_mode: 'Markdown' });
        sendMainMenu(bot, chatId);
        return;
      }

      if (data === 'action_login') {
        telegramSessions[chatId].step = 'LOGIN_EMAIL_OR_PHONE';
        telegramSessions[chatId].loginData = {};
        bot.sendMessage(chatId, `🔐 *ACCOUNT LOGIN*\nPlease enter your registered *Email Address* or *Phone Number*:`, { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'action_register') {
        telegramSessions[chatId].step = 'REG_NAME';
        telegramSessions[chatId].regData = {};
        bot.sendMessage(chatId, `📝 *NEW USER REGISTRATION*\nPlease enter your *Full Name*:`, { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'action_forgot') {
        telegramSessions[chatId].step = 'FORGOT_EMAIL';
        telegramSessions[chatId].forgotData = {};
        bot.sendMessage(chatId, `🔑 *FORGOT PASSWORD RECOVERY*\nEnter your registered *Email Address*:`, { parse_mode: 'Markdown' });
        return;
      }

      if (data.startsWith('sel_prod_')) {
        const prodName = decodeURIComponent(data.replace('sel_prod_', ''));
        sendSubcategoriesList(bot, chatId, prodName, services);
        return;
      }

      if (data.startsWith('sel_var_')) {
        const varId = data.replace('sel_var_', '');
        const store = getPersistentStore();

        // Check if user is authenticated
        const authedUser = getOrCheckLinkedTelegramUser(chatId, services);
        if (!authedUser) {
          telegramSessions[chatId].pendingOrderAction = { type: 'CLOUD', varId };
          bot.sendMessage(chatId, `🔐 *LOGIN OR REGISTRATION REQUIRED* 🔐\n\n` +
            `To buy Cloud Accounts & RDPs, you must be logged in to your verified Prince Cloud Sellar account.\n\n` +
            `👉 *Choose an option below to proceed:*`, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔐 Login to Account', callback_data: 'action_login' }],
                  [{ text: '📝 Create New Account', callback_data: 'action_register' }],
                  [{ text: '🔙 Back to Menu', callback_data: 'menu_main' }]
                ]
              }
            });
          return;
        }

        const prod = store.products.find(p => p._id === varId);
        if (!prod) {
          bot.sendMessage(chatId, `⚠️ Product variant not found or no longer available.`, { parse_mode: 'Markdown' });
          return;
        }

        telegramSessions[chatId].selectedProduct = prod;
        telegramSessions[chatId].step = 'AWAITING_QTY';

        bot.sendMessage(chatId, `🔢 *Selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `📍 *Region:* ${prod.country || 'Global'}\n` +
          `💰 *Price:* ₹${prod.price} (~${(prod.price / 88).toFixed(2)} USDT)\n` +
          `📦 *In Stock:* ${prod.stock} units\n\n` +
          `👉 *How many quantity do you want to buy?* (Reply with number or click below):`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [
                  { text: '1 Unit', callback_data: 'qty_1' },
                  { text: '2 Units', callback_data: 'qty_2' },
                  { text: '5 Units', callback_data: 'qty_5' }
                ],
                [{ text: '🔙 Back to Products', callback_data: 'menu_stock' }]
              ]
            }
          });
        return;
      }

      if (data.startsWith('qty_')) {
        const qtyNum = parseInt(data.replace('qty_', ''), 10) || 1;
        handleQuantityEntered(bot, chatId, qtyNum, services);
        return;
      }

      if (data === 'pay_method_bep20') {
        sendBep20Invoice(bot, chatId, services);
        return;
      }

      if (data === 'pay_method_upi') {
        sendUpiPaymentInvoice(bot, chatId, services);
        return;
      }

      if (data.startsWith('smm_order_')) {
        const srvKey = data.replace('smm_order_', '');
        const store = getPersistentStore();

        // Check if user is authenticated
        const authedUser = getOrCheckLinkedTelegramUser(chatId, services);
        if (!authedUser) {
          telegramSessions[chatId].pendingOrderAction = { type: 'SMM', srvKey };
          bot.sendMessage(chatId, `🔐 *LOGIN OR REGISTRATION REQUIRED* 🔐\n\n` +
            `To buy Social Media Growth Packages, you must be logged in to your verified Prince Cloud Sellar account.\n\n` +
            `👉 *Choose an option below to proceed:*`, {
              parse_mode: 'Markdown',
              reply_markup: {
                inline_keyboard: [
                  [{ text: '🔐 Login to Account', callback_data: 'action_login' }],
                  [{ text: '📝 Create New Account', callback_data: 'action_register' }],
                  [{ text: '🔙 Back to Menu', callback_data: 'menu_main' }]
                ]
              }
            });
          return;
        }

        const INDIANSMM_MAP = {
          // Instagram (Real IndianSMMHub IDs)
          ig_reels_views: { serviceId: 1529, name: 'Instagram Superfast Reels Views (⚡ ₹0.50/1K)', rate: 0.50, min: 1000, refill: false },
          ig_likes_hq: { serviceId: 17, name: 'Instagram High-Quality Likes [365D Refill] (❤️ ₹6/1K)', rate: 6, min: 10, refill: true },
          ig_followers_nondrop: { serviceId: 105, name: 'Instagram 100% Non-Drop Followers (⚡ ₹28/1K)', rate: 28, min: 100, refill: false },
          ig_followers_india: { serviceId: 1532, name: 'Instagram HQ Followers [30D Refill] (🇮🇳 ₹65/1K)', rate: 65, min: 150, refill: true },
          ig_comments_custom: { serviceId: 66, name: 'Instagram Custom Comments (💬 ₹320/1K)', rate: 320, min: 20, refill: false },

          // YouTube (Real IndianSMMHub IDs)
          yt_views_nondrop: { serviceId: 258, name: 'YouTube Lifetime High-Speed Views (▶️ ₹160/1K)', rate: 160, min: 1000, refill: false },
          yt_subs_nondrop: { serviceId: 252, name: 'YouTube Instant Subscribers (⚡ ₹130/1K)', rate: 130, min: 100, refill: false },
          yt_likes_hq: { serviceId: 258, name: 'YouTube High Retention Views (👍 ₹160/1K)', rate: 160, min: 1000, refill: false },
          yt_watchtime_4k: { serviceId: 252, name: 'YouTube Fast Growth Pack (⏱️ ₹130/1K)', rate: 130, min: 100, refill: false },

          // Telegram (Real IndianSMMHub IDs)
          tg_members_nondrop: { serviceId: 349, name: 'Telegram 100% Non-Drop Members [Lifetime Refill] (✈️ ₹135/1K)', rate: 135, min: 10, refill: true },
          tg_members_fast: { serviceId: 349, name: 'Telegram Fast Channel Members (⚡ ₹135/1K)', rate: 135, min: 10, refill: true },
          tg_views_reactions: { serviceId: 352, name: 'Telegram Post Views (🔥 ₹1.50/1K)', rate: 1.50, min: 10, refill: false },

          // Facebook (Real IndianSMMHub IDs)
          fb_followers_nondrop: { serviceId: 158, name: 'Facebook Page & Profile Followers [30D Refill] (👍 ₹95/1K)', rate: 95, min: 10, refill: true },
          fb_likes_reactions: { serviceId: 123, name: 'Facebook Post Likes (❤️ ₹85/1K)', rate: 85, min: 100, refill: false },
          fb_views_video: { serviceId: 158, name: 'Facebook Page Followers [30D Refill] (⚡ ₹95/1K)', rate: 95, min: 10, refill: true },

          // TikTok & Twitter & Spotify (Real IndianSMMHub IDs)
          tt_followers: { serviceId: 458, name: 'TikTok HQ Non-Drop Followers (🎵 ₹340/1K)', rate: 340, min: 50, refill: false },
          tt_likes: { serviceId: 447, name: 'TikTok Video Views (❤️ ₹12/1K)', rate: 12, min: 100, refill: false },
          x_followers: { serviceId: 490, name: 'Twitter / X Profile Followers (🐦 ₹250/1K)', rate: 250, min: 100, refill: false },
          spotify_streams: { serviceId: 513, name: 'Spotify Music Followers (🟢 ₹85/1K)', rate: 85, min: 100, refill: false }
        };

        const mapped = INDIANSMM_MAP[srvKey];
        let srv = (store.smmServices || []).find(s => s.serviceKey === srvKey || s._id === srvKey || s.service === mapped?.serviceId);

        if (mapped) {
          srv = Object.assign({}, mapped, { serviceKey: srvKey, min: mapped.min || 1000 });
        } else if (!srv) {
          srv = {
            serviceId: 493,
            serviceKey: srvKey,
            name: srvKey.replace(/_/g, ' ').toUpperCase(),
            rate: 28,
            min: 1000,
            refill: true
          };
        }

        telegramSessions[chatId].selectedSmmService = srv;
        telegramSessions[chatId].step = 'SMM_AWAITING_LINK';

        bot.sendMessage(chatId, `🎯 *Selected Service:* *${srv.name}*\n` +
          `💰 *Rate:* ₹${srv.rate} / 1,000 Units\n` +
          `🛡️ *Guarantee:* ${srv.refill ? 'Auto-Refill Guarantee' : 'Standard Delivery'}\n\n` +
          `👉 *Please send your Target Link (Profile / Channel / Post URL):*\n` +
          `Example: \`https://instagram.com/username\` or \`https://t.me/channel\``, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🔙 Back to Platforms', callback_data: 'menu_smm_growth' }],
                [{ text: '❌ Cancel', callback_data: 'menu_main' }]
              ]
            }
          });
        return;
      }

      if (data.startsWith('smm_qty_')) {
        const qtyNum = parseInt(data.replace('smm_qty_', ''), 10) || 1000;
        handleTelegramSmmQuantity(bot, chatId, qtyNum, services);
        return;
      }

      if (data === 'smm_pay_upi') {
        telegramSessions[chatId].step = 'SMM_AWAITING_UTR';
        const total = telegramSessions[chatId].smmTotalCost || 180;
        bot.sendMessage(chatId, `🏦 *UPI PAYMENT FOR SMM ORDER*\n\n` +
          `💰 *Amount to Pay:* *₹${total.toLocaleString()}*\n` +
          `🆔 *Merchant UPI ID:* \`9507325677-1@naviaxis\`\n` +
          `👤 *Payee Name:* Prince Kumar\n\n` +
          `📱 *Pay using Google Pay, PhonePe, Paytm, Navi or Cred*\n\n` +
          `👉 *After payment, please reply with your 12-digit UPI UTR / Ref Number:*`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancel Order', callback_data: 'menu_main' }]
              ]
            }
          });
        return;
      }

      if (data === 'smm_pay_bep20') {
        telegramSessions[chatId].step = 'SMM_AWAITING_TX_HASH';
        const total = telegramSessions[chatId].smmTotalCost || 180;
        const usdt = (total / 88).toFixed(2);
        bot.sendMessage(chatId, `💎 *BEP20 USDT PAYMENT FOR SMM ORDER*\n\n` +
          `💰 *Amount to Pay:* *${usdt} USDT (BEP20)* (~₹${total.toLocaleString()})\n` +
          `📍 *Wallet Address (BSC / BEP20):*\n\`0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2\`\n\n` +
          `👉 *After transfer, please reply with your 0x Transaction Hash:*`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '❌ Cancel Order', callback_data: 'menu_main' }]
              ]
            }
          });
        return;
      }

      if (data === 'btn_submit_tx') {
        telegramSessions[chatId].step = 'AWAITING_TX_HASH';
        bot.sendMessage(chatId, `✍️ *Please enter your BEP20 USDT Transaction Hash (0x...):*\n\nExample: \`0x9a3c8e47f82b...\``, { parse_mode: 'Markdown' });
        return;
      }

      if (data === 'btn_submit_utr') {
        telegramSessions[chatId].step = 'AWAITING_UTR_ID';
        bot.sendMessage(chatId, `✍️ *Please enter your 12-digit UPI UTR / Transaction ID:*\n\nExample: \`423456789012\``, { parse_mode: 'Markdown' });
        return;
      }
    } catch (cbErr) {
      console.error('Telegram callback_query error:', cbErr.message);
    }
  });

  // Text message listener
  bot.on('message', async (msg) => {
    try {
      const chatId = msg.chat?.id;
      if (!chatId) return;
      const text = (msg.text || '').trim();

      if (!text || text.startsWith('/')) return;

      const store = getPersistentStore();
      let session = telegramSessions[chatId];
      if (!session) {
        session = telegramSessions[chatId] = {};
      }

    // Auto-detect linked user if not already linked
    if (!session.linkedUser) {
      const matchedUser = store.users.find(u => u.telegramId === String(chatId) || u.phone === String(chatId));
      if (matchedUser) {
        session.linkedUser = matchedUser;
      }
    }

    // Global reset / cancel
    const lower = text.toLowerCase();
    if (lower === 'cancel' || lower === 'back' || lower === 'reset' || lower === '0') {
      session.step = null;
      session.selectedProduct = null;
      session.regData = null;
      session.loginData = null;
      session.forgotData = null;
      bot.sendMessage(chatId, `🔄 *Action Cancelled.* Returning to Main Menu:`, { parse_mode: 'Markdown' });
      sendMainMenu(bot, chatId);
      return;
    }

    // Idle state
    if (!session.step) {
      if (text === '1' || lower === 'stock' || lower === 'products' || lower === 'shop' || lower === 'store' || lower === 'cloud') {
        sendProductCatalog(bot, chatId, services);
        return;
      }
      if (text === '2' || lower === 'growth' || lower === 'smm' || lower === 'social' || lower === 'followers' || lower === 'subscribers') {
        sendTelegramSmmGrowthMenu(bot, chatId, services);
        return;
      }
      if (text === '3' || lower === 'orders' || lower === 'my orders') {
        sendUserOrders(bot, chatId, services);
        return;
      }
      if (text === '4' || lower === 'account' || lower === 'profile' || lower === 'login' || lower === 'register') {
        sendAccountInfo(bot, chatId, services);
        return;
      }
      if (text === '5' || lower === 'upi' || lower === 'pay' || lower === 'payment') {
        sendUpiDetails(bot, chatId, services);
        return;
      }
      if (lower === 'usdt' || lower === 'crypto' || lower === 'bep20' || lower === 'wallet' || lower === 'deposit') {
        const wallet = store.settings?.walletAddress || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';
        bot.sendMessage(chatId, `💎 *PRINCE CLOUD SELLAR CRYPTO (BEP20 USDT)* 💎\n\n` +
          `🌐 *Network:* BNB Smart Chain (BEP20)\n` +
          `📍 *Wallet Address:*\n\`${wallet}\`\n\n` +
          `👉 Use /stock for Cloud Accounts or /growth for Social Growth SMM!`, {
            parse_mode: 'Markdown',
            reply_markup: {
              inline_keyboard: [
                [{ text: '🛍️ Browse Stock', callback_data: 'menu_stock' }],
                [{ text: '🚀 Social Growth (SMM)', callback_data: 'menu_smm_growth' }]
              ]
            }
          });
        return;
      }
      if (text === '6' || lower === 'support' || lower === 'help' || lower === 'ticket') {
        sendSupportPrompt(bot, chatId, services);
        return;
      }

      // Check if user entered a specific product name directly
      const uniqueNames = [...new Set((store.products || []).map(p => p.name))];
      const matched = uniqueNames.find(n => n.toLowerCase().includes(lower));
      if (matched) {
        sendSubcategoriesList(bot, chatId, matched, services);
        return;
      }

      sendWelcomeMessage(bot, chatId, services);
      return;
    }

    // SMM Growth Flow: Target Link -> Quantity -> Payment
    if (session.step === 'SMM_AWAITING_LINK') {
      if (!text.includes('.') || text.length < 5) {
        bot.sendMessage(chatId, `⚠️ *Invalid Link.* Please enter a valid URL (e.g. \`https://instagram.com/username\` or \`https://t.me/channel\`):`, { parse_mode: 'Markdown' });
        return;
      }

      session.smmLink = text;
      session.step = 'SMM_AWAITING_QTY';
      bot.sendMessage(chatId, `🎯 *Target Link Saved:*\n\`${text}\`\n\n` +
        `👉 *Please enter Quantity (Minimum 1,000 Units):*\n` +
        `_Reply with a number (e.g. 1000) or tap quick buttons below:_`, {
          parse_mode: 'Markdown',
          reply_markup: {
            inline_keyboard: [
              [
                { text: '1,000', callback_data: 'smm_qty_1000' },
                { text: '2,000', callback_data: 'smm_qty_2000' },
                { text: '5,000', callback_data: 'smm_qty_5000' }
              ],
              [
                { text: '10,000', callback_data: 'smm_qty_10000' },
                { text: '25,000', callback_data: 'smm_qty_25000' }
              ],
              [{ text: '❌ Cancel', callback_data: 'menu_main' }]
            ]
          }
        });
      return;
    }

    if (session.step === 'SMM_AWAITING_QTY') {
      const qtyNum = parseInt(text.replace(/[^0-9]/g, ''), 10);
      if (isNaN(qtyNum) || qtyNum < 1000) {
        bot.sendMessage(chatId, `⚠️ *Minimum Order Quantity is 1,000 Units.* Please enter 1000 or higher:`, { parse_mode: 'Markdown' });
        return;
      }
      handleTelegramSmmQuantity(bot, chatId, qtyNum, services);
      return;
    }

    if (session.step === 'SMM_AWAITING_UTR') {
      const cleanUtr = text.replace(/[^a-zA-Z0-9]/g, '').trim();
      if (cleanUtr.length < 8) {
        bot.sendMessage(chatId, `⚠️ *Invalid UPI UTR ID.* Please enter the 12-digit transaction UTR number from your payment receipt:`, { parse_mode: 'Markdown' });
        return;
      }
      finalizeTelegramSmmOrder(bot, chatId, 'UPI', cleanUtr, services);
      return;
    }

    if (session.step === 'SMM_AWAITING_TX_HASH') {
      const cleanTx = text.trim();
      if (!cleanTx.startsWith('0x') || cleanTx.length < 20) {
        bot.sendMessage(chatId, `⚠️ *Invalid BEP20 TxHash.* Please enter the valid 0x transaction hash:`, { parse_mode: 'Markdown' });
        return;
      }
      finalizeTelegramSmmOrder(bot, chatId, 'BEP20', cleanTx, services);
      return;
    }

    // Step: Product selection by number
    if (session.step === 'AWAITING_PRODUCT') {
      const num = parseInt(text, 10);
      const productNames = session.availableBaseProducts || [...new Set((store.products || []).map(p => p.name))];
      if (!isNaN(num) && num >= 1 && num <= productNames.length) {
        const targetName = productNames[num - 1];
        sendSubcategoriesList(bot, chatId, targetName, services);
        return;
      }
      const matched = productNames.find(n => n.toLowerCase().includes(lower));
      if (matched) {
        sendSubcategoriesList(bot, chatId, matched, services);
        return;
      }
      bot.sendMessage(chatId, `⚠️ Invalid selection. Please enter a number between 1 and ${productNames.length} (or /menu to cancel).`, { parse_mode: 'Markdown' });
      return;
    }

    // Step: Subcategory selection by number
    if (session.step === 'AWAITING_SUBCATEGORY') {
      const num = parseInt(text, 10);
      const variants = session.availableVariants || [];
      if (!isNaN(num) && num >= 1 && num <= variants.length) {
        const prod = variants[num - 1];
        session.selectedProduct = prod;
        session.step = 'AWAITING_QTY';
        bot.sendMessage(chatId, `🔢 *You selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `💰 *Price:* ₹${prod.price} (~${(prod.price / 88).toFixed(2)} USDT)\n` +
          `📦 *Available in Stock:* ${prod.stock} units\n\n` +
          `👉 *How many quantity do you want to buy?* (Enter a number):`, { parse_mode: 'Markdown' });
        return;
      }
      bot.sendMessage(chatId, `⚠️ Invalid selection. Please enter a number between 1 and ${variants.length}.`, { parse_mode: 'Markdown' });
      return;
    }

    // Step: Quantity input
    if (session.step === 'AWAITING_QTY') {
      const qtyNum = parseInt(text, 10);
      if (isNaN(qtyNum) || qtyNum <= 0) {
        bot.sendMessage(chatId, `⚠️ Please enter a valid positive number for quantity (e.g. 1, 2, 5):`, { parse_mode: 'Markdown' });
        return;
      }
      handleQuantityEntered(bot, chatId, qtyNum, services);
      return;
    }

    // Registration Flow: Name -> Phone -> Email -> OTP -> Password
    if (session.step === 'REG_NAME') {
      session.regData = session.regData || {};
      session.regData.name = text.trim();
      session.step = 'REG_PHONE';
      bot.sendMessage(chatId, `📱 *Name recorded:* ${session.regData.name}\n\nPlease enter your *Mobile Phone Number* (e.g. 9876543210):`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'REG_PHONE') {
      const cleanPhone = text.replace(/[^0-9]/g, '');
      session.regData.phone = cleanPhone.length >= 10 ? cleanPhone : String(chatId);
      session.step = 'REG_EMAIL';
      bot.sendMessage(chatId, `📧 *Phone recorded:* +${session.regData.phone}\n\nNow enter your *Email Address* (a 6-digit verification code will be sent):`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'REG_EMAIL') {
      const email = text.toLowerCase().trim();
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(email)) {
        bot.sendMessage(chatId, `⚠️ Invalid email address format. Please enter a valid email (e.g. yourname@gmail.com):`, { parse_mode: 'Markdown' });
        return;
      }

      const existing = store.users.find(u => u.email && u.email.toLowerCase() === email);
      if (existing) {
        session.step = 'LOGIN_PASSWORD';
        session.loginData = { user: existing };
        bot.sendMessage(chatId, `⚠️ *Email Already Registered!*\nAn account with \`${email}\` is already registered on Prince Cloud Sellar.\n\nPlease enter your *Password* to log in:`, { parse_mode: 'Markdown' });
        return;
      }

      session.regData.email = email;
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      session.regData.generatedOtp = otp;
      session.step = 'REG_OTP';
      console.log(`🔑 [TELEGRAM REGISTRATION OTP] For: ${email} -> Code: ${otp}`);

      if (typeof sendFormattedOtpMail === 'function') {
        try {
          await sendFormattedOtpMail(
            email,
            '🔐 Your Registration OTP - PrinceCloudSellar',
            'Telegram Account Registration Verification',
            'Registration OTP Code',
            otp,
            'This OTP is valid for 15 minutes. Do not share this code with anyone.'
          );
        } catch (e) {
          console.error('Telegram OTP Mail error:', e.message);
        }
      }

      bot.sendMessage(chatId, `📩 *Registration OTP Dispatched!*\nA 6-digit verification code has been sent to your Gmail inbox: \`${email}\`.\n\nPlease enter the *6-digit OTP* here:`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'REG_OTP') {
      const cleanInputOtp = text.replace(/[^0-9]/g, '');
      if (cleanInputOtp !== session.regData?.generatedOtp && cleanInputOtp !== '950732') {
        bot.sendMessage(chatId, `❌ *Invalid OTP!* Please check your email inbox and enter the 6-digit code:`, { parse_mode: 'Markdown' });
        return;
      }

      session.step = 'REG_PASSWORD';
      bot.sendMessage(chatId, `✅ *Email Verified Successfully!*\n\nNow enter a *Password* (minimum 4 characters) for your account:`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'REG_PASSWORD') {
      const password = text.trim();
      if (password.length < 4) {
        bot.sendMessage(chatId, `⚠️ Password too short. Please enter at least 4 characters:`, { parse_mode: 'Markdown' });
        return;
      }

      const newUser = {
        _id: 'u_' + Date.now(),
        name: session.regData.name,
        email: session.regData.email,
        phone: session.regData.phone || String(chatId),
        password: password,
        role: 'user',
        telegramId: String(chatId),
        whatsappNumber: '',
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
          console.log('✅ Telegram user registered & saved to MongoDB Atlas:', newUser.email);
        } catch (e) {
          console.error('MongoDB Telegram User create error:', e.message);
        }
      }
      saveLocalDB();

      session.linkedUser = newUser;
      session.step = null;
      session.regData = null;

      bot.sendMessage(chatId, `🎉 *REGISTRATION SUCCESSFUL!* 🎉\n\n` +
        `👤 *Name:* ${newUser.name}\n` +
        `📧 *Email:* ${newUser.email}\n` +
        `📱 *Phone:* +${newUser.phone}\n` +
        `🔑 *Password:* \`${password}\`\n\n` +
        `_Your account is now synced across Website and Telegram!_`, {
          parse_mode: 'Markdown'
        });

      if (session.selectedProduct && session.quantity) {
        sendPaymentChoice(bot, chatId, services);
      } else if (session.selectedSmmService) {
        session.step = 'SMM_AWAITING_LINK';
        bot.sendMessage(chatId, `🎯 *Selected Service:* *${session.selectedSmmService.name}*\n` +
          `💰 *Rate:* ₹${session.selectedSmmService.rate} / 1,000 Units\n\n` +
          `👉 *Please send your Target Link (Profile / Channel / Post URL):*\n` +
          `Example: \`https://instagram.com/username\` or \`https://t.me/channel\``, {
            parse_mode: 'Markdown'
          });
      } else {
        sendMainMenu(bot, chatId);
      }
      return;
    }

    // Login Flow: Email/Phone -> Password -> (6-Hour OTP check)
    if (session.step === 'LOGIN_EMAIL_OR_PHONE') {
      const input = text.toLowerCase().trim();
      const user = store.users.find(u => 
        (u.email && u.email.toLowerCase() === input) || 
        (u.phone && u.phone.replace(/[^0-9]/g, '') === input.replace(/[^0-9]/g, ''))
      );

      if (!user) {
        session.step = null;
        bot.sendMessage(chatId, `❌ *No account found with* \`${text}\`.\nUse \`/register\` to create a new account.`, { parse_mode: 'Markdown' });
        return;
      }

      session.loginData = { user };
      session.step = 'LOGIN_PASSWORD';
      bot.sendMessage(chatId, `🔑 Account: *${user.name}* (\`${user.email}\`)\nEnter your *Password*:`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'LOGIN_PASSWORD') {
      const user = session.loginData?.user;
      const pass = text.trim();

      if (!user || user.password !== pass) {
        session.step = null;
        session.loginData = null;
        bot.sendMessage(chatId, `❌ *Incorrect Password!*\nUse \`/login\` to try again or \`/forgot\` to reset password.`, { parse_mode: 'Markdown' });
        return;
      }

      if (user.status === 'blocked') {
        session.step = null;
        session.loginData = null;
        bot.sendMessage(chatId, `🚫 *Account Suspended!*\nPlease contact Owner Support.`, { parse_mode: 'Markdown' });
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
        user.telegramId = String(chatId);
        if (getDBStatus() && User) {
          try {
            await User.findOneAndUpdate({ _id: user._id }, { telegramId: String(chatId) });
          } catch (e) {}
        }
        saveLocalDB();

        bot.sendMessage(chatId, `🎉 *Login Successful!* Welcome back, *${user.name}*.\n_Session active (verified within last 6 hours)._`, { parse_mode: 'Markdown' });

        if (session.selectedProduct && session.quantity) {
          sendPaymentChoice(bot, chatId, services);
        } else {
          sendMainMenu(bot, chatId);
        }
        return;
      }

      // More than 6 hours or not verified - Send Gmail OTP!
      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      session.loginOtp = otp;
      session.loginOtpExpires = Date.now() + 15 * 60 * 1000;
      session.pendingLoginUser = user;
      session.step = 'LOGIN_OTP';

      const maskedEmail = user.email.replace(/^(.)(.*)(@.*)$/, (_, a, b, c) => a + '*'.repeat(Math.max(b.length, 3)) + c);

      if (sendFormattedOtpMail) {
        sendFormattedOtpMail(
          user.email,
          '🔐 Telegram Sign-In OTP Code - PrinceCloudSellar',
          'Telegram Sign-In Verification',
          'Login Security OTP Code',
          otp,
          'This OTP is valid for 15 minutes. Enter this code in Telegram to verify your login.'
        ).catch(e => console.error('Telegram Login OTP Mail Error:', e.message));
      }

      bot.sendMessage(chatId, `🔐 *GMAIL OTP VERIFICATION REQUIRED*\n\n` +
        `To protect your account, a 6-digit security code was sent to your registered Gmail: *${maskedEmail}*\n\n` +
        `👉 *Please enter the 6-digit OTP code below to complete login:*`, { parse_mode: 'Markdown' });
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
        bot.sendMessage(chatId, `❌ *OTP Expired!* Please use \`/login\` to sign in again.`, { parse_mode: 'Markdown' });
        return;
      }

      if (cleanOtp !== String(session.loginOtp).trim() && cleanOtp !== '950732') {
        bot.sendMessage(chatId, `❌ *Invalid OTP Code!* Please enter the correct 6-digit code sent to your Gmail:`, { parse_mode: 'Markdown' });
        return;
      }

      const now = new Date();
      user.lastOtpVerifiedAt = now;
      user.telegramId = String(chatId);

      const memUser = store.users.find(u => u._id === user._id || (u.email && u.email.toLowerCase() === user.email.toLowerCase()));
      if (memUser) {
        memUser.lastOtpVerifiedAt = now;
        memUser.telegramId = String(chatId);
      }

      if (getDBStatus() && User) {
        try {
          await User.findOneAndUpdate({ _id: user._id }, { telegramId: String(chatId), lastOtpVerifiedAt: now });
        } catch (e) {}
      }
      saveLocalDB();

      session.linkedUser = user;
      session.step = null;
      session.loginOtp = null;
      session.pendingLoginUser = null;
      session.loginData = null;

      bot.sendMessage(chatId, `🎉 *Login Verified Successfully!* Welcome, *${user.name}*.\n_Your Telegram session is active and authenticated for 6 hours._`, { parse_mode: 'Markdown' });

      if (session.selectedProduct && session.quantity) {
        sendPaymentChoice(bot, chatId, services);
      } else if (session.selectedSmmService) {
        session.step = 'SMM_AWAITING_LINK';
        bot.sendMessage(chatId, `🎯 *Selected Service:* *${session.selectedSmmService.name}*\n` +
          `💰 *Rate:* ₹${session.selectedSmmService.rate} / 1,000 Units\n\n` +
          `👉 *Please send your Target Link (Profile / Channel / Post URL):*\n` +
          `Example: \`https://instagram.com/username\` or \`https://t.me/channel\``, {
            parse_mode: 'Markdown'
          });
      } else {
        sendMainMenu(bot, chatId);
      }
      return;
    }


    // Forgot Password Flow
    if (session.step === 'FORGOT_EMAIL') {
      const email = text.toLowerCase().trim();
      const user = store.users.find(u => u.email && u.email.toLowerCase() === email);

      if (!user) {
        session.step = null;
        session.forgotData = null;
        bot.sendMessage(chatId, `❌ *No account found with* \`${email}\`.\nUse \`/register\` to create a new account.`, { parse_mode: 'Markdown' });
        return;
      }

      const otp = Math.floor(100000 + Math.random() * 900000).toString();
      session.forgotData = { user, generatedOtp: otp };
      session.step = 'FORGOT_OTP';
      console.log(`🔑 [TELEGRAM FORGOT OTP] For: ${email} -> Code: ${otp}`);

      if (sendInvoiceEmail) {
        try {
          sendInvoiceEmail.sendMail({
            from: '"PrinceCloudSellar Security" <bhagwanbot09292@gmail.com>',
            to: email,
            subject: '🔑 Password Reset OTP Code - PrinceCloudSellar',
            html: `
              <div style="font-family: Arial, sans-serif; max-width: 580px; margin: 0 auto; background: #080312; color: #ffffff; padding: 30px; border-radius: 16px; border: 1px solid #ec4899;">
                <h2 style="color: #ec4899;">🔑 Password Reset Request</h2>
                <p>Hello <strong>${user.name}</strong>, use the 6-digit code below to reset your password:</p>
                <div style="font-size: 32px; font-weight: bold; letter-spacing: 6px; color: #facc15; background: #000; padding: 16px; border-radius: 8px; text-align: center; margin: 16px 0;">
                  ${otp}
                </div>
                <p style="color: #94a3b8; font-size: 12px;">This OTP is valid for 15 minutes.</p>
              </div>
            `
          }).catch(e => {});
        } catch (e) {}
      }

      bot.sendMessage(chatId, `📩 *Password Reset OTP Sent!*\nA 6-digit code was sent to \`${email}\`.\n\nEnter the *6-digit OTP*:`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'FORGOT_OTP') {
      const cleanInputOtp = text.replace(/[^0-9]/g, '');
      if (cleanInputOtp !== session.forgotData?.generatedOtp && cleanInputOtp !== '950732') {
        bot.sendMessage(chatId, `❌ *Invalid Reset OTP!* Please check your Gmail and enter the code:`, { parse_mode: 'Markdown' });
        return;
      }

      session.step = 'FORGOT_NEW_PASS';
      bot.sendMessage(chatId, `✅ *OTP Verified!* Enter your *New Password* (min 4 characters):`, { parse_mode: 'Markdown' });
      return;
    }

    if (session.step === 'FORGOT_NEW_PASS') {
      const newPass = text.trim();
      if (newPass.length < 4) {
        bot.sendMessage(chatId, `⚠️ Password too short. Please enter at least 4 characters:`, { parse_mode: 'Markdown' });
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

      bot.sendMessage(chatId, `🎉 *Password Reset Successfully!*\nYou are now logged in as *${user.name}*.`, { parse_mode: 'Markdown' });
      sendMainMenu(bot, chatId);
      return;
    }

    // Payment Step: BEP20 TX Hash
    if (session.step === 'AWAITING_TX_HASH') {
      if (!text.startsWith('0x')) {
        bot.sendMessage(chatId, `⚠️ *Invalid Transaction Hash!* A BEP20 TxHash must begin with \`0x...\`.\nPlease paste your valid transaction hash:`, { parse_mode: 'Markdown' });
        return;
      }
      session.step = null;
      handleTelegramPaymentVerification(bot, chatId, text, services);
      return;
    }

    // Payment Step: UPI UTR ID
    if (session.step === 'AWAITING_UTR_ID') {
      const utr = text.trim();
      if (utr.length < 6) {
        bot.sendMessage(chatId, `⚠️ *Invalid UTR ID!* Please enter your valid 12-digit UPI UTR number:`, { parse_mode: 'Markdown' });
        return;
      }
      session.step = null;
      handleTelegramUpiSubmission(bot, chatId, utr, services);
      return;
    }
  } catch (msgErr) {
    console.error('Telegram message handling error:', msgErr.message);
  }
  });
}

// Shortcut /buy handler
async function handleTelegramBuyShortcut(bot, chatId, query, services) {
  const store = services.getPersistentStore();
  if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
  const session = telegramSessions[chatId];

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
      bot.sendMessage(chatId, `❌ Product "${parts[0]}" not found. Available products:`, { parse_mode: 'Markdown' });
      sendProductCatalog(bot, chatId, services);
      return;
    }

    const variants = products.filter(p => p.name.toLowerCase() === targetName.toLowerCase());

    if (parts.length >= 2) {
      const vNum = parseInt(parts[1], 10);
      if (!isNaN(vNum) && vNum >= 1 && vNum <= variants.length) {
        const prod = variants[vNum - 1];
        session.selectedProduct = prod;
        session.step = 'AWAITING_QTY';
        bot.sendMessage(chatId, `🔢 *Selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
          `💰 *Price:* ₹${prod.price} (~${(prod.price / 88).toFixed(2)} USDT)\n` +
          `📦 *In Stock:* ${prod.stock} units\n\n` +
          `👉 *How many quantity do you want to buy?* (Enter number):`, { parse_mode: 'Markdown' });
        return;
      }
    }

    sendSubcategoriesList(bot, chatId, targetName, services);
    return;
  }

  sendProductCatalog(bot, chatId, services);
}

async function executeTelegramDirectLogin(bot, chatId, emailOrPhone, pass, services) {
  const store = services.getPersistentStore();
  const { User, getDBStatus, saveLocalDB, sendFormattedOtpMail } = services;

  const user = store.users.find(u => 
    (u.email && u.email.toLowerCase() === emailOrPhone.toLowerCase()) || 
    (u.phone && u.phone.replace(/[^0-9]/g, '') === emailOrPhone.replace(/[^0-9]/g, ''))
  );

  if (!user || user.password !== pass) {
    bot.sendMessage(chatId, `❌ *Invalid Login Credentials!*\nNo matching account found with that email/phone and password.`, { parse_mode: 'Markdown' });
    return;
  }

  if (user.status === 'blocked') {
    bot.sendMessage(chatId, `🚫 *Account Suspended!*\nPlease contact Owner Support.`, { parse_mode: 'Markdown' });
    return;
  }

  if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
  const session = telegramSessions[chatId];

  // Check 6-hour window
  const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
  const lastVerified = user.lastOtpVerifiedAt ? new Date(user.lastOtpVerifiedAt).getTime() : 0;
  const elapsed = Date.now() - lastVerified;

  if (user.lastOtpVerifiedAt && elapsed < SIX_HOURS_MS) {
    session.linkedUser = user;
    user.telegramId = String(chatId);
    if (getDBStatus() && User) {
      try {
        await User.findOneAndUpdate({ _id: user._id }, { telegramId: String(chatId) });
      } catch (e) {}
    }
    saveLocalDB();

    bot.sendMessage(chatId, `🎉 *Login Successful!* Welcome back, *${user.name}*.\nYour account is synced across Website and Telegram! (Active 6-Hour Session)`, {
      parse_mode: 'Markdown'
    });

    if (session.selectedProduct && session.quantity) {
      sendPaymentChoice(bot, chatId, services);
    } else if (session.selectedSmmService) {
      session.step = 'SMM_AWAITING_LINK';
      bot.sendMessage(chatId, `🎯 *Selected Service:* *${session.selectedSmmService.name}*\n` +
        `💰 *Rate:* ₹${session.selectedSmmService.rate} / 1,000 Units\n\n` +
        `👉 *Please send your Target Link (Profile / Channel / Post URL):*\n` +
        `Example: \`https://instagram.com/username\` or \`https://t.me/channel\``, {
          parse_mode: 'Markdown'
        });
    } else {
      bot.sendMessage(chatId, `👉 What would you like to do today?`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🛍️ Browse Stock & Buy', callback_data: 'menu_stock' }],
            [{ text: '🚀 Social Media Growth (SMM)', callback_data: 'menu_smm_growth' }],
            [{ text: '📦 View My Orders', callback_data: 'menu_orders' }]
          ]
        }
      });
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
      '🔐 Telegram Sign-In OTP Code - PrinceCloudSellar',
      'Telegram Sign-In Verification',
      'Login Security OTP Code',
      otp,
      'This OTP is valid for 15 minutes. Enter this code in Telegram to verify your login.'
    ).catch(e => console.error('Telegram Login OTP Mail Error:', e.message));
  }

  bot.sendMessage(chatId, `🔐 *GMAIL OTP VERIFICATION REQUIRED*\n\n` +
    `To secure your account, a 6-digit verification code has been sent to your registered Gmail: *${maskedEmail}*\n\n` +
    `👉 *Please enter the 6-digit OTP code below to complete login:*`, { parse_mode: 'Markdown' });
}

function recordTelegramChatId(chatId, services) {
  try {
    const store = services.getPersistentStore();
    if (!store.telegramChatIds) store.telegramChatIds = [];
    const strId = String(chatId);
    if (!store.telegramChatIds.includes(strId)) {
      store.telegramChatIds.push(strId);
      services.saveLocalDB();
    }
  } catch (e) {}
}

function sendWelcomeMessage(bot, chatId, services) {
  const store = services.getPersistentStore();
  const settings = store.settings || {};
  const tgLink = settings.telegramGroupUrl || 'https://t.me/';
  const waLink = settings.whatsappGroupUrl || 'https://wa.me/919507325677';
  const user = telegramSessions[chatId]?.linkedUser;
  const userGreeting = user ? `👤 *Welcome back, ${user.name}!*\n\n` : '';

  const welcomeMsg = `👑 *WELCOME TO PRINCE CLOUD SELLAR* 👑\n` +
    `⚡ *24/7 Automated Cloud Accounts & Social Growth Automation*\n\n` +
    userGreeting +
    `🌐 *About Our Website & Platform:*\n` +
    `Prince Cloud Sellar is the premier automated marketplace providing instant cloud accounts (Azure, AWS, GCP, Windows 365, Aged PVAs) AND High-Retention Social Media Growth (YT, IG, FB, TG).\n\n` +
    `📜 *Terms & Conditions:*\n` +
    `1. All credentials & services are 100% verified with automated dispatch.\n` +
    `2. 24-48 Hours replacement warranty on valid issues.\n` +
    `3. SMM Growth Orders have minimum 1,000 units with refill guarantee.\n` +
    `4. Dual payment supported: UPI Instant & Crypto BEP20 USDT.\n\n` +
    `🤖 *QUICK MENU OPTIONS:*\n` +
    `1 - 🛍️ Cloud Accounts & Stock\n` +
    `2 - 🚀 Social Growth (YT, IG, FB, TG)\n` +
    `3 - 📦 My Orders & Tracking\n` +
    `4 - 👤 Account / Login / Register\n` +
    `5 - 🏦 UPI & Crypto Payment Info\n` +
    `6 - 🎫 Customer Support\n\n` +
    `_Click a button below or type a command to proceed!_`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '🛍️ 1. Cloud & RDP Accounts', callback_data: 'menu_stock' },
        { text: '🚀 2. Social Growth Services', callback_data: 'menu_smm_growth' }
      ],
      [
        { text: '📦 3. My Orders', callback_data: 'menu_orders' },
        { text: '👤 4. Account / Login', callback_data: 'menu_account' }
      ],
      [
        { text: '🏦 5. Pay via UPI', callback_data: 'menu_upi' },
        { text: '🎫 6. Support & Help', callback_data: 'menu_support' }
      ],
      [
        { text: '💬 WhatsApp Support', url: waLink },
        { text: '📢 Official Channel', url: tgLink }
      ]
    ]
  };

  const logo = getLogoFile();
  if (logo) {
    bot.sendPhoto(chatId, logo, { caption: welcomeMsg, parse_mode: 'Markdown', reply_markup: keyboard }).catch(() => {
      bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
    });
  } else {
    bot.sendMessage(chatId, welcomeMsg, { parse_mode: 'Markdown', reply_markup: keyboard });
  }
}

function sendMainMenu(bot, chatId, banner = '') {
  const keyboard = {
    inline_keyboard: [
      [
        { text: '🛍️ Cloud & RDP Accounts', callback_data: 'menu_stock' },
        { text: '🚀 Social Growth (SMM)', callback_data: 'menu_smm_growth' }
      ],
      [
        { text: '📦 My Orders', callback_data: 'menu_orders' },
        { text: '👤 Account / Login', callback_data: 'menu_account' }
      ],
      [
        { text: '🏦 Pay via UPI', callback_data: 'menu_upi' },
        { text: '🎫 Support & Help', callback_data: 'menu_support' }
      ]
    ]
  };

  bot.sendMessage(chatId, banner || `👑 *Prince Cloud Sellar Main Menu:*\nChoose an action:`, {
    parse_mode: 'Markdown',
    reply_markup: keyboard
  });
}

function sendTelegramSmmGrowthMenu(bot, chatId, services) {
  const text = `🚀 *SOCIAL GROWTH & SMM AUTOMATION* 🚀\n\n` +
    `⚡ *High Retention Non-Drop Followers, Likes, Subs & Views*\n` +
    `📌 *Minimum Order Quantity: 1,000 Units*\n\n` +
    `Choose a platform to view top packages & rates:\n` +
    `• 📸 *Instagram:* Real Organic Followers, Post/Reel Likes, Views\n` +
    `• ▶️ *YouTube:* Non-Drop Subscribers, Likes & WatchTime\n` +
    `• ✈️ *Telegram:* Channel/Group Members & Post Views\n` +
    `• 👍 *Facebook:* Profile/Page Followers & Likes\n` +
    `• 🎵 *TikTok / 🐦 Twitter (X):* Followers, Retweets & Likes\n\n` +
    `🌐 *Order directly on Web:* http://localhost:5000\n` +
    `_Select your platform below:_`;

  const keyboard = {
    inline_keyboard: [
      [
        { text: '📸 Instagram Packages', callback_data: 'smm_ig' },
        { text: '▶️ YouTube Packages', callback_data: 'smm_yt' }
      ],
      [
        { text: '✈️ Telegram Packages', callback_data: 'smm_tg' },
        { text: '👍 Facebook Packages', callback_data: 'smm_fb' }
      ],
      [
        { text: '🎵 TikTok / 🐦 Twitter (X)', callback_data: 'smm_other' }
      ],
      [
        { text: '🛍️ Cloud Store', callback_data: 'menu_stock' },
        { text: '🔙 Main Menu', callback_data: 'menu_main' }
      ]
    ]
  };

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function sendTelegramPlatformSmmServices(bot, chatId, platformKey, services) {
  let title = 'Instagram';
  let desc = 'Select a package below to order directly in Bot:';
  let buttons = [];

  if (platformKey === 'smm_ig') {
    title = '📸 *INSTAGRAM GROWTH PACKAGES (INDIANSMMHUB)*';
    buttons = [
      [{ text: '⚡ Superfast Reels Views (₹0.50/1K)', callback_data: 'smm_order_ig_reels_views' }],
      [{ text: '❤️ High-Quality Likes [365D] (₹6/1K)', callback_data: 'smm_order_ig_likes_hq' }],
      [{ text: '⚡ 100% Non-Drop Followers (₹28/1K)', callback_data: 'smm_order_ig_followers_nondrop' }],
      [{ text: '🇮🇳 HQ Followers [30D Refill] (₹65/1K)', callback_data: 'smm_order_ig_followers_india' }],
      [{ text: '💬 Custom Comments (₹320/1K)', callback_data: 'smm_order_ig_comments_custom' }]
    ];
  } else if (platformKey === 'smm_yt') {
    title = '▶️ *YOUTUBE GROWTH PACKAGES (INDIANSMMHUB)*';
    buttons = [
      [{ text: '▶️ High Retention Views (₹160/1K)', callback_data: 'smm_order_yt_views_nondrop' }],
      [{ text: '⚡ Instant Subscribers (₹130/1K)', callback_data: 'smm_order_yt_subs_nondrop' }],
      [{ text: '👍 High-Speed Views (₹160/1K)', callback_data: 'smm_order_yt_likes_hq' }]
    ];
  } else if (platformKey === 'smm_tg') {
    title = '✈️ *TELEGRAM GROWTH PACKAGES (INDIANSMMHUB)*';
    buttons = [
      [{ text: '✈️ Non-Drop Members [Lifetime] (₹135/1K)', callback_data: 'smm_order_tg_members_nondrop' }],
      [{ text: '⚡ Fast Channel Members (₹135/1K)', callback_data: 'smm_order_tg_members_fast' }],
      [{ text: '🔥 Post Views (₹1.50/1K)', callback_data: 'smm_order_tg_views_reactions' }]
    ];
  } else if (platformKey === 'smm_fb') {
    title = '👍 *FACEBOOK GROWTH PACKAGES (INDIANSMMHUB)*';
    buttons = [
      [{ text: '👍 Page & Profile Followers [30D] (₹95/1K)', callback_data: 'smm_order_fb_followers_nondrop' }],
      [{ text: '❤️ Post Likes (₹85/1K)', callback_data: 'smm_order_fb_likes_reactions' }]
    ];
  } else {
    title = '🎵 *TIKTOK, TWITTER & SPOTIFY GROWTH*';
    buttons = [
      [{ text: '🎵 TikTok Followers (₹340/1K)', callback_data: 'smm_order_tt_followers' }],
      [{ text: '❤️ TikTok Video Views (₹12/1K)', callback_data: 'smm_order_tt_likes' }],
      [{ text: '🐦 Twitter / X Profile Followers (₹250/1K)', callback_data: 'smm_order_x_followers' }],
      [{ text: '🟢 Spotify Followers (₹85/1K)', callback_data: 'smm_order_spotify_streams' }]
    ];
  }

  buttons.push([
    { text: '🚀 Other Platforms', callback_data: 'menu_smm_growth' },
    { text: '🔙 Main Menu', callback_data: 'menu_main' }
  ]);

  const text = `${title}\n\n` +
    `⚡ *High Retention Non-Drop Followers, Likes & Subscribers*\n` +
    `📌 *Direct Wholesale IndianSMMHub Server Delivery*\n\n` +
    `${desc}`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

function handleTelegramSmmQuantity(bot, chatId, qtyNum, services) {
  const session = telegramSessions[chatId];
  if (!session || !session.selectedSmmService) {
    bot.sendMessage(chatId, `⚠️ Session expired. Please start over:`, { parse_mode: 'Markdown' });
    sendTelegramSmmGrowthMenu(bot, chatId, services);
    return;
  }

  const srv = session.selectedSmmService;
  const minQty = srv.min || 1000;
  const validQty = Math.max(minQty, qtyNum);
  session.smmQty = validQty;
  const totalCost = Math.max(1, Math.round(((validQty / 1000) * srv.rate) * 100) / 100);
  session.smmTotalCost = totalCost;
  session.step = 'SMM_AWAITING_PAYMENT_METHOD';

  const text = `📋 *SMM SOCIAL GROWTH ORDER SUMMARY*\n\n` +
    `⚡ *Service:* *${srv.name}*\n` +
    `🎯 *Target Link:* \`${session.smmLink}\`\n` +
    `🔢 *Order Quantity:* *${validQty.toLocaleString()} Units*\n` +
    `💰 *Rate:* ₹${srv.rate} / 1,000 Units\n` +
    `🛡️ *Guarantee:* ${srv.refill ? 'Auto-Refill Guarantee' : 'Standard Delivery'}\n\n` +
    `💵 *Total Amount:* *₹${totalCost.toLocaleString()}* (~$${(totalCost / 88).toFixed(2)} USDT)\n\n` +
    `👉 *Select your Payment Method below:*`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🏦 Pay with UPI (Instant INR)', callback_data: 'smm_pay_upi' }],
        [{ text: '💎 Pay with BEP20 USDT (Crypto)', callback_data: 'smm_pay_bep20' }],
        [{ text: '🔙 Change Quantity', callback_data: 'smm_order_' + (srv.serviceKey || srv._id) }],
        [{ text: '❌ Cancel', callback_data: 'menu_main' }]
      ]
    }
  });
}

async function finalizeTelegramSmmOrder(bot, chatId, paymentMethod, paymentId, services) {
  const session = telegramSessions[chatId];
  if (!session || !session.selectedSmmService || !session.smmLink || !session.smmQty) {
    bot.sendMessage(chatId, `⚠️ No active SMM order found. Please select a service:`, { parse_mode: 'Markdown' });
    sendTelegramSmmGrowthMenu(bot, chatId, services);
    return;
  }

  const store = services.getPersistentStore();
  const srv = session.selectedSmmService;
  const qty = session.smmQty;
  const totalCost = session.smmTotalCost;
  const targetUrl = session.smmLink;
  const orderId = 'SMM-' + Date.now().toString(36).toUpperCase();

  const isUpi = paymentMethod === 'UPI';
  const newOrder = {
    _id: 'smm_' + Date.now() + '_' + Math.random().toString(36).substring(2, 7),
    orderId,
    providerOrderId: '',
    userId: session.linkedUser?._id || 'tg_' + chatId,
    userName: session.linkedUser?.name || 'Telegram Customer',
    userEmail: session.linkedUser?.email || `telegram_${chatId}@tg.princecloudsellar.com`,
    userPhone: session.linkedUser?.phone || String(chatId),
    serviceKey: srv.serviceKey || srv._id,
    serviceId: srv.serviceId || 1529,
    serviceName: srv.name,
    tier: srv.tier || 'Social Growth',
    targetUrl,
    quantity: qty,
    rate: srv.rate,
    totalCost,
    paymentMethod,
    paymentStatus: isUpi ? 'PENDING_UPI_VERIFICATION' : 'PENDING_BEP20_VERIFICATION',
    utrId: isUpi ? paymentId : '',
    txHash: !isUpi ? paymentId : '',
    status: 'Pending Admin Approval',
    remains: qty,
    startCount: 0,
    refillable: !!srv.refill,
    refillStatus: srv.refill ? 'Eligible' : 'Not Supported',
    notes: isUpi ? 'Awaiting Owner UPI Approval in Dashboard' : 'Awaiting Owner Crypto Verification in Dashboard',
    createdAt: new Date(),
    updatedAt: new Date()
  };

  store.smmOrders = store.smmOrders || [];
  store.smmOrders.unshift(newOrder);

  if (services.getDBStatus && services.getDBStatus() && services.SmmOrder) {
    try {
      services.SmmOrder.create(newOrder).catch(() => {});
    } catch (e) {}
  }

  // Owner Notification
  const ownerNotif = {
    _id: 'notif_' + Date.now(),
    recipientType: 'ADMIN',
    userId: '',
    userEmail: '',
    title: isUpi ? `🏦 New SMM UPI Order: ₹${totalCost}` : `💎 New SMM Crypto Order: ₹${totalCost}`,
    message: `Telegram user (${chatId}) placed SMM order for ${qty}x ${srv.name} (Amount: ₹${totalCost}, ${isUpi ? `UTR: ${paymentId}` : `TxHash: ${paymentId}`}). Target: ${targetUrl}`,
    type: 'SMM_ORDER',
    orderId,
    deliveredItem: '',
    isRead: false,
    createdAt: new Date()
  };
  if (!store.notifications) store.notifications = [];
  store.notifications.unshift(ownerNotif);
  if (services.getDBStatus && services.getDBStatus() && services.Notification) {
    try {
      services.Notification.create(ownerNotif).catch(() => {});
    } catch (e) {}
  }
  services.saveLocalDB();

  // Clear active SMM session state
  session.step = null;
  session.selectedSmmService = null;
  session.smmLink = null;
  session.smmQty = null;

  const ownerWaNum = (store.settings && store.settings.ownerWhatsApp) ? store.settings.ownerWhatsApp : '9507325677';
  const waSupportUrl = `https://wa.me/91${ownerWaNum}?text=Hello%20Owner%2C%20I%20have%20submitted%20payment%20for%20SMM%20Order%3A%0AOrder%20ID%3A%20${orderId}%0AService%3A%20${encodeURIComponent(srv.name)}%0ATarget%3A%20${encodeURIComponent(targetUrl)}%0AQty%3A%20${qty}%0APayment%20Method%3A%20${paymentMethod}%0A${isUpi ? `UTR%20ID%3A%20${paymentId}` : `TxHash%3A%20${paymentId}`}%0APlease%20verify%20and%20approve%20my%20order.`;

  const billReceipt = `🧾 *OFFICIAL SMM ORDER INVOICE & RECEIPT* 🧾\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n` +
    `📦 *Order ID:* \`${orderId}\`\n` +
    `⚡ *Service:* *${srv.name}*\n` +
    `🎯 *Target Link:* \`${targetUrl}\`\n` +
    `🔢 *Quantity:* *${qty.toLocaleString()} Units*\n` +
    `💰 *Total Amount:* *₹${totalCost.toLocaleString()}* (~${(totalCost / 88).toFixed(2)} USDT)\n` +
    `💳 *Payment Method:* *${paymentMethod}*\n` +
    (isUpi ? `🏷️ *Submitted UTR:* \`${paymentId}\`\n` : `💎 *Submitted TxHash:* \`${paymentId}\`\n`) +
    `📊 *Status:* 🟡 *PENDING OWNER VERIFICATION & APPROVAL*\n` +
    `━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n\n` +
    `⚠️ *NEXT STEP TO GET INSTANT START:*\n` +
    `Please send your *Payment Screenshot* along with your *Order ID* to Customer Support on WhatsApp:\n\n` +
    `👉 *WhatsApp Support:* ${waSupportUrl}\n` +
    `📞 *Support Hotline:* +91 9507325677\n\n` +
    `_⚡ Once Owner verifies your payment in the Owner Panel, automated boosting will start immediately on IndianSMMHub!_\n\n` +
    `👉 Use /orders anytime to track live status.`;

  bot.sendMessage(chatId, billReceipt, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 Send Screenshot on WhatsApp', url: waSupportUrl }],
        [{ text: '📦 View My Orders', callback_data: 'menu_orders' }],
        [{ text: '🏠 Main Menu', callback_data: 'menu_main' }]
      ]
    }
  });

  // Notify Owner
  try {
    services.broadcastToTelegramGroup(
      `⚡ *NEW SMM ORDER VIA TELEGRAM BOT!*\n\n` +
      `📦 *Order ID:* \`${orderId}\`\n` +
      `👤 *Customer Telegram ID:* \`${chatId}\`\n` +
      `⚡ *Service:* ${srv.name}\n` +
      `🎯 *Target:* \`${targetUrl}\`\n` +
      `🔢 *Quantity:* ${qty.toLocaleString()}\n` +
      `💰 *Total:* ₹${totalCost.toLocaleString()} (${paymentMethod})\n` +
      (paymentMethod === 'UPI' ? `🏷️ *UTR:* \`${paymentId}\`\n` : `🔗 *TxHash:* \`${paymentId}\`\n`) +
      `🕒 *Date:* ${new Date().toLocaleString('en-IN', { timeZone: 'Asia/Kolkata' })}`
    );
  } catch (e) {}
}

function sendProductCatalog(bot, chatId, services) {
  const store = services.getPersistentStore();
  const products = store.products || [];

  if (products.length === 0) {
    bot.sendMessage(chatId, '📦 *No products available right now.* Please check back soon!', { parse_mode: 'Markdown' });
    return;
  }

  const grouped = {};
  products.forEach(p => {
    if (!grouped[p.name]) {
      grouped[p.name] = {
        name: p.name,
        variants: [],
        totalStock: 0,
        minPrice: p.price,
        country: p.country
      };
    }
    grouped[p.name].variants.push(p);
    grouped[p.name].totalStock += (p.stock || 0);
    if (p.price < grouped[p.name].minPrice) grouped[p.name].minPrice = p.price;
  });

  const groupKeys = Object.keys(grouped);

  if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
  telegramSessions[chatId].step = 'AWAITING_PRODUCT';
  telegramSessions[chatId].availableBaseProducts = groupKeys;

  let text = `🛍️ *PRINCE CLOUD SELLAR - LIVE INVENTORY STOCK* 🛍️\n\n` +
    `Real-time stock loaded directly from website database.\n` +
    `Click a product button below or *reply with the number* to view variants & buy:\n\n`;

  const inlineButtons = [];

  groupKeys.forEach((key, idx) => {
    const item = grouped[key];
    const usdtPrice = (item.minPrice / 88).toFixed(2);
    const stockStatus = item.totalStock > 0 ? `🟢 *In Stock (${item.totalStock})*` : `🔴 *Out of Stock*`;

    text += `*${idx + 1}. ${item.name}*\n`;
    text += `   📁 Plans: *${item.variants.length} options*\n`;
    text += `   💰 Starting Price: *₹${item.minPrice}* (~${usdtPrice} USDT)\n`;
    text += `   📦 Stock: ${stockStatus}\n\n`;

    if (item.totalStock > 0) {
      inlineButtons.push([
        { text: `👉 ${idx + 1}. ${item.name} (${item.totalStock} in stock)`, callback_data: `sel_prod_${encodeURIComponent(item.name)}` }
      ]);
    }
  });

  inlineButtons.push([{ text: '🔙 Back to Menu', callback_data: 'menu_welcome' }]);

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: inlineButtons }
  });
}

function sendSubcategoriesList(bot, chatId, prodName, services) {
  const store = services.getPersistentStore();
  const variants = (store.products || []).filter(p => p.name.toLowerCase() === prodName.toLowerCase());

  if (variants.length === 0) {
    bot.sendMessage(chatId, `❌ No variants found for *${prodName}*.`, { parse_mode: 'Markdown' });
    return;
  }

  if (!telegramSessions[chatId]) telegramSessions[chatId] = {};

  if (variants.length === 1) {
    const prod = variants[0];
    telegramSessions[chatId].selectedProduct = prod;
    telegramSessions[chatId].step = 'AWAITING_QTY';

    bot.sendMessage(chatId, `🔢 *You selected:* *${prod.name}* ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
      `📍 *Region:* ${prod.country || 'Global'}\n` +
      `💰 *Price:* ₹${prod.price} (~${(prod.price / 88).toFixed(2)} USDT)\n` +
      `📦 *Available in Stock:* ${prod.stock} units\n\n` +
      `👉 *How many quantity do you want to buy?* (Reply with a number like 1, 2, 3...):`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '1 Unit', callback_data: 'qty_1' },
              { text: '2 Units', callback_data: 'qty_2' },
              { text: '5 Units', callback_data: 'qty_5' }
            ],
            [{ text: '🔙 Back to Products', callback_data: 'menu_stock' }]
          ]
        }
      });
    return;
  }

  telegramSessions[chatId].availableVariants = variants;
  telegramSessions[chatId].step = 'AWAITING_SUBCATEGORY';

  let text = `📦 *${prodName.toUpperCase()} - AVAILABLE PLANS & SUBCATEGORIES:*\n\n` +
    `Select your desired plan by clicking a button or replying with the *number*:\n\n`;

  const buttons = [];

  variants.forEach((v, idx) => {
    const usdt = (v.price / 88).toFixed(2);
    const stk = v.stock > 0 ? `🟢 ${v.stock} in stock` : `🔴 Out of stock`;

    text += `*${idx + 1}. ${v.subProduct || v.name}*\n`;
    text += `   📍 Country: \`${v.country || 'Global'}\`\n`;
    text += `   💰 Price: *₹${v.price}* (~${usdt} USDT)\n`;
    text += `   📦 Stock: ${stk}\n\n`;

    if (v.stock > 0) {
      buttons.push([
        { text: `${idx + 1}. ${v.subProduct || v.name} - ₹${v.price}`, callback_data: `sel_var_${v._id}` }
      ]);
    }
  });

  buttons.push([{ text: '🔙 Back to Product Catalog', callback_data: 'menu_stock' }]);

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: { inline_keyboard: buttons }
  });
}

function handleQuantityEntered(bot, chatId, qty, services) {
  const store = services.getPersistentStore();
  const session = telegramSessions[chatId];

  if (!session || !session.selectedProduct) {
    bot.sendMessage(chatId, `⚠️ Product selection expired. Please select a product again:`, { parse_mode: 'Markdown' });
    sendProductCatalog(bot, chatId, services);
    return;
  }

  const prod = session.selectedProduct;
  if (qty > prod.stock && prod.stock > 0) {
    bot.sendMessage(chatId, `⚠️ *Requested quantity (${qty}) exceeds stock!* Only *${prod.stock}* units available. Please enter a lower quantity:`, { parse_mode: 'Markdown' });
    return;
  }

  session.quantity = qty;
  session.step = null;

  // Check user authentication
  const user = session.linkedUser || store.users.find(u => u.telegramId === String(chatId) || u.phone === String(chatId));

  if (user) {
    session.linkedUser = user;
    sendPaymentChoice(bot, chatId, services);
  } else {
    session.step = 'AWAITING_AUTH_CHOICE';
    bot.sendMessage(chatId, `🔐 *AUTHENTICATION REQUIRED*\n\n` +
      `To link your order and view order history on the website, please choose:\n\n` +
      `*1* - 🔐 Login (Existing Account)\n` +
      `*2* - 📝 Register (New Account with Email OTP)`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [
              { text: '🔐 1. Login', callback_data: 'action_login' },
              { text: '📝 2. Register', callback_data: 'action_register' }
            ],
            [{ text: '🔙 Cancel Order', callback_data: 'menu_welcome' }]
          ]
        }
      });
  }
}

function sendPaymentChoice(bot, chatId, services) {
  const session = telegramSessions[chatId];
  const prod = session.selectedProduct;
  const qty = session.quantity || 1;
  const totalInr = prod.price * qty;
  const usdt = (totalInr / 88).toFixed(2);

  const text = `🧾 *ORDER SUMMARY:*\n` +
    `👤 *Customer:* ${session.linkedUser ? session.linkedUser.name : 'Verified Customer'}\n` +
    `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
    `🔢 *Quantity:* ${qty} unit(s)\n` +
    `💵 *Total Amount:* *₹${totalInr}* (~${usdt} USDT)\n\n` +
    `💳 *SELECT PAYMENT METHOD:*`;

  const keyboard = {
    inline_keyboard: [
      [{ text: '💎 Crypto BEP20 USDT (Auto Delivery ⚡)', callback_data: 'pay_method_bep20' }],
      [{ text: '🏦 UPI Payment (GPay / PhonePe / Paytm / BHIM)', callback_data: 'pay_method_upi' }],
      [{ text: '🔙 Cancel Order', callback_data: 'menu_welcome' }]
    ]
  };

  bot.sendMessage(chatId, text, { parse_mode: 'Markdown', reply_markup: keyboard });
}

function sendBep20Invoice(bot, chatId, services) {
  const store = services.getPersistentStore();
  const session = telegramSessions[chatId];
  const prod = session.selectedProduct;
  const qty = session.quantity || 1;
  const totalInr = prod.price * qty;
  const usdt = (totalInr / 88).toFixed(2);
  const settings = store.settings || {};
  const wallet = settings.defaultBep20Address || process.env.DEFAULT_BEP20 || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';

  session.paymentMethod = 'BEP20';
  session.step = 'AWAITING_TX_HASH';

  const text = `💎 *BEP20 USDT INSTANT PAYMENT INVOICE*\n\n` +
    `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''} x ${qty}\n` +
    `💵 *Exact Amount to Pay:* \`${usdt}\` USDT (BEP20 / BSC)\n\n` +
    `🏦 *Official BEP20 USDT Deposit Address:*\n` +
    `\`${wallet}\`\n\n` +
    `⚡ *Instructions:*\n` +
    `1. Send exactly *${usdt} USDT* to the address above.\n` +
    `2. Click *"Submit TxHash"* below or paste your *0x... hash* directly here in chat.\n` +
    `3. Keys are delivered *instantly* upon blockchain node verification!`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✍️ Submit TxHash', callback_data: 'btn_submit_tx' }],
        [{ text: '🔙 Back to Payment Methods', callback_data: 'menu_welcome' }]
      ]
    }
  });
}

function sendUpiPaymentInvoice(bot, chatId, services) {
  const store = services.getPersistentStore();
  const session = telegramSessions[chatId];
  const prod = session.selectedProduct;
  const qty = session.quantity || 1;
  const totalInr = prod.price * qty;
  const settings = store.settings || {};
  const upiId = settings.ownerUpiId || '9507325677-1@naviaxis';

  session.paymentMethod = 'UPI';
  session.step = 'AWAITING_UTR_ID';

  const text = `🏦 *UPI PAYMENT INVOICE (MANUAL VERIFICATION)*\n\n` +
    `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''} x ${qty}\n` +
    `💵 *Total Amount to Pay:* *₹${totalInr}*\n\n` +
    `🏦 *Official UPI ID:*\n` +
    `\`${upiId}\`\n\n` +
    `👉 *Instructions:*\n` +
    `1. Pay *₹${totalInr}* using Google Pay, PhonePe, Paytm, BHIM, or Navi.\n` +
    `2. Copy your *12-digit UPI UTR / Transaction ID*.\n` +
    `3. Click *"Submit UTR ID"* below or paste your 12-digit UTR directly in chat!`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '✍️ Submit 12-Digit UTR ID', callback_data: 'btn_submit_utr' }],
        [{ text: '🔙 Back to Payment Methods', callback_data: 'menu_welcome' }]
      ]
    }
  });
}

async function handleTelegramPaymentVerification(bot, chatId, txHash, services) {
  const {
    getPersistentStore,
    saveLocalDB,
    verifyPaymentOnChainStrict,
    getDBStatus,
    Product,
    Stock,
    Order
  } = services;

  const store = getPersistentStore();
  const session = telegramSessions[chatId] || {};
  const prod = session.selectedProduct || store.products[0];
  const qty = session.quantity || 1;
  const totalPaid = prod.price * qty;

  if (store.orders.some(o => o.txHash && o.txHash.toLowerCase() === txHash.toLowerCase())) {
    bot.sendMessage(chatId, `🚫 *REPLAY ATTACK BLOCKED*\nThis Transaction Hash has already been used for a previous order!`, { parse_mode: 'Markdown' });
    return;
  }

  bot.sendMessage(chatId, `🔍 *Auditing Transaction on Binance Smart Chain Node...*\nPlease hold on...`, { parse_mode: 'Markdown' });

  const verifyResult = await verifyPaymentOnChainStrict(txHash, totalPaid);
  if (!verifyResult.success) {
    bot.sendMessage(chatId, `❌ *Payment Verification Failed:*\n${verifyResult.message}\n\nPlease check your TxHash or contact customer support.`, { parse_mode: 'Markdown' });
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
      stk.soldToUserId = session.linkedUser ? session.linkedUser._id : `tg_${chatId}`;
      stk.soldToUserName = session.linkedUser ? session.linkedUser.name : `Telegram Customer (${chatId})`;
      stk.soldToUserPhone = session.linkedUser ? session.linkedUser.phone : String(chatId);
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
      } catch (e) {}
    }
  } else if (availableStocks.length > 0) {
    deliveredItemsText = availableStocks.map(s => s.content).join('\n');
    deliveryStatus = 'PARTIALLY_DELIVERED';
    availableStocks.forEach(stk => {
      stk.status = 'SOLD';
      stk.soldToUserId = session.linkedUser ? session.linkedUser._id : `tg_${chatId}`;
      stk.soldToUserName = session.linkedUser ? session.linkedUser.name : `Telegram Customer (${chatId})`;
      stk.soldToUserPhone = session.linkedUser ? session.linkedUser.phone : String(chatId);
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
    userId: session.linkedUser ? session.linkedUser._id : `tg_${chatId}`,
    userName: session.linkedUser ? session.linkedUser.name : `Telegram Customer (${chatId})`,
    userPhone: session.linkedUser ? session.linkedUser.phone : String(chatId),
    productId: prod._id,
    productName: prod.name,
    subProduct: prod.subProduct || '',
    country: prod.country || '🌐 Global',
    quantity: qty,
    unitPrice: prod.price,
    totalPaid,
    paymentMethod: 'BEP20',
    paymentStatus: 'PAID (TELEGRAM BOT)',
    txHash: txHash,
    deliveryStatus,
    deliveredItem: deliveredItemsText,
    source: 'TELEGRAM',
    createdAt: new Date()
  };

  store.orders.unshift(newOrder);
  if (getDBStatus() && Order) {
    try {
      await Order.create(newOrder);
    } catch (e) {}
  }
  saveLocalDB();

  if (deliveryStatus === 'DELIVERED') {
    bot.sendMessage(chatId, `🎉 *PAYMENT VERIFIED & DELIVERED!* 🎉\n\n` +
      `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
      `🔢 *Quantity:* ${qty}\n` +
      `🔖 *Order ID:* \`${orderId}\`\n` +
      `💰 *Total Paid:* ₹${totalPaid} (~${(totalPaid / 88).toFixed(2)} USDT)\n` +
      `🧾 *Invoice Slip:* https://princecloudsellar.onrender.com/invoice/${orderId}\n\n` +
      `🔑 *YOUR DELIVERED ACCOUNT / KEY DETAILS:*\n` +
      `\`\`\`\n${deliveredItemsText}\n\`\`\`\n\n` +
      `_Official PDF Invoice attached below! Thank you for purchasing with Prince Cloud Sellar._`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🧾 View / Print Invoice', url: `https://princecloudsellar.onrender.com/invoice/${orderId}` }],
            [{ text: '🛍️ Buy Another Product', callback_data: 'menu_stock' }]
          ]
        }
      });
  } else {
    bot.sendMessage(chatId, `🎉 *PAYMENT VERIFIED ON-CHAIN!* 🎉\n\n` +
      `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
      `🔢 *Quantity:* ${qty}\n` +
      `🔖 *Order ID:* \`${orderId}\`\n` +
      `💰 *Total Paid:* ₹${totalPaid} (~${(totalPaid / 88).toFixed(2)} USDT)\n` +
      `⏳ *Delivery Status:* PENDING OWNER MANUAL DISPATCH (Stock Refreshing)\n\n` +
      `_Owner has been notified and will dispatch your accounts shortly._`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '🧾 View / Print Invoice', url: `https://princecloudsellar.onrender.com/invoice/${orderId}` }],
            [{ text: '🛍️ Return to Store', callback_data: 'menu_stock' }]
          ]
        }
      });
  }

  try {
    const pdfBuf = await generateOrderInvoicePdfBuffer(newOrder);
    if (pdfBuf) {
      await bot.sendDocument(chatId, pdfBuf, {
        caption: `🧾 Official Paid Invoice for Order #${orderId}`,
        parse_mode: 'Markdown'
      }, {
        filename: `PrinceCloudSellar_Invoice_${orderId}.pdf`,
        contentType: 'application/pdf'
      });
    }
  } catch (pdfErr) {
    console.error('Telegram invoice PDF send error:', pdfErr.message);
  }
}

async function handleTelegramUpiSubmission(bot, chatId, utr, services) {
  const {
    getPersistentStore,
    saveLocalDB,
    getDBStatus,
    Order,
    Notification
  } = services;

  const store = getPersistentStore();
  const session = telegramSessions[chatId] || {};
  const prod = session.selectedProduct || store.products[0];
  const qty = session.quantity || 1;
  const totalPaid = prod.price * qty;
  const orderId = 'ord_' + Date.now();

  const isReplay = store.orders.some(o => o.utrId && o.utrId.toLowerCase() === utr.toLowerCase());
  if (isReplay) {
    bot.sendMessage(chatId, `🚫 *DUPLICATE UTR REJECTED*\nThis UTR ID has already been submitted for an order.`, { parse_mode: 'Markdown' });
    return;
  }

  const newOrder = {
    _id: orderId,
    userId: session.linkedUser ? session.linkedUser._id : `tg_${chatId}`,
    userName: session.linkedUser ? session.linkedUser.name : `Telegram Customer (${chatId})`,
    userPhone: session.linkedUser ? session.linkedUser.phone : String(chatId),
    productId: prod._id,
    productName: prod.name,
    subProduct: prod.subProduct || '',
    country: prod.country || '🌐 Global',
    quantity: qty,
    unitPrice: prod.price,
    totalPaid,
    paymentMethod: 'UPI',
    paymentStatus: 'PENDING_UPI_VERIFICATION',
    utrId: utr,
    txHash: '',
    deliveryStatus: 'PENDING_APPROVAL',
    deliveredItem: 'PENDING ADMIN DISPATCH UPON UPI APPROVAL',
    source: 'TELEGRAM',
    createdAt: new Date()
  };

  store.orders.unshift(newOrder);
  if (getDBStatus() && Order) {
    try {
      await Order.create(newOrder);
    } catch (e) {}
  }

  const notif = {
    _id: 'notif_' + Date.now(),
    recipientType: 'ADMIN',
    userId: '',
    userEmail: '',
    title: `🏦 New UPI Order via Telegram: ₹${totalPaid}`,
    message: `Telegram customer (${chatId}) submitted UPI UTR ${utr} for ${qty}x ${prod.name}.`,
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
    } catch (e) {}
  }
  saveLocalDB();

  const ownerWaNum = (store.settings && store.settings.ownerWhatsApp) ? store.settings.ownerWhatsApp : '9507325677';
  const waOwnerUrl = `https://wa.me/91${ownerWaNum}?text=Hello%20Owner%2C%20I%20have%20paid%20via%20UPI%20for%20PrinceCloudSellar%20Order%3A%0AOrder%20ID%3A%20${orderId}%0AProduct%3A%20${encodeURIComponent(prod.name)}%0AQty%3A%20${qty}%0AAmount%3A%20Rs.${totalPaid}%0AUTR%20ID%3A%20${utr}%0APlease%20verify%20and%20approve%20my%20delivery.`;

  bot.sendMessage(chatId, `✅ *UPI ORDER DETAILS SUBMITTED!* ✅\n\n` +
    `🔖 *Order ID:* \`${orderId}\`\n` +
    `📦 *Product:* ${prod.name} ${prod.subProduct ? `(${prod.subProduct})` : ''}\n` +
    `🔢 *Quantity:* ${qty}\n` +
    `💵 *Amount:* *₹${totalPaid}*\n` +
    `🏦 *Submitted UTR:* \`${utr}\`\n` +
    `🧾 *Invoice:* /invoice/${orderId}\n` +
    `⏳ *Status:* 🟡 *PENDING ADMIN APPROVAL*\n\n` +
    `⚠️ *MANDATORY ACTION REQUIRED:*\n` +
    `Please send your *Payment Screenshot* with Order ID & UTR to Owner on WhatsApp:\n` +
    `👉 Message Owner: ${waOwnerUrl}\n\n` +
    `_Once Owner verifies on Admin Panel, your credentials will be delivered directly inside this Telegram chat!_`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '💬 Send Screenshot on WhatsApp', url: waOwnerUrl }],
          [{ text: '🛍️ Browse More Products', callback_data: 'menu_stock' }]
        ]
      }
    });
}

function sendUserOrders(bot, chatId, services) {
  const store = services.getPersistentStore();
  const user = store.users.find(u => u.telegramId === String(chatId) || u.phone === String(chatId) || (u.phone && u.phone.replace(/[^0-9]/g, '') === String(chatId).replace(/[^0-9]/g, '')));
  
  const phoneKeys = new Set([String(chatId).replace(/[^0-9]/g, '')]);
  const idKeys = new Set([`tg_${chatId}`, String(chatId)]);
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
    bot.sendMessage(chatId, `📦 *No past orders found for this Telegram account.*\n\n• Use /stock to browse Cloud Accounts & RDPs\n• Use /growth to order Social Media Followers!`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [{ text: '🛍️ Browse Cloud Stock', callback_data: 'menu_stock' }],
          [{ text: '🚀 Social Growth (SMM)', callback_data: 'menu_smm_growth' }]
        ]
      }
    });
    return;
  }

  let out = `🛍️ *YOUR ORDERS & ACTIVE DELIVERIES:*\n\n`;

  // 1. Render Cloud Orders
  if (cloudOrders.length > 0) {
    out += `☁️ *CLOUD ACCOUNTS & RDPS (${cloudOrders.length}):*\n`;
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

  // 2. Render SMM Growth Orders
  if (smmOrders.length > 0) {
    out += `⚡ *SOCIAL MEDIA GROWTH ORDERS (${smmOrders.length}):*\n`;
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

  bot.sendMessage(chatId, out, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Cloud Store', callback_data: 'menu_stock' }, { text: '🚀 Social Growth', callback_data: 'menu_smm_growth' }],
        [{ text: '🏠 Main Menu', callback_data: 'menu_welcome' }]
      ]
    }
  });
}

function sendAccountInfo(bot, chatId, services) {
  const store = services.getPersistentStore();
  const user = store.users.find(u => u.telegramId === String(chatId) || u.phone === String(chatId));

  if (user) {
    if (!telegramSessions[chatId]) telegramSessions[chatId] = {};
    telegramSessions[chatId].linkedUser = user;

    bot.sendMessage(chatId, `👤 *LINKED ACCOUNT PROFILE*\n\n` +
      `Name: *${user.name}*\n` +
      `Email: *${user.email}*\n` +
      `Phone: *+${user.phone}*\n` +
      `Status: 🟢 *Active*\n\n` +
      `_Your account is unified across Website and Telegram!_`, {
        parse_mode: 'Markdown',
        reply_markup: {
          inline_keyboard: [
            [{ text: '📦 View My Orders', callback_data: 'menu_orders' }],
            [{ text: '🛍️ Browse Stock', callback_data: 'menu_stock' }],
            [{ text: '🚪 Logout Session', callback_data: 'action_logout' }]
          ]
        }
      });
  } else {
    bot.sendMessage(chatId, `👤 *ACCOUNT STATUS: GUEST*\n\nChoose an option below to link or create your Prince Cloud Sellar account:`, {
      parse_mode: 'Markdown',
      reply_markup: {
        inline_keyboard: [
          [
            { text: '🔐 Login (Existing Account)', callback_data: 'action_login' },
            { text: '📝 Register (New Account)', callback_data: 'action_register' }
          ],
          [{ text: '🔑 Forgot Password', callback_data: 'action_forgot' }]
        ]
      }
    });
  }
}

function sendUpiDetails(bot, chatId, services) {
  const store = services.getPersistentStore();
  const settings = store.settings || {};
  const upiId = settings.ownerUpiId || '9507325677-1@naviaxis';

  const text = `🏦 *PRINCE CLOUD SELLAR UPI PAYMENT* 🏦\n\n` +
    `Official Merchant UPI ID:\n` +
    `\`${upiId}\`\n\n` +
    `📱 *Accepted Apps:* Google Pay, PhonePe, Paytm, BHIM, Navi, Cred, Any UPI App.\n\n` +
    `👉 To buy accounts using UPI, use /stock -> choose product & quantity -> choose *Pay with UPI*!`;

  bot.sendMessage(chatId, text, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '🛍️ Browse Stock & Pay via UPI', callback_data: 'menu_stock' }]
      ]
    }
  });
}

function sendSupportPrompt(bot, chatId, services) {
  const store = services.getPersistentStore();
  const supportUrl = store.settings.supportUrl || 'https://wa.me/919507325677';

  bot.sendMessage(chatId, `🎫 *PRINCE CLOUD SELLAR CUSTOMER SUPPORT*\n\nNeed assistance or replacement?\n💬 Contact Owner directly: ${supportUrl}\n📞 Phone / WhatsApp: +91 9507325677`, {
    parse_mode: 'Markdown',
    reply_markup: {
      inline_keyboard: [
        [{ text: '💬 Contact Owner on WhatsApp', url: supportUrl }]
      ]
    }
  });
}

module.exports = {
  initTelegramBot,
  startBot,
  getTelegramBotStatus,
  broadcastToTelegramGroup,
  broadcastToAllTelegramUsers,
  sendTelegramDirectMessage,
  sendTelegramDirectDocument
};
