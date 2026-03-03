/* ══════════════════════════════════════════════════
   BoostPrime — script.js
   Features: Auth, Custom Price, QRIS Generator,
             Upload Bukti, Admin Panel, Storage
══════════════════════════════════════════════════ */

// ─── STORAGE HELPERS ──────────────────────────────
const DB = {
  get: (k) => { try { return JSON.parse(localStorage.getItem('bp_' + k)); } catch { return null; } },
  set: (k, v) => { localStorage.setItem('bp_' + k, JSON.stringify(v)); },
  del: (k) => { localStorage.removeItem('bp_' + k); }
};

function initDB() {
  if (!DB.get('users')) DB.set('users', [
    { id: 'admin', username: 'admin', email: 'admin@boostprime.id', password: 'admin123', role: 'admin', createdAt: Date.now() }
  ]);
  if (!DB.get('orders')) DB.set('orders', []);
}

// ─── AUTH STATE ────────────────────────────────────
let currentUser = null;
let checkoutData = {};
let countdownTimer = null;
let currentAdminTab = 'pending';
let currentUserTab = 'orders';

function getCurrentUser() { return DB.get('session'); }
function setSession(user) { DB.set('session', user); currentUser = user; }
function clearSession() { DB.del('session'); currentUser = null; }

// ─── TOAST ─────────────────────────────────────────
function toast(msg, type = 'info') {
  const icons = { success: '✅', error: '❌', info: '⚡' };
  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.innerHTML = `<span class="toast-ic">${icons[type]}</span><span>${msg}</span>`;
  document.querySelector('.toast-wrap').appendChild(el);
  setTimeout(() => el.remove(), 3500);
}

// ─── SCREEN NAVIGATION ────────────────────────────
function showScreen(id) {
  document.querySelectorAll('.screen').forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
  window.scrollTo(0, 0);
}

// ─── FORMAT CURRENCY ──────────────────────────────
function fmt(n) { return 'Rp ' + Number(n).toLocaleString('id-ID'); }
function fmtShort(n) {
  if (n >= 1000000) return 'Rp ' + (n / 1000000).toFixed(n % 1000000 === 0 ? 0 : 1) + 'jt';
  if (n >= 1000) return 'Rp ' + (n / 1000).toFixed(0) + 'rb';
  return 'Rp ' + n;
}

// ─── RANDOM ID ─────────────────────────────────────
function uid() { return 'BP' + Date.now().toString(36).toUpperCase() + Math.random().toString(36).slice(2, 5).toUpperCase(); }

// ─── NAV UPDATE ────────────────────────────────────
function updateNav() {
  const user = getCurrentUser();
  const nr = document.getElementById('nav-right');
  const loginArea = document.getElementById('nav-login-area');
  const userArea = document.getElementById('nav-user-area');
  const adminBtn = document.getElementById('nav-admin-btn');

  if (user) {
    if (loginArea) loginArea.classList.add('hidden');
    if (userArea) {
      userArea.classList.remove('hidden');
      document.getElementById('nav-username').textContent = user.username;
    }
    if (adminBtn) {
      adminBtn.classList.toggle('hidden', user.role !== 'admin');
    }
  } else {
    if (loginArea) loginArea.classList.remove('hidden');
    if (userArea) userArea.classList.add('hidden');
    if (adminBtn) adminBtn.classList.add('hidden');
  }
}

// ─── AUTH FUNCTIONS ────────────────────────────────
function showAuth(tab = 'login') {
  showScreen('screen-auth');
  switchAuthTab(tab);
}

function switchAuthTab(tab) {
  document.querySelectorAll('.auth-tab').forEach(t => t.classList.remove('active'));
  document.getElementById('tab-' + tab).classList.add('active');
  document.getElementById('form-login').classList.toggle('hidden', tab !== 'login');
  document.getElementById('form-register').classList.toggle('hidden', tab !== 'register');
}

function doLogin(e) {
  e && e.preventDefault();
  const email = document.getElementById('login-email').value.trim();
  const pass = document.getElementById('login-pass').value;
  const users = DB.get('users') || [];
  const user = users.find(u => (u.email === email || u.username === email) && u.password === pass);
  if (!user) { toast('Email/password salah!', 'error'); return; }
  setSession(user);
  updateNav();
  toast(`Selamat datang, ${user.username}!`, 'success');
  if (checkoutData.price) {
    goCheckout();
  } else if (user.role === 'admin') {
    showAdminPanel();
  } else {
    showDashboard();
  }
}

function doRegister(e) {
  e && e.preventDefault();
  const username = document.getElementById('reg-username').value.trim();
  const email = document.getElementById('reg-email').value.trim();
  const pass = document.getElementById('reg-pass').value;
  const pass2 = document.getElementById('reg-pass2').value;
  if (!username || !email || !pass) { toast('Lengkapi semua field!', 'error'); return; }
  if (pass !== pass2) { toast('Password tidak sama!', 'error'); return; }
  if (pass.length < 6) { toast('Password minimal 6 karakter!', 'error'); return; }
  const users = DB.get('users') || [];
  if (users.find(u => u.email === email)) { toast('Email sudah terdaftar!', 'error'); return; }
  if (users.find(u => u.username === username)) { toast('Username sudah dipakai!', 'error'); return; }
  const newUser = { id: uid(), username, email, password: pass, role: 'user', createdAt: Date.now() };
  users.push(newUser);
  DB.set('users', users);
  setSession(newUser);
  updateNav();
  toast('Akun berhasil dibuat! Selamat datang 🎉', 'success');
  if (checkoutData.price) goCheckout();
  else showDashboard();
}

function doLogout() {
  clearSession();
  checkoutData = {};
  updateNav();
  showScreen('screen-landing');
  toast('Berhasil logout', 'info');
}

// ─── LANDING SLIDER & QUICK PICKS ─────────────────
const PACKAGES = [
  { id: 'starter', name: 'Starter', price: 50000, desc: '1.000 Followers + 500 Likes', hot: false },
  { id: 'pro', name: 'Pro', price: 250000, desc: '5K Followers + 10K Views', hot: true },
  { id: 'elite', name: 'Elite', price: 750000, desc: '20K Followers Multi-platform', hot: false }
];

function initSlider() {
  const slider = document.getElementById('price-slider');
  const display = document.getElementById('price-display');
  const followEst = document.getElementById('est-followers');
  const viewEst = document.getElementById('est-views');
  const platformVal = document.getElementById('platform-val');

  function update() {
    const val = parseInt(slider.value);
    const min = parseInt(slider.min), max = parseInt(slider.max);
    const pct = ((val - min) / (max - min)) * 100;
    slider.style.setProperty('--pct', pct + '%');
    display.textContent = fmtShort(val);
    // Estimates
    const followers = Math.floor(val / 45);
    const views = Math.floor(val / 8);
    followEst.textContent = followers.toLocaleString('id-ID') + '+ Followers';
    viewEst.textContent = views.toLocaleString('id-ID') + '+ Views';
    checkoutData.price = val;
    checkoutData.type = 'Custom';
    checkoutData.label = fmtShort(val);

    // Deselect quick picks if custom
    document.querySelectorAll('.quick-card').forEach(c => c.classList.remove('active'));
  }

  slider.addEventListener('input', update);
  update();
}

function pickPackage(id) {
  const pkg = PACKAGES.find(p => p.id === id);
  if (!pkg) return;
  document.querySelectorAll('.quick-card').forEach(c => c.classList.remove('active'));
  document.getElementById('qc-' + id).classList.add('active');
  // Update slider
  const slider = document.getElementById('price-slider');
  slider.value = pkg.price;
  slider.dispatchEvent(new Event('input'));
  checkoutData.price = pkg.price;
  checkoutData.type = pkg.name;
  checkoutData.label = fmtShort(pkg.price);
  checkoutData.desc = pkg.desc;
}

function handleBuyNow() {
  const user = getCurrentUser();
  const platform = document.getElementById('main-platform').value;
  const username = document.getElementById('main-username').value.trim();
  if (!platform || !username) { toast('Pilih platform dan isi username kamu!', 'error'); return; }
  checkoutData.platform = platform;
  checkoutData.username = username;
  if (!user) {
    toast('Login dulu untuk melanjutkan pembayaran', 'info');
    showAuth('login');
    return;
  }
  goCheckout();
}

// ─── CHECKOUT ──────────────────────────────────────
function goCheckout() {
  if (!checkoutData.price) { toast('Pilih paket atau atur harga dulu!', 'error'); return; }
  checkoutData.orderId = uid();

  // Fill summary
  document.getElementById('co-plan').textContent = checkoutData.type || 'Custom';
  document.getElementById('co-platform').textContent = checkoutData.platform || '-';
  document.getElementById('co-user').textContent = checkoutData.username || '-';
  document.getElementById('co-price').textContent = fmt(checkoutData.price);
  document.getElementById('co-total').textContent = fmt(checkoutData.price);

  showScreen('screen-checkout');
  generateQRIS();
}

// ─── QRIS GENERATOR ────────────────────────────────
function buildQRIS(amount) {
  const nmid = 'ID1023200019391';
  const tlv = (tag, val) => `${tag}${String(val.length).padStart(2,'0')}${val}`;
  const pfi = tlv('00','01');
  const poi = tlv('01','12');
  const mai = tlv('26', tlv('00','com.boostprime') + tlv('01', nmid));
  const mcc = tlv('52','5999');
  const cur = tlv('53','360');
  const amt = tlv('54', String(amount));
  const country = tlv('58','ID');
  const mname = tlv('59','BOOSTPRIME');
  const mcity = tlv('60','JAKARTA');
  const ref = tlv('05', 'BP' + Date.now().toString().slice(-8));
  const add = tlv('62', ref);
  const base = pfi+poi+mai+mcc+cur+amt+country+mname+mcity+add+'6304';
  function crc16(s) {
    let c = 0xFFFF;
    for (let i = 0; i < s.length; i++) {
      c ^= s.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) c = (c & 0x8000) ? (c<<1)^0x1021 : c<<1;
      c &= 0xFFFF;
    }
    return c.toString(16).toUpperCase().padStart(4,'0');
  }
  return base + crc16(base);
}

function generateQRIS() {
  const qrisStr = buildQRIS(checkoutData.price);
  document.getElementById('qris-amt').textContent = fmt(checkoutData.price);
  document.getElementById('qr-render').innerHTML = '';

  new QRCode(document.getElementById('qr-render'), {
    text: qrisStr,
    width: 200, height: 200,
    colorDark: '#000000', colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  startCountdown();
}

function startCountdown() {
  if (countdownTimer) clearInterval(countdownTimer);
  let secs = 15 * 60;
  const el = document.getElementById('countdown-val');

  function tick() {
    const m = Math.floor(secs / 60).toString().padStart(2,'0');
    const s = (secs % 60).toString().padStart(2,'0');
    el.textContent = `${m}:${s}`;
    el.classList.toggle('urgent', secs <= 60);
    if (secs <= 0) {
      clearInterval(countdownTimer);
      el.textContent = 'EXPIRED';
      toast('Waktu pembayaran habis! Refresh QRIS.', 'error');
    }
    secs--;
  }
  tick();
  countdownTimer = setInterval(tick, 1000);
}

function refreshQRIS() {
  generateQRIS();
  toast('QRIS diperbarui!', 'success');
}

// ─── UPLOAD BUKTI ──────────────────────────────────
let proofBase64 = null;

function initUpload() {
  const zone = document.getElementById('upload-zone');
  const input = document.getElementById('proof-file');
  const preview = document.getElementById('proof-preview');
  const previewImg = document.getElementById('proof-preview-img');

  input.addEventListener('change', (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (!file.type.startsWith('image/')) { toast('Hanya file gambar yang diterima!', 'error'); return; }
    if (file.size > 5 * 1024 * 1024) { toast('File terlalu besar! Maks 5MB', 'error'); return; }
    const reader = new FileReader();
    reader.onload = (ev) => {
      proofBase64 = ev.target.result;
      previewImg.src = proofBase64;
      zone.classList.add('hidden');
      preview.classList.remove('hidden');
    };
    reader.readAsDataURL(file);
  });

  ['dragover','dragenter'].forEach(ev => zone.addEventListener(ev, e => { e.preventDefault(); zone.classList.add('drag'); }));
  ['dragleave','drop'].forEach(ev => zone.addEventListener(ev, () => zone.classList.remove('drag')));
  zone.addEventListener('drop', (e) => {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) { input.files = e.dataTransfer.files; input.dispatchEvent(new Event('change')); }
  });
}

function removeProof() {
  proofBase64 = null;
  document.getElementById('proof-file').value = '';
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('proof-preview').classList.add('hidden');
}

function submitProof() {
  if (!proofBase64) { toast('Upload bukti pembayaran dulu!', 'error'); return; }
  const user = getCurrentUser();
  if (!user) { toast('Sesi habis, login ulang!', 'error'); showAuth(); return; }

  const order = {
    id: checkoutData.orderId,
    userId: user.id,
    username: user.username,
    userEmail: user.email,
    price: checkoutData.price,
    type: checkoutData.type || 'Custom',
    platform: checkoutData.platform,
    targetUsername: checkoutData.username,
    proof: proofBase64,
    status: 'pending',
    submittedAt: Date.now(),
    note: ''
  };

  const orders = DB.get('orders') || [];
  orders.push(order);
  DB.set('orders', orders);

  if (countdownTimer) clearInterval(countdownTimer);
  toast('Bukti pembayaran berhasil dikirim! Menunggu verifikasi admin.', 'success');
  showDashboard();
  proofBase64 = null;
  document.getElementById('proof-file').value = '';
  document.getElementById('upload-zone').classList.remove('hidden');
  document.getElementById('proof-preview').classList.add('hidden');
}

// ─── DOWNLOAD QRIS ─────────────────────────────────
function downloadQRIS() {
  const canvas = document.querySelector('#qr-render canvas');
  if (!canvas) return;
  const out = document.createElement('canvas');
  out.width = 360; out.height = 460;
  const ctx = out.getContext('2d');
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 360, 460);
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 0, 360, 54);
  ctx.fillStyle = '#0A0A0A';
  ctx.font = 'bold 20px Arial';
  ctx.fillText('BoostPrime', 22, 34);
  ctx.fillStyle = '#E1001A';
  ctx.fillRect(260, 14, 70, 26);
  ctx.fillStyle = '#fff';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('QRIS', 278, 31);
  ctx.drawImage(canvas, 80, 70, 200, 200);
  ctx.fillStyle = '#111';
  ctx.font = 'bold 14px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BoostPrime', 180, 300);
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 16px Arial';
  ctx.fillText(fmt(checkoutData.price), 180, 320);
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.fillText('Scan dengan GoPay · OVO · DANA · ShopeePay · Bank', 180, 350);
  ctx.fillStyle = '#ddd';
  ctx.fillRect(0, 380, 360, 80);
  ctx.fillStyle = '#aaa';
  ctx.font = '9px Arial';
  ctx.fillText('Order #' + checkoutData.orderId + ' · boostprime.id', 180, 420);
  const a = document.createElement('a');
  a.download = 'QRIS-BoostPrime-' + checkoutData.orderId + '.png';
  a.href = out.toDataURL('image/png');
  a.click();
}

// ─── USER DASHBOARD ────────────────────────────────
function showDashboard() {
  const user = getCurrentUser();
  if (!user) { showAuth(); return; }
  showScreen('screen-dashboard');
  switchUserTab('orders');
  renderUserOrders();
  document.getElementById('dash-username').textContent = user.username;
  document.getElementById('dash-email').textContent = user.email;
  document.getElementById('dash-role').textContent = user.role === 'admin' ? '👑 Admin' : '👤 User';
  document.getElementById('sidebar-admin-link').classList.toggle('hidden', user.role !== 'admin');
}

function switchUserTab(tab) {
  currentUserTab = tab;
  document.querySelectorAll('.sidebar-link').forEach(l => l.classList.remove('active'));
  document.getElementById('sidebar-' + tab).classList.add('active');
  document.querySelectorAll('.dash-panel').forEach(p => p.classList.add('hidden'));
  document.getElementById('panel-' + tab).classList.remove('hidden');
  if (tab === 'orders') renderUserOrders();
  else if (tab === 'profile') renderProfile();
}

function renderUserOrders() {
  const user = getCurrentUser();
  const allOrders = DB.get('orders') || [];
  const myOrders = allOrders.filter(o => o.userId === user.id).sort((a,b) => b.submittedAt - a.submittedAt);
  const tbody = document.getElementById('user-orders-tbody');
  const empty = document.getElementById('user-orders-empty');

  if (myOrders.length === 0) {
    tbody.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  tbody.innerHTML = myOrders.map(o => `
    <tr>
      <td><span style="font-family:'Syne';font-size:11px;color:#666">${o.id}</span></td>
      <td>${o.type} — ${o.platform}</td>
      <td class="amt">${fmt(o.price)}</td>
      <td><span class="badge badge-${o.status}">${statusLabel(o.status)}</span></td>
      <td style="color:#555;font-size:11px">${new Date(o.submittedAt).toLocaleDateString('id-ID')}</td>
      <td>${o.note ? `<span style="font-size:11px;color:#888">${o.note}</span>` : '—'}</td>
    </tr>
  `).join('');
}

function renderProfile() {
  const user = getCurrentUser();
  const allOrders = DB.get('orders') || [];
  const my = allOrders.filter(o => o.userId === user.id);
  document.getElementById('profile-total-orders').textContent = my.length;
  document.getElementById('profile-total-spent').textContent = fmt(my.reduce((s,o) => s + o.price, 0));
  document.getElementById('profile-verified').textContent = my.filter(o => o.status === 'verified').length;
}

function statusLabel(s) {
  return { pending: 'Menunggu', verified: 'Terverifikasi', rejected: 'Ditolak' }[s] || s;
}

// ─── ADMIN PANEL ───────────────────────────────────
function showAdminPanel() {
  const user = getCurrentUser();
  if (!user || user.role !== 'admin') { toast('Akses ditolak!', 'error'); return; }
  showScreen('screen-admin');
  switchAdminTab('pending');
}

function switchAdminTab(tab) {
  currentAdminTab = tab;
  document.querySelectorAll('.admin-tab-btn').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
  renderAdminOrders(tab);
  renderAdminStats();
}

function renderAdminStats() {
  const orders = DB.get('orders') || [];
  document.getElementById('a-total').textContent = orders.length;
  document.getElementById('a-pending').textContent = orders.filter(o => o.status === 'pending').length;
  document.getElementById('a-verified').textContent = orders.filter(o => o.status === 'verified').length;
  document.getElementById('a-revenue').textContent = fmtShort(orders.filter(o => o.status === 'verified').reduce((s,o) => s+o.price, 0));
}

function renderAdminOrders(tab) {
  const orders = (DB.get('orders') || []).filter(o => o.status === tab).sort((a,b) => b.submittedAt - a.submittedAt);
  const container = document.getElementById('admin-orders-container');
  const empty = document.getElementById('admin-empty');

  if (orders.length === 0) {
    container.innerHTML = '';
    empty.classList.remove('hidden');
    return;
  }
  empty.classList.add('hidden');
  container.innerHTML = orders.map(o => `
    <div class="proof-card" id="order-card-${o.id}">
      <div>
        <div class="proof-meta">
          <strong>${o.username}</strong> · ${o.userEmail}<br>
          Order <strong>${o.id}</strong> · ${new Date(o.submittedAt).toLocaleString('id-ID')}
        </div>
        <div class="proof-amt">${fmt(o.price)}</div>
        <div class="proof-meta">
          Paket: <strong>${o.type}</strong> ·
          Platform: <strong>${o.platform}</strong> ·
          Target: <strong>@${o.targetUsername}</strong>
        </div>
        ${o.proof ? `<img class="proof-img" src="${o.proof}" alt="Bukti" onclick="openLightbox('${o.id}')">` : '<p style="color:#555;font-size:12px;margin-top:10px">Tidak ada bukti</p>'}
        ${o.status !== 'pending' ? `<div style="margin-top:8px"><span class="badge badge-${o.status}">${statusLabel(o.status)}</span>${o.note ? ` <span style="font-size:11px;color:#888">— ${o.note}</span>` : ''}</div>` : ''}
      </div>
      <div class="proof-actions">
        ${o.status === 'pending' ? `
          <button class="btn btn-success btn-sm" onclick="updateOrder('${o.id}','verified')">✓ Verifikasi</button>
          <button class="btn btn-danger btn-sm" onclick="showRejectDialog('${o.id}')">✕ Tolak</button>
        ` : `<span class="badge badge-${o.status}">${statusLabel(o.status)}</span>`}
      </div>
    </div>
  `).join('');

  // Store proof for lightbox
  window._proofMap = {};
  orders.forEach(o => { if (o.proof) window._proofMap[o.id] = o.proof; });
}

function updateOrder(id, status, note = '') {
  const orders = DB.get('orders') || [];
  const idx = orders.findIndex(o => o.id === id);
  if (idx < 0) return;
  orders[idx].status = status;
  orders[idx].note = note;
  orders[idx].updatedAt = Date.now();
  DB.set('orders', orders);
  toast(status === 'verified' ? 'Order berhasil diverifikasi!' : 'Order ditolak.', status === 'verified' ? 'success' : 'error');
  switchAdminTab(currentAdminTab);
}

function showRejectDialog(id) {
  const reason = prompt('Alasan penolakan (opsional):') ?? '';
  if (reason !== null) updateOrder(id, 'rejected', reason);
}

function openLightbox(id) {
  const src = window._proofMap && window._proofMap[id];
  if (!src) return;
  document.getElementById('lb-img').src = src;
  document.getElementById('lightbox').classList.add('open');
}
function closeLightbox() { document.getElementById('lightbox').classList.remove('open'); }

// ─── COUNTER ANIMATION ────────────────────────────
function animateCounters() {
  document.querySelectorAll('[data-count]').forEach(el => {
    const target = parseInt(el.dataset.count);
    const dur = 1600;
    const step = target / (dur / 16);
    let cur = 0;
    const t = setInterval(() => {
      cur += step;
      if (cur >= target) { cur = target; clearInterval(t); }
      el.textContent = Math.floor(cur).toLocaleString('id-ID');
    }, 16);
  });
}
const obs = new IntersectionObserver(entries => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounters(); obs.disconnect(); } });
}, { threshold: 0.3 });

// ─── INIT ──────────────────────────────────────────
document.addEventListener('DOMContentLoaded', () => {
  initDB();
  currentUser = getCurrentUser();

  // Restore session
  updateNav();

  // Init slider
  initSlider();

  // Init upload
  initUpload();

  // Stats observer
  const statsEl = document.querySelector('.stats-row');
  if (statsEl) obs.observe(statsEl);

  // ESC lightbox
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeLightbox(); });

  // Lightbox click outside
  document.getElementById('lightbox').addEventListener('click', e => {
    if (e.target === e.currentTarget) closeLightbox();
  });
});
