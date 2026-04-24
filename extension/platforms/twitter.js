/**
 * IntentKeeper - Twitter/X Platform Adapter
 *
 * Knows how to find tweets and extract rich text for classification.
 * All classification logic lives in core/classifier.js.
 */

/**
 * Extract text from an element, preserving emoji characters.
 *
 * Twitter renders emoji as <img alt="😂"> rather than Unicode text nodes.
 * A plain .textContent call skips <img> entirely, so emoji-heavy manipulation
 * patterns (🚨🚨 BREAKING, 🔥🔥) would be invisible to the classifier.
 * This function walks child nodes and splices in the alt text for any <img>.
 */
function getEmojiText(element) {
  if (!element) return '';
  let text = '';
  element.childNodes.forEach(node => {
    if (node.nodeType === Node.TEXT_NODE) {
      text += node.textContent;
    } else if (node.nodeName === 'IMG' && node.alt) {
      text += node.alt;
    } else if (node.nodeType === Node.ELEMENT_NODE) {
      text += getEmojiText(node);
    }
  });
  return text.trim();
}

/**
 * On a thread/status page (/username/status/ID), return the text of the focal
 * post - the tweet the page is anchored on.
 *
 * Twitter renders the focal tweet first in the DOM, followed by replies.
 * Providing this as context lets the classifier understand what a reply is
 * responding to - e.g. a sarcastic reply only reads as ragebait when you see
 * the original post it's dunking on.
 *
 * Returns null on timeline pages where there is no single focal post.
 */
function getFocalPostText() {
  if (!/\/status\/\d+/.test(window.location.pathname)) return null;
  const firstTweet = document.querySelector('[data-testid="tweet"]');
  if (!firstTweet) return null;
  const textEl = firstTweet.querySelector('[data-testid="tweetText"]');
  return textEl ? getEmojiText(textEl) : null;
}

const twitterAdapter = {
  platform: 'twitter',
  baseSelector: '[data-testid="tweet"]',

  /**
   * The blurrable content area within a tweet.
   * Used by the core to target blur treatment at text, not the whole tweet card.
   */
  getContentElement(element) {
    return element.querySelector('[data-testid="tweetText"]');
  },

  /**
   * Extract media URLs (photos, GIFs, video thumbnails) from a tweet.
   *
   * All Twitter media is served from pbs.twimg.com. We exclude avatar images
   * (UserAvatar containers) to avoid sending profile pictures to the vision model.
   * URLs are normalized to "medium" resolution - large enough for the vision model
   * to read text overlays and assess emotional tone without over-fetching.
   *
   * These URLs are sent to the server which fetches and describes them using a
   * vision model (OLLAMA_VISION_MODEL env var). If no vision model is configured,
   * the server skips image analysis and classifies on text alone.
   */
  extractMediaUrls(tweetElement) {
    const urls = [];
    tweetElement.querySelectorAll('img[src*="pbs.twimg.com"]').forEach(img => {
      if (img.closest('[data-testid="UserAvatar"]')) return;
      if (!img.src) return;
      const url = img.src.replace(/name=\w+/, 'name=medium');
      if (!urls.includes(url)) urls.push(url);
    });
    return urls;
  },

  /**
   * Extract tweet text including author name, quoted tweets, link cards,
   * video context, poll options, image alt text, and social context banners.
   * Richer context improves classification accuracy.
   *
   * On thread/status pages, replies include the focal post as [Post: ...] so
   * the classifier understands what is being replied to.
   * Emoji are preserved via getEmojiText() rather than .textContent.
   */
  extractText(tweetElement) {
    // If the tweet body hasn't rendered yet (Twitter lazy-loads card content),
    // return '' so the element stays unmarked and gets picked up on the next
    // observer pass. Video/poll tweets have no tweetText by design - only skip
    // early if there's also no video player and no poll present.
    const text = tweetElement.querySelector('[data-testid="tweetText"]');
    const hasVideo = tweetElement.querySelector('[data-testid="videoPlayer"], video, [data-testid="videoComponent"]');
    const hasPoll = tweetElement.querySelector('[data-testid="cardPoll"]');
    const hasCard = tweetElement.querySelector('[data-testid="card.wrapper"]');
    if (!text && !hasVideo && !hasPoll && !hasCard) return '';

    const parts = [];

    // Author display name - helps detect mockery and quote-tweet dunking
    const author = tweetElement.querySelector('[data-testid="User-Name"]');
    if (author) {
      const displayName = author.querySelector('span');
      if (displayName) parts.push(`[Author: ${displayName.textContent.trim()}]`);
    }

    // Main tweet text (emoji-aware: Twitter renders emoji as <img alt="😂">)
    if (text) parts.push(getEmojiText(text));

    // Quoted tweet text (nested tweet inside this tweet).
    // Requires two levels of [data-testid="tweet"] nesting to avoid matching
    // the main tweet's own tweetText, which is also a descendant of the outer
    // tweet element and would be returned first by querySelector.
    const quoted = tweetElement.querySelector(
      '[data-testid="tweet"] [data-testid="tweet"] [data-testid="tweetText"]'
    );
    if (quoted) parts.push(getEmojiText(quoted));

    // Link card title/description
    const card = tweetElement.querySelector('[data-testid="card.wrapper"]');
    if (card) {
      const cardText = card.querySelector(
        '[data-testid="card.layoutLarge.detail"] span, a[role="link"] span'
      );
      if (cardText) parts.push(cardText.textContent.trim());
    }

    // Video context - grab accessible description/title near the video player
    const video = tweetElement.querySelector(
      '[data-testid="videoPlayer"], video, [data-testid="videoComponent"]'
    );
    if (video) {
      const videoLabel = video.getAttribute('aria-label')
        || video.closest('[aria-label]')?.getAttribute('aria-label');
      if (videoLabel && videoLabel.length > 5) {
        parts.push(`[Video: ${videoLabel}]`);
      }
      // If tweet has no text at all, flag it so the LLM still sees something
      if (!text) {
        parts.push('[Video tweet]');
      }
    }

    // Poll options - polls are often engagement bait
    const pollOptions = tweetElement.querySelectorAll(
      '[data-testid="cardPoll"] [role="radio"], [data-testid="cardPoll"] span'
    );
    if (pollOptions.length > 0) {
      const pollTexts = [];
      pollOptions.forEach(opt => {
        const t = opt.textContent?.trim();
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

    // Social context - "X liked" / "X retweeted" banners above the tweet
    const socialContext = tweetElement.querySelector('[data-testid="socialContext"]');
    if (socialContext) {
      parts.push(`[Context: ${socialContext.textContent.trim()}]`);
    }

    // Thread context: on status/thread pages, inject the focal post so the
    // classifier knows what this reply/comment is responding to.
    // Skip for the focal post itself (first tweet in DOM) to avoid redundancy.
    const isFirstTweet = tweetElement === document.querySelector('[data-testid="tweet"]');
    if (!isFirstTweet) {
      const focalText = getFocalPostText();
      if (focalText) parts.unshift(`[Post: ${focalText}]`);
    }

    return parts.join(' | ');
  },

  /**
   * Extract the @handle of the tweet author (Phase 6.2 allowlist/blocklist).
   * Returns lowercase handle without @, e.g. "nytimes", or null if not found.
   */
  extractAuthor(tweetElement) {
    const userNameEl = tweetElement.querySelector('[data-testid="User-Name"]');
    if (!userNameEl) return null;
    // The @handle appears as a link with href="/username" inside User-Name
    const link = userNameEl.querySelector('a[href^="/"]');
    if (!link) return null;
    const handle = link.getAttribute('href').replace('/', '').split('/')[0].toLowerCase();
    return handle || null;
  }
};

if (typeof IntentKeeperCore !== 'undefined') {
  IntentKeeperCore.init(twitterAdapter);
}

if (typeof module !== 'undefined') {
  module.exports = { twitterAdapter };
}
