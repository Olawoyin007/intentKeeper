/**
 * IntentKeeper Background Service Worker
 *
 * Handles extension lifecycle and messaging between components.
 */

const API_URL = 'http://localhost:8420';

// Default settings
const DEFAULT_SETTINGS = {
  enabled: true,
  showTags: true,
  blurRagebait: true,
  hideEngagementBait: true,
  manipulationThreshold: 0.6
};

/**
 * Initialize settings on install
 */
chrome.runtime.onInstalled.addListener(async () => {
  console.log('IntentKeeper: Extension installed');

  // Set default settings
  const stored = await chrome.storage.local.get('intentkeeper_settings');
  if (!stored.intentkeeper_settings) {
    await chrome.storage.local.set({ intentkeeper_settings: DEFAULT_SETTINGS });
  }
});

/**
 * Check API health periodically
 */
async function checkApiHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return data.status === 'ok';
  } catch (e) {
    return false;
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_HEALTH') {
    checkApiHealth().then(healthy => {
      sendResponse({ healthy });
    });
    return true; // async response
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('intentkeeper_settings').then(stored => {
      sendResponse(stored.intentkeeper_settings || DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ intentkeeper_settings: message.settings }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  }
});

/**
 * Update badge based on API status
 */
async function updateBadge() {
  const healthy = await checkApiHealth();

  if (healthy) {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  }
}

// Check health on startup and periodically
updateBadge();
setInterval(updateBadge, 60000);
