/**
 * IntentKeeper Background Service Worker
 *
 * Handles extension lifecycle, API proxying, and messaging between components.
 * All localhost API calls go through here to avoid Chrome's Private Network Access blocking.
 */

const API_URL = 'http://localhost:8420';

// Health check interval — 20s provides faster feedback when server goes down
const HEALTH_CHECK_INTERVAL = 20000;

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
  // Set default settings
  const stored = await chrome.storage.local.get('intentkeeper_settings');
  if (!stored.intentkeeper_settings) {
    await chrome.storage.local.set({ intentkeeper_settings: DEFAULT_SETTINGS });
  }
});

/**
 * Check API health
 */
async function checkApiHealth() {
  try {
    const response = await fetch(`${API_URL}/health`);
    const data = await response.json();
    return data;
  } catch (e) {
    return { status: 'disconnected', ollama_connected: false, model: 'none' };
  }
}

/**
 * Classify content via the local API
 */
async function classifyContent(content, source) {
  try {
    const response = await fetch(`${API_URL}/classify`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ content, source: source || 'twitter' })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    return await response.json();
  } catch (e) {
    console.error('IntentKeeper: Classification failed', e);
    return null;
  }
}

/**
 * Classify multiple content items via the batch API endpoint.
 * Returns an array of results in the same order as items.
 */
async function classifyBatch(items) {
  try {
    const response = await fetch(`${API_URL}/classify/batch`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ items })
    });

    if (!response.ok) {
      throw new Error(`API error: ${response.status}`);
    }

    const data = await response.json();
    return data.results;
  } catch (e) {
    console.error('IntentKeeper: Batch classification failed', e);
    return null;
  }
}

/**
 * Handle messages from content scripts and popup
 */
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'CHECK_HEALTH') {
    checkApiHealth().then(data => {
      sendResponse(data);
    }).catch(() => {
      sendResponse({ status: 'disconnected', ollama_connected: false, model: 'none' });
    });
    return true;
  }

  if (message.type === 'CLASSIFY') {
    classifyContent(message.content, message.source).then(result => {
      sendResponse(result);
    }).catch(() => {
      sendResponse(null);
    });
    return true;
  }

  if (message.type === 'CLASSIFY_BATCH') {
    classifyBatch(message.items).then(results => {
      sendResponse(results);
    }).catch(() => {
      sendResponse(null);
    });
    return true;
  }

  if (message.type === 'GET_SETTINGS') {
    chrome.storage.local.get('intentkeeper_settings').then(stored => {
      sendResponse(stored.intentkeeper_settings || DEFAULT_SETTINGS);
    }).catch(() => {
      sendResponse(DEFAULT_SETTINGS);
    });
    return true;
  }

  if (message.type === 'SAVE_SETTINGS') {
    chrome.storage.local.set({ intentkeeper_settings: message.settings }).then(() => {
      sendResponse({ success: true });
    }).catch(() => {
      sendResponse({ success: false });
    });
    return true;
  }
});

/**
 * Update badge based on API status
 */
async function updateBadge() {
  const health = await checkApiHealth();

  if (health.status === 'ok') {
    chrome.action.setBadgeText({ text: '' });
    chrome.action.setBadgeBackgroundColor({ color: '#4CAF50' });
  } else {
    chrome.action.setBadgeText({ text: '!' });
    chrome.action.setBadgeBackgroundColor({ color: '#f44336' });
  }
}

// Check health on startup and periodically
updateBadge();
setInterval(updateBadge, HEALTH_CHECK_INTERVAL);
