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
  const parts = [];

  // Title is the primary classification signal
  const title = element.querySelector('#video-title');
  if (title) parts.push(title.innerText.trim());

  // Channel name - helps detect known bait channels
  const channel = element.querySelector('ytd-channel-name #text, #channel-name #text');
  if (channel) parts.push(`[Channel: ${channel.innerText.trim()}]`);

  // View count + upload date give context (e.g. viral bait vs organic growth)
  const metadata = element.querySelectorAll('#metadata-line span');
  if (metadata.length > 0) {
    const metaParts = Array.from(metadata)
      .map(s => s.innerText.trim())
      .filter(Boolean);
    if (metaParts.length > 0) parts.push(`[${metaParts.join(', ')}]`);
  }

  return parts.join(' | ');
}

function extractWatchMetadataText(element) {
  const parts = [];

  // Video title
  const title = element.querySelector('h1 yt-formatted-string, yt-formatted-string#title');
  if (title) parts.push(title.innerText.trim());

  // Description (truncated by YouTube until expanded, but grab what's visible)
  const description = element.querySelector(
    '#description-text, ytd-text-inline-expander #content'
  );
  if (description) {
    const text = description.innerText.trim();
    // Cap at 300 chars - description can be very long and LLM only needs the signal
    if (text.length > 0) parts.push(text.slice(0, 300));
  }

  // Channel name
  const channel = element.querySelector('#channel-name #text, ytd-channel-name #text');
  if (channel) parts.push(`[Channel: ${channel.innerText.trim()}]`);

  return parts.join(' | ');
}

function extractCommentText(element) {
  const parts = [];

  // Comment author
  const author = element.querySelector('#author-text');
  if (author) parts.push(`[Author: ${author.innerText.trim()}]`);

  // Comment body
  const body = element.querySelector('#content-text');
  if (body) parts.push(body.innerText.trim());

  return parts.join(' | ');
}

// ---- Adapter ----

const youtubeAdapter = {
  platform: 'youtube',

  // Covers all three content types in a single querySelectorAll pass
  baseSelector: [
    'ytd-rich-item-renderer',       // Homepage feed cards
    'ytd-video-renderer',           // Search result cards
    'ytd-compact-video-renderer',   // Sidebar recommendations on watch page
    'ytd-watch-metadata',           // Currently playing video (title + description)
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
  }
};

IntentKeeperCore.init(youtubeAdapter);
