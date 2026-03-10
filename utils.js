// ═══════════════════════════════════════════
//   AuthForge — Utility Functions
// ═══════════════════════════════════════════

// ── TOAST SYSTEM ──────────────────────────
const toastIcons = {
  success: '✓',
  error: '✕',
  warning: '⚠',
  info: 'ℹ'
};

function showToast(message, type = 'info', duration = 4000) {
  let container = document.getElementById('toast-container');
  if (!container) {
    container = document.createElement('div');
    container.id = 'toast-container';
    document.body.appendChild(container);
  }

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  toast.innerHTML = `
    <span class="toast-icon">${toastIcons[type] || 'ℹ'}</span>
    <span>${message}</span>
  `;
  container.appendChild(toast);

  setTimeout(() => {
    toast.classList.add('hiding');
    setTimeout(() => toast.remove(), 300);
  }, duration);

  return toast;
}

// ── CLIPBOARD ─────────────────────────────
async function copyToClipboard(text, successMsg = 'Copied to clipboard!') {
  try {
    await navigator.clipboard.writeText(text);
    showToast(successMsg, 'success');
    return true;
  } catch {
    // Fallback for older browsers
    const el = document.createElement('textarea');
    el.value = text;
    el.style.position = 'fixed';
    el.style.opacity = '0';
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
    showToast(successMsg, 'success');
    return true;
  }
}

// ── THEME TOGGLE ──────────────────────────
function initTheme() {
  const saved = localStorage.getItem('authforge-theme') || 'dark';
  document.documentElement.setAttribute('data-theme', saved);
  updateThemeIcon(saved);
}

function toggleTheme() {
  const current = document.documentElement.getAttribute('data-theme') || 'dark';
  const next = current === 'dark' ? 'light' : 'dark';
  document.documentElement.setAttribute('data-theme', next);
  localStorage.setItem('authforge-theme', next);
  updateThemeIcon(next);
}

function updateThemeIcon(theme) {
  const icons = document.querySelectorAll('.theme-icon');
  icons.forEach(icon => { icon.textContent = theme === 'dark' ? '◐' : '●'; });
}

// Initialize theme toggles
document.addEventListener('DOMContentLoaded', () => {
  initTheme();
  document.querySelectorAll('#themeToggle, .theme-toggle').forEach(btn => {
    btn.addEventListener('click', toggleTheme);
  });
});

// ── DATE FORMATTING ──────────────────────
function formatDate(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function formatDateTime(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  return d.toLocaleString('en-US', {
    month: 'short', day: 'numeric',
    hour: '2-digit', minute: '2-digit'
  });
}

function timeAgo(ts) {
  if (!ts) return '—';
  const d = ts.toDate ? ts.toDate() : new Date(ts);
  const diff = Date.now() - d.getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return 'just now';
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  if (days < 30) return `${days}d ago`;
  return formatDate(ts);
}

// ── KEY GENERATION ────────────────────────
function generateApiKeyPreview() {
  // For display purposes only — actual key generated server-side
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  let key = 'af_live_';
  for (let i = 0; i < 32; i++) {
    key += chars[Math.floor(Math.random() * chars.length)];
  }
  return key;
}

function maskApiKey(key) {
  if (!key || key.length < 16) return '••••••••••••••••';
  return key.substring(0, 10) + '••••••••••••' + key.slice(-4);
}

// ── LOADING STATES ────────────────────────
function setLoading(btn, loading, text = null) {
  if (loading) {
    btn.dataset.originalText = btn.innerHTML;
    btn.innerHTML = `<span class="spinner"></span> ${text || 'Loading...'}`;
    btn.disabled = true;
  } else {
    btn.innerHTML = btn.dataset.originalText || text || 'Submit';
    btn.disabled = false;
  }
}

function showPageLoader(msg = 'Loading...') {
  let loader = document.getElementById('page-loader');
  if (!loader) {
    loader = document.createElement('div');
    loader.id = 'page-loader';
    loader.className = 'loading-overlay';
    loader.innerHTML = `<div class="spinner"></div> <span>${msg}</span>`;
    document.body.appendChild(loader);
  }
  loader.classList.remove('hidden');
}

function hidePageLoader() {
  const loader = document.getElementById('page-loader');
  if (loader) loader.classList.add('hidden');
}

// ── SIDEBAR (MOBILE) ─────────────────────
function initSidebarToggle() {
  const toggle = document.getElementById('sidebarToggle');
  const sidebar = document.querySelector('.sidebar');
  if (!toggle || !sidebar) return;

  toggle.addEventListener('click', () => sidebar.classList.toggle('open'));
  document.addEventListener('click', (e) => {
    if (!sidebar.contains(e.target) && !toggle.contains(e.target)) {
      sidebar.classList.remove('open');
    }
  });
}

// ── CONFIRM DIALOG ────────────────────────
function confirmAction(message) {
  return new Promise(resolve => {
    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay open';
    overlay.innerHTML = `
      <div class="modal">
        <div class="modal-title">Confirm Action</div>
        <div class="modal-sub">${message}</div>
        <div class="modal-footer">
          <button class="btn-outline" id="cancelConfirm">Cancel</button>
          <button class="btn-danger" id="confirmAction">Confirm</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    overlay.querySelector('#cancelConfirm').addEventListener('click', () => {
      overlay.remove();
      resolve(false);
    });
    overlay.querySelector('#confirmAction').addEventListener('click', () => {
      overlay.remove();
      resolve(true);
    });
    overlay.addEventListener('click', (e) => {
      if (e.target === overlay) { overlay.remove(); resolve(false); }
    });
  });
}

// ── FORM VALIDATION ───────────────────────
function validateEmail(email) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
}

function validatePassword(pw) {
  return pw && pw.length >= 8;
}

function setFieldError(inputEl, msg) {
  inputEl.classList.add('error');
  const existing = inputEl.parentNode.querySelector('.form-error');
  if (existing) existing.remove();
  if (msg) {
    const err = document.createElement('span');
    err.className = 'form-error';
    err.textContent = msg;
    inputEl.parentNode.appendChild(err);
  }
}

function clearFieldError(inputEl) {
  inputEl.classList.remove('error');
  const existing = inputEl.parentNode.querySelector('.form-error');
  if (existing) existing.remove();
}

// ── EXPOSE GLOBALS ────────────────────────
window.showToast = showToast;
window.copyToClipboard = copyToClipboard;
window.formatDate = formatDate;
window.formatDateTime = formatDateTime;
window.timeAgo = timeAgo;
window.maskApiKey = maskApiKey;
window.setLoading = setLoading;
window.showPageLoader = showPageLoader;
window.hidePageLoader = hidePageLoader;
window.initSidebarToggle = initSidebarToggle;
window.confirmAction = confirmAction;
window.validateEmail = validateEmail;
window.validatePassword = validatePassword;
window.setFieldError = setFieldError;
window.clearFieldError = clearFieldError;
window.generateApiKeyPreview = generateApiKeyPreview;
