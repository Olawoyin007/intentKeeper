/**
 * IntentKeeper Core - Shared Classification Engine
 *
 * Platform-agnostic classification pipeline. Each platform adapter
 * provides DOM selectors and content extractors; this module handles
 * everything else: settings, cache, batch API calls, visual treatments,
 * and the MutationObserver loop.
 *
 * Adapter interface:
 *   {
 *     platform: string,                   // 'twitter', 'youtube', etc.
 *     baseSelector: string,               // CSS selector for content items
 *     extractText(element): string,       // Extract classifiable text
 *     getContentElement(element): Element|null  // Element to blur (null = whole item)
 *   }
 *
 * Usage (from a platform script):
 *   IntentKeeperCore.init(adapter)
 */

const PROCESSED_ATTR = 'data-intentkeeper-processed';
const INTENT_ATTR = 'data-intentkeeper-intent';

// Minimum content length to bother classifying (matches server MIN_CONTENT_LENGTH)
const MIN_CONTENT_LENGTH = 20;

// Max items to send in one batch
const MAX_CONCURRENT = 5;

// Max cache entries before LRU eviction
const MAX_CACHE_SIZE = 1000;

// Content hash -> ClassificationResult
const classificationCache = new Map();

// Guard against concurrent processItems() re-entry
let isProcessing = false;

// Flag: new items arrived while a batch was in-flight
let pendingReprocess = false;

// Counts for status badge diagnostics
let foundCount = 0;
let classifiedCount = 0;

// Debug logger - only logs when debug._enabled is true
const debug = {
  _enabled: false,
  log: (...args) => { if (debug._enabled) console.log('IntentKeeper:', ...args); },
  error: (...args) => console.error('IntentKeeper:', ...args),
  warn: (...args) => { if (debug._enabled) console.warn('IntentKeeper:', ...args); },
};

// Settings (loaded from storage, kept in sync via onChanged)
let settings = {
  enabled: true,
  showTags: true,
  blurRagebait: true,
  hideEngagementBait: true,
  manipulationThreshold: 0.6,
  intentEnabled: {
    ragebait: true,
    fearmongering: true,
    hype: true,
    engagement_bait: true,
    divisive: true
  }
};

// --- Utilities ---

/**
 * djb2 hash for cache keys - fast with good distribution for strings.
 */
function hashContent(str) {
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = ((hash << 5) + hash) + str.charCodeAt(i);
    hash = hash & hash; // Convert to 32-bit integer
  }
  return hash.toString(36);
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str;
  return div.innerHTML;
}

/**
 * Human-readable label for each intent, including YouTube-specific intents
 * added in Phase 3.
 */
function formatIntent(intent) {
  const labels = {
    ragebait: 'Ragebait',
    fearmongering: 'Fear-mongering',
    hype: 'Hype',
    engagement_bait: 'Engagement Bait',
    divisive: 'Divisive',
    genuine: 'Genuine',
  };
  return labels[intent] || intent;
}

// --- Settings ---

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

// React to settings changes without requiring a page reload
chrome.storage.onChanged.addListener((changes, area) => {
  if (area === 'local' && changes.intentkeeper_settings) {
    const newSettings = changes.intentkeeper_settings.newValue;
    if (newSettings) {
      settings = { ...settings, ...newSettings };
      debug.log('Settings updated');
    }
  }
});

// --- Corrections (Phase 6.5) ---

const CORRECTIONS_KEY = 'ik_corrections';
const MAX_CORRECTIONS = 100;
const ALL_INTENTS = ['ragebait', 'fearmongering', 'hype', 'engagement_bait', 'divisive', 'genuine'];

async function saveCorrection(snippet, originalIntent, correctedIntent) {
  try {
    const stored = await chrome.storage.local.get(CORRECTIONS_KEY);
    const corrections = stored[CORRECTIONS_KEY] || [];
    corrections.push({
      snippet: snippet.slice(0, 200),
      originalIntent,
      correctedIntent,
      timestamp: Date.now(),
    });
    // LRU: keep most recent MAX_CORRECTIONS
    if (corrections.length > MAX_CORRECTIONS) corrections.splice(0, corrections.length - MAX_CORRECTIONS);
    await chrome.storage.local.set({ [CORRECTIONS_KEY]: corrections });
    debug.log(`Correction saved: ${originalIntent} -> ${correctedIntent}`);
  } catch (e) {
    debug.error('Failed to save correction', e);
  }
}

async function getCorrectionsCount() {
  try {
    const stored = await chrome.storage.local.get(CORRECTIONS_KEY);
    return (stored[CORRECTIONS_KEY] || []).length;
  } catch (e) {
    return 0;
  }
}

async function clearCorrections() {
  await chrome.storage.local.remove(CORRECTIONS_KEY);
}

/**
 * Show a small correction picker dropdown below the given tag element.
 * Dismisses if the user clicks outside or selects an intent.
 */
function showCorrectionPicker(tag, content, originalIntent) {
  // Remove any existing picker
  document.querySelectorAll('.ik-correction-picker').forEach(p => p.remove());

  const picker = document.createElement('div');
  picker.className = 'ik-correction-picker';
  picker.innerHTML = `
    <div class="ik-cp-label">This is actually:</div>
    ${ALL_INTENTS.filter(i => i !== originalIntent).map(i =>
      `<button class="ik-cp-btn" data-intent="${i}">${escapeHtml(formatIntent(i))}</button>`
    ).join('')}
    <button class="ik-cp-btn ik-cp-cancel">Cancel</button>
  `;

  // Position below the tag
  const rect = tag.getBoundingClientRect();
  picker.style.top = `${rect.bottom + window.scrollY + 4}px`;
  picker.style.left = `${rect.left + window.scrollX}px`;
  document.body.appendChild(picker);

  picker.querySelectorAll('.ik-cp-btn[data-intent]').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const correctedIntent = btn.dataset.intent;
      await saveCorrection(content, originalIntent, correctedIntent);
      // Update tag visually to confirmed state
      tag.classList.add('ik-corrected');
      tag.title = `You corrected this to: ${formatIntent(correctedIntent)}`;
      picker.remove();
    });
  });

  picker.querySelector('.ik-cp-cancel').addEventListener('click', (e) => {
    e.stopPropagation();
    picker.remove();
  });

  // Click outside closes picker
  const dismiss = (e) => {
    if (!picker.contains(e.target)) {
      picker.remove();
      document.removeEventListener('click', dismiss);
    }
  };
  setTimeout(() => document.addEventListener('click', dismiss), 0);
}

// --- Cache ---

function cacheResult(content, result) {
  const cacheKey = hashContent(content);
  classificationCache.set(cacheKey, result);
  // LRU eviction: Map preserves insertion order, so oldest key is first
  if (classificationCache.size > MAX_CACHE_SIZE) {
    const firstKey = classificationCache.keys().next().value;
    classificationCache.delete(firstKey);
  }
}

function getCached(content) {
  const cacheKey = hashContent(content);
  return classificationCache.get(cacheKey) || null;
}

// --- API ---

/**
 * Classify a batch of items via the background service worker.
 * Each item is { content: string, mediaUrls: string[] }.
 * Returns a Map of content -> ClassificationResult.
 * Cache hits are served immediately; only uncached items go to the API.
 */
async function classifyBatch(batchItems, platform) {
  const results = new Map();
  const uncached = [];

  for (const item of batchItems) {
    const cached = getCached(item.content);
    if (cached) {
      results.set(item.content, cached);
    } else {
      uncached.push(item);
    }
  }

  if (uncached.length === 0) return results;

  try {
    const items = uncached.map(({ content, mediaUrls }) => ({
      content,
      source: platform,
      ...(mediaUrls && mediaUrls.length > 0 ? { media_urls: mediaUrls } : {})
    }));
    const batchResults = await chrome.runtime.sendMessage({
      type: 'CLASSIFY_BATCH',
      items
    });

    if (batchResults && Array.isArray(batchResults)) {
      for (let i = 0; i < uncached.length; i++) {
        const result = batchResults[i];
        if (result) {
          cacheResult(uncached[i].content, result);
          results.set(uncached[i].content, result);
        }
      }
    }
  } catch (e) {
    debug.error('Batch classification failed', e.message || e);
  }

  return results;
}

// --- Visual Treatments ---

// Confidence thresholds matching Phase 6.4 spec
const CONFIDENCE_LOW = 0.65;
const CONFIDENCE_HIGH = 0.85;

function applyTag(element, intent, confidence, content) {
  const tag = document.createElement('div');
  const uncertain = confidence < CONFIDENCE_LOW;
  tag.className = `intentkeeper-tag intentkeeper-tag-${intent}${uncertain ? ' intentkeeper-tag--uncertain' : ''}`;
  const label = escapeHtml(formatIntent(intent));
  tag.innerHTML = `&#x1f6e1;&#xfe0f; ${label}${uncertain ? ' ?' : ''}<span class="ik-correct-btn" title="Correct this label">&#x270F;&#xFE0F;</span>`;
  tag.title = `Classified as ${label} (confidence: ${(confidence * 100).toFixed(0)}%)`;
  element.style.position = 'relative';
  element.insertBefore(tag, element.firstChild);

  tag.querySelector('.ik-correct-btn').addEventListener('click', (e) => {
    e.stopPropagation();
    showCorrectionPicker(tag, content, intent);
  });
}

/**
 * Blur the content area within an element, with a reveal button.
 *
 * Uses adapter.getContentElement() to find the sub-element to blur.
 * Uses optional adapter.getBlurContainer() to find where to anchor the overlay.
 * If getBlurContainer is not defined (or returns null), the overlay covers
 * the whole item element (Twitter behaviour). When defined, the overlay is
 * scoped to a sub-container - e.g. just the thumbnail on a YouTube card,
 * leaving the title visible but the image obscured.
 */
function applyBlur(element, intent, reasoning, confidence, adapter) {
  const overlay = document.createElement('div');
  overlay.className = 'intentkeeper-overlay';
  const uncertain = confidence < CONFIDENCE_LOW;
  const label = escapeHtml(formatIntent(intent));
  const confidenceNote = uncertain
    ? `<span class="intentkeeper-confidence intentkeeper-confidence--low">Low confidence (${(confidence * 100).toFixed(0)}%)</span>`
    : '';
  overlay.innerHTML = `
    <div class="intentkeeper-warning">
      <span class="intentkeeper-icon">&#x1f6e1;&#xfe0f;</span>
      <span class="intentkeeper-label">${label}${uncertain ? ' ?' : ''}</span>
      ${confidenceNote}
      <span class="intentkeeper-reason">${escapeHtml(reasoning)}</span>
      <button class="intentkeeper-reveal">Show anyway</button>
    </div>
  `;

  const contentEl = adapter.getContentElement(element);
  if (contentEl) {
    contentEl.classList.add('intentkeeper-blurred');
  }

  // Overlay anchors to the blur container if the adapter provides one,
  // otherwise falls back to the whole item element.
  const blurContainer = adapter.getBlurContainer
    ? (adapter.getBlurContainer(element) || element)
    : element;

  blurContainer.style.position = 'relative';
  blurContainer.style.overflow = 'hidden';
  blurContainer.appendChild(overlay);

  overlay.querySelector('.intentkeeper-reveal').addEventListener('click', (e) => {
    e.stopPropagation();
    if (contentEl) contentEl.classList.remove('intentkeeper-blurred');
    overlay.remove();
  });
}

function applyHide(element, intent) {
  element.classList.add('intentkeeper-hidden');

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

function applyTreatment(element, classification, adapter, content) {
  if (!classification) return;

  const { intent, action, manipulation_score, confidence, reasoning } = classification;

  element.setAttribute(PROCESSED_ATTR, 'true');
  element.setAttribute(INTENT_ATTR, intent);
  classifiedCount++;
  updateStatusBadge();

  // Phase 6.1: per-intent kill switch - pass through with no treatment if disabled
  const intentEnabled = settings.intentEnabled || {};
  if (intentEnabled[intent] === false) {
    return;
  }

  if (settings.showTags) {
    applyTag(element, intent, confidence, content || '');
  }

  if (manipulation_score >= settings.manipulationThreshold) {
    if (action === 'blur' && settings.blurRagebait) {
      applyBlur(element, intent, reasoning, confidence, adapter);
    } else if (action === 'hide' && settings.hideEngagementBait) {
      applyHide(element, intent);
    }
  }
}

// --- Processing Pipeline ---

/**
 * Build a querySelectorAll-compatible selector that excludes already-processed
 * items. Applies :not() to each comma-separated part individually so that
 * multi-selector baseSelectors (e.g. YouTube's five ytd-* types) are all
 * filtered - not just the last one.
 */
function buildSelector(baseSelector, processedAttr) {
  return baseSelector
    .split(',')
    .map(s => `${s.trim()}:not([${processedAttr}])`)
    .join(', ');
}

/**
 * Find all unprocessed items on the page, extract their text via the adapter,
 * classify in batches of MAX_CONCURRENT, and apply visual treatments.
 *
 * Guarded against concurrent re-entry: if new items arrive while a batch is
 * in-flight, they're queued for an immediate follow-up pass.
 */
async function processItems(adapter) {
  if (!settings.enabled) return;

  if (isProcessing) {
    pendingReprocess = true;
    return;
  }

  isProcessing = true;
  try {
    updateStatusBadge('scanning');
    const selector = buildSelector(adapter.baseSelector, PROCESSED_ATTR);
    const items = Array.from(document.querySelectorAll(selector));

    const itemData = [];
    for (const item of items) {
      const text = adapter.extractText(item);
      const mediaUrls = adapter.extractMediaUrls ? adapter.extractMediaUrls(item) : [];
      if (text.length < MIN_CONTENT_LENGTH) {
        // Only permanently skip items with SOME text (genuinely short content).
        // Empty string means the element is still loading (lazy render) -
        // leave it unmarked so the next observer pass can pick it up.
        if (text.length > 0) {
          item.setAttribute(PROCESSED_ATTR, 'skipped');
        }
      } else {
        item.classList.add('intentkeeper-classifying');
        foundCount++;
        itemData.push({ item, text, mediaUrls });
      }
    }

    for (let i = 0; i < itemData.length; i += MAX_CONCURRENT) {
      const batch = itemData.slice(i, i + MAX_CONCURRENT);
      const batchItems = batch.map(d => ({ content: d.text, mediaUrls: d.mediaUrls }));
      const results = await classifyBatch(batchItems, adapter.platform);

      for (const { item, text } of batch) {
        item.classList.remove('intentkeeper-classifying');
        const classification = results.get(text) || null;
        if (classification) {
          applyTreatment(item, classification, adapter, text);
        } else {
          item.setAttribute(PROCESSED_ATTR, 'failed');
          updateStatusBadge();
        }
      }
    }
  } finally {
    isProcessing = false;

    if (pendingReprocess) {
      pendingReprocess = false;
      processItems(adapter);
    }
  }
}

// --- Status Badge ---

function createStatusBadge(platform, connected) {
  const existing = document.getElementById('intentkeeper-status-badge');
  if (existing) existing.remove();

  const badge = document.createElement('div');
  badge.id = 'intentkeeper-status-badge';
  if (!connected) badge.classList.add('ik-disconnected');

  const label = platform.charAt(0).toUpperCase() + platform.slice(1);
  badge.innerHTML = `
    <span class="ik-dot"></span>
    <span class="ik-label">&#x1f6e1;&#xfe0f; ${label}</span>
    <span class="ik-count"></span>
  `;
  document.body.appendChild(badge);

  if (connected) {
    badge._hideTimer = setTimeout(() => badge.classList.add('ik-faded'), 4000);
  }
  return badge;
}

function updateStatusBadge(state) {
  const badge = document.getElementById('intentkeeper-status-badge');
  if (!badge) return;
  const countEl = badge.querySelector('.ik-count');
  if (countEl) {
    if (state === 'scanning') {
      countEl.textContent = '· scanning...';
    } else if (foundCount > 0 && classifiedCount === 0) {
      // Items found but nothing classified - likely API issue
      countEl.textContent = `· ${foundCount} found, 0 classified`;
      badge.classList.add('ik-warn');
    } else if (classifiedCount > 0) {
      countEl.textContent = `· ${classifiedCount} classified`;
      badge.classList.remove('ik-warn');
    } else {
      countEl.textContent = '';
    }
  }
  badge.classList.remove('ik-faded');
  clearTimeout(badge._hideTimer);
  // Don't auto-hide if there's a warning
  if (!badge.classList.contains('ik-warn')) {
    badge._hideTimer = setTimeout(() => badge.classList.add('ik-faded'), 3000);
  }
}

function setupObserver(adapter) {
  const observer = new MutationObserver(() => {
    // 200ms debounce balances responsiveness with avoiding excessive calls
    clearTimeout(window.intentkeeperTimeout);
    window.intentkeeperTimeout = setTimeout(() => processItems(adapter), 200);
  });

  observer.observe(document.body, {
    childList: true,
    subtree: true,
    // Also watch text node changes - catches platforms that update existing
    // elements' text content (e.g. YouTube recycling card elements on scroll)
    characterData: true
  });

  // Periodic fallback scan every 3s. Catches any items the MutationObserver
  // missed (e.g. content rendered via requestAnimationFrame after mutations).
  setInterval(() => processItems(adapter), 3000);
}

// --- Public API ---

// Expose utility functions for testing in Node (Jest/jsdom)
if (typeof module !== 'undefined') {
  module.exports = { hashContent, formatIntent, escapeHtml, buildSelector };
}

window.IntentKeeperCore = {
  async init(adapter) {
    debug.log(`Initializing [${adapter.platform}]...`);

    await loadSettings();

    if (!settings.enabled) {
      debug.log('Disabled');
      return;
    }

    let connected = false;
    try {
      const health = await chrome.runtime.sendMessage({ type: 'CHECK_HEALTH' });
      if (!health || health.status === 'disconnected') {
        debug.error('API not available');
        createStatusBadge(adapter.platform, false);
        return;
      }
      connected = true;
      debug.log(`API connected (model: ${health.model})`);
    } catch (e) {
      debug.error('Cannot connect to background worker', e.message || e);
      createStatusBadge(adapter.platform, false);
      return;
    }

    createStatusBadge(adapter.platform, connected);
    processItems(adapter);
    setupObserver(adapter);

    // Optional SPA navigation hook - platform adapters implement this
    // to reset counts and re-scan after client-side navigation completes.
    if (adapter.setupNavigation) {
      adapter.setupNavigation(() => {
        foundCount = 0;
        classifiedCount = 0;
        processItems(adapter);
      });
    }

    debug.log(`Active [${adapter.platform}]`);
  }
};
