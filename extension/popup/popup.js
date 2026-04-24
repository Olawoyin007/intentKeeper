/**
 * IntentKeeper Popup Script
 *
 * All API calls routed through background worker to avoid CORS/PNA issues.
 */

// Intent keys that have per-intent toggles in the popup
const INTENT_KEYS = ['ragebait', 'fearmongering', 'hype', 'engagement_bait', 'divisive'];

// Settings elements
const elements = {
  enabled: document.getElementById('enabled'),
  showTags: document.getElementById('showTags'),
  blurRagebait: document.getElementById('blurRagebait'),
  hideEngagementBait: document.getElementById('hideEngagementBait'),
  threshold: document.getElementById('threshold'),
  thresholdValue: document.getElementById('thresholdValue'),
  status: document.getElementById('status'),
  statusText: document.getElementById('status-text')
};

/**
 * Load settings from storage
 */
async function loadSettings() {
  const stored = await chrome.storage.local.get('intentkeeper_settings');
  const settings = stored.intentkeeper_settings || {};

  elements.enabled.checked = settings.enabled !== false;
  elements.showTags.checked = settings.showTags !== false;
  elements.blurRagebait.checked = settings.blurRagebait !== false;
  elements.hideEngagementBait.checked = settings.hideEngagementBait !== false;

  const threshold = Math.round((settings.manipulationThreshold || 0.6) * 100);
  elements.threshold.value = threshold;
  elements.thresholdValue.textContent = `${threshold}%`;

  // Per-intent toggles (default all enabled)
  const intentEnabled = settings.intentEnabled || {};
  for (const key of INTENT_KEYS) {
    const el = document.getElementById(`intent-${key}`);
    if (el) el.checked = intentEnabled[key] !== false;
  }
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const intentEnabled = {};
  for (const key of INTENT_KEYS) {
    const el = document.getElementById(`intent-${key}`);
    if (el) intentEnabled[key] = el.checked;
  }

  const settings = {
    enabled: elements.enabled.checked,
    showTags: elements.showTags.checked,
    blurRagebait: elements.blurRagebait.checked,
    hideEngagementBait: elements.hideEngagementBait.checked,
    manipulationThreshold: parseInt(elements.threshold.value) / 100,
    intentEnabled
  };

  await chrome.storage.local.set({ intentkeeper_settings: settings });
}

/**
 * Check API health via background worker.
 * Wraps sendMessage in a 5s timeout - MV3 service workers can be dormant
 * and Chrome sometimes fails to wake them, leaving sendMessage hanging forever.
 */
async function checkHealth() {
  try {
    const timeout = new Promise((_, reject) =>
      setTimeout(() => reject(new Error('timeout')), 5000)
    );
    const data = await Promise.race([
      chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' }),
      timeout
    ]);

    if (data && data.status === 'ok') {
      elements.status.className = 'status connected';
      elements.statusText.textContent = `Connected (${data.model})`;
    } else if (data && data.ollama_connected === false) {
      elements.status.className = 'status disconnected';
      elements.statusText.textContent = 'Ollama not connected';
    } else {
      elements.status.className = 'status disconnected';
      elements.statusText.textContent = 'Server not running';
    }
  } catch (e) {
    elements.status.className = 'status disconnected';
    elements.statusText.textContent = 'Server not running';
  }
}

// Event listeners
elements.enabled.addEventListener('change', saveSettings);
elements.showTags.addEventListener('change', saveSettings);
elements.blurRagebait.addEventListener('change', saveSettings);
elements.hideEngagementBait.addEventListener('change', saveSettings);

for (const key of INTENT_KEYS) {
  const el = document.getElementById(`intent-${key}`);
  if (el) el.addEventListener('change', saveSettings);
}

elements.threshold.addEventListener('input', () => {
  elements.thresholdValue.textContent = `${elements.threshold.value}%`;
});
elements.threshold.addEventListener('change', saveSettings);

// --- Corrections (Phase 6.5) ---

async function loadCorrectionsCount() {
  const stored = await chrome.storage.local.get('ik_corrections');
  const count = (stored.ik_corrections || []).length;
  const countEl = document.getElementById('corrections-count');
  const descEl = document.getElementById('corrections-desc');
  if (countEl) countEl.textContent = count;
  if (descEl) {
    descEl.textContent = count === 0
      ? 'Hover a tag and click ✏️ to correct it'
      : `${count} correction${count === 1 ? '' : 's'} teaching your preferences`;
  }
}

document.getElementById('clear-corrections').addEventListener('click', async () => {
  await chrome.storage.local.remove('ik_corrections');
  await loadCorrectionsCount();
});

// --- Allowlist (Phase 6.2) ---

async function loadAllowlist() {
  const stored = await chrome.storage.local.get('ik_allowlist');
  const list = stored.ik_allowlist || [];
  const listEl = document.getElementById('allowlist-list');
  const emptyEl = document.getElementById('allowlist-empty');
  listEl.innerHTML = '';

  if (list.length === 0) {
    emptyEl.style.display = '';
    return;
  }
  emptyEl.style.display = 'none';

  for (const handle of list) {
    const row = document.createElement('div');
    row.style.cssText = 'display:flex;justify-content:space-between;align-items:center;padding:3px 0;';
    row.innerHTML = `
      <span style="font-size:11px;color:#9090b0;">${handle}</span>
      <button data-handle="${handle}" style="
        background:none;border:none;color:#555568;cursor:pointer;font-size:10px;padding:2px 4px;">
        Remove
      </button>`;
    row.querySelector('button').addEventListener('click', async (e) => {
      const h = e.currentTarget.dataset.handle;
      const s = await chrome.storage.local.get('ik_allowlist');
      const updated = (s.ik_allowlist || []).filter(x => x !== h);
      await chrome.storage.local.set({ ik_allowlist: updated });
      await loadAllowlist();
    });
    listEl.appendChild(row);
  }
}

document.getElementById('allowlist-add').addEventListener('click', async () => {
  const input = document.getElementById('allowlist-input');
  const raw = input.value.trim().toLowerCase();
  if (!raw) return;
  // Normalize: strip leading @ or u/
  const handle = raw.replace(/^@/, '').replace(/^u\//, '');
  if (!handle) return;
  const stored = await chrome.storage.local.get('ik_allowlist');
  const list = stored.ik_allowlist || [];
  if (!list.includes(handle)) {
    list.push(handle);
    await chrome.storage.local.set({ ik_allowlist: list });
  }
  input.value = '';
  await loadAllowlist();
});

document.getElementById('allowlist-input').addEventListener('keydown', (e) => {
  if (e.key === 'Enter') document.getElementById('allowlist-add').click();
});

// Initialize
loadSettings();
checkHealth();
loadCorrectionsCount();
loadAllowlist();
