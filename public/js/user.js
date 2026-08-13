// Customer Storefront Application Logic with Mandatory On-Chain Blockchain Payment Verification & Dual Currency Toggle (INR / USD)

let currentUser = null;
let catalogProducts = [];
let selectedProductForBuy = null;
let activeCategoryFilter = 'ALL';
let activeCurrency = localStorage.getItem('store_currency') || 'INR';

let ownerSupportUrl = 'https://wa.me/919507325000?text=Hello%20Owner%20I%20need%20support%20for%20PrinceCloudSellar';
let ownerGlobalBep20Address = '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';

let isEmailOTPVerified = false;

// BEP20 USDT Smart Contract Details
const BEP20_USDT_CONTRACT_BSC = "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT
const POLYGON_USDT_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

document.addEventListener('DOMContentLoaded', () => {
  initStore();
});

function initStore() {
  updateCurrencyUI();
  checkStoredSession();
  loadCachedCatalogFirst();
  fetchCatalog();
  fetchSupportSettings();
  setupEventListeners();
}

function setStoreCurrency(curr) {
  activeCurrency = curr;
  localStorage.setItem('store_currency', curr);
  updateCurrencyUI();
  renderFilteredProducts();
  if (selectedProductForBuy) {
    updateTotalCheckoutPrice();
  }
  showToast(`Currency switched to ${curr === 'USD' ? '$ USD (United States Dollar)' : '₹ INR (Indian Rupee)'}`, 'info');
}

function updateCurrencyUI() {
  const inrBtn = document.getElementById('curr-btn-inr');
  const usdBtn = document.getElementById('curr-btn-usd');

  if (inrBtn && usdBtn) {
    if (activeCurrency === 'USD') {
      usdBtn.classList.add('active');
      inrBtn.classList.remove('active');
    } else {
      inrBtn.classList.add('active');
      usdBtn.classList.remove('active');
    }
  }
}

function formatPriceDisplay(priceInInr) {
  if (activeCurrency === 'USD') {
    const usd = (priceInInr / 88).toFixed(2);
    return `$${usd} USD`;
  } else {
    return `₹${priceInInr.toLocaleString()} INR`;
  }
}

function loadCachedCatalogFirst() {
  try {
    const cached = sessionStorage.getItem('cached_catalog');
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        catalogProducts = parsed;
        renderCategoryNavBar(parsed);
        renderFilteredProducts();
      }
    }
  } catch (e) {
    // Silent fallback
  }
}

function checkStoredSession() {
  const savedUser = localStorage.getItem('prince_user_session');
  const sessionTime = localStorage.getItem('prince_user_session_time');

  if (savedUser && sessionTime) {
    const elapsedHours = (Date.now() - Number(sessionTime)) / (1000 * 60 * 60);
    if (elapsedHours < 6) {
      currentUser = JSON.parse(savedUser);
      updateUserNavUI();
    } else {
      localStorage.removeItem('prince_user_session');
      localStorage.removeItem('prince_user_session_time');
      currentUser = null;
      updateUserNavUI();
    }
  } else {
    updateUserNavUI();
  }
}

function updateUserNavUI() {
  const userActionsDiv = document.getElementById('user-nav-actions');
  if (!userActionsDiv) return;

  if (currentUser) {
    userActionsDiv.innerHTML = `
      <div style="display:flex; align-items:center; gap:10px;">
        <div style="background:rgba(250,204,21,0.1); border:1px solid #facc15; padding:6px 12px; border-radius:30px; display:flex; align-items:center; gap:6px;">
          <span style="font-size:0.85rem; font-weight:700; color:#facc15;">👤 ${escapeHtml(currentUser.name)}</span>
        </div>
        <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.82rem;" onclick="openMyOrdersModal()">🛍️ My Orders</button>
        <button class="btn btn-danger" style="padding:6px 12px; font-size:0.82rem;" onclick="handleUserLogout()">Sign Out</button>
      </div>
    `;
  } else {
    userActionsDiv.innerHTML = `
      <button class="btn btn-secondary" style="padding:6px 14px; font-size:0.85rem;" onclick="openModal('user-login-modal')">🔑 Sign In</button>
      <button class="btn btn-primary" style="padding:6px 14px; font-size:0.85rem;" onclick="openModal('user-register-modal')">✨ Register <span style="color:#ef4444; font-weight:bold;">*</span></button>
    `;
  }
}

function setupEventListeners() {
  const loginForm = document.getElementById('user-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleUserLogin();
    });
  }

  const registerForm = document.getElementById('user-register-form');
  if (registerForm) {
    registerForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleUserRegister();
    });
  }

  const checkoutForm = document.getElementById('checkout-confirm-form');
  if (checkoutForm) {
    checkoutForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCheckoutSubmit();
    });
  }

  const qtyInput = document.getElementById('buy-qty');
  if (qtyInput) {
    qtyInput.addEventListener('input', () => {
      updateTotalCheckoutPrice();
    });
  }
}

// ----------------------------------------------------
// PRODUCT CATALOG & INSTANT CATEGORY FILTERING
// ----------------------------------------------------

async function fetchCatalog() {
  try {
    const res = await fetch('/api/products');
    const data = await res.json();
    if (data.success) {
      catalogProducts = data.products;
      sessionStorage.setItem('cached_catalog', JSON.stringify(data.products));
      renderCategoryNavBar(data.products);
      renderFilteredProducts();
    }
  } catch (err) {
    console.error('Fetch catalog error:', err);
  }
}

function renderCategoryNavBar(products) {
  const navContainer = document.getElementById('category-filter-bar');
  if (!navContainer) return;

  const categories = ['ALL'];
  products.forEach(p => {
    if (p.name && !categories.includes(p.name)) {
      categories.push(p.name);
    }
  });

  navContainer.innerHTML = categories.map(cat => {
    let count = 0;
    if (cat === 'ALL') {
      count = products.length;
    } else {
      count = products.filter(p => p.name === cat).length;
    }

    const isActive = activeCategoryFilter === cat;
    return `
      <button class="category-tab-btn ${isActive ? 'active' : ''}" onclick="setCategoryFilter('${escapeHtml(cat)}')">
        <span>${escapeHtml(cat)}</span>
        <span class="category-count">${count}</span>
      </button>
    `;
  }).join('');
}

function setCategoryFilter(category) {
  activeCategoryFilter = category;
  renderCategoryNavBar(catalogProducts);
  renderFilteredProducts();
}

function renderFilteredProducts() {
  const container = document.getElementById('store-products-container');
  if (!container) return;

  let filtered = catalogProducts;
  if (activeCategoryFilter !== 'ALL') {
    filtered = catalogProducts.filter(p => p.name === activeCategoryFilter);
  }

  if (!filtered || filtered.length === 0) {
    container.innerHTML = `
      <div style="grid-column: 1/-1; text-align:center; padding:60px 20px; color:var(--text-muted);">
        <div style="font-size:3rem; margin-bottom:10px;">📦</div>
        <h3>No Products Available in Category "${escapeHtml(activeCategoryFilter)}"</h3>
        <p style="font-size:0.9rem;">Check back soon or select another category above!</p>
      </div>
    `;
    return;
  }

  container.innerHTML = filtered.map(p => `
    <div class="glass-card product-store-card">
      <div class="product-card-top">
        <div style="display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:8px;">
          <div>
            <h3 class="product-card-title">${escapeHtml(p.name)}</h3>
            ${p.subProduct ? `<div style="font-size:0.9rem; font-weight:700; color:var(--pink-accent); margin-top:2px;">${escapeHtml(p.subProduct)}</div>` : ''}
          </div>
          <span class="badge badge-yellow">${escapeHtml(p.country || '🌐 Global')}</span>
        </div>
        
        <div class="product-price-tag">${formatPriceDisplay(p.price)} <span style="font-size:0.8rem; font-weight:normal; color:var(--text-dim);">/ unit</span></div>
        <p style="font-size:0.88rem; color:var(--text-muted); line-height:1.5; margin-bottom:14px;">${escapeHtml(p.description || 'Premium digital product with instant automated delivery.')}</p>
        
        ${p.offer ? `<span class="badge badge-pink" style="margin-bottom:12px; display:inline-block;">🔥 ${escapeHtml(p.offer)}</span>` : ''}
      </div>

      <div class="product-card-bottom">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:12px;">
          <span class="badge ${p.stock > 0 ? 'badge-success' : 'badge-danger'}">
            ${p.stock > 0 ? `🟢 ${p.stock} Stock Available` : '🔴 Out of Stock'}
          </span>
          <span style="font-size:0.8rem; color:var(--text-dim);">⚡ Instant Delivery</span>
        </div>
        <button class="btn btn-primary btn-block" ${p.stock <= 0 ? 'disabled' : ''} onclick="openBuyModal('${p._id}')">
          ${p.stock > 0 ? '🛒 Buy Now & Claim Key' : 'Out of Stock'}
        </button>
      </div>
    </div>
  `).join('');
}

// ----------------------------------------------------
// CHECKOUT & MANDATORY ON-CHAIN VERIFICATION
// ----------------------------------------------------

function openBuyModal(productId) {
  if (!currentUser) {
    highlightErrorField('login-email-phone');
    showToast('Please Sign In or Register to purchase products.', 'error');
    openModal('user-login-modal');
    return;
  }

  const p = catalogProducts.find(item => item._id === productId);
  if (!p) return;

  selectedProductForBuy = p;

  const displayTitle = `${p.name} ${p.subProduct ? `(${p.subProduct})` : ''} [${p.country || '🌐 Global'}]`;
  document.getElementById('buy-product-title').innerText = displayTitle;
  document.getElementById('buy-product-price-label').innerText = `${formatPriceDisplay(p.price)} / unit`;
  document.getElementById('buy-qty').value = 1;
  document.getElementById('bep20-wallet-addr').innerText = ownerGlobalBep20Address;
  document.getElementById('buy-tx-hash').value = '';

  document.getElementById('buy-user-name').value = currentUser.name;
  document.getElementById('buy-user-phone').value = currentUser.phone;

  document.getElementById('web3-status').innerHTML = '';

  updateTotalCheckoutPrice();
  openModal('buy-product-modal');
}

function updateTotalCheckoutPrice() {
  if (!selectedProductForBuy) return;
  const qty = Math.max(1, Number(document.getElementById('buy-qty').value) || 1);
  const totalInr = selectedProductForBuy.price * qty;
  const totalUsdt = (totalInr / 88).toFixed(2);
  const totalUsd = (totalInr / 88).toFixed(2);

  const priceLabel = document.getElementById('buy-product-price-label');
  if (priceLabel) {
    priceLabel.innerText = `${formatPriceDisplay(selectedProductForBuy.price)} / unit`;
  }

  document.getElementById('buy-total-price').innerText = formatPriceDisplay(totalInr);

  const estimateEl = document.getElementById('buy-usdt-estimate');
  if (estimateEl) {
    if (activeCurrency === 'USD') {
      estimateEl.innerText = `(~ ${totalUsdt} USDT / ₹${totalInr.toLocaleString()} INR)`;
    } else {
      estimateEl.innerText = `(~ ${totalUsdt} USDT / $${totalUsd} USD)`;
    }
  }
}

function copyBep20Address() {
  const addr = document.getElementById('bep20-wallet-addr').innerText;
  navigator.clipboard.writeText(addr).then(() => {
    showToast('BEP20 Address Copied! Open Binance or Trust Wallet app to send payment.', 'success');
  }).catch(() => {
    showToast('Address copied!', 'info');
  });
}

// SMART ADAPTIVE WEB3 DIRECT WALLET & ON-CHAIN VERIFICATION
async function payWithWeb3Wallet() {
  const statusEl = document.getElementById('web3-status');
  if (!statusEl) return;

  if (!selectedProductForBuy) {
    showToast('Please select a product first.', 'error');
    return;
  }

  if (!currentUser) {
    showToast('Please Sign In to purchase.', 'error');
    openModal('user-login-modal');
    return;
  }

  const qty = Math.max(1, Number(document.getElementById('buy-qty').value) || 1);
  const totalInr = selectedProductForBuy.price * qty;
  const usdtAmountNeeded = (totalInr / 88).toFixed(2);

  // IF NO WEB3 WALLET EXTENSION DETECTED ON DESKTOP BROWSER
  if (!window.ethereum) {
    const currentUrl = encodeURIComponent(window.location.href);
    statusEl.innerHTML = `
      <div style="background:rgba(250,204,21,0.1); border:1px solid #facc15; border-radius:10px; padding:14px; margin-top:10px; text-align:left;">
        <div style="font-weight:800; color:#facc15; font-size:0.92rem; margin-bottom:6px;">
          💎 Web3 Wallet Extension Not Found on Browser. Choose Option:
        </div>
        <p style="font-size:0.82rem; color:#cbd5e1; margin-bottom:10px;">
          Aap Binance App, Trust Wallet ya MetaMask se payment bhej sakte hain. Niche Method 2 me Address Copy karke transfer karein:
        </p>
        <div style="display:flex; gap:8px; flex-wrap:wrap;">
          <a href="https://www.binance.com/" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.78rem;">🟡 Binance App</a>
          <a href="https://link.trustwallet.com/open_url?coin_id=60&url=${currentUrl}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.78rem;">🛡️ Trust Wallet App</a>
          <a href="https://metamask.app.link/dapp/${window.location.host}" target="_blank" class="btn btn-secondary" style="padding:6px 12px; font-size:0.78rem;">🦊 MetaMask App</a>
        </div>
      </div>
    `;
    
    const bepBox = document.querySelector('.bep20-card');
    if (bepBox) {
      bepBox.scrollIntoView({ behavior: 'smooth' });
    }
    showToast('Copy BEP20 address below to pay via Binance or Trust Wallet app!', 'info');
    return;
  }

  statusEl.innerText = '💎 Connecting to Binance Web3 / Crypto Wallet...';
  statusEl.style.color = '#facc15';

  try {
    const provider = new ethers.providers.Web3Provider(window.ethereum);
    await provider.send("eth_requestAccounts", []);
    const signer = provider.getSigner();
    const userAddress = await signer.getAddress();

    const network = await provider.getNetwork();
    let contractAddr = BEP20_USDT_CONTRACT_BSC;

    if (network.chainId === 137) {
      contractAddr = POLYGON_USDT_CONTRACT;
    }

    statusEl.innerText = `Connected: ${userAddress.substring(0,6)}...${userAddress.substring(38)} | Preparing ${usdtAmountNeeded} USDT Transfer...`;
    statusEl.style.color = '#60a5fa';

    const usdtContract = new ethers.Contract(contractAddr, ERC20_TRANSFER_ABI, signer);
    const decimals = await usdtContract.decimals();
    const amountParsed = ethers.utils.parseUnits(usdtAmountNeeded.toString(), decimals);

    statusEl.innerText = `⏳ Please APPROVE & CONFIRM the ${usdtAmountNeeded} USDT transfer popup in your wallet...`;
    statusEl.style.color = '#f59e0b';

    const tx = await usdtContract.transfer(ownerGlobalBep20Address, amountParsed);

    statusEl.innerText = `⚡ Transaction Sent to Blockchain! Waiting for block confirmation (Tx: ${tx.hash.substring(0, 14)}...)...`;
    statusEl.style.color = '#facc15';

    const receipt = await tx.wait();

    if (receipt.status === 1) {
      statusEl.innerText = `✅ PAYMENT SUCCESSFUL & ON-CHAIN VERIFIED! Delivering product key...`;
      statusEl.style.color = '#4ade80';

      document.getElementById('buy-tx-hash').value = tx.hash;
      await handleCheckoutSubmit();
    } else {
      statusEl.innerText = `❌ Blockchain transaction failed or was reverted.`;
      statusEl.style.color = '#f87171';
      showToast('Blockchain transaction failed.', 'error');
    }

  } catch (err) {
    console.error('Web3 Payment Error:', err);
    statusEl.innerText = `Transaction Cancelled / Failed: ${err.message}`;
    statusEl.style.color = '#f87171';
    showToast('Transaction cancelled: ' + err.message, 'error');
  }
}

// STRICT CHECKOUT HANDLER: ZERO BYPASS, REQUIRES VALID ON-CHAIN TX HASH
async function handleCheckoutSubmit() {
  if (!selectedProductForBuy) return;
  if (!currentUser) {
    showToast('Please Sign In to purchase.', 'error');
    openModal('user-login-modal');
    return;
  }

  const qty = Number(document.getElementById('buy-qty').value) || 1;
  const userName = currentUser.name;
  const userPhone = currentUser.phone;
  const txHash = document.getElementById('buy-tx-hash').value.trim();

  // STRICT FRONTEND MANDATORY VALIDATION: USER MUST ENTER A VALID 0x... BLOCKCHAIN HASH!
  if (!txHash || !txHash.startsWith('0x') || txHash.length < 60) {
    highlightErrorField('buy-tx-hash');
    showToast('❌ PAYMENT MANDATORY: Please transfer USDT via Binance / Trust Wallet and enter your valid 0x... Transaction Hash!', 'error');
    return;
  }

  showToast('🔍 Auditing Transaction Hash on Blockchain...', 'info');

  try {
    const res = await fetch('/api/user/orders/checkout', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser.id,
        userName,
        userPhone,
        productId: selectedProductForBuy._id,
        quantity: qty,
        txHash
      })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('buy-product-modal');
      document.getElementById('delivered-key-box').innerText = data.deliveredItem;
      openModal('delivery-success-modal');
      showToast('Payment Verified On-Chain! Key Delivered Instantly & Sent to Gmail!', 'success');
      fetchCatalog();
    } else {
      highlightErrorField('buy-tx-hash');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Checkout error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// STRICT LOGIN & LOGIN OTP VERIFICATION
// ----------------------------------------------------

async function handleUserLogin() {
  const emailOrPhoneInput = document.getElementById('login-email-phone');
  const passInput = document.getElementById('login-user-pass');

  const emailOrPhone = emailOrPhoneInput.value.trim();
  const password = passInput.value.trim();

  if (!emailOrPhone) {
    highlightErrorField('login-email-phone');
    showToast('❌ Email / Phone Number is MANDATORY!', 'error');
    return;
  }

  if (!password) {
    highlightErrorField('login-user-pass');
    showToast('❌ Password is MANDATORY!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrPhone, password })
    });
    const data = await res.json();

    if (data.success) {
      if (data.requireOtp) {
        document.getElementById('login-otp-target-email').innerText = data.email;
        document.getElementById('login-otp-step').style.display = 'block';
        showToast(data.message, 'info');
      } else {
        currentUser = data.user;
        localStorage.setItem('prince_user_session', JSON.stringify(currentUser));
        localStorage.setItem('prince_user_session_time', Date.now().toString());

        showToast(data.message, 'success');
        closeModal('user-login-modal');
        updateUserNavUI();
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  }
}

async function verifyLoginOTP() {
  const email = document.getElementById('login-otp-target-email').innerText;
  const otpInput = document.getElementById('login-otp-input');
  const userOTP = otpInput.value.trim();

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('login-otp-input');
    showToast('❌ Enter 6-digit Login OTP Code!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userOTP })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('prince_user_session', JSON.stringify(currentUser));
      localStorage.setItem('prince_user_session_time', Date.now().toString());

      showToast(data.message, 'success');
      closeModal('user-login-modal');
      updateUserNavUI();
    } else {
      highlightErrorField('login-otp-input');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Login OTP verification failed: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// REGISTRATION EMAIL OTP VERIFICATION
// ----------------------------------------------------

async function sendRegistrationEmailOTP() {
  const emailInput = document.getElementById('reg-email');
  const email = emailInput.value.trim();

  if (!email || !email.includes('@')) {
    highlightErrorField('reg-email');
    showToast('❌ Valid Gmail Address is required!', 'error');
    return;
  }

  const btn = document.getElementById('reg-send-otp-btn');
  btn.disabled = true;
  btn.innerText = '⏳ Sending OTP...';

  try {
    const res = await fetch('/api/auth/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('reg-otp-group').style.display = 'block';
      btn.innerText = '🔄 Resend OTP';
      btn.disabled = false;
    } else {
      highlightErrorField('reg-email');
      showToast(data.message, 'error');
      btn.disabled = false;
      btn.innerText = '📩 Send OTP';
    }
  } catch (err) {
    showToast('Send OTP error: ' + err.message, 'error');
    btn.disabled = false;
    btn.innerText = '📩 Send OTP';
  }
}

async function verifyRegistrationEmailOTP() {
  const emailInput = document.getElementById('reg-email');
  const otpInput = document.getElementById('reg-otp');

  const email = emailInput.value.trim();
  const userOTP = otpInput.value.trim();

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('reg-otp');
    showToast('❌ Enter 6-digit OTP code!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/verify-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userOTP })
    });
    const data = await res.json();

    if (data.success) {
      isEmailOTPVerified = true;
      showToast(data.message, 'success');
      document.getElementById('otp-status-badge').className = 'badge badge-success';
      document.getElementById('otp-status-badge').innerText = '✅ Email Verified!';
      
      document.getElementById('reg-email').readOnly = true;
      document.getElementById('reg-otp').readOnly = true;
    } else {
      highlightErrorField('reg-otp');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Verification failed: ' + err.message, 'error');
  }
}

async function handleUserRegister() {
  const nameInput = document.getElementById('reg-name');
  const phoneInput = document.getElementById('reg-phone');
  const emailInput = document.getElementById('reg-email');
  const passInput = document.getElementById('reg-pass');

  const name = nameInput.value.trim();
  const phone = phoneInput.value.trim();
  const email = emailInput.value.trim();
  const password = passInput.value.trim();

  if (!name) {
    highlightErrorField('reg-name');
    showToast('❌ Full Name is MANDATORY!', 'error');
    return;
  }

  if (!phone || phone.length < 10) {
    highlightErrorField('reg-phone');
    showToast('❌ Valid 10-digit Mobile Number is MANDATORY!', 'error');
    return;
  }

  if (!email) {
    highlightErrorField('reg-email');
    showToast('❌ Gmail Address is MANDATORY!', 'error');
    return;
  }

  if (!isEmailOTPVerified) {
    highlightErrorField('reg-otp');
    showToast('❌ Email OTP Verification is MANDATORY! Click "Send OTP" & verify code.', 'error');
    return;
  }

  if (!password || password.length < 4) {
    highlightErrorField('reg-pass');
    showToast('❌ Password is MANDATORY (Minimum 4 characters)!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();

    if (data.success) {
      currentUser = data.user;
      localStorage.setItem('prince_user_session', JSON.stringify(currentUser));
      localStorage.setItem('prince_user_session_time', Date.now().toString());

      showToast('Registration Complete! Account Verified.', 'success');
      closeModal('user-register-modal');
      updateUserNavUI();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  }
}

function handleUserLogout() {
  currentUser = null;
  localStorage.removeItem('prince_user_session');
  localStorage.removeItem('prince_user_session_time');
  showToast('Logged out successfully.', 'info');
  updateUserNavUI();
}

async function openMyOrdersModal() {
  if (!currentUser) {
    showToast('Please Sign In to view your orders.', 'info');
    openModal('user-login-modal');
    return;
  }

  try {
    const res = await fetch(`/api/user/orders/${currentUser.id}`);
    const data = await res.json();
    if (data.success) {
      renderMyOrders(data.orders);
      openModal('my-orders-modal');
    }
  } catch (err) {
    showToast('Error loading orders: ' + err.message, 'error');
  }
}

function renderMyOrders(orders) {
  const container = document.getElementById('my-orders-container');
  if (!container) return;

  if (!orders || orders.length === 0) {
    container.innerHTML = `<p style="text-align:center; color:var(--text-muted); padding:30px;">You haven't placed any orders yet.</p>`;
    return;
  }

  container.innerHTML = orders.map(ord => `
    <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:16px; margin-bottom:14px;">
      <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px;">
        <div>
          <strong style="font-size:1.05rem; color:#ffffff;">${escapeHtml(ord.productName)}</strong>
          ${ord.subProduct ? `<span style="font-size:0.85rem; color:var(--pink-accent); margin-left:6px;">(${escapeHtml(ord.subProduct)})</span>` : ''}
        </div>
        <span class="badge badge-success">${ord.deliveryStatus}</span>
      </div>
      <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
        Country: ${escapeHtml(ord.country || '🌐 Global')} | Qty: ${ord.quantity} | Paid: ${formatPriceDisplay(ord.totalPaid)} | Date: ${new Date(ord.createdAt).toLocaleDateString()}
      </div>
      <div style="margin-top:10px;">
        <label style="font-size:0.75rem; color:var(--yellow-primary); text-transform:uppercase; font-weight:700;">Your Delivered Item / Key:</label>
        <div class="code-box" style="margin:4px 0 0 0;">${escapeHtml(ord.deliveredItem)}</div>
      </div>
    </div>
  `).join('');
}

async function fetchSupportSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      if (data.settings.supportUrl) {
        ownerSupportUrl = data.settings.supportUrl;
      }
      if (data.settings.defaultBep20Address) {
        ownerGlobalBep20Address = data.settings.defaultBep20Address;
      }
    }
  } catch (err) {
    console.error('Fetch support settings error:', err);
  }
}

function contactOwnerSupport() {
  window.open(ownerSupportUrl, '_blank');
}

function highlightErrorField(fieldId) {
  const el = document.getElementById(fieldId);
  if (el) {
    el.classList.add('input-error-shake');
    el.focus();
    setTimeout(() => {
      el.classList.remove('input-error-shake');
    }, 1500);
  }
}

// Global Utilities
function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.add('active');
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) modal.classList.remove('active');
}

function showToast(message, type = 'info') {
  const container = document.getElementById('toast-container');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast toast-${type}`;
  toast.innerHTML = `<span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.remove();
  }, 4000);
}

function escapeHtml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}
