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

// Initialize
loadSettings();
checkHealth();
