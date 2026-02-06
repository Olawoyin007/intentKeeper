/**
 * IntentKeeper Popup Script
 */

const API_URL = 'http://localhost:8420';

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
}

/**
 * Save settings to storage
 */
async function saveSettings() {
  const settings = {
    enabled: elements.enabled.checked,
    showTags: elements.showTags.checked,
    blurRagebait: elements.blurRagebait.checked,
    hideEngagementBait: elements.hideEngagementBait.checked,
    manipulationThreshold: parseInt(elements.threshold.value) / 100
  };

  await chrome.storage.local.set({ intentkeeper_settings: settings });
}

/**
 * Check API health
 */
async function checkHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();

    if (data.status === 'ok') {
      elements.status.className = 'status connected';
      elements.statusText.textContent = `Connected (${data.model})`;
    } else {
      elements.status.className = 'status disconnected';
      elements.statusText.textContent = 'Ollama not connected';
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

elements.threshold.addEventListener('input', () => {
  elements.thresholdValue.textContent = `${elements.threshold.value}%`;
});
elements.threshold.addEventListener('change', saveSettings);

// Initialize
loadSettings();
checkHealth();
