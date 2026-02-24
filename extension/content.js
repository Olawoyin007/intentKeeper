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

// Flag: new tweets arrived while we were processing a batch
let pendingReprocess = false;

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
 * Cache a classification result with LRU eviction.
 */
function cacheResult(content, result) {
  const cacheKey = hashContent(content);
  classificationCache.set(cacheKey, result);
  if (classificationCache.size > MAX_CACHE_SIZE) {
    const firstKey = classificationCache.keys().next().value;
    classificationCache.delete(firstKey);
  }
}

/**
 * Get a cached classification result, or null if not cached.
 */
function getCached(content) {
  const cacheKey = hashContent(content);
  return classificationCache.get(cacheKey) || null;
}

/**
 * Classify a batch of content items via the background service worker.
 * Returns a Map of content -> result.
 */
async function classifyBatch(contentItems) {
  // Separate cached from uncached
  const results = new Map();
  const uncached = [];

  for (const content of contentItems) {
    const cached = getCached(content);
    if (cached) {
      results.set(content, cached);
    } else {
      uncached.push(content);
    }
  }

  if (uncached.length === 0) return results;

  try {
    const items = uncached.map(c => ({ content: c, source: 'twitter' }));
    const batchResults = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_BATCH',
      items
    });

    if (batchResults && Array.isArray(batchResults)) {
      for (let i = 0; i < uncached.length; i++) {
        const result = batchResults[i];
        if (result) {
          cacheResult(uncached[i], result);
          results.set(uncached[i], result);
        }
      }
    }
  } catch (e) {
    debug.error('Batch classification failed', e.message || e);
  }

  return results;
}

/**
 * Extract tweet text from a tweet element, including author name,
 * quoted tweets, link cards, poll options, video context,
 * and image alt text for richer classification context.
 */
function extractTweetText(tweetElement) {
  const parts = [];

  // Author display name — helps detect mockery and quote-tweet dunking
  const author = tweetElement.querySelector('[data-testid="User-Name"]');
  if (author) {
    const displayName = author.querySelector('span');
    if (displayName) parts.push(`[Author: ${displayName.innerText.trim()}]`);
  }

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

  // Video context — grab any accessible description/title near the video player
  const video = tweetElement.querySelector('[data-testid="videoPlayer"], video, [data-testid="videoComponent"]');
  if (video) {
    // Twitter sometimes puts video titles in nearby spans or aria-labels
    const videoLabel = video.getAttribute('aria-label')
      || video.closest('[aria-label]')?.getAttribute('aria-label');
    if (videoLabel && videoLabel.length > 5) {
      parts.push(`[Video: ${videoLabel}]`);
    }
    // If tweet has no text at all, flag it as a video tweet so LLM still sees something
    if (!text) {
      parts.push('[Video tweet]');
    }
  }

  // Poll options — polls are often engagement bait
  const pollOptions = tweetElement.querySelectorAll('[data-testid="cardPoll"] [role="radio"], [data-testid="cardPoll"] span');
  if (pollOptions.length > 0) {
    const pollTexts = [];
    pollOptions.forEach(opt => {
      const t = opt.innerText?.trim();
      if (t && t.length > 1) pollTexts.push(t);
    });
    if (pollTexts.length > 0) parts.push(`[Poll: ${pollTexts.join(' / ')}]`);
  }

  // Image alt text (skip generic/short alt text)
  const imgs = tweetElement.querySelectorAll('img[alt]:not([alt=""])');
  imgs.forEach(img => {
    if (img.alt && !img.alt.startsWith('Image') && img.alt.length > 10) {
      parts.push(img.alt);
    }
  });

  // Social context — "X liked" / "X retweeted" banners above the tweet
  const socialContext = tweetElement.querySelector('[data-testid="socialContext"]');
  if (socialContext) {
    parts.push(`[Context: ${socialContext.innerText.trim()}]`);
  }

  return parts.join(' | ');
}

/**
 * Apply classification to a single tweet given its pre-fetched result.
 */
function applyClassificationToTweet(tweet, classification) {
  tweet.classList.remove('intentkeeper-classifying');
  if (classification) {
    applyTreatment(tweet, classification);
  } else {
    tweet.setAttribute(PROCESSED_ATTR, 'failed');
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

  // Always show tags on every classified tweet so the user sees what's happening
  if (settings.showTags) {
    applyTag(tweetElement, intent, confidence);
  }

  // Blur and hide only apply when manipulation score exceeds the threshold
  if (manipulation_score >= settings.manipulationThreshold) {
    if (action === 'blur' && settings.blurRagebait) {
      applyBlur(tweetElement, intent, reasoning);
    } else if (action === 'hide' && settings.hideEngagementBait) {
      applyHide(tweetElement, intent);
    }
  }
}

/**
 * Blur content with reveal option
 */
function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

function applyBlur(element, intent, reasoning) {
  // Create overlay with warning
  const overlay = document.createElement('div');
  overlay.className = 'intentkeeper-overlay';
  overlay.innerHTML = `
    <div class="intentkeeper-warning">
      <span class="intentkeeper-icon">&#x1f6e1;&#xfe0f;</span>
      <span class="intentkeeper-label">${escapeHtml(formatIntent(intent))}</span>
      <span class="intentkeeper-reason">${escapeHtml(reasoning)}</span>
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
    <span>&#x1f6e1;&#xfe0f; Hidden: ${escapeHtml(formatIntent(intent))}</span>
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
  tag.innerHTML = `&#x1f6e1;&#xfe0f; ${escapeHtml(formatIntent(intent))}`;
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
 * Process tweets on the page using the batch API endpoint.
 * Guarded against concurrent re-entry — if new tweets arrive while
 * a batch is being classified, they're queued for immediate reprocessing.
 */
async function processTweets() {
  if (!settings.enabled) return;

  // If already processing, flag for reprocess when current batch finishes
  if (isProcessing) {
    pendingReprocess = true;
    return;
  }

  isProcessing = true;
  try {
    // Find unprocessed tweets
    const tweets = Array.from(document.querySelectorAll(
      `[data-testid="tweet"]:not([${PROCESSED_ATTR}])`
    ));

    // Extract text and filter out short tweets
    const tweetData = [];
    for (const tweet of tweets) {
      const text = extractTweetText(tweet);
      if (text.length < MIN_CONTENT_LENGTH) {
        tweet.setAttribute(PROCESSED_ATTR, 'skipped');
      } else {
        tweet.classList.add('intentkeeper-classifying');
        tweetData.push({ tweet, text });
      }
    }

    // Classify in batches of MAX_CONCURRENT via the batch endpoint
    for (let i = 0; i < tweetData.length; i += MAX_CONCURRENT) {
      const batch = tweetData.slice(i, i + MAX_CONCURRENT);
      const contents = batch.map(d => d.text);
      const results = await classifyBatch(contents);

      for (const { tweet, text } of batch) {
        applyClassificationToTweet(tweet, results.get(text) || null);
      }
    }
  } finally {
    isProcessing = false;

    // If new tweets arrived while we were processing, go again immediately
    if (pendingReprocess) {
      pendingReprocess = false;
      processTweets();
    }
  }
}

/**
 * Set up mutation observer for dynamic content
 */
function setupObserver() {
  const observer = new MutationObserver((mutations) => {
    // Debounce — 200ms balances responsiveness with avoiding excessive calls
    clearTimeout(window.intentkeeperTimeout);
    window.intentkeeperTimeout = setTimeout(processTweets, 200);
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
