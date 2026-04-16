/**
 * IntentKeeper - YouTube Platform Adapter
 *
 * Handles three content types on YouTube:
 *   - Video cards (feed, search, sidebar recommendations)
 *   - Watch page metadata (current video title + description)
 *   - Comments
 *
 * All classification logic lives in core/classifier.js.
 */

// ---- Per-type text extraction helpers ----

function extractVideoCardText(element) {
  // Try the legacy title element first. Still present on search results
  // (ytd-video-renderer) and sidebar (ytd-compact-video-renderer), and on
  // older YouTube layouts. If found, build a rich context string.
  const titleEl = element.querySelector('#video-title');
  if (titleEl) {
    const text = titleEl.textContent.trim() || titleEl.getAttribute('title') || '';
    if (text) {
      const parts = [text];

      const channel = element.querySelector('ytd-channel-name #text, #channel-name #text');
      if (channel) {
        const name = channel.textContent.trim();
        if (name) parts.push(`[Channel: ${name}]`);
      }

      const metadata = element.querySelectorAll('#metadata-line span');
      if (metadata.length > 0) {
        const metaParts = Array.from(metadata)
          .map(s => s.textContent.trim())
          .filter(Boolean);
        if (metaParts.length > 0) parts.push(`[${metaParts.join(', ')}]`);
      }

      return parts.join(' | ');
    }
  }

  // New YouTube homepage structure (2025+): the internal component hierarchy
  // (ytd-rich-grid-video-renderer, #video-title, #metadata-line) has been
  // replaced by a plain #content div containing all card text concatenated.
  // Noisy (title + hashtags + view count run together) but enough signal for
  // intent classification.
  const content = element.querySelector('#content');
  if (!content) return '';
  return content.textContent.trim();
}

function extractWatchMetadataText(element) {
  const parts = [];

  // Video title
  const title = element.querySelector('h1 yt-formatted-string, yt-formatted-string#title');
  if (title) parts.push(title.textContent.trim());

  // Description (truncated by YouTube until expanded, but grab what's visible)
  const description = element.querySelector(
    '#description-text, ytd-text-inline-expander #content'
  );
  if (description) {
    const text = description.textContent.trim();
    // Cap at 300 chars - description can be very long and LLM only needs the signal
    if (text.length > 0) parts.push(text.slice(0, 300));
  }

  // Channel name
  const channel = element.querySelector('#channel-name #text, ytd-channel-name #text');
  if (channel) {
    const name = channel.textContent.trim();
    if (name) parts.push(`[Channel: ${name}]`);
  }

  return parts.join(' | ');
}

function extractCommentText(element) {
  const parts = [];

  // Comment author
  const author = element.querySelector('#author-text');
  if (author) parts.push(`[Author: ${author.textContent.trim()}]`);

  // Comment body
  const body = element.querySelector('#content-text');
  if (body) parts.push(body.textContent.trim());

  return parts.join(' | ');
}

// ---- Adapter ----

const youtubeAdapter = {
  platform: 'youtube',

  // Video card titles and top-level comments are the high-signal, low-noise
  // targets. Watch-page metadata (ytd-watch-metadata) is excluded for now:
  // descriptions are long and ambiguous, and one classification per page adds
  // latency with unclear user value. Re-enable once eval numbers justify it.
  baseSelector: [
    'ytd-rich-item-renderer',       // Homepage feed cards
    'ytd-video-renderer',           // Search result cards
    'ytd-compact-video-renderer',   // Sidebar recommendations on watch page
    'ytd-comment-thread-renderer',  // Top-level comments
  ].join(', '),

  /**
   * The element to apply blur to (receives the .intentkeeper-blurred class).
   * - Video cards: the thumbnail image
   * - Watch metadata: the description text
   * - Comments: the comment body text
   */
  getContentElement(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'ytd-comment-thread-renderer') {
      return element.querySelector('#content-text');
    }
    if (tag === 'ytd-watch-metadata') {
      return element.querySelector('#description-text, ytd-text-inline-expander #content');
    }
    // Video cards: blur the thumbnail image
    return element.querySelector('#thumbnail img, ytd-thumbnail img');
  },

  /**
   * The element that anchors the blur overlay.
   * For video cards, scope the overlay to the thumbnail container so the
   * title remains readable while the image is obscured.
   * For comments and watch metadata, overlay the whole element.
   */
  getBlurContainer(element) {
    const tag = element.tagName.toLowerCase();
    if (
      tag === 'ytd-rich-item-renderer' ||
      tag === 'ytd-video-renderer' ||
      tag === 'ytd-compact-video-renderer'
    ) {
      return element.querySelector('#thumbnail, ytd-thumbnail');
    }
    return null; // fall back to whole element
  },

  /**
   * Dispatch to the correct text extractor based on element type.
   */
  extractText(element) {
    const tag = element.tagName.toLowerCase();
    if (tag === 'ytd-comment-thread-renderer') return extractCommentText(element);
    if (tag === 'ytd-watch-metadata') return extractWatchMetadataText(element);
    return extractVideoCardText(element);
  },

  /**
   * YouTube SPA navigation hook.
   * YouTube fires 'yt-navigate-finish' when client-side navigation completes
   * and the new page's content is in the DOM. Without this, the MutationObserver
   * may fire on the navigation skeleton before content is ready.
   */
  setupNavigation(reprocess) {
    document.addEventListener('yt-navigate-finish', reprocess);
  }
};

if (typeof IntentKeeperCore !== 'undefined') {
  IntentKeeperCore.init(youtubeAdapter);
}

if (typeof module !== 'undefined') {
  module.exports = { youtubeAdapter };
}
