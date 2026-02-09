/**
 * IntentKeeper Content Script
 *
 * Intercepts tweets on Twitter/X and classifies their intent.
 * Applies visual treatments based on classification results.
 *
 * All API calls are routed through the background service worker
 * to avoid Chrome's Private Network Access blocking localhost.
 */

const PROCESSED_ATTR = 'data-intentkeeper-processed';
const INTENT_ATTR = 'data-intentkeeper-intent';
const MAX_CONCURRENT = 5;

// Minimum tweet length to bother classifying (matches server MIN_CONTENT_LENGTH)
const MIN_CONTENT_LENGTH = 20;

// Max cache entries before LRU eviction
const MAX_CACHE_SIZE = 1000;

// Cache to avoid re-classifying same content (keyed by full content hash)
const classificationCache = new Map();

// Guard against concurrent processTweets() re-entry
let isProcessing = false;

// Debug logger — only logs when DEBUG is enabled
const debug = {
  _enabled: false,
  log: (...args) => { if (debug._enabled) console.log('IntentKeeper:', ...args); },
  error: (...args) => console.error('IntentKeeper:', ...args),
  warn: (...args) => { if (debug._enabled) console.warn('IntentKeeper:', ...args); },
};

// Settings (loaded from storage)
let settings = {
  enabled: true,
  showTags: true,
  blurRagebait: true,
  hideEngagementBait: true,
  manipulationThreshold: 0.6
};

/**
 * Generate a simple hash for cache keys using the full content string.
 * Uses djb2 algorithm — fast and produces good distribution for strings.
 */
function hashContent(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

/**
 * Load settings from Chrome storage
 */
async function loadSettings() {
  try {
    const stored = await chrome.storage.local.get('intentkeeper_settings');
    if (stored.intentkeeper_settings) {
      settings = { ...settings, ...stored.intentkeeper_settings };
    }
  } catch (e) {
    debug.log('Using default settings');
  }
}

/**
 * Listen for settings changes so they take effect without page reload
 */
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.intentkeeper_settings) {
    const newSettings = changes.intentkeeper_settings.newValue;
    if (newSettings) {
      settings = { ...settings, ...newSettings };
      debug.log('Settings updated');
    }
  }
});

/**
 * Classify content via background service worker
 */
async function classifyContent(content) {
  // Check cache using full content hash
  const cacheKey = hashContent(content);
  if (classificationCache.has(cacheKey)) {
    return classificationCache.get(cacheKey);
  }

  try {
    const result = await chrome.runtime.sendMessage({
      type: 'CLASSIFY',
      content: content,
      source: 'twitter'
    });

    if (result) {
      // Cache result
      classificationCache.set(cacheKey, result);

      // LRU eviction — remove oldest entry when over limit
      if (classificationCache.size > MAX_CACHE_SIZE) {
        const firstKey = classificationCache.keys().next().value;
        classificationCache.delete(firstKey);
      }
    }

    return result;
  } catch (e) {
    // Background worker may be dead/restarting — fail silently
    debug.error('Classification failed', e.message || e);
    return null;
  }
}

/**
 * Extract tweet text from a tweet element, including quoted tweets,
 * link cards, and image alt text for richer classification context.
 */
function extractTweetText(tweetElement) {
  const parts = [];

  // Main tweet text
  const text = tweetElement.querySelector('[data-testid="tweetText"]');
  if (text) parts.push(text.innerText.trim());

  // Quoted tweet text (nested tweet inside this tweet)
  const quoted = tweetElement.querySelector('[data-testid="tweet"] [data-testid="tweetText"]');
  if (quoted && quoted !== text) parts.push(quoted.innerText.trim());

  // Link card title/description
  const card = tweetElement.querySelector('[data-testid="card.wrapper"]');
  if (card) {
    const cardText = card.querySelector(
      '[data-testid="card.layoutLarge.detail"] span, a[role="link"] span'
    );
    if (cardText) parts.push(cardText.innerText.trim());
  }

  // Image alt text (skip generic/short alt text)
  const imgs = tweetElement.querySelectorAll('img[alt]:not([alt=""])');
  imgs.forEach(img => {
    if (img.alt && !img.alt.startsWith('Image') && img.alt.length > 10) {
      parts.push(img.alt);
    }
  });

  return parts.join(' | ');
}

/**
 * Classify a single tweet and apply treatment.
 * Adds/removes the classifying indicator during processing.
 */
async function classifyAndApply(tweet) {
  const text = extractTweetText(tweet);

  // Skip very short tweets
  if (text.length < MIN_CONTENT_LENGTH) {
    tweet.setAttribute(PROCESSED_ATTR, 'skipped');
    return;
  }

  // Show loading indicator
  tweet.classList.add('intentkeeper-classifying');

  try {
    const classification = await classifyContent(text);
    if (classification) {
      applyTreatment(tweet, classification);
    } else {
      tweet.setAttribute(PROCESSED_ATTR, 'failed');
    }
  } finally {
    // Always remove loading indicator
    tweet.classList.remove('intentkeeper-classifying');
  }
}

/**
 * Apply visual treatment based on classification
 */
function applyTreatment(tweetElement, classification) {
  if (!classification) return;

  const { intent, action, manipulation_score, confidence, reasoning } = classification;

  // Mark as processed
  tweetElement.setAttribute(PROCESSED_ATTR, 'true');
  tweetElement.setAttribute(INTENT_ATTR, intent);

  // Skip if manipulation score below threshold
  if (manipulation_score < settings.manipulationThreshold) {
    return;
  }

  // Apply action-based treatment
  switch (action) {
    case 'blur':
      if (settings.blurRagebait) {
        applyBlur(tweetElement, intent, reasoning);
      }
      break;

    case 'hide':
      if (settings.hideEngagementBait) {
        applyHide(tweetElement, intent);
      }
      break;

    case 'tag':
      if (settings.showTags) {
        applyTag(tweetElement, intent, confidence);
      }
      break;
  }
}

/**
 * Blur content with reveal option
 */
function applyBlur(element, intent, reasoning) {
  // Create overlay with warning
  const overlay = document.createElement('div');
  overlay.className = 'intentkeeper-overlay';
  overlay.innerHTML = `
    <div class="intentkeeper-warning">
      <span class="intentkeeper-icon">&#x1f6e1;&#xfe0f;</span>
      <span class="intentkeeper-label">${formatIntent(intent)}</span>
      <span class="intentkeeper-reason">${reasoning}</span>
      <button class="intentkeeper-reveal">Show anyway</button>
    </div>
  `;

  // Add blur to tweet content
  const tweetContent = element.querySelector('[data-testid="tweetText"]');
  if (tweetContent) {
    tweetContent.classList.add('intentkeeper-blurred');
  }

  // Insert overlay
  element.style.position = 'relative';
  element.appendChild(overlay);

  // Reveal button handler
  overlay.querySelector('.intentkeeper-reveal').addEventListener('click', (e) => {
    e.stopPropagation();
    if (tweetContent) {
      tweetContent.classList.remove('intentkeeper-blurred');
    }
    overlay.remove();
  });
}

/**
 * Hide content (collapse)
 */
function applyHide(element, intent) {
  element.classList.add('intentkeeper-hidden');

  // Add show option
  const showBar = document.createElement('div');
  showBar.className = 'intentkeeper-hidden-bar';
  showBar.innerHTML = `
    <span>&#x1f6e1;&#xfe0f; Hidden: ${formatIntent(intent)}</span>
    <button class="intentkeeper-show">Show</button>
  `;

  element.parentNode.insertBefore(showBar, element);

  showBar.querySelector('.intentkeeper-show').addEventListener('click', () => {
    element.classList.remove('intentkeeper-hidden');
    showBar.remove();
  });
}

/**
 * Add intent tag
 */
function applyTag(element, intent, confidence) {
  const tag = document.createElement('div');
  tag.className = `intentkeeper-tag intentkeeper-tag-${intent}`;
  tag.innerHTML = `&#x1f6e1;&#xfe0f; ${formatIntent(intent)}`;
  tag.title = `Confidence: ${(confidence * 100).toFixed(0)}%`;

  // Insert at top of tweet
  element.style.position = 'relative';
  element.insertBefore(tag, element.firstChild);
}

/**
 * Format intent name for display
 */
function formatIntent(intent) {
  const labels = {
    ragebait: 'Ragebait',
    fearmongering: 'Fear-mongering',
    hype: 'Hype',
    engagement_bait: 'Engagement Bait',
    divisive: 'Divisive',
    genuine: 'Genuine',
    neutral: 'Neutral'
  };
  return labels[intent] || intent;
}

/**
 * Process tweets on the page in parallel batches.
 * Guarded against concurrent re-entry.
 */
async function processTweets() {
  if (!settings.enabled || isProcessing) return;

  isProcessing = true;
  try {
    // Find unprocessed tweets
    const tweets = Array.from(document.querySelectorAll(
      `[data-testid="tweet"]:not([${PROCESSED_ATTR}])`
    ));

    // Process in batches of MAX_CONCURRENT
    for (let i = 0; i < tweets.length; i += MAX_CONCURRENT) {
      const batch = tweets.slice(i, i + MAX_CONCURRENT);
      await Promise.allSettled(batch.map(t => classifyAndApply(t)));
    }
  } finally {
    isProcessing = false;
  }
}

/**
 * Set up mutation observer for dynamic content
 */
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    // Debounce processing
    clearTimeout(window.intentkeeperTimeout);
    window.intentkeeperTimeout = setTimeout(processTweets, 500);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true
  });
}

/**
 * Initialize the content script
 */
async function init() {
  debug.log('Initializing...');

  await loadSettings();

  if (!settings.enabled) {
    debug.log('Disabled');
    return;
  }

  // Check API health via background worker
  try {
    const health = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
    if (!health || health.status === 'disconnected') {
      debug.error('API not available');
      return;
    }
    debug.log(`API connected (model: ${health.model})`);
  } catch (e) {
    debug.error('Cannot connect to background worker', e.message || e);
    return;
  }

  // Process existing tweets
  processTweets();

  // Watch for new tweets
  setupObserver();

  debug.log('Active');
}

// Start
init();
