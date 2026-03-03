// ─── COUNTER ANIMATION ───
function animateCounters() {
  document.querySelectorAll('.counter').forEach(el => {
    const target = parseInt(el.dataset.target);
    const duration = 1800;
    const step = target / (duration / 16);
    let current = 0;
    const timer = setInterval(() => {
      current += step;
      if (current >= target) { current = target; clearInterval(timer); }
      el.textContent = Math.floor(current).toLocaleString('id-ID');
    }, 16);
  });
}

// ─── INTERSECTION OBSERVER FOR COUNTERS ───
const counterObserver = new IntersectionObserver((entries) => {
  entries.forEach(e => { if (e.isIntersecting) { animateCounters(); counterObserver.disconnect(); } });
}, { threshold: 0.3 });

// ─── PRICING DATA ───
const plans = [
  {
    id: 'starter',
    name: 'Starter',
    price: 150000,
    label: '150.000',
    desc: 'Cocok untuk personal branding awal',
    features: ['1.000 Followers Instagram', '500 Likes per post', 'Pengiriman dalam 24 jam', 'Garansi 30 hari', 'Support via WhatsApp'],
    featured: false
  },
  {
    id: 'pro',
    name: 'Pro',
    price: 450000,
    label: '450.000',
    desc: 'Paling populer untuk content creator',
    features: ['5.000 Followers Instagram', '2.000 Likes per post', '10.000 YouTube Views', 'Pengiriman dalam 12 jam', 'Garansi 60 hari', 'Priority Support 24/7'],
    featured: true
  },
  {
    id: 'elite',
    name: 'Elite',
    price: 1200000,
    label: '1.200.000',
    desc: 'Untuk brand & bisnis skala besar',
    features: ['20.000 Followers Multi-platform', '10.000 Likes per post', '50.000 YouTube Views', '5.000 TikTok Followers', 'Pengiriman dalam 6 jam', 'Garansi 90 hari', 'Dedicated Account Manager'],
    featured: false
  }
];

// ─── MODAL LOGIC ───
let selectedPlan = null;
let countdownInterval = null;

function openCheckout(planId) {
  selectedPlan = plans.find(p => p.id === planId);
  if (!selectedPlan) return;

  // Fill summary
  document.getElementById('summary-plan').textContent = `Paket ${selectedPlan.name}`;
  document.getElementById('summary-price').textContent = `Rp ${selectedPlan.label}`;
  document.getElementById('summary-total').textContent = `Rp ${selectedPlan.label}`;
  document.getElementById('modal-plan-name').textContent = `Paket ${selectedPlan.name}`;

  // Reset form & QRIS
  document.getElementById('checkout-form').reset();
  document.getElementById('qris-section').classList.remove('visible');
  document.getElementById('form-section').style.display = 'block';
  setActiveTab(1);

  document.getElementById('qrcode-container').innerHTML = '';
  if (countdownInterval) clearInterval(countdownInterval);

  document.getElementById('modal-overlay').classList.add('active');
  document.body.style.overflow = 'hidden';
}

function closeModal() {
  document.getElementById('modal-overlay').classList.remove('active');
  document.body.style.overflow = '';
  if (countdownInterval) clearInterval(countdownInterval);
}

function setActiveTab(num) {
  document.querySelectorAll('.step-tab').forEach((t, i) => {
    t.classList.toggle('active', i + 1 === num);
  });
}

// ─── GENERATE QRIS ───
// QRIS format menggunakan EMVCo standard dengan NMID dummy
function buildQRISString(merchantName, amount) {
  // NMID dummy (National Merchant ID - format resmi QRIS)
  const nmid = 'ID1023200019391';
  const merchantCity = 'JAKARTA';
  const merchantCountry = 'ID';
  const currency = '360'; // IDR

  // EMVCo TLV builder
  const tlv = (tag, value) => {
    const len = String(value.length).padStart(2, '0');
    return `${tag}${len}${value}`;
  };

  // Payload Format Indicator
  const pfi = tlv('00', '01');
  // Point of Initiation Method: 12 = dynamic (amount included)
  const poi = tlv('01', '12');

  // Merchant Account Info - QRIS (tag 26)
  const qrisGUID = tlv('00', 'com.p2pqris');
  const merchantId = tlv('01', nmid);
  const merchantAccInfo = tlv('26', qrisGUID + merchantId);

  // Merchant Category Code
  const mcc = tlv('52', '5999');
  // Transaction Currency
  const txCurrency = tlv('53', currency);
  // Transaction Amount
  const txAmount = tlv('54', String(amount));
  // Country Code
  const country = tlv('58', merchantCountry);
  // Merchant Name (max 25 chars)
  const mName = tlv('59', merchantName.substring(0, 25).toUpperCase());
  // Merchant City
  const mCity = tlv('60', merchantCity);

  // Additional data (reference number)
  const refNum = tlv('05', 'BOOSTPRIME' + Date.now().toString().slice(-8));
  const additionalData = tlv('62', refNum);

  // Assemble without CRC
  const payload = pfi + poi + merchantAccInfo + mcc + txCurrency + txAmount + country + mName + mCity + additionalData + '6304';

  // CRC16-CCITT calculation
  function crc16(str) {
    let crc = 0xFFFF;
    for (let i = 0; i < str.length; i++) {
      crc ^= str.charCodeAt(i) << 8;
      for (let j = 0; j < 8; j++) {
        crc = (crc & 0x8000) ? (crc << 1) ^ 0x1021 : crc << 1;
        crc &= 0xFFFF;
      }
    }
    return crc.toString(16).toUpperCase().padStart(4, '0');
  }

  return payload + crc16(payload);
}

function generateQRIS() {
  const name = document.getElementById('input-name').value.trim();
  const email = document.getElementById('input-email').value.trim();
  const platform = document.getElementById('input-platform').value;

  if (!name || !email || !platform) {
    alert('Mohon lengkapi semua data terlebih dahulu!');
    return;
  }

  // Show QRIS section
  document.getElementById('form-section').style.display = 'none';
  document.getElementById('qris-section').classList.add('visible');
  setActiveTab(2);

  // Set info
  document.getElementById('qris-merchant-name').textContent = 'BoostPrime';
  document.getElementById('qris-amount-display').textContent = `Rp ${selectedPlan.label}`;

  // Generate QRIS string
  const qrisString = buildQRISString('BOOSTPRIME', selectedPlan.price);

  // Render QR code
  document.getElementById('qrcode-container').innerHTML = '';
  new QRCode(document.getElementById('qrcode-container'), {
    text: qrisString,
    width: 220,
    height: 220,
    colorDark: '#000000',
    colorLight: '#ffffff',
    correctLevel: QRCode.CorrectLevel.M
  });

  // Countdown 15 menit
  let seconds = 15 * 60;
  function updateCountdown() {
    const m = Math.floor(seconds / 60).toString().padStart(2, '0');
    const s = (seconds % 60).toString().padStart(2, '0');
    document.getElementById('countdown-display').textContent = `${m}:${s}`;
    if (seconds <= 0) {
      clearInterval(countdownInterval);
      document.getElementById('countdown-display').textContent = 'KADALUARSA';
      document.getElementById('countdown-display').style.color = '#E74C3C';
    }
    seconds--;
  }
  updateCountdown();
  countdownInterval = setInterval(updateCountdown, 1000);

  // Store data for download
  window._lastQRIS = { name, email, platform, plan: selectedPlan };
}

// ─── DOWNLOAD QRIS ───
function downloadQRIS() {
  const canvas = document.querySelector('#qrcode-container canvas');
  if (!canvas) return;

  // Create full QRIS card canvas
  const outputCanvas = document.createElement('canvas');
  outputCanvas.width = 400;
  outputCanvas.height = 520;
  const ctx = outputCanvas.getContext('2d');

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, 400, 520);

  // Header bar
  ctx.fillStyle = '#D4AF37';
  ctx.fillRect(0, 0, 400, 60);

  // Logo text
  ctx.fillStyle = '#0A0A0A';
  ctx.font = 'bold 22px Arial';
  ctx.fillText('BoostPrime', 30, 38);

  // QRIS badge
  ctx.fillStyle = '#E1001A';
  ctx.fillRect(290, 16, 80, 28);
  ctx.fillStyle = '#ffffff';
  ctx.font = 'bold 11px Arial';
  ctx.fillText('QRIS', 308, 35);

  // Draw QR code
  ctx.drawImage(canvas, 90, 80, 220, 220);

  // Merchant info
  ctx.fillStyle = '#111';
  ctx.font = 'bold 16px Arial';
  ctx.textAlign = 'center';
  ctx.fillText('BoostPrime', 200, 330);

  ctx.fillStyle = '#555';
  ctx.font = '13px Arial';
  const plan = window._lastQRIS?.plan;
  ctx.fillText(`Paket ${plan?.name} — Rp ${plan?.label}`, 200, 352);

  ctx.fillStyle = '#888';
  ctx.font = '11px Arial';
  ctx.fillText('Scan dengan aplikasi bank atau e-wallet apapun', 200, 380);
  ctx.fillText('yang mendukung QRIS', 200, 396);

  // Bottom bar
  ctx.fillStyle = '#F5F5F5';
  ctx.fillRect(0, 450, 400, 70);
  ctx.fillStyle = '#888';
  ctx.font = '10px Arial';
  ctx.fillText('Didukung oleh seluruh bank dan e-wallet di Indonesia', 200, 475);
  ctx.fillText('GoPay • OVO • DANA • ShopeePay • LinkAja • Semua Bank', 200, 492);
  ctx.fillStyle = '#D4AF37';
  ctx.font = 'bold 10px Arial';
  ctx.fillText('boostprime.id', 200, 512);

  // Download
  const link = document.createElement('a');
  link.download = `QRIS-BoostPrime-${plan?.name}-${Date.now()}.png`;
  link.href = outputCanvas.toDataURL('image/png');
  link.click();
}

// ─── INIT ───
document.addEventListener('DOMContentLoaded', () => {
  // Observer for stats
  const statsBar = document.querySelector('.stats-bar');
  if (statsBar) counterObserver.observe(statsBar);

  // Modal overlay click to close
  document.getElementById('modal-overlay').addEventListener('click', function(e) {
    if (e.target === this) closeModal();
  });

  // ESC to close
  document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });
});
