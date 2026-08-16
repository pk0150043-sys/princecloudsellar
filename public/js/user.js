// Customer Storefront Application Logic with Mandatory On-Chain Blockchain Payment Verification & Dual Currency Toggle (INR / USD)

let currentUser = null;
let catalogProducts = [];
let selectedProductForBuy = null;
let activeCategoryFilter = 'ALL';
let activeCurrency = localStorage.getItem('store_currency') || 'INR';

let ownerSupportUrl = 'https://wa.me/919507325677?text=Hello%20Owner%20I%20need%20support%20for%20PrinceCloudSellar';
let ownerGlobalBep20Address = '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';
let ownerGlobalUpiId = '9507325677-1@naviaxis';
let ownerGlobalWhatsApp = '9507325677';

let isEmailOTPVerified = false;

// BEP20 USDT Smart Contract Details
const BEP20_USDT_CONTRACT_BSC = "0x55d398326f99059fF775485246999027B3197955"; // BSC Mainnet USDT
const POLYGON_USDT_CONTRACT = "0xc2132D05D31c914a87C6611C10748AEb04B58e8F"; // Polygon USDT

function escapeHtml(str) {
  if (str === null || str === undefined) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

const ERC20_TRANSFER_ABI = [
  "function transfer(address to, uint256 amount) returns (bool)",
  "function decimals() view returns (uint8)"
];

// ----------------------------------------------------
// CUSTOMER REVIEWS & FEEDBACK CLIENT LOGIC
// ----------------------------------------------------
async function fetchFeedbacks() {
  try {
    const res = await fetch('/api/feedback?t=' + Date.now());
    const data = await res.json();
    if (data.success) {
      renderFeedbacks(data.feedbacks, data.averageRating, data.totalReviews);
    }
  } catch (err) {
    console.error('Error fetching feedbacks:', err);
  }
}

function renderFeedbacks(feedbacks, avgRating, totalCount) {
  const container = document.getElementById('feedbacks-container');
  const avgBadge = document.getElementById('feedback-avg-badge');

  if (avgBadge) avgBadge.innerText = `${avgRating || '5.0'} ★ (${totalCount || 0} Reviews)`;
  if (!container) return;

  if (!feedbacks || feedbacks.length === 0) {
    container.innerHTML = `<p style="grid-column: 1/-1; text-align: center; color: var(--text-muted); padding: 20px;">Be the first customer to leave a review!</p>`;
    return;
  }

  container.innerHTML = feedbacks.map(f => {
    const starCount = Number(f.rating) || 5;
    const starsStr = '★'.repeat(starCount) + '☆'.repeat(Math.max(0, 5 - starCount));

    return `
      <div style="background: rgba(18, 7, 36, 0.7); border: 1px solid var(--glass-border); border-radius: var(--radius-md); padding: 18px; display: flex; flex-direction: column; justify-content: space-between;">
        <div>
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
            <span style="color: #facc15; font-size: 1.15rem; letter-spacing: 2px;">${starsStr}</span>
            <span class="badge badge-success" style="font-size: 0.7rem;">✓ Verified Buyer</span>
          </div>
          <strong style="color: #ffffff; font-size: 1rem; display: block; margin-bottom: 4px;">${escapeHtml(f.title)}</strong>
          <p style="color: var(--text-muted); font-size: 0.85rem; line-height: 1.45;">${escapeHtml(f.comment)}</p>
        </div>

        <div style="margin-top: 14px; pt-2; border-top: 1px solid rgba(255,255,255,0.06); display: flex; justify-content: space-between; align-items: center; font-size: 0.78rem; color: var(--text-dim);">
          <span style="font-weight: 700; color: #ffffff;">👤 ${escapeHtml(f.userName)}</span>
          <span>${f.productName ? escapeHtml(f.productName) : 'Verified Purchase'}</span>
        </div>
      </div>
    `;
  }).join('');
}

function openFeedbackModal() {
  if (currentUser) {
    const nameEl = document.getElementById('feedback-user-name');
    const emailEl = document.getElementById('feedback-user-email');
    if (nameEl) nameEl.value = currentUser.name || '';
    if (emailEl) emailEl.value = currentUser.email || '';
  }
  setRatingValue(5);
  openModal('feedback-modal');
}

function setRatingValue(val) {
  const ratingInput = document.getElementById('feedback-rating-val');
  if (ratingInput) ratingInput.value = val;

  const stars = document.querySelectorAll('.star-rating-selector .star-item');
  stars.forEach(st => {
    const starNum = Number(st.getAttribute('data-rating'));
    if (starNum <= val) {
      st.style.color = '#facc15';
      st.innerText = '★';
    } else {
      st.style.color = 'var(--text-dim)';
      st.innerText = '☆';
    }
  });
}

async function handleFeedbackSubmit() {
  const rating = document.getElementById('feedback-rating-val').value;
  const userName = document.getElementById('feedback-user-name').value.trim();
  const userEmail = document.getElementById('feedback-user-email').value.trim();
  const productName = document.getElementById('feedback-product-name').value.trim();
  const title = document.getElementById('feedback-title').value.trim();
  const comment = document.getElementById('feedback-comment').value.trim();
  const userId = currentUser ? currentUser._id : '';

  try {
    const res = await fetch('/api/feedback', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userName, userEmail, rating, productName, title, comment })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Thank you! Your feedback is now live on our store.', 'success');
      closeModal('feedback-modal');
      document.getElementById('submit-feedback-form').reset();
      fetchFeedbacks();
    } else {
      showToast(data.message || 'Failed to submit feedback.', 'error');
    }
  } catch (err) {
    showToast('Feedback error: ' + err.message, 'error');
  }
}

// Initial page bootstrap
document.addEventListener('DOMContentLoaded', () => {
  initStore();
  fetchFeedbacks();
  fetchUserNotifications();
  setInterval(fetchUserNotifications, 25000);
});

function initStore() {
  updateCurrencyUI();
  checkStoredSession();
  loadCachedCatalogFirst();
  fetchCatalog();
  fetchSupportSettings();
  fetchSmmServices();
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

function normalizeUserObj(user) {
  if (!user) return null;
  const uid = user._id || user.id || '';
  return {
    ...user,
    _id: uid,
    id: uid
  };
}

function setCurrentUserSession(userData) {
  if (!userData) {
    currentUser = null;
    localStorage.removeItem('prince_user_session');
    localStorage.removeItem('prince_user_session_time');
    return;
  }
  currentUser = normalizeUserObj(userData);
  localStorage.setItem('prince_user_session', JSON.stringify(currentUser));
  localStorage.setItem('prince_user_session_time', Date.now().toString());
}

function checkStoredSession() {
  const savedUser = localStorage.getItem('prince_user_session');
  const sessionTime = localStorage.getItem('prince_user_session_time');

  if (savedUser && sessionTime) {
    const elapsedMs = Date.now() - Number(sessionTime);
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (elapsedMs < SIX_HOURS_MS) {
      try {
        const parsed = JSON.parse(savedUser);
        currentUser = normalizeUserObj(parsed);
      } catch (e) {
        currentUser = null;
      }
      updateUserNavUI();
    } else {
      setCurrentUserSession(null);
      updateUserNavUI();
      showToast('⏰ Your 6-hour session has expired. Please sign in again.', 'info');
    }
  } else {
    updateUserNavUI();
  }
}

// PERIODIC AUTO-LOGOUT MONITOR (Checks for 6-hour expiration every 30 seconds)
setInterval(() => {
  if (!currentUser) return;
  const sessionTime = localStorage.getItem('prince_user_session_time');
  if (sessionTime) {
    const elapsedMs = Date.now() - Number(sessionTime);
    const SIX_HOURS_MS = 6 * 60 * 60 * 1000;
    if (elapsedMs >= SIX_HOURS_MS) {
      setCurrentUserSession(null);
      updateUserNavUI();
      showToast('⏰ Your 6-hour session has expired. You have been automatically logged out.', 'info');
    }
  }
}, 30000);

let isInlineEmailOTPVerified = false;

function updateUserNavUI() {
  const userActionsDiv = document.getElementById('user-nav-actions');
  const aboutTermsSec = document.getElementById('landing-about-terms-section');

  // ALWAYS keep About & Terms section visible so users can read policies anytime!
  if (aboutTermsSec) {
    aboutTermsSec.style.display = 'block';
  }

  // Render the prominent user auth portal box on the homepage
  renderAuthPortalBox();

  if (currentUser) {
    if (userActionsDiv) {
      userActionsDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px; flex-wrap:wrap;">
          <div style="background:rgba(250,204,21,0.1); border:1px solid #facc15; padding:6px 12px; border-radius:30px; display:flex; align-items:center; gap:6px;">
            <span style="font-size:0.85rem; font-weight:700; color:#facc15;">👤 ${escapeHtml(currentUser.name)}</span>
          </div>
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.82rem; font-weight:700;" onclick="openMyOrdersModal()">🛍️ My Orders</button>
          <button class="btn btn-danger" style="padding:6px 12px; font-size:0.82rem;" onclick="handleUserLogout()">Sign Out</button>
        </div>
      `;
    }
  } else {
    if (userActionsDiv) {
      userActionsDiv.innerHTML = `
        <div style="display:flex; align-items:center; gap:8px;">
          <button class="btn btn-secondary" style="padding:7px 14px; font-size:0.85rem; font-weight:700; border-color:var(--yellow-primary); color:var(--yellow-primary);" onclick="openModal('user-login-modal')">🔑 Sign In</button>
          <button class="btn btn-primary" style="padding:7px 16px; font-size:0.85rem; font-weight:700;" onclick="openModal('user-register-modal')">✨ Register</button>
        </div>
      `;
    }
  }
}

function renderAuthPortalBox() {
  const card = document.getElementById('user-auth-portal-card');
  if (!card) return;

  if (currentUser) {
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 16px;">
        <div style="display: flex; align-items: center; gap: 16px;">
          <div style="width: 52px; height: 52px; border-radius: 50%; background: linear-gradient(135deg, #facc15, #ec4899); display: flex; align-items: center; justify-content: center; font-size: 1.6rem; color: #000; font-weight: 800; box-shadow: 0 0 16px rgba(250,204,21,0.4);">
            👤
          </div>
          <div>
            <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
              <h2 style="color: #facc15; font-size: 1.35rem; margin: 0;">Welcome, ${escapeHtml(currentUser.name)}!</h2>
              <span class="badge badge-success" style="font-size: 0.75rem;">✅ Verified Account</span>
              <span class="badge badge-info" style="font-size: 0.75rem;">🔐 6-Hour Session Active</span>
            </div>
            <div style="color: var(--text-muted); font-size: 0.85rem; margin-top: 4px; display: flex; gap: 16px; flex-wrap: wrap;">
              <span>📧 <strong>Email:</strong> ${escapeHtml(currentUser.email)}</span>
              <span>📱 <strong>Mobile:</strong> +${escapeHtml(currentUser.phone || '')}</span>
            </div>
          </div>
        </div>

        <div style="display: flex; align-items: center; gap: 10px; flex-wrap: wrap;">
          <button class="btn btn-primary" onclick="openMyOrdersModal()" style="padding: 10px 18px; font-weight: 700;">
            🛍️ My Orders &amp; Keys
          </button>
          <button class="btn btn-secondary" onclick="openSupportTicketModal()" style="padding: 10px 16px; border-color: var(--yellow-primary); color: var(--yellow-primary);">
            🎫 Tickets
          </button>
          <button class="btn btn-secondary" onclick="openFeedbackModal()" style="padding: 10px 16px; border-color: var(--pink-accent); color: var(--pink-accent);">
            ⭐ Review
          </button>
          <button class="btn btn-danger" onclick="handleUserLogout()" style="padding: 10px 16px;">
            🚪 Sign Out
          </button>
        </div>
      </div>
    `;
  } else {
    card.innerHTML = `
      <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 12px; margin-bottom: 18px; border-bottom: 1px solid rgba(255,255,255,0.1); padding-bottom: 14px;">
        <div style="display: flex; align-items: center; gap: 10px;">
          <span style="font-size: 1.5rem;">👑</span>
          <div>
            <h3 style="color: var(--yellow-primary); margin: 0; font-size: 1.15rem;">Customer Account &amp; Access Portal</h3>
            <p style="color: var(--text-muted); font-size: 0.8rem; margin: 0;">Sign in to access your orders, or register a new verified account (6-digit OTP verification)</p>
          </div>
        </div>

        <!-- TABS -->
        <div style="display: flex; gap: 8px;">
          <button id="inline-tab-login-btn" class="btn btn-secondary" onclick="switchInlineAuthTab('login')" style="padding: 8px 18px; font-weight: 700; border-color: var(--yellow-primary); color: var(--yellow-primary); background: rgba(250,204,21,0.15);">
            🔑 Sign In / Login
          </button>
          <button id="inline-tab-reg-btn" class="btn btn-secondary" onclick="switchInlineAuthTab('register')" style="padding: 8px 18px; font-weight: 700; border-color: rgba(255,255,255,0.2);">
            ✨ Create Account / Register <span style="color:#ef4444; font-weight:bold;">*</span>
          </button>
        </div>
      </div>

      <!-- INLINE SIGN IN VIEW -->
      <div id="inline-auth-login-view">
        <form id="inline-login-form" onsubmit="event.preventDefault(); handleInlineUserLogin();">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)) 160px; gap: 12px; align-items: end;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Registered Email / Phone <span class="required-star">*</span></label>
              <input type="text" id="inline-login-email-phone" class="form-control" placeholder="user@gmail.com or 9876543210" required>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <div style="display: flex; justify-content: space-between;">
                <label class="form-label" style="font-size: 0.8rem;">Account Password <span class="required-star">*</span></label>
                <a href="javascript:void(0)" onclick="openModal('forgot-pass-modal')" style="font-size: 0.75rem; color: var(--pink-accent); text-decoration: underline;">Forgot?</a>
              </div>
              <input type="password" id="inline-login-pass" class="form-control" placeholder="••••••••" required>
            </div>

            <div>
              <button type="submit" class="btn btn-primary btn-block" style="padding: 11px; font-weight: 700; font-size: 0.9rem;">
                🚀 Sign In Now
              </button>
            </div>
          </div>

          <!-- INLINE LOGIN OTP STEP (IF 6-HOUR SECURITY TRIGGERS) -->
          <div id="inline-login-otp-step" style="display: none; margin-top: 14px; background: rgba(250, 204, 21, 0.08); border: 1px solid var(--yellow-primary); padding: 14px; border-radius: var(--radius-md);">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <strong style="color: var(--yellow-primary); font-size: 0.88rem;">🔐 Security Login OTP Sent!</strong>
                <p style="color: #cbd5e1; font-size: 0.8rem; margin: 2px 0 0 0;">Enter 6-digit code sent to <strong id="inline-login-otp-target-email"></strong>:</p>
              </div>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="inline-login-otp-input" class="form-control" placeholder="123456" maxlength="6" style="width: 140px; letter-spacing: 4px; text-align: center; font-weight: 700;">
                <button type="button" class="btn btn-primary" onclick="verifyInlineLoginOTP()" style="padding: 8px 18px; font-weight: 700;">
                  Verify &amp; Sign In
                </button>
              </div>
            </div>
          </div>
        </form>
      </div>

      <!-- INLINE REGISTER VIEW -->
      <div id="inline-auth-reg-view" style="display: none;">
        <form id="inline-reg-form" onsubmit="event.preventDefault(); handleInlineUserRegister();">
          <div style="display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 12px; margin-bottom: 12px;">
            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Full Name <span class="required-star">*</span></label>
              <input type="text" id="inline-reg-name" class="form-control" placeholder="John Doe" required>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Mobile Number <span class="required-star">*</span></label>
              <input type="tel" id="inline-reg-phone" class="form-control" placeholder="9876543210" required>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Gmail Address <span class="required-star">*</span></label>
              <div style="display: flex; gap: 6px;">
                <input type="email" id="inline-reg-email" class="form-control" placeholder="user@gmail.com" required>
                <button type="button" id="inline-reg-send-otp-btn" class="btn btn-secondary" onclick="sendInlineRegistrationEmailOTP()" style="padding: 0 12px; font-size: 0.78rem; white-space: nowrap;">
                  📩 Send OTP
                </button>
              </div>
            </div>

            <div class="form-group" style="margin-bottom: 0;">
              <label class="form-label" style="font-size: 0.8rem;">Account Password <span class="required-star">*</span></label>
              <input type="password" id="inline-reg-pass" class="form-control" placeholder="••••••••" required>
            </div>
          </div>

          <!-- INLINE REG OTP FIELD -->
          <div id="inline-reg-otp-group" style="display: none; background: rgba(236, 72, 153, 0.08); border: 1px solid var(--pink-accent); padding: 12px 16px; border-radius: var(--radius-md); margin-bottom: 12px;">
            <div style="display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
              <div>
                <span id="inline-otp-status-badge" class="badge badge-warning">Pending Code</span>
                <span style="font-size: 0.82rem; color: #cbd5e1; margin-left: 8px;">Enter 6-digit OTP code sent to your Gmail inbox:</span>
              </div>
              <div style="display: flex; gap: 8px;">
                <input type="text" id="inline-reg-otp" class="form-control" placeholder="123456" maxlength="6" style="width: 130px; letter-spacing: 4px; text-align: center; font-weight: 700;">
                <button type="button" class="btn btn-primary" onclick="verifyInlineRegistrationEmailOTP()" style="padding: 6px 14px; font-size: 0.82rem; white-space: nowrap;">
                  Verify OTP
                </button>
              </div>
            </div>
          </div>

          <div style="display: flex; justify-content: flex-end; gap: 10px;">
            <button type="submit" class="btn btn-primary" style="padding: 10px 24px; font-weight: 700;">
              ✨ Create &amp; Verify Account
            </button>
          </div>
        </form>
      </div>
    `;
  }
}

function switchInlineAuthTab(tab) {
  const loginView = document.getElementById('inline-auth-login-view');
  const regView = document.getElementById('inline-auth-reg-view');
  const loginBtn = document.getElementById('inline-tab-login-btn');
  const regBtn = document.getElementById('inline-tab-reg-btn');

  if (tab === 'login') {
    if (loginView) loginView.style.display = 'block';
    if (regView) regView.style.display = 'none';
    if (loginBtn) {
      loginBtn.style.background = 'rgba(250,204,21,0.15)';
      loginBtn.style.borderColor = 'var(--yellow-primary)';
      loginBtn.style.color = 'var(--yellow-primary)';
    }
    if (regBtn) {
      regBtn.style.background = 'transparent';
      regBtn.style.borderColor = 'rgba(255,255,255,0.2)';
      regBtn.style.color = 'var(--text-light)';
    }
  } else {
    if (loginView) loginView.style.display = 'none';
    if (regView) regView.style.display = 'block';
    if (regBtn) {
      regBtn.style.background = 'rgba(250,204,21,0.15)';
      regBtn.style.borderColor = 'var(--yellow-primary)';
      regBtn.style.color = 'var(--yellow-primary)';
    }
    if (loginBtn) {
      loginBtn.style.background = 'transparent';
      loginBtn.style.borderColor = 'rgba(255,255,255,0.2)';
      loginBtn.style.color = 'var(--text-light)';
    }
  }
}

async function handleInlineUserLogin() {
  const inputFld = document.getElementById('inline-login-email-phone');
  const passFld = document.getElementById('inline-login-pass');
  if (!inputFld || !passFld) return;

  const emailOrPhone = inputFld.value.trim();
  const password = passFld.value.trim();

  if (!emailOrPhone) {
    highlightErrorField('inline-login-email-phone');
    showToast('❌ Enter Email or Phone number!', 'error');
    return;
  }
  if (!password) {
    highlightErrorField('inline-login-pass');
    showToast('❌ Enter Password!', 'error');
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
        const targetEl = document.getElementById('inline-login-otp-target-email');
        if (targetEl) {
          targetEl.innerText = data.maskedEmail || data.email || emailOrPhone;
          targetEl.setAttribute('data-real-email', data.email || emailOrPhone);
        }
        document.getElementById('inline-login-otp-step').style.display = 'block';
        const otpFld = document.getElementById('inline-login-otp-input');
        if (otpFld) {
          otpFld.value = '';
          otpFld.focus();
        }
        showToast(data.message, 'info');
      } else {
        setCurrentUserSession(data.user);

        showToast(data.message, 'success');
        updateUserNavUI();
        if (selectedProductForBuy) {
          openBuyModal(selectedProductForBuy._id);
        }
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Login error: ' + err.message, 'error');
  }
}

async function verifyInlineLoginOTP() {
  const targetEl = document.getElementById('inline-login-otp-target-email');
  const emailInput = document.getElementById('inline-login-email-phone');
  const email = (targetEl?.getAttribute('data-real-email') || emailInput?.value || targetEl?.innerText || '').trim();
  const otpInput = document.getElementById('inline-login-otp-input');
  const userOTP = otpInput ? otpInput.value.replace(/[^0-9]/g, '') : '';

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('inline-login-otp-input');
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
      setCurrentUserSession(data.user);

      showToast(data.message, 'success');
      updateUserNavUI();
      if (selectedProductForBuy) {
        openBuyModal(selectedProductForBuy._id);
      }
    } else {
      highlightErrorField('inline-login-otp-input');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Verify OTP error: ' + err.message, 'error');
  }
}

let regOtpCooldownTimer = null;
async function sendInlineRegistrationEmailOTP() {
  const emailInput = document.getElementById('inline-reg-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !email.includes('@')) {
    highlightErrorField('inline-reg-email');
    showToast('❌ Valid Gmail Address is required!', 'error');
    return;
  }

  const btn = document.getElementById('inline-reg-send-otp-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Sending...';
  }

  try {
    const res = await fetch('/api/auth/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('inline-reg-otp-group').style.display = 'block';
      const otpFld = document.getElementById('inline-reg-otp');
      if (otpFld) otpFld.focus();

      // Start 30s Cooldown
      let seconds = 30;
      if (btn) {
        btn.innerText = `⏳ Wait ${seconds}s`;
        clearInterval(regOtpCooldownTimer);
        regOtpCooldownTimer = setInterval(() => {
          seconds--;
          if (seconds <= 0) {
            clearInterval(regOtpCooldownTimer);
            btn.disabled = false;
            btn.innerText = '🔄 Resend OTP';
          } else {
            btn.innerText = `⏳ Wait ${seconds}s`;
          }
        }, 1000);
      }
    } else {
      highlightErrorField('inline-reg-email');
      showToast(data.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📩 Send OTP';
      }
    }
  } catch (err) {
    showToast('Send OTP error: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📩 Send OTP';
    }
  }
}

async function verifyInlineRegistrationEmailOTP() {
  const emailInput = document.getElementById('inline-reg-email');
  const otpInput = document.getElementById('inline-reg-otp');

  const email = emailInput ? emailInput.value.trim() : '';
  const userOTP = otpInput ? otpInput.value.replace(/[^0-9]/g, '') : '';

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('inline-reg-otp');
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
      isInlineEmailOTPVerified = true;
      isEmailOTPVerified = true;
      showToast(data.message, 'success');
      const badge = document.getElementById('inline-otp-status-badge');
      if (badge) {
        badge.className = 'badge badge-success';
        badge.innerText = '✅ Email Verified!';
      }
      if (emailInput) emailInput.readOnly = true;
      if (otpInput) otpInput.readOnly = true;
    } else {
      highlightErrorField('inline-reg-otp');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Verification failed: ' + err.message, 'error');
  }
}

async function handleInlineUserRegister() {
  const nameInput = document.getElementById('inline-reg-name');
  const phoneInput = document.getElementById('inline-reg-phone');
  const emailInput = document.getElementById('inline-reg-email');
  const passInput = document.getElementById('inline-reg-pass');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const password = passInput ? passInput.value.trim() : '';

  if (!name) {
    highlightErrorField('inline-reg-name');
    showToast('❌ Full Name is MANDATORY!', 'error');
    return;
  }

  if (!phone || phone.length < 10) {
    highlightErrorField('inline-reg-phone');
    showToast('❌ Valid 10-digit Mobile Number is MANDATORY!', 'error');
    return;
  }

  if (!email) {
    highlightErrorField('inline-reg-email');
    showToast('❌ Gmail Address is MANDATORY!', 'error');
    return;
  }

  if (!isInlineEmailOTPVerified && !isEmailOTPVerified) {
    highlightErrorField('inline-reg-email');
    showToast('❌ Email OTP verification is mandatory! Click Send OTP first.', 'error');
    return;
  }

  if (!password || password.length < 4) {
    highlightErrorField('inline-reg-pass');
    showToast('❌ Password must be at least 4 characters!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, phone, email, password })
    });
    const data = await res.json();

    if (data.success) {
      setCurrentUserSession(data.user);

      showToast(`🎉 Registration Successful! Welcome ${currentUser.name}.`, 'success');
      updateUserNavUI();
      if (selectedProductForBuy) {
        openBuyModal(selectedProductForBuy._id);
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Registration failed: ' + err.message, 'error');
  }
}

function setupEventListeners() {
  const loginForm = document.getElementById('user-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const otpStep = document.getElementById('login-otp-step');
      if (otpStep && otpStep.style.display === 'block') {
        await verifyLoginOTP();
      } else {
        await handleUserLogin();
      }
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

  const createTicketForm = document.getElementById('create-ticket-form');
  if (createTicketForm) {
    createTicketForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleCreateTicketSubmit();
    });
  }

  const feedbackForm = document.getElementById('submit-feedback-form');
  if (feedbackForm) {
    feedbackForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleFeedbackSubmit();
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
  const p = catalogProducts.find(item => item._id === productId);
  if (!p) return;

  selectedProductForBuy = p;

  if (!currentUser) {
    showToast(`🔑 Please Sign In or Register to purchase "${p.name}".`, 'info');
    openModal('user-login-modal');
    return;
  }

  const displayTitle = `${p.name} ${p.subProduct ? `(${p.subProduct})` : ''} [${p.country || '🌐 Global'}]`;
  document.getElementById('buy-product-title').innerText = displayTitle;
  document.getElementById('buy-product-price-label').innerText = `${formatPriceDisplay(p.price)} / unit`;
  document.getElementById('buy-qty').value = 1;
  document.getElementById('bep20-wallet-addr').innerText = ownerGlobalBep20Address;
  
  const upiEl = document.getElementById('upi-merchant-id');
  if (upiEl) upiEl.innerText = ownerGlobalUpiId;

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

  const upiEl = document.getElementById('upi-merchant-id');
  if (upiEl) upiEl.innerText = ownerGlobalUpiId;

  const priceLabel = document.getElementById('buy-product-price-label');
  if (priceLabel) {
    priceLabel.innerText = `${formatPriceDisplay(selectedProductForBuy.price)} / unit`;
  }

  document.getElementById('buy-total-price').innerText = formatPriceDisplay(totalInr);

  const upiAmountLabel = document.getElementById('upi-pay-amount-label');
  if (upiAmountLabel) {
    upiAmountLabel.innerText = totalInr.toLocaleString();
  }

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

function copyUpiId() {
  const upiEl = document.getElementById('upi-merchant-id');
  const upiId = upiEl ? upiEl.innerText.trim() : (ownerGlobalUpiId || '9507325677-1@naviaxis');
  navigator.clipboard.writeText(upiId).then(() => {
    showToast(`UPI ID Copied (${upiId})! Open GPay, PhonePe, Paytm, or BHIM to pay.`, 'success');
  }).catch(() => {
    showToast('UPI ID: ' + upiId, 'info');
  });
}

async function submitUpiCheckout() {
  if (!selectedProductForBuy) {
    showToast('Please select a product first.', 'error');
    return;
  }
  if (!currentUser) {
    showToast('Please Sign In or Register to purchase.', 'error');
    openModal('user-login-modal');
    return;
  }

  const utrInput = document.getElementById('buy-upi-utr');
  const utrId = utrInput ? utrInput.value.trim() : '';

  if (!utrId || utrId.length < 6) {
    highlightErrorField('buy-upi-utr');
    showToast('❌ Please pay via UPI and enter your 12-digit UPI UTR / Transaction ID!', 'error');
    return;
  }

  const qty = Math.max(1, Number(document.getElementById('buy-qty').value) || 1);
  const totalInr = selectedProductForBuy.price * qty;

  showToast('🏦 Submitting UPI Order...', 'info');

  try {
    const res = await fetch('/api/user/orders/checkout-upi', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId: currentUser._id || currentUser.id,
        userName: currentUser.name,
        userPhone: currentUser.phone,
        userEmail: currentUser.email,
        productId: selectedProductForBuy._id,
        quantity: qty,
        utrId
      })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('buy-product-modal');
      const order = data.order;


      const waProofUrl = `https://wa.me/919507325677?text=Hello%20Owner%2C%20I%20have%20paid%20via%20UPI%20for%20PrinceCloudSellar%20Order%3A%0AOrder%20ID%3A%20${order._id}%0AProduct%3A%20${encodeURIComponent(order.productName)}%0AQty%3A%20${qty}%0AAmount%3A%20Rs.${totalInr}%0AUTR%20ID%3A%20${utrId}%0APlease%20verify%20and%20approve%20my%20delivery.`;
      
      const proofBtn = document.getElementById('upi-whatsapp-proof-btn');
      if (proofBtn) proofBtn.href = waProofUrl;

      const invoiceBtn = document.getElementById('upi-invoice-btn');
      if (invoiceBtn) invoiceBtn.href = `/invoice/${order._id}`;

      openModal('upi-success-modal');
      showToast('UPI Order Submitted! Please send screenshot on WhatsApp for approval.', 'success');
      fetchCatalog();
    } else {
      highlightErrorField('buy-upi-utr');
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('UPI checkout error: ' + err.message, 'error');
  }
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
        userId: currentUser._id || currentUser.id,
        userName,
        userPhone,
        userEmail: currentUser.email,
        productId: selectedProductForBuy._id,
        quantity: qty,
        txHash
      })
    });
    const data = await res.json();

    if (data.success) {
      closeModal('buy-product-modal');
      document.getElementById('delivered-key-box').innerText = data.deliveredItem;
      const invLink = document.getElementById('crypto-invoice-link');
      if (invLink && data.order) {
        invLink.href = `/invoice/${data.order._id}`;
      }
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
  const submitBtn = document.getElementById('login-submit-btn');

  const emailOrPhone = emailOrPhoneInput ? emailOrPhoneInput.value.trim() : '';
  const password = passInput ? passInput.value.trim() : '';

  if (!emailOrPhone) {
    highlightErrorField('login-email-phone');
    showToast('❌ Email or Phone Number is REQUIRED to Sign In!', 'error');
    if (emailOrPhoneInput) emailOrPhoneInput.focus();
    return;
  }

  if (!password) {
    highlightErrorField('login-user-pass');
    showToast('❌ Password is REQUIRED to Sign In!', 'error');
    if (passInput) passInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '⏳ Signing in...';
  }

  showToast('🔐 Processing Sign In...', 'info');

  try {
    const res = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ emailOrPhone, password })
    });
    const data = await res.json();

    if (data.success) {
      if (data.requireOtp) {
        const targetEmailEl = document.getElementById('login-otp-target-email');
        if (targetEmailEl) {
          targetEmailEl.innerText = data.maskedEmail || data.email || emailOrPhone;
          targetEmailEl.setAttribute('data-real-email', data.email || emailOrPhone);
        }
        const otpStep = document.getElementById('login-modal-otp-step');
        if (otpStep) {
          otpStep.style.display = 'block';
        }
        const otpInput = document.getElementById('login-otp-input');
        if (otpInput) {
          otpInput.value = '';
          otpInput.focus();
        }
        showToast(data.message || '🔐 6-digit OTP code sent to your registered Gmail!', 'info');
      } else {
        setCurrentUserSession(data.user);

        showToast(data.message || `🎉 Welcome back, ${currentUser.name}!`, 'success');
        closeModal('user-login-modal');
        updateUserNavUI();

        if (selectedProductForBuy) {
          openBuyModal(selectedProductForBuy._id);
        }
      }
    } else {
      highlightErrorField('login-email-phone');
      highlightErrorField('login-user-pass');
      showToast(data.message || '❌ Invalid Credentials! Check your details or Register.', 'error');
    }
  } catch (err) {
    showToast('Login connection error: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Sign In To Store';
    }
  }
}

async function verifyLoginOTP() {
  const targetEmailEl = document.getElementById('login-otp-target-email');
  const inputEmail = document.getElementById('login-email-phone');
  const email = (targetEmailEl?.getAttribute('data-real-email') || inputEmail?.value || targetEmailEl?.innerText || '').trim();
  const otpInput = document.getElementById('login-otp-input');
  const verifyBtn = document.getElementById('login-verify-otp-btn');
  const userOTP = otpInput ? otpInput.value.replace(/[^0-9]/g, '') : '';

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('login-otp-input');
    showToast('❌ Enter complete 6-digit Login OTP Code!', 'error');
    if (otpInput) otpInput.focus();
    return;
  }

  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerText = '⏳ Verifying...';
  }

  try {
    const res = await fetch('/api/auth/verify-login-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, userOTP })
    });
    const data = await res.json();

    if (data.success) {
      setCurrentUserSession(data.user);

      showToast(data.message || `🎉 Signed In Successfully as ${currentUser.name}!`, 'success');
      closeModal('user-login-modal');
      updateUserNavUI();

      if (selectedProductForBuy) {
        openBuyModal(selectedProductForBuy._id);
      }
    } else {
      highlightErrorField('login-otp-input');
      showToast(data.message || '❌ Invalid Login OTP code entered!', 'error');
    }
  } catch (err) {
    showToast('Login OTP verification failed: ' + err.message, 'error');
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify & Enter';
    }
  }
}

// ----------------------------------------------------
// REGISTRATION EMAIL OTP VERIFICATION
// ----------------------------------------------------

let regModalCooldownTimer = null;
async function sendRegistrationEmailOTP() {
  const emailInput = document.getElementById('reg-email');
  const email = emailInput ? emailInput.value.trim() : '';

  if (!email || !email.includes('@')) {
    highlightErrorField('reg-email');
    showToast('❌ Valid Gmail Address is required!', 'error');
    if (emailInput) emailInput.focus();
    return false;
  }

  const btn = document.getElementById('reg-send-otp-btn');
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Sending OTP...';
  }

  try {
    const res = await fetch('/api/auth/send-email-otp', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email })
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      const otpGroup = document.getElementById('reg-otp-group');
      if (otpGroup) otpGroup.style.display = 'block';
      
      const badge = document.getElementById('otp-status-badge');
      if (badge) {
        badge.className = 'badge badge-warning';
        badge.innerText = 'Code Sent';
      }

      const otpFld = document.getElementById('reg-otp');
      if (otpFld) {
        otpFld.focus();
      }

      // Start 30s Cooldown
      let seconds = 30;
      if (btn) {
        btn.innerText = `⏳ Wait ${seconds}s`;
        clearInterval(regModalCooldownTimer);
        regModalCooldownTimer = setInterval(() => {
          seconds--;
          if (seconds <= 0) {
            clearInterval(regModalCooldownTimer);
            btn.disabled = false;
            btn.innerText = '🔄 Resend OTP';
          } else {
            btn.innerText = `⏳ Wait ${seconds}s`;
          }
        }, 1000);
      }
      return true;
    } else {
      highlightErrorField('reg-email');
      showToast(data.message, 'error');
      if (btn) {
        btn.disabled = false;
        btn.innerText = '📩 Send OTP';
      }
      return false;
    }
  } catch (err) {
    showToast('Send OTP error: ' + err.message, 'error');
    if (btn) {
      btn.disabled = false;
      btn.innerText = '📩 Send OTP';
    }
    return false;
  }
}

async function verifyRegistrationEmailOTP() {
  const emailInput = document.getElementById('reg-email');
  const otpInput = document.getElementById('reg-otp');
  const verifyBtn = document.getElementById('reg-verify-btn');

  const email = emailInput ? emailInput.value.trim() : '';
  const userOTP = otpInput ? otpInput.value.replace(/[^0-9]/g, '') : '';

  if (!userOTP || userOTP.length < 6) {
    highlightErrorField('reg-otp');
    showToast('❌ Enter 6-digit OTP code!', 'error');
    if (otpInput) otpInput.focus();
    return false;
  }

  if (verifyBtn) {
    verifyBtn.disabled = true;
    verifyBtn.innerText = '⏳ Verifying...';
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
      const badge = document.getElementById('otp-status-badge');
      if (badge) {
        badge.className = 'badge badge-success';
        badge.innerText = '✅ Email Verified!';
      }
      if (emailInput) emailInput.readOnly = true;
      if (otpInput) {
        otpInput.readOnly = true;
        otpInput.style.borderColor = '#22c55e';
      }
      const passFld = document.getElementById('reg-pass');
      if (passFld) passFld.focus();
      return true;
    } else {
      highlightErrorField('reg-otp');
      showToast(data.message, 'error');
      return false;
    }
  } catch (err) {
    showToast('Verification failed: ' + err.message, 'error');
    return false;
  } finally {
    if (verifyBtn) {
      verifyBtn.disabled = false;
      verifyBtn.innerText = 'Verify OTP';
    }
  }
}

async function handleUserRegister() {
  const nameInput = document.getElementById('reg-name');
  const phoneInput = document.getElementById('reg-phone');
  const emailInput = document.getElementById('reg-email');
  const otpInput = document.getElementById('reg-otp');
  const passInput = document.getElementById('reg-pass');
  const submitBtn = document.getElementById('reg-submit-btn');

  const name = nameInput ? nameInput.value.trim() : '';
  const phone = phoneInput ? phoneInput.value.trim() : '';
  const email = emailInput ? emailInput.value.trim() : '';
  const userOTP = otpInput ? otpInput.value.replace(/[^0-9]/g, '') : '';
  const password = passInput ? passInput.value.trim() : '';

  if (!name) {
    highlightErrorField('reg-name');
    showToast('❌ Full Name is MANDATORY!', 'error');
    if (nameInput) nameInput.focus();
    return;
  }

  if (!phone || phone.length < 10) {
    highlightErrorField('reg-phone');
    showToast('❌ Valid 10-digit Mobile Number is MANDATORY!', 'error');
    if (phoneInput) phoneInput.focus();
    return;
  }

  if (!email || !email.includes('@')) {
    highlightErrorField('reg-email');
    showToast('❌ Gmail Address is MANDATORY!', 'error');
    if (emailInput) emailInput.focus();
    return;
  }

  // SMART AUTO-VERIFY: If user typed 6-digit OTP but didn't click "Verify OTP" button
  if (!isEmailOTPVerified) {
    if (userOTP && userOTP.length === 6) {
      const verified = await verifyRegistrationEmailOTP();
      if (!verified) return;
    } else {
      highlightErrorField('reg-otp');
      showToast('⚠️ Please enter the 6-digit OTP code sent to your Gmail inbox!', 'warning');
      if (otpInput) otpInput.focus();
      return;
    }
  }

  if (!password || password.length < 4) {
    highlightErrorField('reg-pass');
    showToast('❌ Password is MANDATORY (Minimum 4 characters)!', 'error');
    if (passInput) passInput.focus();
    return;
  }

  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '⏳ Creating Account...';
  }

  try {
    const res = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, email, phone, password })
    });
    const data = await res.json();

    if (data.success) {
      setCurrentUserSession(data.user);

      showToast('🎉 Registration Complete! Account Verified.', 'success');
      closeModal('user-register-modal');
      updateUserNavUI();

      if (selectedProductForBuy) {
        openBuyModal(selectedProductForBuy._id);
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Registration error: ' + err.message, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = 'Create & Verify Account';
    }
  }
}

function handleUserLogout() {
  setCurrentUserSession(null);
  showToast('Logged out successfully.', 'info');
  updateUserNavUI();
}

let currentOrdersTab = 'cloud';
let userLoadedCloudOrders = [];
let userLoadedSmmOrders = [];

async function openMyOrdersModal() {
  if (!currentUser) {
    showToast('Please Sign In to view your orders.', 'info');
    openModal('user-login-modal');
    return;
  }

  const uid = currentUser._id || currentUser.id || currentUser.phone || currentUser.email;
  if (!uid) {
    showToast('User identifier missing. Please Sign In again.', 'error');
    return;
  }

  try {
    const [cloudRes, smmRes] = await Promise.all([
      fetch(`/api/user/orders/${encodeURIComponent(uid)}?t=${Date.now()}`),
      fetch(`/api/smm/orders/user/${encodeURIComponent(uid)}?t=${Date.now()}`)
    ]);

    const cloudData = await cloudRes.json();
    const smmData = await smmRes.json();

    userLoadedCloudOrders = cloudData.success ? cloudData.orders : [];
    userLoadedSmmOrders = smmData.success ? smmData.orders : [];

    renderCombinedOrdersView();
    openModal('my-orders-modal');
  } catch (err) {
    showToast('Error loading orders: ' + err.message, 'error');
  }
}

function switchOrdersTab(tab) {
  currentOrdersTab = tab;
  renderCombinedOrdersView();
}

function renderCombinedOrdersView() {
  const container = document.getElementById('my-orders-container');
  if (!container) return;

  const headerTabs = `
    <div style="display:flex; gap:8px; margin-bottom:18px; border-bottom:1px solid rgba(255,255,255,0.1); padding-bottom:10px;">
      <button type="button" class="btn ${currentOrdersTab === 'cloud' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOrdersTab('cloud')" style="flex:1; padding:8px 12px; font-size:0.85rem; font-weight:700;">
        ☁️ Cloud & RDPs (${userLoadedCloudOrders.length})
      </button>
      <button type="button" class="btn ${currentOrdersTab === 'smm' ? 'btn-primary' : 'btn-secondary'}" onclick="switchOrdersTab('smm')" style="flex:1; padding:8px 12px; font-size:0.85rem; font-weight:700;">
        ⚡ Social Growth SMM (${userLoadedSmmOrders.length})
      </button>
    </div>
  `;

  if (currentOrdersTab === 'cloud') {
    if (userLoadedCloudOrders.length === 0) {
      container.innerHTML = headerTabs + `<p style="text-align:center; color:var(--text-muted); padding:30px;">You haven't placed any Cloud or RDP orders yet.</p>`;
      return;
    }

    const listHtml = userLoadedCloudOrders.map(ord => {
      const isDelivered = ord.deliveryStatus === 'DELIVERED';
      const isRejected = ord.deliveryStatus === 'REJECTED';
      const isPending = ord.deliveryStatus === 'PENDING_APPROVAL' || ord.deliveryStatus === 'PENDING_DELIVERY';
      const isUpi = ord.paymentMethod === 'UPI' || (ord.utrId && ord.utrId.length > 0);

      let statusBadgeClass = 'badge-success';
      if (isPending) statusBadgeClass = 'badge-warning';
      if (isRejected) statusBadgeClass = 'badge-danger';

      return `
        <div style="background:rgba(255,255,255,0.03); border:1px solid var(--glass-border); border-radius:var(--radius-md); padding:16px; margin-bottom:14px;">
          <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
            <div>
              <strong style="font-size:1.05rem; color:#ffffff;">${escapeHtml(ord.productName)}</strong>
              ${ord.subProduct ? `<span style="font-size:0.85rem; color:var(--pink-accent); margin-left:6px;">(${escapeHtml(ord.subProduct)})</span>` : ''}
              <span class="badge ${isUpi ? 'badge-primary' : 'badge-yellow'}" style="margin-left:6px; font-size:0.72rem;">
                ${isUpi ? '🏦 UPI' : '💎 BEP20'}
              </span>
            </div>
            <span class="badge ${statusBadgeClass}">${escapeHtml(ord.deliveryStatus)}</span>
          </div>
          <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
            Country: ${escapeHtml(ord.country || '🌐 Global')} | Qty: ${ord.quantity} | Paid: <strong>${formatPriceDisplay(ord.totalPaid)}</strong> | Date: ${new Date(ord.createdAt).toLocaleDateString()}
            ${ord.utrId ? `<br><span style="color:#22c55e;">UTR: <code>${escapeHtml(ord.utrId)}</code></span>` : ''}
          </div>
          <div style="margin-top:10px;">
            <label style="font-size:0.75rem; color:var(--yellow-primary); text-transform:uppercase; font-weight:700;">Your Delivered Item / Key:</label>
            <div class="code-box" style="margin:4px 0 0 0; white-space:pre-wrap;">${escapeHtml(ord.deliveredItem)}</div>
          </div>
          <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
            <a href="/invoice/${ord._id}" target="_blank" class="btn btn-secondary" style="flex:1; min-width:130px; padding:7px 12px; font-size:0.82rem; text-decoration:none; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
              🧾 Invoice Slip
            </a>
            <a href="/invoice/${ord._id}/pdf" target="_blank" class="btn btn-secondary" style="flex:1; min-width:130px; padding:7px 12px; font-size:0.82rem; text-decoration:none; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-color:var(--yellow-primary); color:var(--yellow-primary);">
              📥 PDF Invoice
            </a>
            ${(!isDelivered && !isRejected && ord.deliveryStatus !== 'CANCELLED') ? `
              <button type="button" class="btn btn-secondary" onclick="cancelCustomerCloudOrder('${escapeHtml(ord._id)}')" style="flex:1; min-width:110px; padding:7px 12px; font-size:0.82rem; border-color:#ef4444; color:#ef4444; font-weight:700;">
                ❌ Cancel Order
              </button>
            ` : ''}
            <button type="button" class="btn btn-secondary" onclick="reportOrderIssue('${escapeHtml(ord._id)}', '${escapeHtml(ord.productId)}', '${escapeHtml(ord.productName)}', '${escapeHtml(ord.subProduct || '')}', '${escapeHtml(ord.country || '')}', '${escapeHtml(ord.txHash || '')}', '${escapeHtml(ord.totalPaid)}')" style="flex:1; min-width:130px; padding:7px 12px; font-size:0.82rem; border-color:#f87171; color:#f87171; font-weight:700; display:flex; align-items:center; justify-content:center; gap:6px;">
              ⚠️ Report Issue
            </button>
          </div>
        </div>
      `;
    }).join('');

    container.innerHTML = headerTabs + listHtml;
    return;
  }

  // SMM Tab
  if (userLoadedSmmOrders.length === 0) {
    container.innerHTML = headerTabs + `<p style="text-align:center; color:var(--text-muted); padding:30px;">You haven't placed any Social Growth (SMM) orders yet.</p>`;
    return;
  }

  const smmHtml = userLoadedSmmOrders.map(ord => {
    const isCompleted = ord.status === 'Completed';
    const isProcessing = ord.status === 'Processing' || ord.status === 'In progress';
    const isPendingUpi = ord.paymentStatus === 'PENDING_UPI_VERIFICATION';
    const remains = ord.remains !== undefined ? ord.remains : 0;
    const progressPercent = ord.quantity > 0 ? Math.min(100, Math.max(0, Math.round(((ord.quantity - remains) / ord.quantity) * 100))) : 0;

    let badgeColor = '#38bdf8';
    if (isCompleted) badgeColor = '#22c55e';
    if (isPendingUpi) badgeColor = '#facc15';

    return `
      <div id="smm-order-card-${escapeHtml(ord._id || ord.orderId)}" style="background:rgba(20,10,40,0.6); border:1px solid rgba(56,189,248,0.3); border-radius:var(--radius-md); padding:16px; margin-bottom:14px;">
        <div style="display:flex; justify-content:space-between; align-items:center; margin-bottom:8px; flex-wrap:wrap; gap:8px;">
          <div>
            <strong style="font-size:1.05rem; color:#ffffff;">${escapeHtml(ord.serviceName || 'Social Growth Package')}</strong>
            <span class="badge" style="background:${badgeColor}20; border:1px solid ${badgeColor}; color:${badgeColor}; font-size:0.72rem; margin-left:6px;">
              ${escapeHtml(ord.status || 'Processing')}
            </span>
          </div>
          <span style="font-family:monospace; font-size:0.8rem; color:var(--text-dim);">
            #${escapeHtml(ord.orderId || ord._id)}
          </span>
        </div>

        <div style="font-size:0.85rem; color:var(--text-muted); margin-bottom:8px;">
          🎯 <strong>Target Link:</strong> <a href="${escapeHtml(ord.targetUrl)}" target="_blank" style="color:#38bdf8; word-break:break-all;">${escapeHtml(ord.targetUrl)}</a><br>
          🔢 <strong>Quantity:</strong> ${ord.quantity?.toLocaleString()} | 💰 <strong>Paid:</strong> ₹${ord.totalCost} (${ord.paymentMethod}) | 📅 <strong>Date:</strong> ${new Date(ord.createdAt).toLocaleDateString()}
          ${ord.utrId ? `<br><span style="color:#22c55e;">🏷️ UTR: <code>${escapeHtml(ord.utrId)}</code></span>` : ''}
        </div>

        <!-- Live Progress Bar -->
        <div style="margin:10px 0 6px 0;">
          <div style="display:flex; justify-content:space-between; font-size:0.75rem; color:var(--text-dim); margin-bottom:4px;">
            <span>Delivered: ${Math.max(0, ord.quantity - remains).toLocaleString()} / ${ord.quantity?.toLocaleString()}</span>
            <span style="color:${badgeColor}; font-weight:700;">${progressPercent}%</span>
          </div>
          <div style="width:100%; height:6px; background:rgba(255,255,255,0.08); border-radius:10px; overflow:hidden;">
            <div style="width:${progressPercent}%; height:100%; background:linear-gradient(90deg, #38bdf8, #22c55e); transition:width 0.4s ease;"></div>
          </div>
        </div>

        <div style="display:flex; gap:8px; margin-top:12px; flex-wrap:wrap;">
          <button type="button" id="btn-sync-smm-${escapeHtml(ord._id || ord.orderId)}" onclick="syncCustomerSmmOrderStatus('${escapeHtml(ord._id || ord.orderId)}')" class="btn btn-secondary" style="flex:1; min-width:130px; padding:7px 12px; font-size:0.82rem; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-color:#38bdf8; color:#38bdf8;">
            🔄 Live Status
          </button>
          <a href="/invoice/smm/${escapeHtml(ord.orderId || ord._id)}" target="_blank" class="btn btn-secondary" style="flex:1; min-width:110px; padding:7px 12px; font-size:0.82rem; text-decoration:none; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
            🧾 Bill Slip
          </a>
          <a href="/invoice/smm/${escapeHtml(ord.orderId || ord._id)}/pdf" target="_blank" class="btn btn-secondary" style="flex:1; min-width:110px; padding:7px 12px; font-size:0.82rem; text-decoration:none; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:6px; border-color:#facc15; color:#facc15;">
            📥 PDF Bill
          </a>
          ${(!isCompleted && ord.status !== 'Canceled' && (!ord.providerOrderId || ord.providerOrderId.startsWith('TG-') || ord.providerOrderId.startsWith('WA-'))) ? `
            <button type="button" onclick="cancelCustomerSmmOrder('${escapeHtml(ord.orderId || ord._id)}')" class="btn btn-secondary" style="flex:1; min-width:100px; padding:7px 12px; font-size:0.82rem; border-color:#ef4444; color:#ef4444; font-weight:700;">
              ❌ Cancel
            </button>
          ` : ''}
          <a href="https://wa.me/919507325677?text=Hello%20Owner%20I%20have%20an%20inquiry%20regarding%20SMM%20Order%20${escapeHtml(ord.orderId)}" target="_blank" class="btn btn-secondary" style="flex:1; min-width:110px; padding:7px 12px; font-size:0.82rem; text-decoration:none; text-align:center; display:inline-flex; align-items:center; justify-content:center; gap:6px;">
            💬 Support
          </a>
        </div>
      </div>
    `;
  }).join('');

  container.innerHTML = headerTabs + smmHtml;
}

async function cancelCustomerCloudOrder(orderId) {
  if (!confirm(`Are you sure you want to CANCEL Order #${orderId}?`)) return;

  try {
    const res = await fetch(`/api/orders/${orderId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('✅ Order cancelled successfully.', 'info');
      handleOpenMyOrdersModal();
    } else {
      showToast(data.message || 'Failed to cancel order.', 'error');
    }
  } catch (err) {
    showToast('Cancellation error: ' + err.message, 'error');
  }
}

async function cancelCustomerSmmOrder(orderId) {
  if (!confirm(`Are you sure you want to CANCEL SMM Order #${orderId}?`)) return;

  try {
    const res = await fetch(`/api/smm/orders/${orderId}/cancel`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast('✅ SMM Order cancelled successfully.', 'info');
      handleOpenMyOrdersModal();
    } else {
      showToast(data.message || 'Failed to cancel SMM order.', 'error');
    }
  } catch (err) {
    showToast('Cancellation error: ' + err.message, 'error');
  }
}

async function syncCustomerSmmOrderStatus(orderId) {
  const btn = document.getElementById(`btn-sync-smm-${orderId}`);
  if (btn) {
    btn.disabled = true;
    btn.innerText = '⏳ Syncing...';
  }

  try {
    const res = await fetch(`/api/smm/orders/${orderId}/sync-status`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ Live Status: ${data.status}`, 'success');
      // Update local array and re-render
      const match = userLoadedSmmOrders.find(o => o._id === orderId || o.orderId === orderId);
      if (match && data.order) {
        Object.assign(match, data.order);
        renderCombinedOrdersView();
      }
    } else {
      showToast(data.message || 'Could not sync status at this moment.', 'info');
    }
  } catch (err) {
    showToast('Sync error: ' + err.message, 'error');
  } finally {
    if (btn) {
      btn.disabled = false;
      btn.innerText = '🔄 Refresh Live Status';
    }
  }
}

async function fetchSupportSettings() {
  try {
    const res = await fetch('/api/settings?t=' + Date.now());
    const data = await res.json();
    if (data.success && data.settings) {
      if (data.settings.supportUrl) {
        ownerSupportUrl = data.settings.supportUrl;
      }
      if (data.settings.defaultBep20Address) {
        ownerGlobalBep20Address = data.settings.defaultBep20Address;
      }
      if (data.settings.ownerUpiId) {
        ownerGlobalUpiId = data.settings.ownerUpiId;
      }
      if (data.settings.ownerWhatsApp) {
        ownerGlobalWhatsApp = data.settings.ownerWhatsApp;
      }

      const waBotUrl = data.settings.whatsappBotUrl || 'https://wa.me/qr/DDVIRR5NFY2YO1';
      const waGroupUrl = data.settings.whatsappGroupUrl || 'https://wa.me/qr/DDVIRR5NFY2YO1';
      const tgBotUrl = data.settings.telegramBotUrl || 'https://t.me/princecloudsellarshop_bot';
      const tgGroupUrl = data.settings.telegramGroupUrl || 'https://t.me/princecloudsellarshop_bot';

      const waBtn = document.getElementById('btn-join-whatsapp');
      if (waBtn) {
        waBtn.href = waBotUrl;
        waBtn.style.display = 'inline-flex';
      }

      const waChanBtn = document.getElementById('btn-join-wa-channel');
      if (waChanBtn) {
        waChanBtn.href = waGroupUrl;
        waChanBtn.style.display = 'inline-flex';
      }

      const topWa = document.getElementById('top-wa-link');
      if (topWa) topWa.href = waBotUrl;

      const tgBtn = document.getElementById('btn-join-telegram');
      if (tgBtn) {
        tgBtn.href = tgBotUrl;
        tgBtn.style.display = 'inline-flex';
      }

      const topTg = document.getElementById('top-tg-link');
      if (topTg) topTg.href = tgBotUrl;

      const tgChanBtn = document.getElementById('btn-join-tg-channel');
      if (tgChanBtn) {
        tgChanBtn.href = tgGroupUrl;
        tgChanBtn.style.display = 'inline-flex';
      }
    }
  } catch (err) {
    console.error('Fetch support settings error:', err);
  }
}

function contactOwnerSupport() {
  window.open(ownerSupportUrl, '_blank');
}

// ----------------------------------------------------
// SUPPORT TICKET & DISPUTE RESOLUTION CLIENT LOGIC
// ----------------------------------------------------

function onTicketCategoryChange(val) {
  const customGroup = document.getElementById('custom-problem-field-group');
  if (customGroup) {
    if (val === 'CUSTOM_PROBLEM') {
      customGroup.style.display = 'block';
      const input = document.getElementById('ticket-custom-problem');
      if (input) input.required = true;
    } else {
      customGroup.style.display = 'none';
      const input = document.getElementById('ticket-custom-problem');
      if (input) input.required = false;
    }
  }
}

function reportOrderIssue(ordId, prodId, prodName, subProd, country, txHash, totalPaid) {
  closeModal('my-orders-modal');

  const prodIdEl = document.getElementById('ticket-product-id');
  const prodNameEl = document.getElementById('ticket-product-name');
  const subProdEl = document.getElementById('ticket-sub-product');
  const countryEl = document.getElementById('ticket-country');
  const ordIdEl = document.getElementById('ticket-order-id');
  const txHashEl = document.getElementById('ticket-tx-hash');
  const amtEl = document.getElementById('ticket-amount');
  const subjEl = document.getElementById('ticket-subject');

  if (prodIdEl) prodIdEl.value = prodId || '';
  if (prodNameEl) prodNameEl.value = prodName || '';
  if (subProdEl) subProdEl.value = subProd || '';
  if (countryEl) countryEl.value = country || '';
  if (ordIdEl) ordIdEl.value = ordId || '';
  if (txHashEl) txHashEl.value = txHash || '';
  if (amtEl) amtEl.value = totalPaid ? `₹${totalPaid}` : '';

  const fullProdDesc = `${prodName} ${subProd ? `(${subProd})` : ''} [${country || '🌐 Global'}]`;
  if (subjEl) subjEl.value = `Issue with ${fullProdDesc} - Order #${ordId}`;

  const banner = document.getElementById('ticket-order-product-banner');
  const bannerText = document.getElementById('ticket-product-banner-text');
  if (banner && bannerText) {
    bannerText.innerText = `${fullProdDesc} (Order ID: ${ordId})`;
    banner.style.display = 'block';
  }

  const catSelect = document.getElementById('ticket-category');
  if (catSelect) catSelect.value = 'KEY_REPLACEMENT';

  openSupportTicketModal();
}

function openSupportTicketModal(prefillCategory = null) {
  if (currentUser) {
    const nameEl = document.getElementById('ticket-name');
    const emailEl = document.getElementById('ticket-email');
    const phoneEl = document.getElementById('ticket-phone');
    if (nameEl) nameEl.value = currentUser.name || '';
    if (emailEl) emailEl.value = currentUser.email || '';
    if (phoneEl) phoneEl.value = currentUser.phone || '';

    const trackInput = document.getElementById('ticket-track-query');
    if (trackInput && !trackInput.value) trackInput.value = currentUser.email || currentUser.phone || '';
  }

  if (prefillCategory) {
    const catSelect = document.getElementById('ticket-category');
    if (catSelect) catSelect.value = prefillCategory;
  }

  switchTicketModalTab('CREATE');
  openModal('support-ticket-modal');
}

function switchTicketModalTab(tab) {
  const createView = document.getElementById('ticket-view-create');
  const trackView = document.getElementById('ticket-view-track');
  const btnCreate = document.getElementById('tab-btn-create-ticket');
  const btnTrack = document.getElementById('tab-btn-track-ticket');

  if (tab === 'CREATE') {
    if (createView) createView.style.display = 'block';
    if (trackView) trackView.style.display = 'none';
    if (btnCreate) { btnCreate.className = 'btn btn-primary'; btnCreate.style.flex = '1'; }
    if (btnTrack) { btnTrack.className = 'btn btn-secondary'; btnTrack.style.flex = '1'; }
  } else {
    if (createView) createView.style.display = 'none';
    if (trackView) trackView.style.display = 'block';
    if (btnCreate) { btnCreate.className = 'btn btn-secondary'; btnCreate.style.flex = '1'; }
    if (btnTrack) { btnTrack.className = 'btn btn-primary'; btnTrack.style.flex = '1'; }
    fetchUserTickets();
  }
}

async function handleCreateTicketSubmit() {
  const category = document.getElementById('ticket-category').value;
  const customProblem = (document.getElementById('ticket-custom-problem') ? document.getElementById('ticket-custom-problem').value : '').trim();
  const productId = (document.getElementById('ticket-product-id') ? document.getElementById('ticket-product-id').value : '').trim();
  const productName = (document.getElementById('ticket-product-name') ? document.getElementById('ticket-product-name').value : '').trim();
  const subProduct = (document.getElementById('ticket-sub-product') ? document.getElementById('ticket-sub-product').value : '').trim();
  const country = (document.getElementById('ticket-country') ? document.getElementById('ticket-country').value : '').trim();
  const subject = document.getElementById('ticket-subject').value.trim();
  const orderId = document.getElementById('ticket-order-id').value.trim();
  const amountPaid = document.getElementById('ticket-amount').value.trim();
  const txHash = document.getElementById('ticket-tx-hash').value.trim();
  const userName = document.getElementById('ticket-name').value.trim();
  const userPhone = document.getElementById('ticket-phone').value.trim();
  const userEmail = document.getElementById('ticket-email').value.trim();
  const message = document.getElementById('ticket-message').value.trim();
  const userId = currentUser ? currentUser._id : '';

  try {
    const res = await fetch('/api/user/tickets', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        userName,
        userPhone,
        userEmail,
        category,
        customProblem,
        orderId,
        productId,
        productName,
        subProduct,
        country,
        amountPaid,
        txHash,
        subject,
        message
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Complaint ticket submitted to Owner successfully! Ticket ID: ' + (data.ticket ? data.ticket._id : ''), 'success');
      document.getElementById('create-ticket-form').reset();
      
      const banner = document.getElementById('ticket-order-product-banner');
      if (banner) banner.style.display = 'none';

      const trackInput = document.getElementById('ticket-track-query');
      if (trackInput) trackInput.value = userEmail || userPhone;

      switchTicketModalTab('TRACK');
    } else {
      showToast(data.message || 'Failed to submit ticket.', 'error');
    }
  } catch (err) {
    showToast('Ticket submission error: ' + err.message, 'error');
  }
}

async function fetchUserTickets() {
  let query = (document.getElementById('ticket-track-query') ? document.getElementById('ticket-track-query').value : '').trim();
  if (!query && currentUser) {
    query = currentUser.email || currentUser.phone || '';
  }

  const container = document.getElementById('ticket-history-list');
  if (!container) return;

  if (!query) {
    container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:30px;">Please enter your registered Gmail or Phone number to fetch tickets.</div>`;
    return;
  }

  container.innerHTML = `<div style="text-align:center; color:var(--yellow-primary); padding:20px;">🔍 Fetching your submitted tickets...</div>`;

  try {
    const isEmail = query.includes('@');
    const param = isEmail ? `email=${encodeURIComponent(query)}` : `phone=${encodeURIComponent(query)}`;
    const userIdParam = currentUser ? `&userId=${encodeURIComponent(currentUser._id)}` : '';

    const res = await fetch(`/api/user/tickets?${param}${userIdParam}`);
    const data = await res.json();

    if (data.success) {
      renderUserTicketsList(data.tickets);
    } else {
      container.innerHTML = `<div style="text-align:center; color:#f87171; padding:20px;">Failed to load tickets: ${escapeHtml(data.message)}</div>`;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; color:#f87171; padding:20px;">Network error loading tickets: ${escapeHtml(err.message)}</div>`;
  }
}

function renderUserTicketsList(tickets) {
  const container = document.getElementById('ticket-history-list');
  if (!container) return;

  if (!tickets || tickets.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:30px;">
        <div style="font-size:2rem; margin-bottom:8px;">🎫</div>
        <p>No complaint tickets found for this contact.</p>
        <button class="btn btn-primary" onclick="switchTicketModalTab('CREATE')" style="margin-top:12px; font-size:0.85rem;">
          📝 Submit A Ticket Now
        </button>
      </div>
    `;
    return;
  }

  container.innerHTML = tickets.map(t => {
    let statusBadge = '<span class="badge badge-warning">🟡 PENDING REVIEW</span>';
    if (t.status === 'RESOLVED') statusBadge = '<span class="badge badge-success">🟢 RESOLVED</span>';
    if (t.status === 'IN_PROGRESS') statusBadge = '<span class="badge badge-yellow">🔄 IN PROGRESS</span>';
    if (t.status === 'REJECTED') statusBadge = '<span class="badge badge-danger">🔴 REJECTED</span>';

    return `
      <div class="ticket-record-card">
        <div class="ticket-header-row">
          <div>
            <span style="font-family:monospace; color:var(--yellow-primary); font-weight:800; font-size:0.85rem;">[${escapeHtml(t._id)}]</span>
            <strong style="color:#ffffff; margin-left:6px; font-size:0.95rem;">${escapeHtml(t.subject)}</strong>
          </div>
          ${statusBadge}
        </div>

        <div style="font-size:0.8rem; color:var(--text-dim); margin-bottom:8px; display:flex; gap:12px; flex-wrap:wrap;">
          <span><strong>Category:</strong> ${escapeHtml(t.category)}</span>
          ${t.orderId ? `<span><strong>Order:</strong> ${escapeHtml(t.orderId)}</span>` : ''}
          ${t.amountPaid ? `<span><strong>Amount:</strong> ${escapeHtml(t.amountPaid)}</span>` : ''}
          <span><strong>Date:</strong> ${new Date(t.createdAt).toLocaleString()}</span>
        </div>

        <div style="font-size:0.86rem; color:var(--text-muted); line-height:1.45; background:rgba(0,0,0,0.3); padding:10px; border-radius:8px;">
          <strong>Your Complaint:</strong> ${escapeHtml(t.message)}
          ${t.txHash ? `<div style="font-family:monospace; font-size:0.78rem; color:#38bdf8; margin-top:4px; word-break:break-all;"><strong>TX Hash:</strong> ${escapeHtml(t.txHash)}</div>` : ''}
        </div>

        ${t.ownerReply ? `
          <div class="ticket-reply-box">
            <strong style="color:var(--yellow-primary); display:block; margin-bottom:4px;">👑 Owner Resolution &amp; Reply:</strong>
            <div style="color:#ffffff; line-height:1.45; white-space:pre-wrap;">${escapeHtml(t.ownerReply)}</div>
            ${t.resolvedAt ? `<div style="font-size:0.75rem; color:var(--text-dim); margin-top:6px;">Resolved on: ${new Date(t.resolvedAt).toLocaleString()}</div>` : ''}
          </div>
        ` : `
          <div style="font-size:0.8rem; color:var(--text-dim); margin-top:8px; font-style:italic;">
            ⏳ Owner is reviewing your submission. You will see the resolution note right here once updated.
          </div>
        `}
      </div>
    `;
  }).join('');
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
  if (modal) {
    modal.classList.add('active');
    if (id === 'user-login-modal') {
      const otpStep = document.getElementById('login-modal-otp-step');
      if (otpStep) otpStep.style.display = 'none';
      const otpInput = document.getElementById('login-otp-input');
      if (otpInput) otpInput.value = '';
    }
  }
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

// ----------------------------------------------------
// USER NOTIFICATIONS & BROADCAST CLIENT LOGIC
// ----------------------------------------------------
let currentUserNotifications = [];

async function fetchUserNotifications() {
  try {
    const userId = currentUser ? currentUser._id : '';
    const email = currentUser ? currentUser.email : '';
    const res = await fetch(`/api/user/notifications?userId=${encodeURIComponent(userId)}&email=${encodeURIComponent(email)}&t=${Date.now()}`);
    const data = await res.json();
    if (data.success) {
      currentUserNotifications = data.notifications || [];
      updateNotifBadge();
    }
  } catch (err) {
    console.error('Fetch notifications error:', err);
  }
}

function updateNotifBadge() {
  const badge = document.getElementById('user-notif-badge');
  if (!badge) return;

  const unreadCount = currentUserNotifications.filter(n => !n.isRead).length;
  if (unreadCount > 0) {
    badge.innerText = unreadCount > 9 ? '9+' : unreadCount;
    badge.style.display = 'flex';
  } else {
    badge.style.display = 'none';
  }
}

function openNotificationsModal() {
  renderNotificationsList();
  openModal('user-notifications-modal');
}

function renderNotificationsList() {
  const container = document.getElementById('user-notifications-list');
  if (!container) return;

  if (currentUserNotifications.length === 0) {
    container.innerHTML = `
      <div style="text-align:center; color:var(--text-muted); padding:40px 20px;">
        <div style="font-size:2.5rem; margin-bottom:8px;">📭</div>
        <p>No new notifications right now.</p>
      </div>
    `;
    return;
  }

  container.innerHTML = currentUserNotifications.map(n => {
    let icon = '📢';
    let typeClass = 'badge-yellow';
    let typeName = 'Announcement';

    if (n.type === 'ORDER_DISPATCH') {
      icon = '👑';
      typeClass = 'badge-success';
      typeName = 'Direct Delivery';
    } else if (n.type === 'STOCK_ALERT') {
      icon = '📦';
      typeClass = 'badge-cyan';
      typeName = 'Stock Drop';
    } else if (n.type === 'PROMO') {
      icon = '🎁';
      typeClass = 'badge-pink';
      typeName = 'Special Offer';
    }

    return `
      <div class="notif-card ${!n.isRead ? 'unread' : ''}">
        <div class="notif-header">
          <div style="display:flex; align-items:center; gap:8px;">
            <span style="font-size:1.2rem;">${icon}</span>
            <span class="badge ${typeClass}" style="font-size:0.7rem;">${typeName}</span>
            <strong class="notif-title">${escapeHtml(n.title)}</strong>
          </div>
          <span class="notif-time">${new Date(n.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • ${new Date(n.createdAt).toLocaleDateString()}</span>
        </div>
        <p class="notif-message">${escapeHtml(n.message)}</p>
        ${n.deliveredItem ? `
          <div style="margin-top:8px;">
            <label style="font-size:0.75rem; color:#facc15; font-weight:800; text-transform:uppercase;">Delivered Key / Payload:</label>
            <div class="code-box" style="margin:4px 0 0 0; font-size:0.8rem;">${escapeHtml(n.deliveredItem)}</div>
          </div>
        ` : ''}
      </div>
    `;
  }).join('');
}

async function markNotificationsAsRead() {
  try {
    const userId = currentUser ? currentUser._id : '';
    const email = currentUser ? currentUser.email : '';
    await fetch('/api/user/notifications/mark-read', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, email })
    });

    currentUserNotifications.forEach(n => n.isRead = true);
    updateNotifBadge();
    renderNotificationsList();
    showToast('All notifications marked as read.', 'success');
  } catch (err) {
    showToast('Error marking read: ' + err.message, 'error');
  }
}

// ============================================================
// STORE LAYOUT VIEW SWITCHER (DUAL SPLIT / PRODUCTS / SMM)
// ============================================================

function switchStoreView(view) {
  const allBtn = document.getElementById('view-tab-all');
  const prodBtn = document.getElementById('view-tab-products');
  const smmBtn = document.getElementById('view-tab-smm');
  const layout = document.getElementById('store-main-layout');
  const prodCol = document.getElementById('store-products-column');
  const smmCol = document.getElementById('store-smm-column');

  if (allBtn) allBtn.classList.remove('active');
  if (prodBtn) prodBtn.classList.remove('active');
  if (smmBtn) smmBtn.classList.remove('active');

  if (view === 'all') {
    if (allBtn) allBtn.classList.add('active');
    if (layout) {
      layout.style.display = 'grid';
      layout.className = 'store-dual-layout';
    }
    if (prodCol) prodCol.style.display = 'block';
    if (smmCol) {
      smmCol.style.display = 'block';
      smmCol.style.maxWidth = '100%';
      smmCol.style.margin = '0';
    }
  } else if (view === 'products') {
    if (prodBtn) prodBtn.classList.add('active');
    if (layout) {
      layout.style.display = 'block';
    }
    if (prodCol) prodCol.style.display = 'block';
    if (smmCol) smmCol.style.display = 'none';
  } else if (view === 'smm') {
    if (smmBtn) smmBtn.classList.add('active');
    if (layout) {
      layout.style.display = 'block';
    }
    if (prodCol) prodCol.style.display = 'none';
    if (smmCol) {
      smmCol.style.display = 'block';
      smmCol.style.maxWidth = '780px';
      smmCol.style.margin = '0 auto';
    }
  }
}

// ============================================================
// INDIANSMMHUB LIVE SMM SERVICES & SOCIAL GROWTH AUTOMATION ENGINE
// ============================================================

let allPeakerrServices = [];
let peakerrCategories = [];
let currentSmmPlatform = 'Instagram';
let currentSelectedCategory = '';
let currentSearchQuery = '';
let selectedSmmServiceObj = null;

// Fetch live IndianSMMHub Services from Backend API
async function fetchSmmServices() {
  try {
    const res = await fetch('/api/smm/services');
    const data = await res.json();
    if (data.success && Array.isArray(data.services) && data.services.length > 0) {
      allPeakerrServices = data.services;
      peakerrCategories = data.categories || [];

      const badge = document.getElementById('smm-total-services-badge');
      if (badge) {
        badge.innerText = `${allPeakerrServices.length.toLocaleString()} Live Services`;
      }

      selectSmmPlatform(currentSmmPlatform);
    }
  } catch (err) {
    console.error('IndianSMM services fetch error:', err.message);
  }
}

// Select SMM Platform Tab Pill
function selectSmmPlatform(platform) {
  currentSmmPlatform = platform;

  document.querySelectorAll('.smm-platform-selector .platform-pill-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const platIdMap = {
    'Instagram': 'smm-plat-instagram',
    'Telegram': 'smm-plat-telegram',
    'YouTube': 'smm-plat-youtube',
    'Facebook': 'smm-plat-facebook',
    'Twitter / X': 'smm-plat-twitter',
    'TikTok': 'smm-plat-tiktok',
    'Spotify': 'smm-plat-spotify',
    'Threads': 'smm-plat-threads',
    'Website Traffic': 'smm-plat-traffic',
    'WhatsApp': 'smm-plat-whatsapp',
    'ALL': 'smm-plat-all'
  };

  const activeBtn = document.getElementById(platIdMap[platform]);
  if (activeBtn) activeBtn.classList.add('active');

  // Set target link placeholder
  const linkInput = document.getElementById('smm-target-url');
  const linkLabel = document.getElementById('smm-link-type-label');

  if (platform === 'Instagram') {
    if (linkInput) linkInput.placeholder = 'https://instagram.com/username or https://instagram.com/p/...';
    if (linkLabel) linkLabel.innerText = 'Instagram Profile / Post / Reel URL';
  } else if (platform === 'Telegram') {
    if (linkInput) linkInput.placeholder = 'https://t.me/channel_name or https://t.me/joinchat/...';
    if (linkLabel) linkLabel.innerText = 'Telegram Channel / Group Link';
  } else if (platform === 'YouTube') {
    if (linkInput) linkInput.placeholder = 'https://youtube.com/@channel or https://youtu.be/video_id';
    if (linkLabel) linkLabel.innerText = 'YouTube Channel / Video / Shorts URL';
  } else if (platform === 'Facebook') {
    if (linkInput) linkInput.placeholder = 'https://facebook.com/page or post URL';
    if (linkLabel) linkLabel.innerText = 'Facebook Page / Profile / Post / Reel URL';
  } else if (platform === 'TikTok') {
    if (linkInput) linkInput.placeholder = 'https://tiktok.com/@username/video/...';
    if (linkLabel) linkLabel.innerText = 'TikTok Profile / Video URL';
  } else if (platform === 'Twitter / X') {
    if (linkInput) linkInput.placeholder = 'https://x.com/username or https://x.com/status/...';
    if (linkLabel) linkLabel.innerText = 'Twitter / X Profile or Tweet URL';
  } else if (platform === 'Spotify') {
    if (linkInput) linkInput.placeholder = 'https://open.spotify.com/artist/... or playlist URL';
    if (linkLabel) linkLabel.innerText = 'Spotify Artist / Track / Playlist URL';
  } else if (platform === 'Threads') {
    if (linkInput) linkInput.placeholder = 'https://www.threads.net/@username or post URL';
    if (linkLabel) linkLabel.innerText = 'Threads Profile / Post URL';
  } else if (platform === 'Website Traffic') {
    if (linkInput) linkInput.placeholder = 'https://yourwebsite.com';
    if (linkLabel) linkLabel.innerText = 'Target Website URL';
  } else if (platform === 'WhatsApp') {
    if (linkInput) linkInput.placeholder = 'https://chat.whatsapp.com/... or channel link';
    if (linkLabel) linkLabel.innerText = 'WhatsApp Channel / Group Link';
  } else {
    if (linkInput) linkInput.placeholder = 'https://... (Target Link)';
    if (linkLabel) linkLabel.innerText = 'Target Link (URL)';
  }

  populateSmmCategories();
}

// Populate Categories Dropdown based on Platform
function populateSmmCategories() {
  const catSelect = document.getElementById('smm-category-select');
  if (!catSelect) return;

  catSelect.innerHTML = '';

  let cats = peakerrCategories;
  if (currentSmmPlatform !== 'ALL') {
    cats = cats.filter(c => c.platform && c.platform.toLowerCase() === currentSmmPlatform.toLowerCase());
  }

  if (cats.length === 0) {
    catSelect.innerHTML = '<option value="">All Categories</option>';
    currentSelectedCategory = '';
    populateSmmServices();
    return;
  }

  cats.forEach((catObj) => {
    const opt = document.createElement('option');
    opt.value = catObj.category;
    opt.textContent = `${catObj.category} (${catObj.count || 0})`;
    catSelect.appendChild(opt);
  });

  currentSelectedCategory = cats[0].category;
  catSelect.value = currentSelectedCategory;
  populateSmmServices();
}

// Category selection changed
function onSmmCategoryChanged() {
  const catSelect = document.getElementById('smm-category-select');
  if (catSelect) {
    currentSelectedCategory = catSelect.value;
  }
  populateSmmServices();
}

// Live Search Input handler
function onSmmSearchInput() {
  const searchInput = document.getElementById('smm-search-input');
  currentSearchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
  populateSmmServices();
}

// Populate Services Dropdown based on Category and Search
function populateSmmServices() {
  const srvSelect = document.getElementById('smm-service-select');
  if (!srvSelect) return;

  srvSelect.innerHTML = '';

  let list = allPeakerrServices;

  // Filter by search query or category
  if (currentSearchQuery.length > 0) {
    list = list.filter(s =>
      s.name.toLowerCase().includes(currentSearchQuery) ||
      s.category.toLowerCase().includes(currentSearchQuery) ||
      String(s.service).includes(currentSearchQuery)
    );
  } else if (currentSelectedCategory) {
    list = list.filter(s => s.category === currentSelectedCategory);
  } else if (currentSmmPlatform !== 'ALL') {
    list = list.filter(s => s.platform.toLowerCase() === currentSmmPlatform.toLowerCase());
  }

  if (list.length === 0) {
    srvSelect.innerHTML = '<option value="">❌ No services found matching criteria</option>';
    selectedSmmServiceObj = null;
    return;
  }

  list.forEach((srv) => {
    const opt = document.createElement('option');
    opt.value = srv.service;
    opt.textContent = `[#${srv.service}] ${srv.name} — ₹${srv.rateInr}/1K (${srv.refill ? '🛡️ Refill' : '⚡ Fast'})`;
    srvSelect.appendChild(opt);
  });

  srvSelect.selectedIndex = 0;
  onSmmServiceChanged();
}

// Service Selection Change Trigger
function onSmmServiceChanged() {
  const srvSelect = document.getElementById('smm-service-select');
  if (!srvSelect) return;

  const serviceId = parseInt(srvSelect.value, 10);
  const srv = allPeakerrServices.find(s => s.service === serviceId);
  selectedSmmServiceObj = srv || allPeakerrServices[0];

  if (!selectedSmmServiceObj) return;

  // Update Info Box
  const tierBadge = document.getElementById('smm-tier-badge');
  const tierDesc = document.getElementById('smm-tier-desc');
  const tierSpeed = document.getElementById('smm-tier-speed');
  const refillTag = document.getElementById('smm-tier-refill-tag');
  const minmaxTag = document.getElementById('smm-tier-minmax-tag');
  const typeTag = document.getElementById('smm-tier-type-tag');
  const limitsHint = document.getElementById('smm-qty-limits-hint');
  const rateInd = document.getElementById('smm-rate-indicator');

  if (tierBadge) {
    tierBadge.textContent = selectedSmmServiceObj.refill ? '🛡️ Refill Protected Service' : '⚡ High Speed Delivery';
    tierBadge.className = selectedSmmServiceObj.refill ? 'badge badge-success' : 'badge badge-yellow';
  }

  if (tierDesc) {
    tierDesc.textContent = `${selectedSmmServiceObj.name} • High-Retention Server Delivery (${selectedSmmServiceObj.category}).`;
  }

  if (tierSpeed) {
    tierSpeed.textContent = selectedSmmServiceObj.cancel ? '⚡ Instant (Cancelable)' : '⚡ Instant Automated Start';
  }

  if (refillTag) {
    refillTag.textContent = selectedSmmServiceObj.refill ? '🛡️ Auto-Refill Guarantee' : '⚡ Standard Drop (No Refill)';
    refillTag.className = selectedSmmServiceObj.refill ? 'badge badge-success' : 'badge badge-secondary';
  }

  if (minmaxTag) {
    minmaxTag.textContent = `🔢 Min: ${selectedSmmServiceObj.min.toLocaleString()} | Max: ${selectedSmmServiceObj.max.toLocaleString()}`;
  }

  if (typeTag) {
    typeTag.textContent = selectedSmmServiceObj.type || 'Default';
  }

  if (limitsHint) {
    limitsHint.textContent = `Min: ${selectedSmmServiceObj.min.toLocaleString()} | Max: ${selectedSmmServiceObj.max.toLocaleString()}`;
  }

  if (rateInd) {
    rateInd.textContent = `Rate: ₹${selectedSmmServiceObj.rateInr} / 1,000 (~ $${selectedSmmServiceObj.rateUsd})`;
  }

  // Comments visibility
  const commentsGroup = document.getElementById('smm-custom-comments-group');
  if (commentsGroup) {
    if (selectedSmmServiceObj.type === 'Custom Comments' || selectedSmmServiceObj.name.toLowerCase().includes('custom comment')) {
      commentsGroup.style.display = 'block';
    } else {
      commentsGroup.style.display = 'none';
    }
  }

  // Set default qty based on service minimum
  const qtyInput = document.getElementById('smm-quantity-input');
  const serviceMin = selectedSmmServiceObj.min || 1000;
  const serviceMax = selectedSmmServiceObj.max || 100000;

  if (qtyInput) {
    qtyInput.min = serviceMin;
    qtyInput.max = serviceMax;
    const currentVal = parseInt(qtyInput.value, 10) || 0;
    if (currentVal < serviceMin) {
      qtyInput.value = serviceMin;
    }
  }

  // Update dynamic quantity chips container
  const chipsContainer = document.querySelector('.smm-qty-chips');
  if (chipsContainer) {
    let chipValues = [];
    if (serviceMin >= 1000) {
      chipValues = [serviceMin, serviceMin * 2, serviceMin * 5, serviceMin * 10, serviceMin * 25].filter(v => v <= serviceMax);
    } else {
      chipValues = [serviceMin, 500, 1000, 2500, 5000].filter(v => v >= serviceMin && v <= serviceMax);
    }
    if (chipValues.length === 0) chipValues = [serviceMin, serviceMin * 2];

    const currentQty = parseInt(qtyInput ? qtyInput.value : serviceMin, 10);
    chipsContainer.innerHTML = chipValues.map(val => `
      <button type="button" class="smm-chip-btn ${val === currentQty ? 'active' : ''}" onclick="setSmmQuantity(${val})">
        ${val.toLocaleString()}
      </button>
    `).join('');
  }

  calculateSmmPrice();
}

// Quick Quantity Chip Button Handler
function setSmmQuantity(qty) {
  const qtyInput = document.getElementById('smm-quantity-input');
  if (!qtyInput) return;

  const min = selectedSmmServiceObj ? (selectedSmmServiceObj.min || 1000) : 1000;
  if (qty < min) {
    qty = min;
  }
  qtyInput.value = qty;

  document.querySelectorAll('.smm-qty-chips .smm-chip-btn').forEach(btn => {
    btn.classList.remove('active');
    if (btn.textContent.trim() === qty.toLocaleString() || btn.textContent.trim() === `+${qty.toLocaleString()}`) {
      btn.classList.add('active');
    }
  });

  calculateSmmPrice();
}

// Custom comments line count sync
function onCustomCommentsInput() {
  const textarea = document.getElementById('smm-custom-comments');
  const countLabel = document.getElementById('smm-comments-count');
  const qtyInput = document.getElementById('smm-quantity-input');

  if (!textarea) return;
  const lines = textarea.value.split('\n').map(l => l.trim()).filter(l => l.length > 0);
  const count = lines.length;

  if (countLabel) countLabel.innerText = count;
  if (qtyInput && count > 0) {
    const min = selectedSmmServiceObj ? (selectedSmmServiceObj.min || 10) : 10;
    qtyInput.value = Math.max(min, count);
  }
  calculateSmmPrice();
}

// Dynamic Price Calculation
function calculateSmmPrice() {
  if (!selectedSmmServiceObj) return;

  const qtyInput = document.getElementById('smm-quantity-input');
  const priceDisplay = document.getElementById('smm-total-price-display');
  const usdtDisplay = document.getElementById('smm-total-usdt-display');
  const limitsHint = document.getElementById('smm-qty-limits-hint');

  const min = selectedSmmServiceObj.min || 1000;
  const max = selectedSmmServiceObj.max || 100000;
  const qty = parseInt(qtyInput ? qtyInput.value : min, 10) || 0;

  if (limitsHint) {
    if (qty < min) {
      limitsHint.innerHTML = `<span style="color:#ef4444; font-weight:800;">⚠️ Min: ${min.toLocaleString()} Required!</span> | Max: ${max.toLocaleString()}`;
    } else {
      limitsHint.innerHTML = `Min: ${min.toLocaleString()} | Max: ${max.toLocaleString()}`;
    }
  }

  const rateInr = selectedSmmServiceObj.rateInr || 100;
  const total = Math.max(1, Math.round(((qty / 1000) * rateInr) * 100) / 100);
  const usdt = (total / 88).toFixed(2);

  if (priceDisplay) priceDisplay.innerText = `₹${total.toFixed(2)}`;
  if (usdtDisplay) usdtDisplay.innerText = `(~ ${usdt} USDT)`;
}

// Open SMM Checkout Modal
function openSmmCheckoutModal() {
  if (!selectedSmmServiceObj) {
    showToast('Please select a valid service first.', 'error');
    return;
  }

  // Mandatory Login Enforcement
  if (!currentUser) {
    showToast('🔐 Please log in or register with Email OTP first to order followers & social growth!', 'warning');
    openModal('login-modal');
    return;
  }

  const targetUrl = (document.getElementById('smm-target-url')?.value || '').trim();
  if (!targetUrl || targetUrl.length < 4) {
    showToast('❌ Please enter a valid Target Link (Channel / Profile / Post URL)!', 'error');
    document.getElementById('smm-target-url')?.focus();
    return;
  }

  const qtyInput = document.getElementById('smm-quantity-input');
  const qty = parseInt(qtyInput ? qtyInput.value : 0, 10) || 0;
  const min = selectedSmmServiceObj.min || 1000;
  const max = selectedSmmServiceObj.max || 100000;

  if (qty < min) {
    showToast(`⚠️ Minimum quantity for ${selectedSmmServiceObj.name} is ${min.toLocaleString()}! (${min.toLocaleString()} se kam order nahi kar sakte)`, 'error');
    if (qtyInput) {
      qtyInput.value = min;
      calculateSmmPrice();
    }
    return;
  }

  if (qty > max) {
    showToast(`❌ Maximum quantity allowed for this service is ${max.toLocaleString()}!`, 'error');
    return;
  }

  const rateInr = selectedSmmServiceObj.rateInr || 100;
  const total = Math.max(1, Math.round(((qty / 1000) * rateInr) * 100) / 100);
  const usdt = (total / 88).toFixed(2);

  const titleEl = document.getElementById('smm-checkout-title');
  const badgeEl = document.getElementById('smm-checkout-tier-badge');
  const urlEl = document.getElementById('smm-checkout-url');
  const qtyEl = document.getElementById('smm-checkout-qty');
  const totalInrEl = document.getElementById('smm-checkout-total-inr');
  const totalUsdtEl = document.getElementById('smm-checkout-total-usdt');
  const upiHintEl = document.getElementById('smm-upi-amount-hint');

  if (titleEl) titleEl.innerText = `[ID #${selectedSmmServiceObj.service}] ${selectedSmmServiceObj.name}`;
  if (badgeEl) badgeEl.innerText = selectedSmmServiceObj.category;
  if (urlEl) urlEl.innerText = targetUrl;
  if (qtyEl) qtyEl.innerText = qty.toLocaleString();
  if (totalInrEl) totalInrEl.innerText = `₹${total.toFixed(2)}`;
  if (totalUsdtEl) totalUsdtEl.innerText = `(~ ${usdt} USDT)`;
  if (upiHintEl) upiHintEl.innerText = `₹${total.toFixed(2)}`;

  // Populate merchant details from owner settings
  const upiMerchantEl = document.getElementById('smm-upi-merchant-id');
  const bep20AddrEl = document.getElementById('smm-bep20-addr');
  if (upiMerchantEl) upiMerchantEl.innerText = ownerGlobalUpiId || '9507325677-1@naviaxis';
  if (bep20AddrEl) bep20AddrEl.innerText = ownerGlobalBep20Address || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';

  // Customer contact info from logged in user
  const nameInput = document.getElementById('smm-user-name');
  const phoneInput = document.getElementById('smm-user-phone');
  if (currentUser) {
    if (nameInput) nameInput.value = currentUser.name || '';
    if (phoneInput) phoneInput.value = currentUser.phone || '';
  }

  // Clear previous UTR and TxHash
  const utrInput = document.getElementById('smm-upi-utr');
  const txInput = document.getElementById('smm-tx-hash');
  if (utrInput) utrInput.value = '';
  if (txInput) txInput.value = '';

  openModal('smm-checkout-modal');
}

// Confirm and Submit SMM Order to Peakerr
async function confirmSmmOrderPlacement(paymentMethod) {
  if (!selectedSmmServiceObj) return;

  if (!currentUser) {
    showToast('🔐 Please log in first to submit your order.', 'error');
    openModal('login-modal');
    return;
  }

  const targetUrl = (document.getElementById('smm-target-url')?.value || '').trim();
  const qty = parseInt(document.getElementById('smm-quantity-input')?.value || 0, 10);
  const userName = (document.getElementById('smm-user-name')?.value || '').trim();
  const userPhone = (document.getElementById('smm-user-phone')?.value || '').trim();
  const customComments = (document.getElementById('smm-custom-comments')?.value || '').trim();

  if (!userName) {
    showToast('Please enter your name.', 'error');
    document.getElementById('smm-user-name')?.focus();
    return;
  }
  if (!userPhone || userPhone.length < 7) {
    showToast('Please enter your WhatsApp/Phone number.', 'error');
    document.getElementById('smm-user-phone')?.focus();
    return;
  }

  const utrId = (document.getElementById('smm-upi-utr')?.value || '').trim();
  const txHash = (document.getElementById('smm-tx-hash')?.value || '').trim();

  if (paymentMethod === 'UPI' && !utrId) {
    showToast('⚠️ Please enter 12-digit UPI UTR / Transaction ID after paying!', 'error');
    document.getElementById('smm-upi-utr')?.focus();
    return;
  }
  if (paymentMethod === 'BEP20' && !txHash) {
    showToast('⚠️ Please paste 0x... Crypto Transaction Hash from your wallet!', 'error');
    document.getElementById('smm-tx-hash')?.focus();
    return;
  }

  const submitBtn = paymentMethod === 'UPI' ? document.getElementById('btn-submit-smm-upi') : document.getElementById('btn-submit-smm-crypto');
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerText = '⏳ Placing SMM Order...';
  }

  try {
    const payload = {
      serviceId: selectedSmmServiceObj.service,
      targetUrl: targetUrl,
      quantity: qty,
      customComments: customComments,
      userId: currentUser ? currentUser._id : 'guest',
      userName: userName,
      userPhone: userPhone,
      userEmail: currentUser ? currentUser.email : '',
      paymentMethod: paymentMethod,
      utrId: utrId,
      txHash: txHash
    };

    const res = await fetch('/api/smm/order', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });

    const data = await res.json();
    if (data.success) {
      closeModal('smm-checkout-modal');

      // Populate Success Modal
      const succOrderId = document.getElementById('smm-success-order-id');
      const succService = document.getElementById('smm-success-service');
      const succLink = document.getElementById('smm-success-link');
      const succQty = document.getElementById('smm-success-qty');

      if (succOrderId) succOrderId.innerText = data.orderId || 'SMM-ORDER';
      if (succService) succService.innerText = `[ID #${selectedSmmServiceObj.service}] ${selectedSmmServiceObj.name}`;
      if (succLink) succLink.innerText = targetUrl;
      if (succQty) succQty.innerText = `${qty.toLocaleString()} Units`;

      openModal('smm-success-modal');
      showToast(data.message || `🎉 SMM Order placed successfully! Order ID: ${data.orderId}`, 'success');

      // Clear link input
      const linkInput = document.getElementById('smm-target-url');
      if (linkInput) linkInput.value = '';
    } else {
      showToast(`❌ Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Order submission failed: ${err.message}`, 'error');
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerText = paymentMethod === 'UPI' ? '🏦 Submit UPI Order' : '⚡ Pay BEP20 Crypto';
    }
  }
}

// Open SMM Tracker Modal & Fetch Orders
function openSmmOrdersTracker() {
  openModal('smm-tracker-modal');
  fetchUserSmmOrders();
}

async function fetchUserSmmOrders() {
  const container = document.getElementById('smm-tracker-orders-list');
  if (!container) return;

  container.innerHTML = `<div style="text-align:center; color:var(--text-muted); padding:30px;">🔍 Fetching your social growth orders...</div>`;

  try {
    const userId = currentUser ? currentUser._id : 'guest';
    const phone = currentUser ? (currentUser.phone || '') : '';
    const email = currentUser ? (currentUser.email || '') : '';

    const res = await fetch(`/api/smm/orders/user/${userId}?phone=${encodeURIComponent(phone)}&email=${encodeURIComponent(email)}`);
    const data = await res.json();

    if (data.success && data.orders && data.orders.length > 0) {
      container.innerHTML = data.orders.map(o => {
        const dateStr = new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

        const qty = o.quantity || 1;
        const remains = o.remains !== undefined ? o.remains : (o.status === 'Completed' ? 0 : qty);
        const delivered = Math.max(0, Math.min(qty, qty - remains));
        const progressPercent = o.status === 'Completed' ? 100 : Math.min(100, Math.round((delivered / qty) * 100));

        let statusBadge = `<span class="badge badge-warning">🟡 Processing</span>`;
        if (o.status === 'Completed') statusBadge = `<span class="badge badge-success">🟢 Completed (100%)</span>`;
        else if (o.status === 'In Progress' || o.status === 'In progress') statusBadge = `<span class="badge badge-primary">🔵 Delivering (${progressPercent}%)</span>`;
        else if (o.status === 'Partial') statusBadge = `<span class="badge badge-yellow">🟠 Partial (${delivered}/${qty})</span>`;
        else if (o.status === 'Canceled') statusBadge = `<span class="badge badge-danger">🔴 Canceled</span>`;

        return `
          <div class="smm-order-item-card" style="background:rgba(255,255,255,0.03); border:1px solid rgba(255,255,255,0.08); border-radius:12px; padding:16px; margin-bottom:14px;">
            <div class="smm-order-item-header" style="display:flex; justify-content:space-between; align-items:center; margin-bottom:10px;">
              <div>
                <strong style="color:var(--yellow-primary); font-family:monospace; font-size:0.95rem;">${escapeHtml(o.orderId)}</strong>
                ${o.providerOrderId ? `<span style="font-size:0.75rem; color:#38bdf8; font-family:monospace; margin-left:6px;">[IndianSMM #${escapeHtml(o.providerOrderId)}]</span>` : ''}
                <span style="font-size:0.75rem; color:var(--text-dim); margin-left:8px;">${dateStr}</span>
              </div>
              <div style="display:flex; gap:6px; align-items:center;">
                ${statusBadge}
                ${o.refillable ? `<span class="badge badge-yellow" style="font-size:0.7rem;">🛡️ Auto-Refill</span>` : ''}
              </div>
            </div>

            <div style="font-size:0.92rem; font-weight:700; color:#ffffff; margin-bottom:6px;">
              ${escapeHtml(o.serviceName || 'Social Growth Service')}
            </div>

            <div style="font-size:0.82rem; color:#38bdf8; font-family:monospace; word-break:break-all; margin-bottom:10px;">
              🔗 <a href="${escapeHtml(o.targetUrl)}" target="_blank" style="color:#38bdf8; text-decoration:underline;">${escapeHtml(o.targetUrl)}</a>
            </div>

            <!-- LIVE REAL-TIME PROGRESS BAR -->
            <div style="background:rgba(0,0,0,0.3); border-radius:6px; overflow:hidden; height:10px; margin-bottom:8px; border:1px solid rgba(255,255,255,0.1);">
              <div style="background:linear-gradient(90deg, #38bdf8, #22c55e); height:100%; width:${progressPercent}%; transition:width 0.4s ease;"></div>
            </div>

            <!-- METRIC COUNTERS -->
            <div style="display:flex; justify-content:space-between; align-items:center; font-size:0.8rem; color:var(--text-muted); margin-bottom:10px;">
              <div>Ordered: <strong style="color:#ffffff;">${qty.toLocaleString()}</strong></div>
              <div>Delivered: <strong style="color:#22c55e;">${delivered.toLocaleString()}</strong></div>
              <div>Remains: <strong style="color:#facc15;">${remains.toLocaleString()}</strong></div>
              <div>Total: <strong style="color:#22c55e;">₹${o.totalCost || 0}</strong></div>
            </div>

            <div style="display:flex; justify-content:flex-end; gap:8px; border-top:1px solid rgba(255,255,255,0.06); padding-top:8px;">
              <button type="button" class="btn btn-secondary" onclick="checkSingleOrderStatus('${o.orderId}')" style="padding:4px 10px; font-size:0.75rem;">
                🔄 Refresh Live Status
              </button>
              ${o.refillable ? `
                <button type="button" class="btn btn-secondary" onclick="triggerSmmUserRefill('${o.orderId}')" style="padding:4px 10px; font-size:0.75rem; border-color:var(--yellow-primary); color:var(--yellow-primary);">
                  🛡️ Request Refill
                </button>
              ` : ''}
            </div>
          </div>
        `;
      }).join('');
    } else {
      container.innerHTML = `
        <div style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:3rem; margin-bottom:10px;">🚀</div>
          <h3>No Growth Orders Found</h3>
          <p style="font-size:0.85rem; margin-top:6px;">Place an order from the Social Growth Portal above and track it live right here!</p>
        </div>
      `;
    }
  } catch (err) {
    container.innerHTML = `<div style="text-align:center; color:#f87171; padding:30px;">Error loading orders: ${escapeHtml(err.message)}</div>`;
  }
}

// Check single order status
async function checkSingleOrderStatus(orderId) {
  try {
    const res = await fetch(`/api/smm/status/${orderId}`);
    const data = await res.json();
    if (data.success) {
      showToast(`Order status: ${data.status || 'Active'} | Delivered: ${data.delivered || 0} / ${data.quantity || 0} (${data.progressPercent || 0}%)`, 'info');
      fetchUserSmmOrders();
    }
  } catch (e) {}
}

// User trigger auto refill
async function triggerSmmUserRefill(orderId) {
  try {
    const res = await fetch('/api/smm/refill', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ orderId })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`🔄 Refill request submitted! Refill ID: ${data.refillId}`, 'success');
      fetchUserSmmOrders();
    } else {
      showToast(`❌ Refill failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Refill error: ${err.message}`, 'error');
  }
}


