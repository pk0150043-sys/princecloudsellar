// Owner Admin Application Logic with Realtime IST Clock, Dual Currency Switcher & On-Chain Audit Links

let ownerToken = localStorage.getItem('prince_owner_token') || null;
let activeTab = 'dashboard';
let currentProducts = [];
let currentAvailableStocks = [];
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
  onMainProductChange('Azure');
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

  const optionsHtml = ALL_WORLD_COUNTRIES.map(c => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`).join('');

  if (prodCountrySelect) prodCountrySelect.innerHTML = optionsHtml;
  if (stockCountrySelect) stockCountrySelect.innerHTML = optionsHtml;
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

  const settingsForm = document.getElementById('settings-form');
  if (settingsForm) {
    settingsForm.addEventListener('submit', async (e) => {
      e.preventDefault();
      await handleSaveSettings();
    });
  }
}

function onMainProductChange(mainVal) {
  const customMainGroup = document.getElementById('custom-main-group');
  const subSelect = document.getElementById('prod-sub-select');

  if (mainVal === '__CUSTOM__') {
    customMainGroup.style.display = 'block';
    subSelect.innerHTML = '<option value="__CUSTOM__">➕ Add Custom Sub-Product...</option>';
    onSubProductChange('__CUSTOM__');
  } else {
    customMainGroup.style.display = 'none';
    const subs = PRESETS[mainVal] || [];
    subSelect.innerHTML = subs.map(s => `<option value="${s}">${s}</option>`) +
      '<option value="__CUSTOM__">➕ Add Custom Sub-Product...</option>';
    if (subs.length > 0) {
      onSubProductChange(subs[0]);
    } else {
      onSubProductChange('__CUSTOM__');
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

  const subs = [...(PRESETS[mainVal] || [])];
  
  // Merge any sub-products created by owner for this main product!
  currentProducts.filter(p => p.name === mainVal).forEach(p => {
    if (p.subProduct && !subs.includes(p.subProduct)) {
      subs.push(p.subProduct);
    }
  });

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

  setInterval(() => {
    if (ownerToken) {
      fetchMetrics();
      fetchRecentTransactions();
    }
  }, 6000);
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
      document.getElementById('kpi-stock-val').innerText = `${m.availableStocksCount} Items`;
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
          <span class="badge badge-success">PAID & VERIFIED</span><br>
          ${isTxHashReal 
            ? `<a href="${bscScanUrl}" target="_blank" style="font-size:0.72rem; color:var(--yellow-primary); text-decoration:underline;">🔍 BscScan Audit</a>` 
            : `<span style="font-size:0.72rem; color:var(--text-dim);">⚡ Web3 Auto</span>`
          }
        </td>
        <td>
          <span class="badge ${ord.deliveryStatus === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">
            ${ord.deliveryStatus}
          </span>
        </td>
      </tr>
    `;
  }).join('');
}

// ----------------------------------------------------
// CUSTOMER DETAILS DIRECTORY & ACCOUNT MANAGEMENT
// ----------------------------------------------------

async function fetchCustomerDetails() {
  try {
    const res = await fetch('/api/owner/customers');
    const data = await res.json();
    if (data.success) {
      renderCustomersTable(data.customers);
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

// ----------------------------------------------------
// PRODUCTS MANAGEMENT
// ----------------------------------------------------

async function fetchProducts() {
  try {
    const res = await fetch('/api/products?t=' + Date.now());
    const data = await res.json();
    if (data.success) {
      currentProducts = data.products;
      renderAdminProducts(data.products);
      populateStockProductDropdown(data.products);
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
          <button class="btn btn-primary" style="padding:6px 12px; font-size:0.8rem;" onclick="quickAddStockForProduct('${p._id}')">➕ Add Keys</button>
          <button class="btn btn-danger" style="padding:6px 12px; font-size:0.8rem;" onclick="deleteProduct('${p._id}')">Delete</button>
        </div>
      </div>
    </div>
  `).join('');
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
// ORDERS MANAGEMENT WITH BLOCKCHAIN AUDIT
// ----------------------------------------------------

async function fetchOrders(filterStatus = 'ALL') {
  try {
    const res = await fetch(`/api/owner/orders?status=${filterStatus}`);
    const data = await res.json();
    if (data.success) {
      renderOrdersTable(data.orders);
    }
  } catch (err) {
    console.error('Fetch orders error:', err);
  }
}

function renderOrdersTable(orders) {
  const tbody = document.getElementById('orders-table-tbody');
  if (!tbody) return;

  if (!orders || orders.length === 0) {
    tbody.innerHTML = `<tr><td colspan="8" style="text-align:center; color: var(--text-muted); padding:30px;">No orders found.</td></tr>`;
    return;
  }

  tbody.innerHTML = orders.map(ord => {
    const isTxHashReal = ord.txHash && ord.txHash.startsWith('0x');
    const bscScanUrl = isTxHashReal ? `https://bscscan.com/tx/${ord.txHash}` : '#';

    return `
      <tr>
        <td><span style="font-family:monospace; color:var(--text-muted);">${ord._id.substring(0, 10)}</span></td>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(ord.userName)}</strong><br>
          <span style="font-size:0.8rem; color:var(--yellow-primary);">${escapeHtml(ord.userPhone)}</span>
        </td>
        <td>
          <strong style="color:#ffffff;">${escapeHtml(ord.productName)}</strong><br>
          <span style="font-size:0.78rem; color:var(--pink-accent);">${escapeHtml(ord.subProduct || '')}</span>
        </td>
        <td><span class="badge badge-yellow">${escapeHtml(ord.country || '🌐 Global')}</span></td>
        <td>
          <strong style="color:var(--green-bright);">${formatOwnerPriceDisplay(ord.totalPaid)}</strong><br>
          ${isTxHashReal 
            ? `<a href="${bscScanUrl}" target="_blank" style="font-size:0.72rem; color:var(--yellow-primary); text-decoration:underline;">🔍 Audit on BscScan</a>` 
            : `<span style="font-size:0.72rem; color:var(--text-dim);">⚡ Verified</span>`
          }
        </td>
        <td>
          <span class="badge ${ord.deliveryStatus === 'DELIVERED' ? 'badge-success' : 'badge-warning'}">
            ${ord.deliveryStatus}
          </span>
        </td>
        <td>
          <div class="code-box" style="font-size:0.75rem; max-width:180px; max-height:60px; overflow:hidden;">
            ${escapeHtml(ord.deliveredItem || 'No key')}
          </div>
        </td>
        <td>
          <span style="font-size:0.78rem; color:var(--text-dim);">${new Date(ord.createdAt).toLocaleString()}</span>
        </td>
      </tr>
    `;
  }).join('');
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
      if (document.getElementById('setting-owner-phone')) document.getElementById('setting-owner-phone').value = s.ownerPhone || '';
      if (document.getElementById('setting-support-url')) document.getElementById('setting-support-url').value = s.supportUrl || '';
    }
  } catch (err) {
    console.error('Fetch settings error:', err);
  }
}

async function handleSaveSettings() {
  const ownerPhone = document.getElementById('setting-owner-phone').value;
  const supportUrl = document.getElementById('setting-support-url').value;

  try {
    const res = await fetch('/api/owner/settings', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ ownerPhone, supportUrl })
    });
    const data = await res.json();
    if (data.success) {
      showToast('Owner support settings saved successfully!', 'success');
    } else {
      showToast(data.message, 'error');
    }
  } catch (err) {
    showToast('Save settings error: ' + err.message, 'error');
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
