let ownerToken = localStorage.getItem('prince_owner_token') || null;
let activeTab = 'dashboard';
let currentProducts = [];
let currentAvailableStocks = [];
let currentCustomers = [];
let activeOwnerCurrency = localStorage.getItem('owner_store_currency') || 'INR';

const PRESETS = {
  "Azure": [
    "Azure Free Trial",
    "Azure Pay As Go Direct Acc",
    "Azure Pay As Go Upgrade Acc"
  ],
  "Gmail": [
    "Fresh Gmail Acc",
    "Aged Gmail Acc",
    "PVA Gmail"
  ],
  "WhatsApp Numbers": [
    "Indian WhatsApp Numbers",
    "US Virtual WhatsApp Numbers",
    "UK WhatsApp Numbers"
  ],
  "Telegram Numbers": [
    "Telegram US Numbers",
    "Telegram India Numbers",
    "Telegram Old Accounts"
  ],
  "GCP": [
    "Paid Acc",
    "Unpaid Acc"
  ],
  "Windows 365": [
    "Windows 365 Cloud PC 4vCPU",
    "Windows 365 Cloud PC 8vCPU"
  ],
  "Microsoft 365": [
    "Microsoft 365 E5 Admin",
    "Microsoft 365 Personal"
  ],
  "AWS": [
    "AWS 8 vCPU",
    "AWS 32 vCPU",
    "AWS 64 vCPU"
  ],
  "Vultr Account": [
    "Vultr $200 Credit Acc",
    "Vultr $300 Credit Acc",
    "Vultr $250 Credit Acc"
  ]
};

// FULL EXHAUSTIVE LIST OF ALL 200+ COUNTRIES IN THE WORLD WITH FLAGS
const ALL_WORLD_COUNTRIES = [
  "🌐 Global / Worldwide",
  "🇦🇫 Afghanistan",
  "🇦🇱 Albania",
  "🇩🇿 Algeria",
  "🇦🇩 Andorra",
  "🇦🇴 Angola",
  "🇦🇬 Antigua & Barbuda",
  "🇦🇷 Argentina",
  "🇦🇲 Armenia",
  "🇦🇺 Australia",
  "🇦🇹 Austria",
  "🇦🇿 Azerbaijan",
  "🇧🇸 Bahamas",
  "🇧🇭 Bahrain",
  "🇧🇩 Bangladesh",
  "🇧🇧 Barbados",
  "🇧🇾 Belarus",
  "🇧🇪 Belgium",
  "🇧🇿 Belize",
  "🇧🇯 Benin",
  "🇧🇹 Bhutan",
  "🇧🇴 Bolivia",
  "🇧🇦 Bosnia & Herzegovina",
  "🇧🇼 Botswana",
  "🇧🇷 Brazil",
  "🇧🇳 Brunei",
  "🇧🇬 Bulgaria",
  "🇧🇫 Burkina Faso",
  "🇧🇮 Burundi",
  "🇰🇭 Cambodia",
  "🇨🇲 Cameroon",
  "🇨🇦 Canada",
  "🇨🇻 Cape Verde",
  "🇨🇫 Central African Republic",
  "🇹🇩 Chad",
  "🇨🇱 Chile",
  "🇨🇳 China",
  "🇨🇴 Colombia",
  "🇰🇲 Comoros",
  "🇨🇬 Congo - Brazzaville",
  "🇨🇩 Congo - Kinshasa",
  "🇨🇷 Costa Rica",
  "🇭🇷 Croatia",
  "🇨🇺 Cuba",
  "🇨🇾 Cyprus",
  "🇨🇿 Czech Republic",
  "🇩🇰 Denmark",
  "🇩🇯 Djibouti",
  "🇩🇲 Dominica",
  "🇩🇴 Dominican Republic",
  "🇪🇨 Ecuador",
  "🇪🇬 Egypt",
  "🇸🇻 El Salvador",
  "🇬🇶 Equatorial Guinea",
  "🇪🇷 Eritrea",
  "🇪🇪 Estonia",
  "🇸🇿 Eswatini (Swaziland)",
  "🇪🇹 Ethiopia",
  "🇫🇯 Fiji",
  "🇫🇮 Finland",
  "🇫🇷 France",
  "🇬🇦 Gabon",
  "🇬🇲 Gambia",
  "🇬🇪 Georgia",
  "🇩🇪 Germany",
  "🇬🇭 Ghana",
  "🇬🇷 Greece",
  "🇬🇩 Grenada",
  "🇬🇹 Guatemala",
  "🇬🇳 Guinea",
  "🇬🇼 Guinea-Bissau",
  "🇬🇾 Guyana",
  "🇭🇹 Haiti",
  "🇭🇳 Honduras",
  "🇭🇺 Hungary",
  "🇮🇸 Iceland",
  "🇮🇳 India",
  "🇮🇩 Indonesia",
  "🇮🇷 Iran",
  "🇮🇶 Iraq",
  "🇮🇪 Ireland",
  "🇮🇱 Israel",
  "🇮🇹 Italy",
  "🇨🇮 Ivory Coast (Côte d’Ivoire)",
  "🇯🇲 Jamaica",
  "🇯🇵 Japan",
  "🇯🇴 Jordan",
  "🇰🇿 Kazakhstan",
  "🇰🇪 Kenya",
  "🇰🇮 Kiribati",
  "🇽 Kosovo",
  "🇰🇼 Kuwait",
  "🇰🇬 Kyrgyzstan",
  "🇱🇦 Laos",
  "🇱🇻 Latvia",
  "🇱🇧 Lebanon",
  "🇱🇸 Lesotho",
  "🇱🇷 Liberia",
  "🇱🇾 Libya",
  "🇱🇮 Liechtenstein",
  "🇱🇹 Lithuania",
  "🇱🇺 Luxembourg",
  "🇲🇬 Madagascar",
  "🇲🇼 Malawi",
  "🇲🇾 Malaysia",
  "🇲🇻 Maldives",
  "🇲🇱 Mali",
  "🇲🇹 Malta",
  "🇲🇭 Marshall Islands",
  "🇲🇷 Mauritania",
  "🇲🇺 Mauritius",
  "🇲🇽 Mexico",
  "🇫🇲 Micronesia",
  "🇲🇩 Moldova",
  "🇲🇨 Monaco",
  "🇲🇳 Mongolia",
  "🇲🇪 Montenegro",
  "🇲🇦 Morocco",
  "🇲🇿 Mozambique",
  "🇲🇲 Myanmar (Burma)",
  "🇳🇦 Namibia",
  "🇳🇷 Nauru",
  "🇳🇵 Nepal",
  "🇳🇱 Netherlands",
  "🇳🇿 New Zealand",
  "🇳🇮 Nicaragua",
  "🇳🇪 Niger",
  "🇳🇬 Nigeria",
  "🇰🇵 North Korea",
  "🇲🇰 North Macedonia",
  "🇳🇴 Norway",
  "🇴🇲 Oman",
  "🇵🇰 Pakistan",
  "🇵🇼 Palau",
  "🇵🇸 Palestine",
  "🇵🇦 Panama",
  "🇵🇬 Papua New Guinea",
  "🇵🇾 Paraguay",
  "🇵🇪 Peru",
  "🇵🇭 Philippines",
  "🇵🇱 Poland",
  "🇵🇹 Portugal",
  "🇶🇦 Qatar",
  "🇷🇴 Romania",
  "🇷🇼 Rwanda",
  "🇰KN Saint Kitts & Nevis",
  "🇱🇨 Saint Lucia",
  "🇻🇨 Saint Vincent & Grenadines",
  "🇼🇸 Samoa",
  "🇸🇲 San Marino",
  "🇸🇹 São Tomé & Príncipe",
  "🇸🇦 Saudi Arabia",
  "🇸🇳 Senegal",
  "🇷🇸 Serbia",
  "🇸🇨 Seychelles",
  "🇸🇱 Sierra Leone",
  "🇸🇬 Singapore",
  "🇸🇰 Slovakia",
  "🇸🇮 Slovenia",
  "🇸🇧 Solomon Islands",
  "🇸🇴 Somalia",
  "🇿🇦 South Africa",
  "🇰🇷 South Korea",
  "🇸🇸 South Sudan",
  "🇪🇸 Spain",
  "🇱🇰 Sri Lanka",
  "🇸🇩 Sudan",
  "🇸🇷 Suriname",
  "🇸🇪 Sweden",
  "🇨🇭 Switzerland",
  "🇸🇾 Syria",
  "🇹🇼 Taiwan",
  "🇹🇯 Tajikistan",
  "🇹ℤ Tanzania",
  "🇹🇭 Thailand",
  "🇹🇱 Timor-Leste",
  "🇹🇬 Togo",
  "🇹🇴 Tonga",
  "🇹TT Trinidad & Tobago",
  "🇹🇳 Tunisia",
  "🇹🇷 Turkey",
  "🇹🇲 Turkmenistan",
  "🇹🇻 Tuvalu",
  "🇺🇬 Uganda",
  "🇺🇦 Ukraine",
  "🇦🇪 United Arab Emirates",
  "🇬🇧 United Kingdom",
  "🇺🇸 United States",
  "🇺🇾 Uruguay",
  "🇺🇿 Uzbekistan",
  "🇻🇺 Vanuatu",
  "🇻🇦 Vatican City",
  "🇻🇪 Venezuela",
  "🇻🇳 Vietnam",
  "🇾🇪 Yemen",
  "🇿🇲 Zambia",
  "🇿🇼 Zimbabwe"
];

document.addEventListener('DOMContentLoaded', () => {
  initApp();
});

function initApp() {
  updateOwnerCurrencyUI();
  startLiveISTClock();
  populateCountrySelects();
  if (ownerToken) {
    showOwnerDashboard();
  } else {
    showLoginScreen();
  }

  setupEventListeners();
  refreshProductCategoryDropdowns();
  onStockMainProductChange('Azure');
  onStockModeChange('EXISTING');
}

function setOwnerStoreCurrency(curr) {
  activeOwnerCurrency = curr;
  localStorage.setItem('owner_store_currency', curr);
  updateOwnerCurrencyUI();
  fetchMetrics();
  renderAdminProducts(currentProducts);
  fetchOrders('ALL');
  fetchRecentTransactions();
  showToast(`Owner currency switched to ${curr === 'USD' ? '$ USD (United States Dollar)' : '₹ INR (Indian Rupee)'}`, 'info');
}

function updateOwnerCurrencyUI() {
  const inrBtn = document.getElementById('owner-curr-btn-inr');
  const usdBtn = document.getElementById('owner-curr-btn-usd');

  if (inrBtn && usdBtn) {
    if (activeOwnerCurrency === 'USD') {
      usdBtn.classList.add('active');
      inrBtn.classList.remove('active');
    } else {
      inrBtn.classList.add('active');
      usdBtn.classList.remove('active');
    }
  }
}

function formatOwnerPriceDisplay(priceInInr) {
  if (activeOwnerCurrency === 'USD') {
    const usd = (priceInInr / 88).toFixed(2);
    return `$${usd} USD`;
  } else {
    return `₹${priceInInr.toLocaleString()} INR`;
  }
}

function startLiveISTClock() {
  const clockEl = document.getElementById('live-ist-clock');
  const dateEl = document.getElementById('live-ist-date');

  const update = () => {
    const now = new Date();
    const optionsDate = { weekday: 'long', day: '2-digit', month: 'long', year: 'numeric', timeZone: 'Asia/Kolkata' };
    const optionsTime = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: true, timeZone: 'Asia/Kolkata' };
    
    if (dateEl) dateEl.innerText = now.toLocaleDateString('en-IN', optionsDate);
    if (clockEl) clockEl.innerText = now.toLocaleTimeString('en-IN', optionsTime) + ' IST';
  };

  update();
  setInterval(update, 1000);
}

function populateCountrySelects() {
  const prodCountrySelect = document.getElementById('prod-country-select');
  const stockCountrySelect = document.getElementById('stock-country-select');
  const editCountrySelect = document.getElementById('edit-prod-country-select');

  const optionsHtml = ALL_WORLD_COUNTRIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (prodCountrySelect) prodCountrySelect.innerHTML = optionsHtml;
  if (stockCountrySelect) stockCountrySelect.innerHTML = optionsHtml;
  if (editCountrySelect) editCountrySelect.innerHTML = optionsHtml;
}

function setupEventListeners() {
  const loginForm = document.getElementById('owner-login-form');
  if (loginForm) {
    loginForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const username = document.getElementById('login-username').value;
      const password = document.getElementById('login-password').value;
      await handleLogin(username, password);
    });
  }

  const threeDotsBtn = document.getElementById('three-dots-btn');
  const dropdownMenu = document.getElementById('owner-dropdown-menu');

  if (threeDotsBtn && dropdownMenu) {
    threeDotsBtn.addEventListener('click', (e) => {
      e.stopPropagation();
      dropdownMenu.classList.toggle('active');
      threeDotsBtn.classList.toggle('active');
    });

    document.addEventListener('click', () => {
      dropdownMenu.classList.remove('active');
      threeDotsBtn.classList.remove('active');
    });
  }

  document.querySelectorAll('.nav-menu-item').forEach(item => {
    item.addEventListener('click', (e) => {
      const tab = item.getAttribute('data-tab');
      if (tab) {
        switchTab(tab);
        if (dropdownMenu) dropdownMenu.classList.remove('active');
      }
    });
  });

  const logoutBtn = document.getElementById('logout-btn');
  if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
      localStorage.removeItem('prince_owner_token');
      ownerToken = null;
      showToast('Logged out successfully!', 'info');
      showLoginScreen();
    });
  }

  const addProductForm = document.getElementById('add-product-form');
  if (addProductForm) {
    addProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAddProduct();
    });
  }

  const addStockForm = document.getElementById('add-stock-form');
  if (addStockForm) {
    addStockForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleAddStock();
    });
  }

  const stockTextarea = document.getElementById('stock-raw-content');
  if (stockTextarea) {
    stockTextarea.addEventListener('input', () => {
      const text = stockTextarea.value;
      const count = text.split('\n').filter(line => line.trim().length > 0).length;
      const counterBadge = document.getElementById('stock-live-counter');
      if (counterBadge) {
        counterBadge.innerText = `Live Keys: ${count}`;
      }
    });
  }

  const pmForm = document.getElementById('payment-method-form');
  if (pmForm) {
    pmForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSavePaymentMethod();
    });
  }

  const editProductForm = document.getElementById('edit-product-form');
  if (editProductForm) {
    editProductForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleEditProductSubmit();
    });
  }

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveSettings();
    });
  }

  const directDispatchForm = document.getElementById('direct-dispatch-form');
  if (directDispatchForm) {
    directDispatchForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleDirectDispatchSubmit();
    });
  }

  const broadcastForm = document.getElementById('broadcast-notification-form');
  if (broadcastForm) {
    broadcastForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleBroadcastSubmit();
    });
  }

  const directNotifForm = document.getElementById('direct-notif-form');
  if (directNotifForm) {
    directNotifForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleDirectNotifSubmit();
    });
  }

  const tgConfigForm = document.getElementById('telegram-bot-config-form');
  if (tgConfigForm) {
    tgConfigForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveTelegramBot();
    });
  }

  const tgTestForm = document.getElementById('telegram-test-broadcast-form');
  if (tgTestForm) {
    tgTestForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleTestTelegramBroadcast();
    });
  }

  const waSimForm = document.getElementById('whatsapp-simulate-form');
  if (waSimForm) {
    waSimForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleTestWhatsAppSimulate();
    });
  }
}

function getAllCategoryNames() {
  const baseNames = Object.keys(PRESETS);
  const allNames = [...baseNames];
  currentProducts.forEach(p => {
    if (p.name && !allNames.includes(p.name)) {
      allNames.push(p.name);
    }
  });
  return allNames;
}

function getAllSubcategoriesForCategory(catName) {
  const subs = [...(PRESETS[catName] || [])];
  currentProducts.forEach(p => {
    if (p.name === catName && p.subProduct && !subs.includes(p.subProduct)) {
      subs.push(p.subProduct);
    }
  });
  return subs;
}

function refreshProductCategoryDropdowns() {
  const prodMainSelect = document.getElementById('prod-main-select');
  if (!prodMainSelect) return;

  const currentVal = prodMainSelect.value || 'Azure';
  const allCats = getAllCategoryNames();

  prodMainSelect.innerHTML = allCats.map(cat => `<option value="${escapeHtml(cat)}">${escapeHtml(cat)}</option>`).join('') +
    '<option value="__CUSTOM__">➕ Add Custom Product Category...</option>';

  if (allCats.includes(currentVal) || currentVal === '__CUSTOM__') {
    prodMainSelect.value = currentVal;
  } else if (allCats.length > 0) {
    prodMainSelect.value = allCats[0];
  }
  onMainProductChange(prodMainSelect.value);
}

function onMainProductChange(mainVal) {
  const customMainGroup = document.getElementById('custom-main-group');
  const subSelect = document.getElementById('prod-sub-select');

  if (mainVal === '__CUSTOM__') {
    if (customMainGroup) customMainGroup.style.display = 'block';
    if (subSelect) {
      subSelect.innerHTML = '<option value="__CUSTOM__">➕ Add Custom Sub-Product...</option>';
    }
    onSubProductChange('__CUSTOM__');
  } else {
    if (customMainGroup) customMainGroup.style.display = 'none';
    const subs = getAllSubcategoriesForCategory(mainVal);
    if (subSelect) {
      if (subs.length > 0) {
        subSelect.innerHTML = subs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('') +
          '<option value="__CUSTOM__">➕ Add Custom Sub-Product...</option>';
        onSubProductChange(subs[0]);
      } else {
        subSelect.innerHTML = '<option value="Standard Account">Standard Account</option><option value="__CUSTOM__">➕ Add Custom Sub-Product...</option>';
        onSubProductChange('Standard Account');
      }
    }
  }
}

function onSubProductChange(subVal) {
  const customSubGroup = document.getElementById('custom-sub-group');
  if (customSubGroup) {
    customSubGroup.style.display = subVal === '__CUSTOM__' ? 'block' : 'none';
  }
}

function onStockModeChange(mode) {
  const presetContainer = document.getElementById('stock-preset-container');
  const existingContainer = document.getElementById('stock-existing-container');
  if (mode === 'PRESET') {
    presetContainer.style.display = 'block';
    existingContainer.style.display = 'none';
  } else {
    presetContainer.style.display = 'none';
    existingContainer.style.display = 'block';
    populateStockProductDropdown(currentProducts);
  }
}

function onStockMainProductChange(mainVal) {
  const subSelect = document.getElementById('stock-sub-select');
  if (!subSelect) return;

  const subs = getAllSubcategoriesForCategory(mainVal);

  if (subs.length === 0) {
    subSelect.innerHTML = '<option value="Standard Account">Standard Account</option>';
  } else {
    subSelect.innerHTML = subs.map(s => `<option value="${escapeHtml(s)}">${escapeHtml(s)}</option>`).join('');
  }
}

async function handleLogin(username, password) {
  try {
    const res = await fetch('/api/owner/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, password })
    });
    const data = await res.json();

    if (data.success) {
      ownerToken = data.token;
      localStorage.setItem('prince_owner_token', ownerToken);
      showToast('Welcome Owner! Access Granted.', 'success');
      showOwnerDashboard();
    } else {
      showToast(data.message || 'Invalid Login Credentials!', 'error');
    }
  } catch (err) {
    showToast('Login Server Error: ' + err.message, 'error');
  }
}

function showLoginScreen() {
  document.getElementById('owner-login-view').style.display = 'flex';
  document.getElementById('owner-dashboard-view').style.display = 'none';
}

let ownerRefreshInterval = null;

function showOwnerDashboard() {
  document.getElementById('owner-login-view').style.display = 'none';
  document.getElementById('owner-dashboard-view').style.display = 'block';

  fetchMetrics();
  fetchRecentTransactions();
  fetchProducts();
  fetchOrders('ALL');
  fetchStocks();
  fetchCustomerDetails();
  fetchPaymentMethodSettings();
  fetchSettings();
  fetchBotStatus();

  if (ownerRefreshInterval) clearInterval(ownerRefreshInterval);
  ownerRefreshInterval = setInterval(() => {
    if (ownerToken) {
      fetchMetrics();
      fetchRecentTransactions();
    }
  }, 10000);
}

function switchTab(tabName) {
  activeTab = tabName;

  document.querySelectorAll('.nav-menu-item').forEach(item => {
    if (item.getAttribute('data-tab') === tabName) {
      item.classList.add('active');
    } else {
      item.classList.remove('active');
    }
  });

  document.querySelectorAll('.tab-panel').forEach(panel => {
    panel.classList.remove('active');
  });

  const targetPanel = document.getElementById(`panel-${tabName}`);
  if (targetPanel) {
    targetPanel.classList.add('active');
  }

  if (tabName === 'products') fetchProducts();
  if (tabName === 'orders') fetchOrders('ALL');
  if (tabName === 'stocks') fetchStocks();
  if (tabName === 'customers') fetchCustomerDetails();
  if (tabName === 'payment-methods') fetchPaymentMethodSettings();
  if (tabName === 'settings') fetchSettings();
  if (tabName === 'tickets') fetchOwnerTickets();
  if (tabName === 'smm') fetchOwnerSmmDashboard();
}

// ----------------------------------------------------
// FETCH & RENDER DATA WITH ON-CHAIN AUDIT LINKS
// ----------------------------------------------------

async function fetchMetrics() {
  try {
    const res = await fetch('/api/owner/metrics');
    const data = await res.json();
    if (data.success) {
      const m = data.metrics;
      document.getElementById('kpi-users-val').innerText = m.totalUsers || 0;
      document.getElementById('kpi-sold-val').innerText = m.todaySold || 0;
      document.getElementById('kpi-revenue-val').innerText = formatOwnerPriceDisplay(m.todayRevenue || 0);
      
      const monthlyValEl = document.getElementById('kpi-monthly-val');
      const monthlySubEl = document.getElementById('kpi-monthly-subtext');
      if (monthlyValEl) monthlyValEl.innerText = formatOwnerPriceDisplay(m.monthRevenue || 0);
      if (monthlySubEl) monthlySubEl.innerText = `${m.monthSold || 0} Units Sold (This Month)`;

      document.getElementById('kpi-stock-val').innerText = `${m.availableStocksCount} Items`;

      const ticketBadge = document.getElementById('owner-pending-tickets-badge');
      if (ticketBadge) {
        if (m.pendingTicketsCount > 0) {
          ticketBadge.innerText = m.pendingTicketsCount;
          ticketBadge.style.display = 'inline-block';
        } else {
          ticketBadge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Error fetching metrics:', err);
  }
}

async function fetchRecentTransactions() {
  try {
    const res = await fetch('/api/owner/recent-transactions');
    const data = await res.json();
    if (data.success) {
      renderRecentTransactions(data.orders);
    }
  } catch (err) {
    console.error('Recent transactions error:', err);
  }
}

function renderRecentTransactions(orders) {
  const tbody = document.getElementById('recent-transactions-tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="7" style="text-align:center; color: var(--text-muted); padding:30px;">No recent transactions yet. Add products & stock!</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const isTxHashReal = ord.txHash && ord.txHash.startsWith('0x');
    const bscScanUrl = isTxHashReal ? `https://bscscan.com/tx/${ord.txHash}` : '#';
    const isUpi = ord.paymentMethod === 'UPI' || (ord.utrId && ord.utrId.length > 0);
    const isPendingApproval = ord.deliveryStatus === 'PENDING_APPROVAL' || ord.deliveryStatus === 'PENDING_DELIVERY';

    return `
      <tr>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(ord.userName)}</strong><br>
          <span style="font-size:0.8rem; color:var(--text-muted);">${escapeHtml(ord.userPhone)}</span>
        </td>
        <td>
          <strong style="color:var(--yellow-primary);">${escapeHtml(ord.productName)}</strong><br>
          <span style="font-size:0.8rem; color:var(--pink-accent);">${escapeHtml(ord.subProduct || '')}</span>
        </td>
        <td><span class="badge badge-yellow">${escapeHtml(ord.country || '🌐 Global')}</span></td>
        <td><span class="badge badge-primary">${ord.quantity}x</span></td>
        <td><strong style="color:var(--green-bright);">${formatOwnerPriceDisplay(ord.totalPaid)}</strong></td>
        <td>
          ${isUpi 
            ? `<span class="badge badge-warning" style="font-size:0.7rem;">🏦 UPI: ${escapeHtml(ord.utrId || 'Pending')}</span>`
            : (isTxHashReal 
                ? `<a href="${bscScanUrl}" target="_blank" style="font-size:0.72rem; color:var(--yellow-primary); text-decoration:underline;">🔍 BscScan Audit</a>` 
                : `<span style="font-size:0.72rem; color:var(--text-dim);">⚡ Web3 Auto</span>`
              )
          }
        </td>
        <td>
          <span class="badge ${ord.deliveryStatus === 'DELIVERED' ? 'badge-success' : (isPendingApproval ? 'badge-warning' : 'badge-danger')}">
            ${ord.deliveryStatus}
          </span>
          ${isPendingApproval ? `
            <br>
            <button type="button" class="btn btn-warning btn-sm" onclick="openOrderDetailsModal('${ord._id}')" style="padding:2px 8px; font-size:0.7rem; font-weight:700; margin-top:4px;">
              ⚡ Approve UPI
            </button>
          ` : ''}
        </td>
      </tr>
    `;
  }).join('');
}

async function fetchCustomerDetails() {
  try {
    const res = await fetch('/api/owner/customers');
    const data = await res.json();
    if (data.success) {
      currentCustomers = data.customers || [];
      renderCustomersTable(currentCustomers);
      populateCustomerSelects(currentCustomers);
    }
  } catch (err) {
    console.error('Fetch customer details error:', err);
  }
}

function renderCustomersTable(customers) {
  const tbody = document.getElementById('customers-table-tbody');
  if (!tbody) return;

  if (!customers || customers.length === 0) {
    tbody.innerHTML = `<tr><td colspan="9" style="text-align:center; color: var(--text-muted); padding:30px;">No registered customers yet. Invite users to register!</td></tr>`;
    return;
  }

  tbody.innerHTML = customers.map(c => `
    <tr>
      <td><span style="font-family:monospace; color:var(--text-muted);">${escapeHtml(c.id ? c.id.toString().substring(0, 10) : 'N/A')}</span></td>
      <td><strong style="color:#ffffff;">${escapeHtml(c.name)}</strong></td>
      <td><span style="color:var(--yellow-primary); font-weight:700;">${escapeHtml(c.phone)}</span></td>
      <td><span style="color:var(--pink-accent); font-weight:600;">${escapeHtml(c.email)}</span></td>
      <td>
        <div style="display:flex; align-items:center; gap:6px;">
          <input type="password" value="${escapeHtml(c.password)}" class="form-control" style="padding:4px 8px; font-size:0.8rem; width:90px; background:rgba(0,0,0,0.5);" readonly id="pass-field-${c.id}">
          <button class="btn btn-secondary" style="padding:2px 6px; font-size:0.7rem;" onclick="togglePassView('${c.id}')">👁️</button>
        </div>
      </td>
      <td>
        <span class="badge ${c.status === 'blocked' ? 'badge-danger' : 'badge-success'}">
          ${c.status === 'blocked' ? '🔴 BLOCKED' : '🟢 ACTIVE'}
        </span>
      </td>
      <td><span class="badge badge-primary">${c.totalOrders || 0} Orders</span></td>
      <td><strong style="color:var(--green-bright);">${formatOwnerPriceDisplay(c.totalSpent || 0)}</strong></td>
      <td>
        <div style="display:flex; gap:6px;">
          ${c.status === 'blocked' 
            ? `<button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="unblockCustomer('${c.id}')">✅ Unblock</button>` 
            : `<button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="blockCustomer('${c.id}')">🚫 Block</button>`
          }
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteCustomer('${c.id}')">🗑️ Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function togglePassView(id) {
  const field = document.getElementById(`pass-field-${id}`);
  if (field) {
    field.type = field.type === 'password' ? 'text' : 'password';
  }
}

async function blockCustomer(id) {
  if (!confirm('Are you sure you want to BLOCK/SUSPEND this customer account? User will not be able to log in or purchase.')) return;
  try {
    const res = await fetch(`/api/owner/customers/${id}/block`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchCustomerDetails();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Block customer error: ' + err.message, 'error');
  }
}

async function unblockCustomer(id) {
  try {
    const res = await fetch(`/api/owner/customers/${id}/unblock`, { method: 'PUT' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchCustomerDetails();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Unblock customer error: ' + err.message, 'error');
  }
}

async function deleteCustomer(id) {
  if (!confirm('Are you sure you want to PERMANENTLY DELETE this customer account?')) return;
  try {
    const res = await fetch(`/api/owner/customers/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      fetchCustomerDetails();
      fetchMetrics();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Delete customer error: ' + err.message, 'error');
  }
}

async function fetchProducts() {
  try {
    const res = await fetch('/api/products?t=' + Date.now());
    const data = await res.json();
    if (data.success) {
      currentProducts = data.products;
      renderAdminProducts(data.products);
      refreshProductCategoryDropdowns();
      populateStockProductDropdown(data.products);
      populateDispatchProductSelect(data.products);
    }
  } catch (err) {
    console.error('Fetch products error:', err);
  }
}

function renderAdminProducts(products) {
  const container = document.getElementById('admin-products-container');
  if (!container) return;

  if (!products || products.length === 0) {
    container.innerHTML = `<div style="grid-column: 1/-1; text-align:center; padding:40px; color:var(--text-muted);">No products created yet. Add products via the form below or through the Stock tab!</div>`;
    return;
  }

  container.innerHTML = products.map(p => `
    <div class="glass-card admin-product-card">
      <div>
        <div style="display:flex; justify-content:space-between; align-items:flex-start;">
          <div>
            <h4 class="product-card-title">${escapeHtml(p.name)}</h4>
            ${p.subProduct ? `<div style="font-size:0.88rem; font-weight:700; color:var(--pink-accent); margin-bottom:4px;">${escapeHtml(p.subProduct)}</div>` : ''}
          </div>
          <span class="badge badge-yellow">${escapeHtml(p.country || '🌐 Global')}</span>
        </div>
        <div class="product-price-tag">${formatOwnerPriceDisplay(p.price)}</div>
        <p style="font-size:0.88rem; color:var(--text-muted); margin-bottom:12px;">${escapeHtml(p.description || 'No description provided.')}</p>
        ${p.offer ? `<span class="badge badge-pink" style="margin-bottom:10px;">${escapeHtml(p.offer)}</span>` : ''}
      </div>
      <div style="display:flex; justify-content:space-between; align-items:center; border-top:1px solid var(--glass-border); padding-top:12px; margin-top:12px; flex-wrap:wrap; gap:8px;">
        <span class="badge badge-primary">Stock: ${p.stock} Available</span>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary" style="padding:6px 12px; font-size:0.8rem;" onclick="openEditProductModal('${p._id}')">✏️ Edit</button>
          <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="quickAddStockForProduct('${p._id}')">➕ Add Keys</button>
          <button class="btn btn-danger" style="padding:6px 12px; font-size:0.8rem;" onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
}

function openEditProductModal(id) {
  const p = currentProducts.find(prod => prod._id === id);
  if (!p) {
    showToast('Product not found.', 'error');
    return;
  }

  document.getElementById('edit-prod-id').value = p._id;
  document.getElementById('edit-prod-name').value = p.name || '';
  document.getElementById('edit-prod-sub').value = p.subProduct || '';
  
  const countrySelect = document.getElementById('edit-prod-country-select');
  if (countrySelect) countrySelect.value = p.country || '🌐 Global / Worldwide';

  document.getElementById('edit-prod-price').value = p.price;
  document.getElementById('edit-prod-stock').value = p.stock || 0;
  document.getElementById('edit-prod-offer').value = p.offer || '';
  document.getElementById('edit-prod-desc').value = p.description || '';

  openModal('edit-product-modal');
}

async function handleEditProductSubmit() {
  const id = document.getElementById('edit-prod-id').value;
  const name = document.getElementById('edit-prod-name').value.trim();
  const subProduct = document.getElementById('edit-prod-sub').value.trim();
  const country = document.getElementById('edit-prod-country-select').value;
  const price = document.getElementById('edit-prod-price').value;
  const stock = document.getElementById('edit-prod-stock').value;
  const offer = document.getElementById('edit-prod-offer').value.trim();
  const description = document.getElementById('edit-prod-desc').value.trim();

  if (!name || price === '') {
    showToast('Product name and price are required.', 'error');
    return;
  }

  try {
    const res = await fetch(`/api/owner/products/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subProduct, country, price, stock, offer, description })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Product updated successfully!', 'success');
      closeModal('edit-product-modal');
      await fetchProducts();
      fetchMetrics();
      fetchStocks();
    } else {
      showToast(data.message || 'Failed to update product.', 'error');
    }
  } catch (err) {
    showToast('Edit product error: ' + err.message, 'error');
  }
}

function quickAddStockForProduct(productId) {
  switchTab('stocks');
  const modeSelect = document.getElementById('stock-mode-select');
  if (modeSelect) {
    modeSelect.value = 'EXISTING';
    onStockModeChange('EXISTING');
  }
  const prodSelect = document.getElementById('stock-product-select');
  if (prodSelect) {
    prodSelect.value = productId;
  }
  const textarea = document.getElementById('stock-raw-content');
  if (textarea) {
    textarea.focus();
  }
}

async function handleAddProduct() {
  const mainSelectVal = document.getElementById('prod-main-select').value;
  const subSelectVal = document.getElementById('prod-sub-select').value;

  const name = mainSelectVal === '__CUSTOM__' ? document.getElementById('prod-custom-main').value.trim() : mainSelectVal;
  const subProduct = subSelectVal === '__CUSTOM__' ? document.getElementById('prod-custom-sub').value.trim() : subSelectVal;
  const country = document.getElementById('prod-country-select').value;

  const price = document.getElementById('prod-price').value;
  const stock = document.getElementById('prod-stock').value;
  const description = document.getElementById('prod-desc').value;
  const offer = document.getElementById('prod-offer').value;

  try {
    const res = await fetch('/api/owner/products', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, subProduct, country, price, stock, description, offer })
    });
    const data = await res.json();
    if (data.success) {
      showToast('New Product Created! Now auto-selecting in Stock tab...', 'success');
      closeModal('add-product-modal');
      document.getElementById('add-product-form').reset();
      
      await fetchProducts();
      fetchMetrics();

      if (data.product && data.product._id) {
        quickAddStockForProduct(data.product._id);
      }
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Add product failed: ' + err.message, 'error');
  }
}

async function deleteProduct(id) {
  if (!confirm('Are you sure you want to delete this product and all associated stock keys?')) return;
  try {
    const res = await fetch(`/api/owner/products/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Product and stocks deleted!', 'info');
      fetchProducts();
      fetchMetrics();
    }
  } catch (err) {
    showToast('Delete error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// ORDERS MANAGEMENT WITH INSTANT 1-CLICK UPI APPROVAL
// ----------------------------------------------------

let allOwnerOrders = [];
let currentOrderFilter = 'ALL';
let orderSearchQuery = '';

function filterOrdersByStatus(status) {
  currentOrderFilter = status;

  // Update button active styles
  const btnMap = {
    'ALL': 'order-filter-btn-all',
    'PENDING_APPROVAL': 'order-filter-btn-pending',
    'DELIVERED': 'order-filter-btn-delivered',
    'REJECTED': 'order-filter-btn-rejected'
  };

  Object.entries(btnMap).forEach(([st, btnId]) => {
    const el = document.getElementById(btnId);
    if (el) {
      if (st === status) {
        el.className = 'btn btn-primary btn-sm';
      } else {
        el.className = 'btn btn-secondary btn-sm';
      }
    }
  });

  applyOrdersFilterAndRender();
}

function handleOrderSearch(val) {
  orderSearchQuery = (val || '').trim().toLowerCase();
  applyOrdersFilterAndRender();
}

function clearOrderSearch() {
  const input = document.getElementById('order-search-input');
  if (input) input.value = '';
  orderSearchQuery = '';
  applyOrdersFilterAndRender();
}

async function fetchOrders() {
  try {
    const res = await fetch(`/api/owner/orders?t=${Date.now()}`);
    const data = await res.json();
    if (data.success) {
      allOwnerOrders = data.orders || [];

      // Update pending badge counter
      const pendingCount = allOwnerOrders.filter(o => 
        o.deliveryStatus === 'PENDING_APPROVAL' || o.deliveryStatus === 'PENDING_DELIVERY'
      ).length;

      const counterBadge = document.getElementById('orders-pending-counter');
      if (counterBadge) {
        if (pendingCount > 0) {
          counterBadge.innerText = pendingCount;
          counterBadge.style.display = 'inline-block';
        } else {
          counterBadge.style.display = 'none';
        }
      }

      applyOrdersFilterAndRender();
    }
  } catch (err) {
    console.error('Fetch orders error:', err);
  }
}

function applyOrdersFilterAndRender() {
  let filtered = [...allOwnerOrders];

  // Apply Status Filter
  if (currentOrderFilter === 'PENDING_APPROVAL') {
    filtered = filtered.filter(o => o.deliveryStatus === 'PENDING_APPROVAL' || o.deliveryStatus === 'PENDING_DELIVERY');
  } else if (currentOrderFilter === 'DELIVERED') {
    filtered = filtered.filter(o => o.deliveryStatus === 'DELIVERED');
  } else if (currentOrderFilter === 'REJECTED') {
    filtered = filtered.filter(o => o.deliveryStatus === 'REJECTED');
  }

  // Apply Real-time Text Search Filter
  if (orderSearchQuery && orderSearchQuery.length > 0) {
    filtered = filtered.filter(o => {
      const matchId = (o._id || '').toLowerCase().includes(orderSearchQuery);
      const matchUser = (o.userName || '').toLowerCase().includes(orderSearchQuery);
      const matchPhone = (o.userPhone || '').toLowerCase().includes(orderSearchQuery);
      const matchProd = (o.productName || '').toLowerCase().includes(orderSearchQuery);
      const matchSub = (o.subProduct || '').toLowerCase().includes(orderSearchQuery);
      const matchUtr = (o.utrId || '').toLowerCase().includes(orderSearchQuery);
      const matchTx = (o.txHash || '').toLowerCase().includes(orderSearchQuery);
      return matchId || matchUser || matchPhone || matchProd || matchSub || matchUtr || matchTx;
    });
  }

  renderOrdersTable(filtered);
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding:30px;">No matching customer orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const isTxHashReal = ord.txHash && ord.txHash.startsWith('0x');
    const bscScanUrl = isTxHashReal ? `https://bscscan.com/tx/${ord.txHash}` : '#';
    const isUpi = ord.paymentMethod === 'UPI' || (ord.utrId && ord.utrId.length > 0);
    const isPendingApproval = ord.deliveryStatus === 'PENDING_APPROVAL' || ord.deliveryStatus === 'PENDING_DELIVERY';
    const isDelivered = ord.deliveryStatus === 'DELIVERED';
    const isRejected = ord.deliveryStatus === 'REJECTED';

    let statusBadgeClass = 'badge-warning';
    if (isDelivered) statusBadgeClass = 'badge-success';
    if (isRejected) statusBadgeClass = 'badge-danger';

    const cleanPhone = (ord.userPhone || '').replace(/[^0-9]/g, '');

    return `
      <tr id="order-row-${ord._id}">
        <td>
          <span style="font-family:monospace; color:var(--text-muted); font-size:0.8rem;">${ord._id}</span><br>
          <span class="badge badge-primary" style="font-size:0.68rem; margin-top:2px;">${escapeHtml(ord.source || 'WEB')}</span>
        </td>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(ord.userName)}</strong><br>
          <span style="font-size:0.8rem; color:var(--yellow-primary);">${escapeHtml(ord.userPhone || 'N/A')}</span>
          ${cleanPhone.length >= 10 ? `
            <a href="https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(ord.userName)}%2C%20regarding%20Order%20${ord._id}" target="_blank" style="margin-left:4px; font-size:0.75rem; text-decoration:none;" title="Chat on WhatsApp">💬</a>
          ` : ''}
        </td>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(ord.productName)}</strong><br>
          <span style="font-size:0.78rem; color:var(--pink-accent);">${escapeHtml(ord.subProduct || '')}</span>
          <span style="font-size:0.75rem; color:var(--text-dim);">[${escapeHtml(ord.country || 'Global')}] (x${ord.quantity || 1})</span>
        </td>
        <td>
          <strong style="color:var(--green-bright); font-size:0.95rem;">${formatOwnerPriceDisplay(ord.totalPaid)}</strong><br>
          ${isUpi 
            ? `<span style="font-size:0.75rem; color:#22c55e; font-weight:700; background:rgba(34,197,94,0.12); padding:2px 6px; border-radius:4px; display:inline-block; margin-top:2px;">
                🏦 UTR: <code>${escapeHtml(ord.utrId || 'Pending')}</code>
               </span>`
            : (isTxHashReal 
                ? `<a href="${bscScanUrl}" target="_blank" style="font-size:0.72rem; color:var(--yellow-primary); text-decoration:underline;">🔍 BscScan Audit</a>` 
                : `<span style="font-size:0.72rem; color:var(--text-dim);">⚡ BEP20 USDT</span>`
              )
          }
        </td>
        <td>
          <span class="badge ${statusBadgeClass}">
            ${ord.deliveryStatus}
          </span>
        </td>
        <td>
          <div class="code-box" style="font-size:0.72rem; max-width:180px; max-height:55px; overflow:hidden; white-space:pre-wrap; cursor:pointer;" onclick="openOrderDetailsModal('${ord._id}')" title="Click to view full delivered keys">
            ${escapeHtml(ord.deliveredItem || 'No key delivered yet')}
          </div>
        </td>
        <td>
          <div style="display:flex; flex-direction:column; gap:4px; min-width:130px;">
            <button type="button" class="btn btn-secondary btn-sm" onclick="openOrderDetailsModal('${ord._id}')" style="padding:4px 8px; font-size:0.75rem; border-color:var(--yellow-primary); color:var(--yellow-primary);">
              👁️ View Details
            </button>
            ${isPendingApproval ? `
              <button type="button" class="btn btn-success btn-sm" onclick="approveUpiOrder('${ord._id}', this)" style="padding:4px 8px; font-size:0.75rem; font-weight:800; background:#16a34a; border-color:#16a34a;">
                ⚡ Fast Approve
              </button>
              <button type="button" class="btn btn-danger btn-sm" onclick="rejectUpiOrder('${ord._id}')" style="padding:4px 8px; font-size:0.72rem;">
                ❌ Reject
              </button>
            ` : ''}
            <a href="/invoice/${ord._id}" target="_blank" class="btn btn-secondary btn-sm" style="padding:4px 8px; font-size:0.72rem; text-decoration:none; text-align:center;">
              🧾 Invoice Slip
            </a>
          </div>
        </td>
        <td>
          <span style="font-size:0.72rem; color:var(--text-dim);">${new Date(ord.createdAt).toLocaleString()}</span>
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// DEDICATED ORDER DETAILS & UPI APPROVAL MODAL ENGINE
// ----------------------------------------------------

function openOrderDetailsModal(orderId) {
  const ord = allOwnerOrders.find(o => String(o._id) === String(orderId));
  if (!ord) {
    showToast('Order not found.', 'error');
    return;
  }

  // Populate IDs & Status
  document.getElementById('mod-order-id-val').value = ord._id;
  document.getElementById('mod-order-product-id').value = ord.productId || '';
  document.getElementById('mod-order-id-sub').innerText = `Order ID: #${ord._id}`;
  
  const statusBadge = document.getElementById('mod-order-status-badge');
  const isPending = ord.deliveryStatus === 'PENDING_APPROVAL' || ord.deliveryStatus === 'PENDING_DELIVERY';
  const isDelivered = ord.deliveryStatus === 'DELIVERED';
  const isRejected = ord.deliveryStatus === 'REJECTED';

  if (isDelivered) {
    statusBadge.className = 'badge badge-success';
    statusBadge.innerText = 'DELIVERED & PAID';
  } else if (isRejected) {
    statusBadge.className = 'badge badge-danger';
    statusBadge.innerText = 'REJECTED';
  } else {
    statusBadge.className = 'badge badge-warning';
    statusBadge.innerText = '🟡 PENDING APPROVAL';
  }

  // Customer Profile Info
  document.getElementById('mod-cust-name').innerText = ord.userName || 'Anonymous Customer';
  document.getElementById('mod-cust-phone').innerText = ord.userPhone || 'N/A';
  
  const cleanPhone = (ord.userPhone || '').replace(/[^0-9]/g, '');
  const waBtn = document.getElementById('mod-cust-wa-link');
  if (cleanPhone.length >= 10) {
    waBtn.href = `https://wa.me/91${cleanPhone}?text=Hello%20${encodeURIComponent(ord.userName)}%2C%20regarding%20your%20PrinceCloudSellar%20Order%20${ord._id}...`;
    waBtn.style.display = 'inline-flex';
  } else {
    waBtn.style.display = 'none';
  }

  document.getElementById('mod-order-source').innerText = ord.source || 'WEB';
  document.getElementById('mod-order-date').innerText = new Date(ord.createdAt).toLocaleString();

  // Product & Pricing Info
  document.getElementById('mod-prod-name').innerText = ord.productName || 'Cloud Account';
  document.getElementById('mod-prod-sub').innerText = ord.subProduct || 'Standard Variant';
  document.getElementById('mod-prod-country').innerText = ord.country || '🌐 Global';
  document.getElementById('mod-order-qty').innerText = `${ord.quantity || 1}x`;
  document.getElementById('mod-order-total').innerText = formatOwnerPriceDisplay(ord.totalPaid);

  // UPI / Payment Info
  const isUpi = ord.paymentMethod === 'UPI' || (ord.utrId && ord.utrId.length > 0);
  document.getElementById('mod-payment-method-badge').innerText = isUpi ? 'UPI PAYMENT' : 'CRYPTO BEP20';
  document.getElementById('mod-order-utr').innerText = ord.utrId || (ord.txHash ? `TX: ${String(ord.txHash).substring(0, 18)}...` : 'No UTR Submitted');

  // Stock check
  const availStockCount = (currentStocks || []).filter(s => 
    String(s.productId) === String(ord.productId) && s.status === 'AVAILABLE'
  ).length;

  const stockBadge = document.getElementById('mod-stock-status-badge');
  if (availStockCount > 0) {
    stockBadge.className = 'badge badge-success';
    stockBadge.innerText = `🟢 ${availStockCount} Stock Item(s) Ready for Auto-Dispatch`;
  } else {
    stockBadge.className = 'badge badge-warning';
    stockBadge.innerText = `🟡 0 in Stock (Auto-Keygen or Custom Keys)`;
  }

  // Delivered vs Pending Boxes
  const deliveredBox = document.getElementById('mod-already-delivered-box');
  const pendingBox = document.getElementById('mod-pending-delivery-input-box');
  const approveBtn = document.getElementById('mod-approve-btn');
  const rejectBtn = document.getElementById('mod-reject-btn');
  const invoiceBtn = document.getElementById('mod-invoice-btn');

  invoiceBtn.href = `/invoice/${ord._id}`;

  if (isDelivered) {
    deliveredBox.style.display = 'block';
    document.getElementById('mod-delivered-text-display').innerText = ord.deliveredItem || 'No content';
    pendingBox.style.display = 'none';
    approveBtn.style.display = 'none';
    rejectBtn.style.display = 'none';
  } else {
    deliveredBox.style.display = 'none';
    pendingBox.style.display = 'block';
    document.getElementById('mod-custom-payload').value = '';
    document.getElementById('mod-owner-notes').value = '';
    approveBtn.style.display = 'inline-block';
    approveBtn.disabled = false;
    approveBtn.innerHTML = '⚡ Approve &amp; Deliver Now';
    rejectBtn.style.display = 'inline-block';
  }

  openModal('order-details-modal');
}

function copyUtrFromModal() {
  const utr = document.getElementById('mod-order-utr').innerText;
  if (utr && utr !== '-' && utr !== 'No UTR Submitted') {
    navigator.clipboard.writeText(utr);
    showToast(`UTR copied: ${utr}`, 'success');
  } else {
    showToast('No UTR to copy.', 'info');
  }
}

async function handleModalApproveOrder() {
  const orderId = document.getElementById('mod-order-id-val').value;
  const customPayload = document.getElementById('mod-custom-payload').value;
  const notes = document.getElementById('mod-owner-notes').value;
  const approveBtn = document.getElementById('mod-approve-btn');

  if (!orderId) return;

  if (approveBtn) {
    approveBtn.disabled = true;
    approveBtn.innerHTML = '⏳ Approving &amp; Delivering...';
  }

  try {
    const res = await fetch(`/api/owner/orders/${orderId}/approve-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ customPayload, notes })
    });
    const data = await res.json();

    if (data.success) {
      showToast('🎉 Order Approved & Credentials Delivered Successfully!', 'success');
      closeModal('order-details-modal');

      // Update in-memory order object
      const idx = allOwnerOrders.findIndex(o => String(o._id) === String(orderId));
      if (idx !== -1 && data.order) {
        allOwnerOrders[idx] = data.order;
      }

      applyOrdersFilterAndRender();
      
      // Refresh related views in background
      Promise.all([fetchOrders(), fetchStocks(), fetchMetrics(), fetchRecentTransactions()]).catch(() => {});
    } else {
      showToast(data.message || 'Approval failed.', 'error');
      if (approveBtn) {
        approveBtn.disabled = false;
        approveBtn.innerHTML = '⚡ Approve &amp; Deliver Now';
      }
    }
  } catch (err) {
    showToast('Approval error: ' + err.message, 'error');
    if (approveBtn) {
      approveBtn.disabled = false;
      approveBtn.innerHTML = '⚡ Approve &amp; Deliver Now';
    }
  }
}

async function handleModalRejectOrder() {
  const orderId = document.getElementById('mod-order-id-val').value;
  if (!orderId) return;

  closeModal('order-details-modal');
  await rejectUpiOrder(orderId);
}

async function approveUpiOrder(orderId, btnEl) {
  if (btnEl) {
    btnEl.disabled = true;
    btnEl.innerHTML = '⏳ Approving...';
  }

  try {
    const res = await fetch(`/api/owner/orders/${orderId}/approve-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({})
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 Order Approved! Keys Delivered Instantly.', 'success');
      
      // Update in-memory order object
      const idx = allOwnerOrders.findIndex(o => String(o._id) === String(orderId));
      if (idx !== -1 && data.order) {
        allOwnerOrders[idx] = data.order;
      }

      applyOrdersFilterAndRender();
      Promise.all([fetchStocks(), fetchMetrics(), fetchRecentTransactions()]).catch(() => {});
    } else {
      showToast(data.message || 'Approval failed.', 'error');
      if (btnEl) {
        btnEl.disabled = false;
        btnEl.innerHTML = '⚡ Fast Approve';
      }
    }
  } catch (err) {
    showToast('Approval error: ' + err.message, 'error');
    if (btnEl) {
      btnEl.disabled = false;
      btnEl.innerHTML = '⚡ Fast Approve';
    }
  }
}

async function rejectUpiOrder(orderId) {
  const reason = prompt('Enter reason for order rejection:', 'Payment unverified / invalid UPI UTR');
  if (reason === null) return;
  
  try {
    const res = await fetch(`/api/owner/orders/${orderId}/reject-upi`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Order Rejected.', 'info');
      
      const idx = allOwnerOrders.findIndex(o => String(o._id) === String(orderId));
      if (idx !== -1 && data.order) {
        allOwnerOrders[idx] = data.order;
      }
      applyOrdersFilterAndRender();
      fetchRecentTransactions();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Reject error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// UNIVERSAL DYNAMIC STOCK & PRESET SYNC ENGINE
// ----------------------------------------------------

function populateStockProductDropdown(products) {
  const select = document.getElementById('stock-product-select');
  if (select) {
    if (!products || products.length === 0) {
      select.innerHTML = '<option value="">-- No Created Products Yet --</option>';
    } else {
      select.innerHTML = '<option value="">-- Select Created Product / Variant --</option>' +
        products.map(p => {
          const label = `${p.name} ${p.subProduct ? `(${p.subProduct})` : ''} [${p.country || '🌐 Global'}] - (Stock Available: ${p.stock})`;
          return `<option value="${p._id}">${escapeHtml(label)}</option>`;
        }).join('');
    }
  }

  // UNIVERSALLY MERGE ALL CREATED PRODUCTS INTO PRESET MAIN SELECTOR TOO!
  const stockMainSelect = document.getElementById('stock-main-select');
  if (stockMainSelect && products) {
    const basePresetNames = ["Azure", "Gmail", "WhatsApp Numbers", "Telegram Numbers", "GCP", "Windows 365", "Microsoft 365", "AWS", "Vultr Account"];
    products.forEach(p => {
      if (p.name && !basePresetNames.includes(p.name)) {
        basePresetNames.push(p.name);
      }
    });

    stockMainSelect.innerHTML = basePresetNames.map(name => `<option value="${escapeHtml(name)}">${escapeHtml(name)}</option>`).join('');
    
    // Trigger variant update for currently selected preset
    if (stockMainSelect.value) {
      onStockMainProductChange(stockMainSelect.value);
    }
  }
}

async function handleAddStock() {
  const mode = document.getElementById('stock-mode-select').value;
  const rawStockData = document.getElementById('stock-raw-content').value;

  let payload = { rawStockData };

  if (mode === 'PRESET') {
    const name = document.getElementById('stock-main-select').value;
    const subProduct = document.getElementById('stock-sub-select').value;
    const country = document.getElementById('stock-country-select').value;
    const price = document.getElementById('stock-price-input').value;

    payload.name = name;
    payload.subProduct = subProduct;
    payload.country = country;
    payload.price = price;
  } else {
    const productId = document.getElementById('stock-product-select').value;
    if (!productId) {
      showToast('Please select a product from the list.', 'error');
      return;
    }
    payload.productId = productId;
  }

  try {
    const res = await fetch('/api/owner/stocks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    const data = await res.json();

    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('add-stock-form').reset();
      document.getElementById('stock-live-counter').innerText = 'Live Keys: 0';
      await fetchProducts();
      await fetchStocks();
      fetchMetrics();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Add stock error: ' + err.message, 'error');
  }
}

async function fetchStocks() {
  try {
    const res = await fetch('/api/owner/stocks');
    const data = await res.json();
    if (data.success) {
      currentAvailableStocks = data.availableStocks;
      renderAvailableStocks(data.availableStocks);
      renderSoldStocks(data.soldStocks);
    }
  } catch (err) {
    console.error('Fetch stocks error:', err);
  }
}

function renderAvailableStocks(availableStocks) {
  const tbody = document.getElementById('available-stocks-tbody');
  if (!tbody) return;

  if (!availableStocks || availableStocks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="3" style="text-align:center; color: var(--text-muted); padding:20px;">No available stock keys in inventory. Add keys above!</td></tr>`;
    return;
  }

  tbody.innerHTML = availableStocks.map(s => `
    <tr>
      <td>
        <strong style="color:#ffffff;">${escapeHtml(s.productName)}</strong><br>
        <span style="font-size:0.78rem; color:var(--pink-accent);">${escapeHtml(s.subProduct || '')}</span>
      </td>
      <td><div class="code-box" style="font-size:0.8rem; margin:0;">${escapeHtml(s.content)}</div></td>
      <td>
        <div style="display:flex; gap:6px;">
          <button class="btn btn-secondary" style="padding:4px 8px; font-size:0.75rem;" onclick="openEditStockModal('${s._id}')">Edit</button>
          <button class="btn btn-danger" style="padding:4px 8px; font-size:0.75rem;" onclick="deleteStock('${s._id}')">Delete</button>
        </div>
      </td>
    </tr>
  `).join('');
}

function openEditStockModal(id) {
  const stk = currentAvailableStocks.find(s => s._id === id);
  if (!stk) return;

  document.getElementById('edit-stock-id').value = stk._id;
  document.getElementById('edit-stock-content').value = stk.content;
  openModal('edit-stock-modal');
}

async function handleEditStockSubmit() {
  const id = document.getElementById('edit-stock-id').value;
  const content = document.getElementById('edit-stock-content').value;

  try {
    const res = await fetch(`/api/owner/stocks/${id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Stock item updated!', 'success');
      closeModal('edit-stock-modal');
      fetchStocks();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Edit stock error: ' + err.message, 'error');
  }
}

async function deleteStock(id) {
  if (!confirm('Are you sure you want to remove this stock item? Product stock count will be updated.')) return;
  try {
    const res = await fetch(`/api/owner/stocks/${id}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast('Stock item deleted & availability updated!', 'info');
      fetchStocks();
      fetchProducts();
      fetchMetrics();
    }
  } catch (err) {
    showToast('Delete stock error: ' + err.message, 'error');
  }
}

function renderSoldStocks(soldStocks) {
  const tbody = document.getElementById('sold-stocks-tbody');
  if (!tbody) return;

  if (!soldStocks || soldStocks.length === 0) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center; color: var(--text-muted); padding:20px;">No sold products recorded yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = soldStocks.map(s => `
    <tr>
      <td>
        <strong style="color:#ffffff;">${escapeHtml(s.productName)}</strong><br>
        <span style="font-size:0.78rem; color:var(--pink-accent);">${escapeHtml(s.subProduct || '')}</span>
      </td>
      <td><div class="code-box" style="font-size:0.8rem; margin:0; color:#34d399;">${escapeHtml(s.content)}</div></td>
      <td>
        <strong style="color:#ffffff;">${escapeHtml(s.soldToUserName || 'Customer')}</strong><br>
        <span style="font-size:0.78rem; color:var(--yellow-primary);">${escapeHtml(s.soldToUserPhone || '')}</span>
      </td>
      <td><span style="font-size:0.78rem; color:var(--text-dim);">${s.soldAt ? new Date(s.soldAt).toLocaleString() : 'N/A'}</span></td>
    </tr>
  `).join('');
}

// ----------------------------------------------------
// PAYMENT METHODS SETTINGS (BEP20 USDT ADDRESS)
// ----------------------------------------------------

async function fetchPaymentMethodSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      if (document.getElementById('pm-bep20-address')) {
        document.getElementById('pm-bep20-address').value = data.settings.defaultBep20Address || '0xD3D65940718F769E66E1e5c425AcFf76C2D9bFf2';
      }
    }
  } catch (err) {
    console.error('Fetch payment settings error:', err);
  }
}

async function handleSavePaymentMethod() {
  const defaultBep20Address = document.getElementById('pm-bep20-address').value.trim();

  try {
    const res = await fetch('/api/owner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ defaultBep20Address })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Global BEP20 Payment Address Saved!', 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Save payment method error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// OWNER SUPPORT SETTINGS
// ----------------------------------------------------

async function fetchSettings() {
  try {
    const res = await fetch('/api/settings');
    const data = await res.json();
    if (data.success && data.settings) {
      const s = data.settings;
      if (document.getElementById('setting-owner-upi')) document.getElementById('setting-owner-upi').value = s.ownerUpiId || '9507325677-1@naviaxis';
      if (document.getElementById('setting-owner-whatsapp')) document.getElementById('setting-owner-whatsapp').value = s.ownerWhatsApp || '9507325677';
      if (document.getElementById('setting-owner-bep20')) document.getElementById('setting-owner-bep20').value = s.defaultBep20Address || '';
      if (document.getElementById('setting-whatsapp-bot')) document.getElementById('setting-whatsapp-bot').value = s.whatsappBotUrl || 'https://wa.me/qr/DDVIRR5NFY2YO1';
      if (document.getElementById('setting-telegram-bot')) document.getElementById('setting-telegram-bot').value = s.telegramBotUrl || 'https://t.me/princecloudsellarshop_bot';
      if (document.getElementById('setting-owner-phone')) document.getElementById('setting-owner-phone').value = s.ownerPhone || '+91 9507325677';
      if (document.getElementById('setting-support-url')) document.getElementById('setting-support-url').value = s.supportUrl || '';
      if (document.getElementById('setting-whatsapp-group')) document.getElementById('setting-whatsapp-group').value = s.whatsappGroupUrl || '';
      if (document.getElementById('setting-telegram-group')) document.getElementById('setting-telegram-group').value = s.telegramGroupUrl || '';
      
      const linkWa = document.getElementById('setting-link-wa-bot');
      if (linkWa) linkWa.href = s.whatsappBotUrl || 'https://wa.me/qr/DDVIRR5NFY2YO1';

      const linkTg = document.getElementById('setting-link-tg-bot');
      if (linkTg) linkTg.href = s.telegramBotUrl || 'https://t.me/princecloudsellarshop_bot';
    }
  } catch (err) {
    console.error('Fetch settings error:', err);
  }
}

async function handleSaveSettings() {
  const ownerUpiId = document.getElementById('setting-owner-upi')?.value.trim() || '9507325677-1@naviaxis';
  const ownerWhatsApp = document.getElementById('setting-owner-whatsapp')?.value.trim() || '9507325677';
  const defaultBep20Address = document.getElementById('setting-owner-bep20')?.value.trim() || '';
  const whatsappBotUrl = document.getElementById('setting-whatsapp-bot')?.value.trim() || 'https://wa.me/qr/DDVIRR5NFY2YO1';
  const telegramBotUrl = document.getElementById('setting-telegram-bot')?.value.trim() || 'https://t.me/princecloudsellarshop_bot';
  const ownerPhone = document.getElementById('setting-owner-phone')?.value.trim() || '+91 9507325677';
  const supportUrl = document.getElementById('setting-support-url')?.value.trim() || '';
  const whatsappGroupUrl = document.getElementById('setting-whatsapp-group')?.value.trim() || '';
  const telegramGroupUrl = document.getElementById('setting-telegram-group')?.value.trim() || '';

  try {
    const res = await fetch('/api/owner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        ownerUpiId, 
        ownerWhatsApp, 
        defaultBep20Address, 
        whatsappBotUrl,
        telegramBotUrl,
        ownerPhone, 
        supportUrl, 
        whatsappGroupUrl, 
        telegramGroupUrl 
      })
    });
    const data = await res.json();
    if (data.success) {
      showToast('🎉 All Platform, Bot & Payment Settings saved successfully! Live everywhere.', 'success');
      fetchSettings();
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Save settings error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// OWNER SUPPORT TICKETS & DISPUTES LOGIC
// ----------------------------------------------------
let currentOwnerTickets = [];

async function fetchOwnerTickets() {
  try {
    const res = await fetch('/api/owner/tickets?t=' + Date.now());
    const data = await res.json();
    if (data.success) {
      currentOwnerTickets = data.tickets || [];
      renderOwnerTicketsTable(currentOwnerTickets);

      const pendingCount = currentOwnerTickets.filter(t => t.status === 'PENDING').length;
      const ticketBadge = document.getElementById('owner-pending-tickets-badge');
      if (ticketBadge) {
        if (pendingCount > 0) {
          ticketBadge.innerText = pendingCount;
          ticketBadge.style.display = 'inline-block';
        } else {
          ticketBadge.style.display = 'none';
        }
      }
    }
  } catch (err) {
    console.error('Fetch owner tickets error:', err);
    showToast('Failed to load tickets: ' + err.message, 'error');
  }
}

function renderOwnerTicketsTable(tickets) {
  const tbody = document.getElementById('owner-tickets-tbody');
  if (!tbody) return;

  if (!tickets || tickets.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; padding:30px; color:var(--text-muted);">No customer support tickets received yet.</td></tr>`;
    return;
  }

  tbody.innerHTML = tickets.map(t => {
    let statusBadge = '<span class="badge badge-warning">🟡 PENDING</span>';
    if (t.status === 'RESOLVED') statusBadge = '<span class="badge badge-success">🟢 RESOLVED</span>';
    if (t.status === 'IN_PROGRESS') statusBadge = '<span class="badge badge-yellow">🔄 IN PROGRESS</span>';
    if (t.status === 'REJECTED') statusBadge = '<span class="badge badge-danger">🔴 REJECTED</span>';

    const productTag = t.productName ? `
      <div style="background: rgba(250,204,21,0.08); border: 1px solid rgba(250,204,21,0.3); border-radius: 4px; padding: 2px 6px; margin-top: 4px; font-size: 0.75rem; color: #facc15; display: inline-block;">
        📦 ${escapeHtml(t.productName)} ${t.subProduct ? `(${escapeHtml(t.subProduct)})` : ''} ${t.country ? `[${escapeHtml(t.country)}]` : ''}
      </div>
    ` : '';

    const customCategoryTag = t.customProblem ? `
      <div style="color: #ec4899; font-size: 0.75rem; font-weight: 700; margin-top: 2px;">
        Specific Issue: ${escapeHtml(t.customProblem)}
      </div>
    ` : '';

    return `
      <tr>
        <td style="font-family:monospace; color:var(--yellow-primary); font-weight:800; font-size:0.82rem;">${escapeHtml(t._id)}</td>
        <td>
          <div style="font-weight:700; color:#ffffff;">${escapeHtml(t.userName)}</div>
          <div style="font-size:0.78rem; color:var(--text-dim);">${escapeHtml(t.userPhone)}</div>
          <div style="font-size:0.78rem; color:var(--pink-accent);">${escapeHtml(t.userEmail)}</div>
        </td>
        <td>
          <span class="badge badge-yellow" style="font-size:0.72rem;">${escapeHtml(t.category)}</span>
          ${customCategoryTag}
          ${productTag}
        </td>
        <td>
          <div style="font-weight:600; color:#ffffff;">${escapeHtml(t.subject)}</div>
          ${t.orderId ? `<div style="font-size:0.75rem; color:var(--text-dim);">Order: ${escapeHtml(t.orderId)}</div>` : ''}
          ${t.amountPaid ? `<div style="font-size:0.75rem; color:#34d399;">Amount: ${escapeHtml(t.amountPaid)}</div>` : ''}
          ${t.txHash ? `<div style="font-family:monospace; font-size:0.72rem; color:#38bdf8; word-break:break-all; max-width:180px;">TX: ${escapeHtml(t.txHash)}</div>` : ''}
        </td>
        <td style="max-width:240px; font-size:0.84rem; color:var(--text-muted); line-height:1.4;">
          ${escapeHtml(t.message)}
          <div style="font-size:0.72rem; color:var(--text-dim); margin-top:4px;">${new Date(t.createdAt).toLocaleString()}</div>
        </td>
        <td>${statusBadge}</td>
        <td style="max-width:220px; font-size:0.84rem;">
          ${t.ownerReply ? `
            <div style="color:var(--yellow-primary); background:rgba(0,0,0,0.4); padding:6px 10px; border-radius:6px; font-size:0.8rem; line-height:1.35;">
              ${escapeHtml(t.ownerReply)}
            </div>
          ` : `<span style="color:var(--text-dim); font-size:0.78rem; font-style:italic;">No reply yet</span>`}
        </td>
        <td>
          <button class="btn btn-primary" onclick="openResolveTicketModal('${t._id}')" style="padding:6px 12px; font-size:0.8rem; white-space:nowrap;">
            ✍️ Resolve / Reply
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

function openResolveTicketModal(ticketId) {
  const ticket = currentOwnerTickets.find(t => t._id === ticketId);
  if (!ticket) return;

  document.getElementById('resolve-ticket-id').value = ticket._id;
  document.getElementById('resolve-status-select').value = ticket.status || 'RESOLVED';
  document.getElementById('resolve-reply-text').value = ticket.ownerReply || '';

  const infoEl = document.getElementById('resolve-ticket-info');
  if (infoEl) {
    infoEl.innerHTML = `
      <div style="margin-bottom:6px;"><strong>Ticket ID:</strong> <span style="color:var(--yellow-primary); font-family:monospace;">${escapeHtml(ticket._id)}</span></div>
      <div style="margin-bottom:6px;"><strong>Customer:</strong> ${escapeHtml(ticket.userName)} (${escapeHtml(ticket.userPhone)} / ${escapeHtml(ticket.userEmail)})</div>
      <div style="margin-bottom:6px;"><strong>Category &amp; Issue:</strong> [${escapeHtml(ticket.category)}] ${ticket.customProblem ? `(Custom: ${escapeHtml(ticket.customProblem)})` : ''}</div>
      ${ticket.productName ? `<div style="margin-bottom:6px; color:#facc15;"><strong>Disputed Product:</strong> ${escapeHtml(ticket.productName)} ${ticket.subProduct ? `(${escapeHtml(ticket.subProduct)})` : ''} [${escapeHtml(ticket.country || 'Global')}]</div>` : ''}
      ${ticket.orderId ? `<div style="margin-bottom:6px;"><strong>Order ID:</strong> ${escapeHtml(ticket.orderId)}</div>` : ''}
      ${ticket.txHash ? `<div style="margin-bottom:6px; font-family:monospace; color:#38bdf8; word-break:break-all;"><strong>TX Hash:</strong> ${escapeHtml(ticket.txHash)}</div>` : ''}
      <div style="background:rgba(255,255,255,0.06); padding:8px; border-radius:6px; margin-top:8px;">
        <strong>Customer Complaint:</strong><br>${escapeHtml(ticket.message)}
      </div>
    `;
  }

  openModal('resolve-ticket-modal');
}

async function handleResolveTicketSubmit() {
  const ticketId = document.getElementById('resolve-ticket-id').value;
  const status = document.getElementById('resolve-status-select').value;
  const ownerReply = document.getElementById('resolve-reply-text').value.trim();

  if (!ownerReply) {
    showToast('Please enter resolution note / reply for the customer.', 'warning');
    return;
  }

  try {
    const res = await fetch(`/api/owner/tickets/${ticketId}/resolve`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ownerReply })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Support ticket updated & customer notified!', 'success');
      closeModal('resolve-ticket-modal');
      fetchOwnerTickets();
      fetchMetrics();
    } else {
      showToast(data.message || 'Failed to update ticket.', 'error');
    }
  } catch (err) {
    showToast('Resolve ticket error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// DIRECT DISPATCH & BROADCAST NOTIFICATIONS CONTROLLER
// ----------------------------------------------------

function populateCustomerSelects(customers) {
  const dispatchSelect = document.getElementById('dispatch-customer-select');
  const directNotifSelect = document.getElementById('direct-notif-customer-select');

  const optionsHtml = (customers && customers.length > 0)
    ? '<option value="">-- Choose Customer from Database --</option>' + customers.map(c => `
        <option value="${escapeHtml(c.id)}">${escapeHtml(c.name)} (${escapeHtml(c.email)} • ${escapeHtml(c.phone)})</option>
      `).join('')
    : '<option value="">-- No Registered Customers Found --</option>';

  if (dispatchSelect) dispatchSelect.innerHTML = optionsHtml;
  if (directNotifSelect) directNotifSelect.innerHTML = optionsHtml;
}

function populateDispatchProductSelect(products) {
  const select = document.getElementById('dispatch-product-select');
  if (!select) return;

  if (!products || products.length === 0) {
    select.innerHTML = '<option value="">-- No Products Created Yet --</option>';
    return;
  }

  select.innerHTML = '<option value="">-- Choose Store Product --</option>' + products.map(p => `
    <option value="${escapeHtml(p._id)}">📦 ${escapeHtml(p.name)} ${p.subProduct ? `(${escapeHtml(p.subProduct)})` : ''} [${escapeHtml(p.country || 'Global')}] (Stock: ${p.stock || 0} Avail)</option>
  `).join('');
}

function onDispatchProductChange(prodId) {
  const prod = currentProducts.find(p => p._id === prodId);
  const qtyInput = document.getElementById('dispatch-quantity');
  if (prod && qtyInput) {
    const avail = Number(prod.stock) || 0;
    if (avail > 0) {
      qtyInput.max = avail;
    }
  }
}

function onDispatchStockModeChange(mode) {
  const customGroup = document.getElementById('dispatch-custom-payload-group');
  if (customGroup) {
    customGroup.style.display = mode === 'CUSTOM_KEY' ? 'block' : 'none';
  }
}

async function handleDirectDispatchSubmit() {
  const userId = document.getElementById('dispatch-customer-select').value;
  const productId = document.getElementById('dispatch-product-select').value;
  const quantity = Number(document.getElementById('dispatch-quantity').value) || 1;
  const stockMode = document.getElementById('dispatch-stock-mode').value;
  const customPayload = document.getElementById('dispatch-custom-payload') ? document.getElementById('dispatch-custom-payload').value : '';
  const notes = document.getElementById('dispatch-notes') ? document.getElementById('dispatch-notes').value.trim() : '';
  const sendEmail = document.getElementById('dispatch-send-email') ? document.getElementById('dispatch-send-email').checked : true;

  if (!userId || !productId) {
    showToast('Please select both a Customer and a Product.', 'warning');
    return;
  }

  if (stockMode === 'CUSTOM_KEY' && (!customPayload || customPayload.trim().length === 0)) {
    showToast('Please enter the custom account payload / key.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/owner/dispatch-direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        userId,
        productId,
        quantity,
        useStock: stockMode === 'AUTO_STOCK',
        customPayload,
        notes,
        sendEmail
      })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message || 'Account successfully dispatched to customer!', 'success');
      document.getElementById('direct-dispatch-form').reset();
      fetchProducts();
      fetchStocks();
      fetchRecentTransactions();
      fetchMetrics();
    } else {
      showToast(data.message || 'Dispatch failed.', 'error');
    }
  } catch (err) {
    showToast('Dispatch error: ' + err.message, 'error');
  }
}

async function handleBroadcastSubmit() {
  const type = document.getElementById('broadcast-type').value;
  const title = document.getElementById('broadcast-title').value.trim();
  const message = document.getElementById('broadcast-message').value.trim();

  if (!title || !message) {
    showToast('Please enter both notification title and message body.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/owner/notifications/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, title, message })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Broadcast notification sent to ALL users successfully!', 'success');
      document.getElementById('broadcast-notification-form').reset();
    } else {
      showToast(data.message || 'Failed to send broadcast.', 'error');
    }
  } catch (err) {
    showToast('Broadcast error: ' + err.message, 'error');
  }
}

async function handleDirectNotifSubmit() {
  const userId = document.getElementById('direct-notif-customer-select').value;
  const title = document.getElementById('direct-notif-title').value.trim();
  const message = document.getElementById('direct-notif-message').value.trim();

  if (!userId || !title || !message) {
    showToast('Please select a customer, title and message.', 'warning');
    return;
  }

  const cust = currentCustomers.find(c => c.id === userId);
  const userEmail = cust ? cust.email : '';

  try {
    const res = await fetch('/api/owner/notifications/direct', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ userId, userEmail, title, message, type: 'PROMO' })
    });

    const data = await res.json();
    if (data.success) {
      showToast('Direct notification sent to customer successfully!', 'success');
      document.getElementById('direct-notif-form').reset();
    } else {
      showToast(data.message || 'Failed to send direct notification.', 'error');
    }
  } catch (err) {
    showToast('Direct notification error: ' + err.message, 'error');
  }
}

// ----------------------------------------------------
// TELEGRAM & WHATSAPP BOT MANAGEMENT CONTROLLER
// ----------------------------------------------------

async function fetchBotStatus() {
  try {
    const res = await fetch('/api/owner/bots/status');
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('tg-bot-status-badge');
      const tgStatusText = document.getElementById('tg-live-status-text');
      const tgUserText = document.getElementById('tg-live-username-text');
      const tgSessText = document.getElementById('tg-live-sessions-text');
      const tgDbText = document.getElementById('tg-live-db-text');

      if (badge) {
        if (data.telegram && data.telegram.isActive) {
          badge.className = 'badge badge-success';
          badge.innerText = '🟢 BOT RUNNING';
          if (tgStatusText) tgStatusText.innerText = 'ONLINE (Polling Active)';
          if (tgStatusText) tgStatusText.style.color = '#22c55e';
        } else if (data.telegram && data.telegram.tokenSet) {
          badge.className = 'badge badge-yellow';
          badge.innerText = '🟡 CONFIGURED';
          if (tgStatusText) tgStatusText.innerText = 'CONFIGURED (Starting...)';
          if (tgStatusText) tgStatusText.style.color = '#facc15';
        } else {
          badge.className = 'badge badge-warning';
          badge.innerText = '⚪ TOKEN REQUIRED';
          if (tgStatusText) tgStatusText.innerText = 'OFFLINE (Token Needed)';
          if (tgStatusText) tgStatusText.style.color = '#ef4444';
        }
      }

      if (tgUserText) {
        tgUserText.innerText = data.telegram?.botUsername || (data.telegram?.isActive ? '@BotActive' : 'Not Connected');
      }
      if (tgSessText) {
        tgSessText.innerText = `${data.telegram?.activeSessions || 0} Chats`;
      }
      if (tgDbText) {
        tgDbText.innerText = '🟢 Live Connected';
      }

      if (data.telegram && data.telegram.channelId) {
        const chanInput = document.getElementById('tg-channel-id-input');
        if (chanInput && !chanInput.value) chanInput.value = data.telegram.channelId;
      }

      const waBadge = document.getElementById('wa-session-status-badge');
      if (waBadge) {
        if (data.whatsapp && data.whatsapp.sessionLinked) {
          waBadge.className = 'badge badge-success';
          waBadge.innerText = '🟢 SESSION PAIRED';
        } else {
          waBadge.className = 'badge badge-yellow';
          waBadge.innerText = '🟡 READY TO PAIR';
        }
      }

      if (data.whatsapp && data.whatsapp.connectedNumber) {
        const phoneDisp = document.getElementById('wa-connected-phone-display');
        if (phoneDisp) phoneDisp.innerText = data.whatsapp.connectedNumber;
      } else {
        const phoneDisp = document.getElementById('wa-connected-phone-display');
        if (phoneDisp) phoneDisp.innerText = 'Ready to Pair';
      }

      fetchWhatsAppLiveQR();
    }
  } catch (err) {
    console.error('Fetch bot status error:', err);
  }
}

async function handleSaveTelegramBot() {
  const token = document.getElementById('tg-bot-token-input').value.trim();
  const channelId = document.getElementById('tg-channel-id-input').value.trim();

  if (!token) {
    showToast('Please enter your Telegram Bot Token.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/owner/bots/telegram/configure', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, channelId })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchBotStatus();
    } else {
      showToast(data.message || 'Failed to connect Telegram Bot.', 'error');
    }
  } catch (err) {
    showToast('Telegram connection error: ' + err.message, 'error');
  }
}

async function handleTestTelegramBroadcast() {
  const title = document.getElementById('tg-test-title').value.trim();
  const message = document.getElementById('tg-test-msg').value.trim();
  const channelId = document.getElementById('tg-channel-id-input').value.trim();

  if (!title || !message) {
    showToast('Please enter title and message.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/owner/bots/telegram/broadcast', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, message, channelId })
    });

    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      document.getElementById('telegram-test-broadcast-form').reset();
    } else {
      showToast(data.message || 'Broadcast failed. Check if bot is admin in channel.', 'error');
    }
  } catch (err) {
    showToast('Telegram broadcast error: ' + err.message, 'error');
  }
}

async function handleTestWhatsAppSimulate() {
  const from = document.getElementById('wa-sim-number').value.trim();
  const message = document.getElementById('wa-sim-cmd').value.trim();

  try {
    const res = await fetch('/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ from, message })
    });

    const data = await res.json();
    const resultBox = document.getElementById('wa-sim-result-box');
    const replyText = document.getElementById('wa-sim-reply-text');

    if (data.success && data.reply) {
      if (resultBox && replyText) {
        replyText.innerText = data.reply;
        resultBox.style.display = 'block';
      }
      showToast('WhatsApp bot replied successfully!', 'success');
    } else {
      showToast('No reply or unhandled command.', 'info');
    }
  } catch (err) {
    showToast('WhatsApp simulation error: ' + err.message, 'error');
  }
}

async function fetchWhatsAppLiveQR() {
  const phoneInput = document.getElementById('wa-link-phone-input');
  const phone = (phoneInput ? phoneInput.value : '+919507325677').trim();
  const spinner = document.getElementById('wa-qr-loading-spinner');
  const qrImg = document.getElementById('wa-live-qr-img');

  try {
    const res = await fetch(`/api/owner/bots/whatsapp/qr?phone=${encodeURIComponent(phone)}`);
    const data = await res.json();

    if (data.success) {
      const waBadge = document.getElementById('wa-session-status-badge');
      const phoneDisp = document.getElementById('wa-connected-phone-display');
      const codeVal = document.getElementById('wa-pairing-code-val');

      if (data.sessionLinked) {
        if (waBadge) {
          waBadge.className = 'badge badge-success';
          waBadge.innerText = '🟢 SESSION PAIRED & ONLINE';
        }
        if (phoneDisp && data.connectedNumber) {
          phoneDisp.innerText = data.connectedNumber;
        }
        if (qrImg) qrImg.style.display = 'none';
        if (spinner) {
          spinner.style.display = 'flex';
          spinner.innerHTML = '<div style="text-align:center; padding:10px;"><div style="font-size:1.6rem; margin-bottom:4px;">✅</div><strong style="color:#22c55e; font-size:0.85rem;">WhatsApp Connected!</strong><p style="color:#94a3b8; font-size:0.7rem; margin-top:2px;">Session Active</p></div>';
        }
        if (codeVal) codeVal.innerText = 'ACTIVE';
      } else if (data.qrDataUrl) {
        if (waBadge) {
          waBadge.className = 'badge badge-yellow';
          waBadge.innerText = '🟡 SCAN QR TO PAIR';
        }
        if (qrImg) {
          qrImg.src = data.qrDataUrl;
          qrImg.style.display = 'block';
        }
        if (spinner) spinner.style.display = 'none';

        if (codeVal && data.pairingCode) codeVal.innerText = data.pairingCode;
      } else {
        if (qrImg) qrImg.style.display = 'none';
        if (spinner) {
          spinner.style.display = 'flex';
          spinner.innerHTML = '⏳ Loading QR...';
        }
      }
    }
  } catch (err) {
    console.error('WhatsApp QR fetch error:', err);
  }
}

async function generateWhatsAppPairingCode() {
  const phoneInput = document.getElementById('wa-link-phone-input');
  const phone = phoneInput ? phoneInput.value.trim() : '+919507325000';

  if (!phone) {
    showToast('Please enter your WhatsApp mobile number.', 'warning');
    return;
  }

  try {
    const res = await fetch('/api/owner/bots/whatsapp/pair', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ phone })
    });

    const data = await res.json();
    if (data.success) {
      if (data.pairingCode) {
        const codeVal = document.getElementById('wa-pairing-code-val');
        if (codeVal) codeVal.innerText = data.pairingCode;
      }

      const phoneDisp = document.getElementById('wa-connected-phone-display');
      if (phoneDisp) phoneDisp.innerText = data.phone || phone;

      showToast(data.message || `Pairing Code generated: ${data.pairingCode}`, 'success');
    } else {
      showToast(data.message || 'Failed to request pairing code.', 'error');
    }
  } catch (err) {
    showToast('WhatsApp pairing error: ' + err.message, 'error');
  }
}

async function disconnectWhatsAppSession() {
  try {
    const res = await fetch('/api/owner/bots/whatsapp/disconnect', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('wa-session-status-badge');
      if (badge) {
        badge.className = 'badge badge-warning';
        badge.innerText = '⚪ DISCONNECTED';
      }
      showToast('WhatsApp session disconnected.', 'info');
      fetchWhatsAppLiveQR();
    }
  } catch (err) {
    showToast('Disconnect error: ' + err.message, 'error');
  }
}

async function resetWhatsAppFullSession() {
  if (!confirm('⚠️ Are you sure you want to PERMANENTLY delete the linked WhatsApp session?\n\nThis will wipe all credentials and generate a brand-new QR code.')) {
    return;
  }

  try {
    showToast('🗑️ Deleting WhatsApp session and generating new QR...', 'info');
    const res = await fetch('/api/owner/bots/whatsapp/disconnect', {
      method: 'POST'
    });
    const data = await res.json();
    if (data.success) {
      const badge = document.getElementById('wa-session-status-badge');
      const phoneDisp = document.getElementById('wa-connected-phone-display');
      if (badge) {
        badge.className = 'badge badge-yellow';
        badge.innerText = '🟡 READY TO PAIR';
      }
      if (phoneDisp) {
        phoneDisp.innerText = 'Ready to Pair (Scan QR)';
      }
      showToast('✅ WhatsApp session deleted. Scan the new QR code below to reconnect!', 'success');
      setTimeout(fetchWhatsAppLiveQR, 1000);
    } else {
      showToast(data.message || 'Failed to delete session.', 'error');
    }
  } catch (err) {
    showToast('Session reset error: ' + err.message, 'error');
  }
}

function copyPairingCode() {
  const display = document.getElementById('wa-pairing-code-val');
  if (display) {
    navigator.clipboard.writeText(display.innerText);
    showToast('Pairing code copied to clipboard!', 'info');
  }
}

// Helper Utilities
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

window.showOwnerToast = showToast;
window.showToast = showToast;

// ============================================================
// OWNER INDIANSMMHUB SMM SERVICES & GROWTH ORDERS MANAGEMENT ENGINE
// ============================================================

let ownerSmmServicesList = [];
let ownerSmmOrdersList = [];
let activeOwnerSmmPlatformFilter = 'ALL';
let currentOwnerSmmSearchQuery = '';
let currentSelectedSmmModalOrder = null;
let smmSearchDebounceTimer = null;
let smmServicesSearchDebounceTimer = null;

// Fetch IndianSMMHub SMM Dashboard
async function fetchOwnerSmmDashboard() {
  await Promise.all([
    fetchOwnerSmmOverview(),
    fetchOwnerSmmServices(),
    fetchOwnerSmmOrders()
  ]);
}

// Fetch IndianSMMHub Overview & Live KPIs
async function fetchOwnerSmmOverview() {
  try {
    const res = await fetch('/api/owner/smm/overview');
    const data = await res.json();
    if (data.success) {
      const balanceEl = document.getElementById('owner-smm-kpi-balance');
      const ordersEl = document.getElementById('owner-smm-kpi-orders');
      const revenueEl = document.getElementById('owner-smm-kpi-revenue');
      const servicesEl = document.getElementById('owner-smm-kpi-services');
      const lastSyncEl = document.getElementById('owner-smm-kpi-last-sync');

      if (balanceEl) balanceEl.innerText = `₹${parseFloat(data.balance || 0).toFixed(2)} ${data.currency || 'INR'}`;
      if (ordersEl) ordersEl.innerText = (data.totalOrders || 0).toLocaleString();
      if (revenueEl) revenueEl.innerText = `₹${(data.totalRevenue || 0).toLocaleString()}`;
      if (servicesEl) servicesEl.innerText = `${(data.servicesCount || 0).toLocaleString()}`;
      if (lastSyncEl && data.lastSync) {
        lastSyncEl.innerText = `Last synced: ${new Date(data.lastSync).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`;
      }

      // Populate Settings Inputs
      const urlInput = document.getElementById('setting-smm-provider-url');
      const keyInput = document.getElementById('setting-smm-api-key');
      const marginInput = document.getElementById('setting-smm-profit-margin');

      if (urlInput && (data.smmProviderUrl || data.peakerrApiUrl)) urlInput.value = data.smmProviderUrl || data.peakerrApiUrl;
      if (marginInput && data.profitMargin) marginInput.value = data.profitMargin;
    }
  } catch (err) {
    console.error('Error fetching IndianSMMHub overview:', err);
  }
}

// Trigger Live Sync from IndianSMMHub API
async function syncPeakerrFromOwner() {
  const syncBtn = document.getElementById('btn-owner-peakerr-sync');
  if (syncBtn) {
    syncBtn.disabled = true;
    syncBtn.innerText = '⏳ Syncing 530+ Services...';
  }

  try {
    const res = await fetch('/api/owner/smm/sync', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🎉 Successfully synced ${data.total.toLocaleString()} live services from IndianSMMHub!`, 'success');
      await fetchOwnerSmmDashboard();
    } else {
      showToast(`❌ Sync Failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Sync error: ${err.message}`, 'error');
  } finally {
    if (syncBtn) {
      syncBtn.disabled = false;
      syncBtn.innerText = '🔄 Live Sync (530+ Services)';
    }
  }
}
const syncIndianSmmFromOwner = syncPeakerrFromOwner;

// Fetch IndianSMMHub Services
async function fetchOwnerSmmServices() {
  try {
    const res = await fetch('/api/owner/smm/services');
    const data = await res.json();
    if (data.success && data.services) {
      ownerSmmServicesList = data.services;
      renderOwnerSmmServicesTable();
    }
  } catch (err) {
    console.error('Error fetching IndianSMMHub services:', err);
  }
}

// Filter SMM Platform
function filterOwnerSmmPlatform(platform) {
  activeOwnerSmmPlatformFilter = platform;
  document.querySelectorAll('#panel-smm .filter-pill-btn').forEach(btn => {
    btn.classList.remove('active');
  });

  const platIdMap = {
    'ALL': 'smm-owner-plat-all',
    'Instagram': 'smm-owner-plat-instagram',
    'Telegram': 'smm-owner-plat-telegram',
    'YouTube': 'smm-owner-plat-youtube',
    'Facebook': 'smm-owner-plat-facebook',
    'TikTok': 'smm-owner-plat-tiktok',
    'Twitter / X': 'smm-owner-plat-twitter',
    'Spotify': 'smm-owner-plat-spotify'
  };

  const activeBtn = document.getElementById(platIdMap[platform]);
  if (activeBtn) activeBtn.classList.add('active');

  renderOwnerSmmServicesTable();
}

function debounceFilterOwnerSmmServices() {
  clearTimeout(smmServicesSearchDebounceTimer);
  smmServicesSearchDebounceTimer = setTimeout(() => {
    const searchInput = document.getElementById('owner-smm-services-search');
    currentOwnerSmmSearchQuery = searchInput ? searchInput.value.trim().toLowerCase() : '';
    renderOwnerSmmServicesTable();
  }, 250);
}

// Restore Default Cloud Products & Stocks
async function restoreDefaultCloudProducts() {
  if (!confirm('Are you sure you want to restore the default Cloud Accounts (Azure, Gmail, WhatsApp Numbers, GCP, Windows 365, AWS, etc.) and stock keys?')) {
    return;
  }

  try {
    const res = await fetch('/api/owner/products/seed-defaults', { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      if (typeof fetchAdminProducts === 'function') fetchAdminProducts();
      if (typeof fetchStockSummary === 'function') fetchStockSummary();
      if (typeof updateKPIs === 'function') updateKPIs();
    } else {
      showToast(`Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Restore failed: ${err.message}`, 'error');
  }
}

// Render IndianSMMHub Services Table
function renderOwnerSmmServicesTable() {
  const tbody = document.getElementById('owner-smm-services-tbody');
  if (!tbody) return;

  let filtered = ownerSmmServicesList;

  if (activeOwnerSmmPlatformFilter !== 'ALL') {
    filtered = filtered.filter(s => (s.platform || '').toLowerCase() === activeOwnerSmmPlatformFilter.toLowerCase());
  }

  if (currentOwnerSmmSearchQuery.length > 0) {
    filtered = filtered.filter(s =>
      s.name.toLowerCase().includes(currentOwnerSmmSearchQuery) ||
      s.category.toLowerCase().includes(currentOwnerSmmSearchQuery) ||
      String(s.service).includes(currentOwnerSmmSearchQuery)
    );
  }

  if (!filtered || filtered.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:2rem; margin-bottom:6px;">📦</div>
          No services found matching the selected filter.
        </td>
      </tr>
    `;
    return;
  }

  // Display top 150 results for speed if large list
  const displayList = filtered.slice(0, 150);

  tbody.innerHTML = displayList.map(s => {
    const isCustom = Boolean(s.customOverride);
    const isActive = s.active !== false;
    const baseCost = parseFloat(s.rawRateInr || s.rawRate || 0);

    return `
      <tr>
        <td>
          <span style="font-family:monospace; color:#38bdf8; font-weight:700;">#${s.service}</span>
        </td>
        <td>
          <span class="badge badge-primary" style="font-size:0.72rem; font-weight:700;">${escapeHtml(s.platform)}</span>
          <div style="font-size:0.75rem; color:var(--text-dim); margin-top:2px; max-width:180px; overflow:hidden; text-overflow:ellipsis; white-space:nowrap;">
            ${escapeHtml(s.category)}
          </div>
        </td>
        <td>
          <strong style="color:#ffffff; font-size:0.86rem; display:block;">${escapeHtml(s.name)}</strong>
          ${isCustom ? `<span class="badge badge-success" style="font-size:0.65rem; margin-top:2px;">⭐ Custom Price Set</span>` : ''}
        </td>
        <td>
          <span style="color:#94a3b8; font-family:monospace; font-size:0.85rem;">₹${baseCost.toFixed(3)}</span>
        </td>
        <td>
          <strong style="color:${isCustom ? '#facc15' : '#22c55e'}; font-size:0.95rem;">₹${(s.rateInr || 0).toLocaleString()}</strong>
          <span style="font-size:0.7rem; color:var(--text-dim); display:block;">/ 1K (${isCustom ? 'Custom' : '+Markup'})</span>
        </td>
        <td style="font-size:0.82rem; color:var(--text-muted);">
          ${(s.min || 10).toLocaleString()} - ${(s.max || 100000).toLocaleString()}
        </td>
        <td>
          <span class="badge ${s.refill ? 'badge-success' : 'badge-secondary'}" style="font-size:0.72rem;">
            ${s.refill ? '🛡️ Refill' : 'No Refill'}
          </span>
        </td>
        <td>
          <span class="badge ${isActive ? 'badge-success' : 'badge-danger'}" style="font-size:0.72rem;">
            ${isActive ? '🟢 Active' : '🔴 Inactive'}
          </span>
        </td>
        <td style="text-align:right;">
          <button type="button" class="btn btn-secondary" onclick="openOwnerSmmRateModal(${s.service})" style="padding:4px 10px; font-size:0.75rem; border-color:var(--yellow-primary); color:var(--yellow-primary); font-weight:700;">
            ✏️ Edit Rate
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

// Open SMM Rate Editor Modal
function openOwnerSmmRateModal(serviceId) {
  const s = ownerSmmServicesList.find(item => item.service === serviceId);
  if (!s) return;

  const baseCost = parseFloat(s.rawRateInr || s.rawRate || 0);

  document.getElementById('smm-edit-modal-title').innerText = `✏️ Edit Service Rate: [#${s.service}]`;
  document.getElementById('smm-edit-service-id').value = s.service;
  document.getElementById('smm-edit-name').value = s.name;
  document.getElementById('smm-edit-raw-rate').value = `₹${baseCost.toFixed(3)} INR / 1,000`;
  document.getElementById('smm-edit-rate-inr').value = s.rateInr || 10;
  document.getElementById('smm-edit-min').value = s.min || 10;
  document.getElementById('smm-edit-max').value = s.max || 100000;
  document.getElementById('smm-edit-refill').checked = Boolean(s.refill);
  document.getElementById('smm-edit-active').checked = s.active !== false;

  const resetBtn = document.getElementById('smm-edit-reset-btn');
  if (resetBtn) {
    resetBtn.style.display = s.customOverride ? 'inline-block' : 'none';
  }

  openModal('owner-smm-rate-modal');
}

// Save Custom SMM Rate & Settings
async function saveOwnerCustomServiceRate() {
  const serviceId = parseInt(document.getElementById('smm-edit-service-id')?.value, 10);
  const name = (document.getElementById('smm-edit-name')?.value || '').trim();
  const rateInr = parseFloat(document.getElementById('smm-edit-rate-inr')?.value);
  const min = parseInt(document.getElementById('smm-edit-min')?.value, 10);
  const max = parseInt(document.getElementById('smm-edit-max')?.value, 10);
  const refill = document.getElementById('smm-edit-refill')?.checked;
  const active = document.getElementById('smm-edit-active')?.checked;

  if (!serviceId || isNaN(rateInr)) {
    showToast('Please enter a valid rate in ₹ INR!', 'error');
    return;
  }

  try {
    const res = await fetch('/api/owner/smm/service/override', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ serviceId, name, rateInr, min, max, refill, active })
    });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      closeModal('owner-smm-rate-modal');
      await fetchOwnerSmmDashboard();
    } else {
      showToast(`Error: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast(`Failed to save rate: ${err.message}`, 'error');
  }
}

// Reset Custom Service Rate to Multiplier formula
async function resetCustomServiceRate() {
  const serviceId = parseInt(document.getElementById('smm-edit-service-id')?.value, 10);
  if (!serviceId) return;

  if (!confirm(`Reset service #${serviceId} rate to standard formula price?`)) return;

  try {
    const res = await fetch(`/api/owner/smm/service/override/${serviceId}`, { method: 'DELETE' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'info');
      closeModal('owner-smm-rate-modal');
      await fetchOwnerSmmDashboard();
    }
  } catch (err) {
    showToast(`Reset error: ${err.message}`, 'error');
  }
}

// Fetch SMM Orders
async function fetchOwnerSmmOrders() {
  const status = document.getElementById('owner-smm-orders-status-filter')?.value || 'ALL';
  const search = (document.getElementById('owner-smm-orders-search')?.value || '').trim();

  try {
    const res = await fetch(`/api/owner/smm/orders?status=${encodeURIComponent(status)}&search=${encodeURIComponent(search)}`);
    const data = await res.json();
    if (data.success && data.orders) {
      ownerSmmOrdersList = data.orders;
      renderOwnerSmmOrdersTable();
    }
  } catch (err) {
    console.error('Error fetching SMM orders:', err);
  }
}

function debounceFilterSmmOrders() {
  clearTimeout(smmSearchDebounceTimer);
  smmSearchDebounceTimer = setTimeout(fetchOwnerSmmOrders, 300);
}

// Render SMM Orders Table with Real-Time Progress Bar & Metrics
function renderOwnerSmmOrdersTable() {
  const tbody = document.getElementById('owner-smm-orders-tbody');
  if (!tbody) return;

  if (!ownerSmmOrdersList || ownerSmmOrdersList.length === 0) {
    tbody.innerHTML = `
      <tr>
        <td colspan="9" style="text-align:center; padding:40px 20px; color:var(--text-muted);">
          <div style="font-size:2.2rem; margin-bottom:8px;">🚚</div>
          No customer growth orders found. Live orders will appear here automatically!
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = ownerSmmOrdersList.map(o => {
    const dateStr = new Date(o.createdAt).toLocaleDateString([], { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });

    const qty = o.quantity || 1;
    const remains = o.remains !== undefined ? o.remains : (o.status === 'Completed' ? 0 : qty);
    const delivered = Math.max(0, Math.min(qty, qty - remains));
    const progressPercent = o.status === 'Completed' ? 100 : Math.min(100, Math.round((delivered / qty) * 100));

    let statusClass = 'badge-warning';
    if (o.status === 'Completed') statusClass = 'badge-success';
    else if (o.status === 'In Progress' || o.status === 'In progress') statusClass = 'badge-primary';
    else if (o.status === 'Partial') statusClass = 'badge-yellow';
    else if (o.status === 'Canceled') statusClass = 'badge-danger';

    return `
      <tr>
        <td>
          <strong style="color:var(--yellow-primary); font-family:monospace; font-size:0.88rem;">${escapeHtml(o.orderId)}</strong>
          ${o.refillable ? `<span class="badge badge-yellow" style="font-size:0.65rem; display:block; width:fit-content; margin-top:2px;">🛡️ Refill</span>` : ''}
        </td>
        <td>
          ${o.providerOrderId ? `<span style="font-family:monospace; color:#38bdf8; font-weight:700;">#${escapeHtml(o.providerOrderId)}</span>` : '<span style="color:#94a3b8; font-size:0.75rem;">Queued</span>'}
        </td>
        <td>
          <strong style="color:#ffffff; font-size:0.85rem;">${escapeHtml(o.userName || 'Customer')}</strong>
          <div style="font-size:0.75rem; color:#38bdf8;">${escapeHtml(o.userPhone || 'No Phone')}</div>
          <div style="font-size:0.7rem; color:var(--text-dim);">${dateStr}</div>
        </td>
        <td>
          <strong style="color:#ffffff; font-size:0.84rem; display:block;">${escapeHtml(o.serviceName)}</strong>
          <span class="badge badge-primary" style="font-size:0.7rem;">${escapeHtml(o.platform)}</span>
        </td>
        <td>
          <a href="${escapeHtml(o.targetUrl)}" target="_blank" style="color:#38bdf8; font-size:0.8rem; font-family:monospace; text-decoration:underline; word-break:break-all; max-width:140px; display:inline-block;">
            🔗 ${escapeHtml(o.targetUrl.length > 25 ? o.targetUrl.slice(0, 25) + '...' : o.targetUrl)}
          </a>
        </td>
        <td>
          <!-- LIVE PROGRESS BAR & COUNTER -->
          <div style="font-size:0.85rem; font-weight:800; color:#ffffff; margin-bottom:3px;">
            ${qty.toLocaleString()} Units
          </div>
          <div style="background:rgba(0,0,0,0.3); border-radius:4px; overflow:hidden; height:6px; width:100px; margin-bottom:3px; border:1px solid rgba(255,255,255,0.1);">
            <div style="background:linear-gradient(90deg, #38bdf8, #22c55e); height:100%; width:${progressPercent}%;"></div>
          </div>
          <div style="font-size:0.68rem; color:var(--text-dim);">
            Done: <span style="color:#22c55e; font-weight:700;">${delivered.toLocaleString()}</span> | Left: <span style="color:#facc15;">${remains.toLocaleString()}</span> (${progressPercent}%)
          </div>
        </td>
        <td>
          <strong style="color:#22c55e; font-size:0.95rem;">₹${(o.totalCost || 0).toLocaleString()}</strong>
        </td>
        <td>
          <span class="badge ${statusClass}">
            ${escapeHtml(o.status || 'Processing')}
          </span>
        </td>
        <td style="text-align:right;">
          <div style="display:flex; justify-content:flex-end; gap:6px;">
            ${(!o.providerOrderId || isNaN(Number(o.providerOrderId))) ? `
              <button type="button" class="btn btn-primary" onclick="retryOwnerSmmDispatch('${o.orderId}')" style="padding:4px 8px; font-size:0.75rem; font-weight:700;" title="Dispatch order to IndianSMMHub">
                🚀 Dispatch
              </button>
            ` : `
              <button type="button" class="btn btn-secondary" onclick="syncSinglePeakerrOrderStatus('${o.orderId}')" style="padding:4px 8px; font-size:0.75rem;" title="Sync Live Status directly from IndianSMMHub">
                🔄 Sync
              </button>
            `}
            <button type="button" class="btn btn-secondary" onclick="openOwnerSmmOrderModal('${o.orderId}')" style="padding:4px 8px; font-size:0.75rem;">
              🔍 Details
            </button>
            ${o.refillable ? `
              <button type="button" class="btn btn-secondary" onclick="triggerOwnerSmmRefill('${o.orderId}')" style="padding:4px 8px; font-size:0.75rem; border-color:var(--yellow-primary); color:var(--yellow-primary);" title="Trigger Refill">
                🛡️
              </button>
            ` : ''}
          </div>
        </td>
      </tr>
    `;
  }).join('');
}

// Retry or send dispatch directly to IndianSMMHub API
async function retryOwnerSmmDispatch(orderId) {
  try {
    showToast('🚀 Dispatching order to IndianSMMHub...', 'info');
    const res = await fetch(`/api/owner/smm/orders/${orderId}/retry-dispatch`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(data.message, 'success');
      fetchOwnerSmmOrders();
    } else {
      showToast(data.message || 'Dispatch notice from IndianSMMHub', 'error');
    }
  } catch (err) {
    showToast('Dispatch error: ' + err.message, 'error');
  }
}

// Sync single order status directly from IndianSMMHub
async function syncSinglePeakerrOrderStatus(orderId) {
  try {
    const res = await fetch(`/api/owner/smm/orders/${orderId}/sync-status`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`✅ ${data.message}`, 'success');
      fetchOwnerSmmOrders();
    } else {
      showToast(`Sync notice: ${data.message}`, 'info');
    }
  } catch (err) {
    showToast('Sync error: ' + err.message, 'error');
  }
}
const syncSingleIndianSmmOrderStatus = syncSinglePeakerrOrderStatus;

// Open SMM Order Inspection Modal
function openOwnerSmmOrderModal(orderId) {
  const o = ownerSmmOrdersList.find(item => item.orderId === orderId || item._id === orderId);
  if (!o) return;

  currentSelectedSmmModalOrder = o;

  document.getElementById('smm-mod-order-id').innerText = `${o.orderId} ${o.providerOrderId ? `(IndianSMM #${o.providerOrderId})` : ''}`;
  document.getElementById('smm-mod-status-badge').innerText = o.status || 'Processing';
  document.getElementById('smm-mod-customer-name').innerText = o.userName || 'Customer';
  document.getElementById('smm-mod-customer-phone').innerText = o.userPhone || 'N/A';
  document.getElementById('smm-mod-service-name').innerText = `${o.serviceName} (${o.platform})`;
  document.getElementById('smm-mod-qty-total').innerText = `${(o.quantity || 0).toLocaleString()} Units • ₹${o.totalCost || 0}`;
  document.getElementById('smm-mod-target-url').value = o.targetUrl;
  document.getElementById('smm-mod-open-link-btn').href = o.targetUrl;

  const commentsBox = document.getElementById('smm-mod-comments-box');
  const commentsText = document.getElementById('smm-mod-comments-text');
  if (o.customComments && o.customComments.trim().length > 0) {
    if (commentsBox) commentsBox.style.display = 'block';
    if (commentsText) commentsText.value = o.customComments;
  } else {
    if (commentsBox) commentsBox.style.display = 'none';
  }

  document.getElementById('smm-mod-status-select').value = o.status || 'Processing';
  document.getElementById('smm-mod-payment-select').value = o.paymentStatus || 'PAID';

  openModal('owner-smm-order-modal');
}

// Save Modal Status Override
async function saveOwnerSmmOrderStatusModal() {
  if (!currentSelectedSmmModalOrder) return;

  const status = document.getElementById('smm-mod-status-select')?.value;
  const paymentStatus = document.getElementById('smm-mod-payment-select')?.value;

  try {
    const res = await fetch(`/api/owner/smm/orders/${currentSelectedSmmModalOrder.orderId}/status`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, paymentStatus })
    });
    const data = await res.json();
    if (data.success) {
      showToast(`Order ${currentSelectedSmmModalOrder.orderId} updated to ${status}.`, 'success');
      closeModal('owner-smm-order-modal');
      fetchOwnerSmmOrders();
    }
  } catch (err) {
    showToast('Failed to update status: ' + err.message, 'error');
  }
}

// Trigger Refill from Modal or Table
async function triggerOwnerRefillFromModal() {
  if (!currentSelectedSmmModalOrder) return;
  await triggerOwnerSmmRefill(currentSelectedSmmModalOrder.orderId);
}

async function triggerOwnerSmmRefill(orderId) {
  try {
    const res = await fetch(`/api/owner/smm/orders/${orderId}/refill`, { method: 'POST' });
    const data = await res.json();
    if (data.success) {
      showToast(`🔄 Refill sent to IndianSMMHub! Refill ID: ${data.refillId || 'OK'}`, 'success');
      fetchOwnerSmmOrders();
    } else {
      showToast(`Refill failed: ${data.message}`, 'error');
    }
  } catch (err) {
    showToast('Refill error: ' + err.message, 'error');
  }
}

// Attach IndianSMMHub Settings Form Submit Handler
document.addEventListener('DOMContentLoaded', () => {
  const settingsForm = document.getElementById('owner-smm-settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      const smmProviderUrl = (document.getElementById('setting-smm-provider-url')?.value || '').trim();
      const smmApiKey = (document.getElementById('setting-smm-api-key')?.value || '').trim();
      const smmProfitMargin = parseFloat(document.getElementById('setting-smm-profit-margin')?.value) || 1.30;

      try {
        const res = await fetch('/api/owner/smm/settings', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ smmProviderUrl, smmApiKey, smmProfitMargin })
        });
        const data = await res.json();
        if (data.success) {
          showToast('IndianSMMHub API settings & profit markup saved successfully!', 'success');
          await fetchOwnerSmmDashboard();
        } else {
          showToast('Failed to save settings: ' + data.message, 'error');
        }
      } catch (err) {
        showToast('Settings error: ' + err.message, 'error');
      }
    });
  }
});


