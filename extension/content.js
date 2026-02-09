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

// Cache to avoid re-classifying same content
const classificationCache = new Map();

// Settings (loaded from storage)
let settings = {
  enabled: true,
  showTags: true,
  blurRagebait: true,
  hideEngagementBait: true,
  manipulationThreshold: 0.6
};

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
    console.log('IntentKeeper: Using default settings');
  }
}

/**
 * Classify content via background service worker
 */
async function classifyContent(content) {
  // Check cache
  const cacheKey = content.substring(0, 100);
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

      // Limit cache size
      if (classificationCache.size > 1000) {
        const firstKey = classificationCache.keys().next().value;
        classificationCache.delete(firstKey);
      }
    }

    return result;
  } catch (e) {
    console.error('IntentKeeper: Classification failed', e);
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
  if (text.length < 20) {
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
      <span class="intentkeeper-icon">🛡️</span>
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
    <span>🛡️ Hidden: ${formatIntent(intent)}</span>
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
  tag.innerHTML = `🛡️ ${formatIntent(intent)}`;
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
 * Process tweets on the page in parallel batches
 */
async function processTweets() {
  if (!settings.enabled) return;

  // Find unprocessed tweets
  const tweets = Array.from(document.querySelectorAll(
    `[data-testid="tweet"]:not([${PROCESSED_ATTR}])`
  ));

  // Process in batches of MAX_CONCURRENT
  for (let i = 0; i < tweets.length; i += MAX_CONCURRENT) {
    const batch = tweets.slice(i, i + MAX_CONCURRENT);
    await Promise.allSettled(batch.map(t => classifyAndApply(t)));
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
  console.log('IntentKeeper: Initializing...');

  await loadSettings();

  if (!settings.enabled) {
    console.log('IntentKeeper: Disabled');
    return;
  }

  // Check API health via background worker
  try {
    const health = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
    if (!health || health.status === 'disconnected') {
      console.error('IntentKeeper: API not available');
      return;
    }
    console.log(`IntentKeeper: API connected (model: ${health.model})`);
  } catch (e) {
    console.error('IntentKeeper: Cannot connect to background worker', e);
    return;
  }

  // Process existing tweets
  processTweets();

  // Watch for new tweets
  setupObserver();

  console.log('IntentKeeper: Active');
}

// Start
init();
