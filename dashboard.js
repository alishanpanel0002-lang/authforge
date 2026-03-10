// ═══════════════════════════════════════════
//   AuthForge — Dashboard Module
// ═══════════════════════════════════════════

import {
  getFirestore,
  collection,
  doc,
  getDocs,
  getDoc,
  addDoc,
  updateDoc,
  deleteDoc,
  query,
  where,
  orderBy,
  limit,
  serverTimestamp,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.7.1/firebase-firestore.js";

import { getFunctions, httpsCallable } from "https://www.gstatic.com/firebasejs/10.7.1/firebase-functions.js";
import { app } from '/firebase/firebase-config.js';
import { requireAuth, logOut, onAuthStateChanged, auth } from './auth.js';

const db = getFirestore(app);
const functions = getFunctions(app);

// ── INIT DASHBOARD ────────────────────────
async function initDashboard() {
  showPageLoader('Loading dashboard...');

  try {
    const user = await requireAuth();
    const userDoc = await getDoc(doc(db, 'users', user.uid));
    const userData = userDoc.data() || {};

    hidePageLoader();
    renderUserInfo(user, userData);
    await Promise.all([
      loadApiKeys(user.uid),
      loadUsageStats(user.uid),
      loadRecentLogs(user.uid)
    ]);
    initChart(user.uid);
    initSidebarToggle();

  } catch (err) {
    hidePageLoader();
    showToast('Failed to load dashboard: ' + err.message, 'error');
  }
}

// ── RENDER USER INFO ──────────────────────
function renderUserInfo(user, userData) {
  const name = user.displayName || userData.displayName || user.email.split('@')[0];
  const initial = name[0].toUpperCase();

  document.querySelectorAll('.user-name-display').forEach(el => el.textContent = name);
  document.querySelectorAll('.user-email-display').forEach(el => el.textContent = user.email);
  document.querySelectorAll('.user-avatar-initial').forEach(el => el.textContent = initial);

  const memberSince = document.getElementById('memberSince');
  if (memberSince && userData.createdAt) {
    memberSince.textContent = formatDate(userData.createdAt);
  }

  const verifiedBadge = document.getElementById('emailVerifiedBadge');
  if (verifiedBadge) {
    verifiedBadge.className = `status-badge ${user.emailVerified ? 'status-active' : 'status-error'}`;
    verifiedBadge.textContent = user.emailVerified ? '✓ Verified' : '⚠ Unverified';
  }

  // Plan badge
  const plan = userData.plan || 'free';
  document.querySelectorAll('.plan-display').forEach(el => {
    el.textContent = plan.charAt(0).toUpperCase() + plan.slice(1);
  });
}

// ── API KEY MANAGEMENT ────────────────────
async function loadApiKeys(uid) {
  const keysList = document.getElementById('apiKeysList');
  if (!keysList) return;

  keysList.innerHTML = renderSkeletonKeys();

  try {
    const q = query(
      collection(db, 'api_keys'),
      where('userId', '==', uid),
      orderBy('createdAt', 'desc')
    );
    const snap = await getDocs(q);
    const keys = [];
    snap.forEach(d => keys.push({ id: d.id, ...d.data() }));

    // Update count
    const countEl = document.getElementById('apiKeyCount');
    if (countEl) countEl.textContent = keys.length;

    if (keys.length === 0) {
      keysList.innerHTML = `
        <div class="empty-state">
          <div class="empty-state-icon">🔑</div>
          <h3>No API keys yet</h3>
          <p>Generate your first key to start making authenticated requests.</p>
          <button class="btn-primary" onclick="openCreateKeyModal()">Generate API Key</button>
        </div>`;
      return;
    }

    keysList.innerHTML = keys.map(k => renderApiKeyItem(k)).join('');

  } catch (err) {
    keysList.innerHTML = `<div class="empty-state"><p>Failed to load API keys.</p></div>`;
    console.error(err);
  }
}

function renderSkeletonKeys() {
  return Array(3).fill(0).map(() => `
    <div class="apikey-item">
      <div class="skeleton" style="width:36px;height:36px;border-radius:8px;flex-shrink:0"></div>
      <div style="flex:1">
        <div class="skeleton skeleton-text" style="width:140px"></div>
        <div class="skeleton skeleton-text" style="width:200px;margin-top:6px"></div>
      </div>
      <div class="skeleton" style="width:180px;height:32px;border-radius:6px"></div>
    </div>`).join('');
}

function renderApiKeyItem(key) {
  const masked = maskApiKey(key.keyPrefix + '...' + key.keySuffix);
  const lastUsed = key.lastUsedAt ? timeAgo(key.lastUsedAt) : 'Never';
  const created = key.createdAt ? formatDate(key.createdAt) : '—';

  return `
    <div class="apikey-item" data-key-id="${key.id}">
      <div class="apikey-icon">🔑</div>
      <div class="apikey-info">
        <div class="apikey-name">${escapeHtml(key.name || 'Unnamed Key')}</div>
        <div class="apikey-meta">Created ${created} · Last used ${lastUsed} · ${key.usageCount || 0} requests</div>
      </div>
      <div class="apikey-value" title="Click to reveal">${masked}</div>
      <span class="status-badge ${key.active ? 'status-active' : 'status-inactive'}">
        ${key.active ? '● Active' : '● Disabled'}
      </span>
      <div class="apikey-actions">
        <button class="btn-icon" title="Copy key hash" onclick="copyKeyRef('${key.id}')">⎘</button>
        <button class="btn-icon" title="Rename key" onclick="openRenameModal('${key.id}', '${escapeHtml(key.name || '')}')">✎</button>
        <button class="btn-icon danger" title="Delete key" onclick="deleteApiKey('${key.id}')">⊗</button>
      </div>
    </div>`;
}

// ── CREATE API KEY ────────────────────────
function openCreateKeyModal() {
  const overlay = document.getElementById('createKeyModal');
  if (overlay) overlay.classList.add('open');
}

async function createApiKey(name, uid) {
  const createKey = httpsCallable(functions, 'createApiKey');
  try {
    const result = await createKey({ name });
    return result.data;
  } catch (err) {
    // Fallback: create key client-side if functions not deployed
    return createApiKeyClientSide(name, uid);
  }
}

async function createApiKeyClientSide(name, uid) {
  // Generate a secure-looking key client side (use Cloud Functions in production)
  const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  const array = new Uint8Array(32);
  crypto.getRandomValues(array);
  let rawKey = 'af_live_';
  array.forEach(b => rawKey += chars[b % chars.length]);

  // Hash the key for storage (SHA-256)
  const encoder = new TextEncoder();
  const data = encoder.encode(rawKey);
  const hashBuffer = await crypto.subtle.digest('SHA-256', data);
  const hashArray = Array.from(new Uint8Array(hashBuffer));
  const keyHash = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

  const keyDoc = {
    userId: uid,
    name: name || 'My API Key',
    keyHash: keyHash,
    keyPrefix: rawKey.substring(0, 10),
    keySuffix: rawKey.slice(-4),
    active: true,
    usageCount: 0,
    createdAt: serverTimestamp(),
    lastUsedAt: null
  };

  const docRef = await addDoc(collection(db, 'api_keys'), keyDoc);
  return { keyId: docRef.id, rawKey, ...keyDoc };
}

// ── DELETE API KEY ────────────────────────
async function deleteApiKey(keyId) {
  const confirmed = await confirmAction('Are you sure you want to delete this API key? This action cannot be undone and will immediately invalidate it.');
  if (!confirmed) return;

  try {
    await deleteDoc(doc(db, 'api_keys', keyId));
    document.querySelector(`[data-key-id="${keyId}"]`)?.remove();
    showToast('API key deleted.', 'success');

    // Refresh count
    const user = auth.currentUser;
    if (user) loadApiKeys(user.uid);
  } catch (err) {
    showToast('Failed to delete key: ' + err.message, 'error');
  }
}

// ── RENAME API KEY ────────────────────────
function openRenameModal(keyId, currentName) {
  const overlay = document.getElementById('renameKeyModal');
  if (!overlay) return;
  overlay.dataset.keyId = keyId;
  const input = overlay.querySelector('#renameKeyInput');
  if (input) input.value = currentName;
  overlay.classList.add('open');
}

async function renameApiKey(keyId, newName) {
  await updateDoc(doc(db, 'api_keys', keyId), { name: newName });
  const nameEl = document.querySelector(`[data-key-id="${keyId}"] .apikey-name`);
  if (nameEl) nameEl.textContent = newName;
  showToast('Key renamed successfully.', 'success');
}

// ── COPY KEY REF ──────────────────────────
async function copyKeyRef(keyId) {
  // In real use, we'd show the key prefix. Full key was shown only at creation.
  const keyEl = document.querySelector(`[data-key-id="${keyId}"] .apikey-value`);
  if (keyEl) {
    showToast('Full key is only shown once at creation. Copy it from the creation dialog.', 'warning');
  }
}

// ── USAGE STATS ───────────────────────────
async function loadUsageStats(uid) {
  try {
    const userDoc = await getDoc(doc(db, 'users', uid));
    const userData = userDoc.data() || {};

    const totalCallsEl = document.getElementById('totalApiCalls');
    if (totalCallsEl) totalCallsEl.textContent = (userData.apiCallCount || 0).toLocaleString();

    // Count active keys
    const keysSnap = await getDocs(query(
      collection(db, 'api_keys'),
      where('userId', '==', uid),
      where('active', '==', true)
    ));
    const activeKeysEl = document.getElementById('activeKeysCount');
    if (activeKeysEl) activeKeysEl.textContent = keysSnap.size;

    // Recent activity (last 7 days)
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);

    const usageSnap = await getDocs(query(
      collection(db, 'api_usage'),
      where('userId', '==', uid),
      where('timestamp', '>=', weekAgo),
      limit(500)
    ));

    const weekCallsEl = document.getElementById('weekApiCalls');
    if (weekCallsEl) weekCallsEl.textContent = usageSnap.size.toLocaleString();

  } catch (err) {
    console.warn('Could not load usage stats:', err.message);
  }
}

// ── USAGE CHART ───────────────────────────
async function initChart(uid) {
  const canvas = document.getElementById('usageChart');
  if (!canvas || typeof Chart === 'undefined') return;

  try {
    // Build last 7 days
    const days = [];
    const labels = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(d.toDateString());
      labels.push(d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }));
    }

    // Fetch usage logs
    const weekAgo = new Date();
    weekAgo.setDate(weekAgo.getDate() - 7);
    const snap = await getDocs(query(
      collection(db, 'api_usage'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(1000)
    ));

    const counts = Object.fromEntries(days.map(d => [d, 0]));
    snap.forEach(d => {
      const ts = d.data().timestamp?.toDate?.() || new Date(d.data().timestamp);
      const key = ts.toDateString();
      if (counts[key] !== undefined) counts[key]++;
    });

    const data = days.map(d => counts[d]);

    const isDark = document.documentElement.getAttribute('data-theme') !== 'light';
    const gridColor = isDark ? 'rgba(255,255,255,0.06)' : 'rgba(0,0,0,0.06)';
    const textColor = isDark ? '#6666aa' : '#9999cc';

    new Chart(canvas, {
      type: 'bar',
      data: {
        labels,
        datasets: [{
          label: 'API Calls',
          data,
          backgroundColor: 'rgba(124,92,252,0.4)',
          borderColor: 'rgba(124,92,252,0.8)',
          borderWidth: 1,
          borderRadius: 4,
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            backgroundColor: isDark ? '#1a1a2e' : '#ffffff',
            titleColor: isDark ? '#f0f0ff' : '#0f0f1a',
            bodyColor: isDark ? '#9999cc' : '#4444aa',
            borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)',
            borderWidth: 1,
          }
        },
        scales: {
          x: { grid: { color: gridColor }, ticks: { color: textColor, font: { family: 'DM Mono', size: 11 } } },
          y: {
            grid: { color: gridColor },
            ticks: { color: textColor, font: { family: 'DM Mono', size: 11 }, precision: 0 },
            beginAtZero: true
          }
        }
      }
    });
  } catch (err) {
    console.warn('Chart init failed:', err.message);
  }
}

// ── RECENT LOGS ───────────────────────────
async function loadRecentLogs(uid) {
  const tbody = document.getElementById('recentLogsBody');
  if (!tbody) return;

  try {
    const q = query(
      collection(db, 'api_usage'),
      where('userId', '==', uid),
      orderBy('timestamp', 'desc'),
      limit(10)
    );
    const snap = await getDocs(q);
    const logs = [];
    snap.forEach(d => logs.push(d.data()));

    if (logs.length === 0) {
      tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-3);padding:24px">No API calls yet</td></tr>`;
      return;
    }

    tbody.innerHTML = logs.map(log => `
      <tr>
        <td class="font-mono text-sm">${escapeHtml(log.endpoint || '/v1/user')}</td>
        <td>
          <span class="status-badge ${log.statusCode < 400 ? 'status-active' : 'status-error'}">
            ${log.statusCode || 200}
          </span>
        </td>
        <td class="text-muted text-sm">${log.responseTime ? log.responseTime + 'ms' : '—'}</td>
        <td class="text-muted text-sm">${timeAgo(log.timestamp)}</td>
      </tr>`).join('');

  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="4" style="text-align:center;color:var(--text-3)">Could not load logs</td></tr>`;
  }
}

// ── UTILS ─────────────────────────────────
function escapeHtml(str) {
  const map = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#039;' };
  return String(str).replace(/[&<>"']/g, m => map[m]);
}

export {
  initDashboard,
  loadApiKeys,
  createApiKey,
  createApiKeyClientSide,
  deleteApiKey,
  openCreateKeyModal,
  openRenameModal,
  renameApiKey,
  copyKeyRef,
  loadUsageStats,
  loadRecentLogs,
  escapeHtml
};

// Expose to window for inline handlers
window.deleteApiKey = deleteApiKey;
window.openRenameModal = openRenameModal;
window.copyKeyRef = copyKeyRef;
window.openCreateKeyModal = openCreateKeyModal;
