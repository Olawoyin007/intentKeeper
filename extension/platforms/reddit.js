/**
 * IntentKeeper - Reddit Platform Adapter
 *
 * Handles three Reddit DOM variants:
 *   - Shreddit (current new Reddit, ~2023+): <shreddit-post>, <shreddit-comment>
 *   - Old new Reddit (pre-shreddit): div[data-testid="post-container"]
 *   - Old Reddit (old.reddit.com): .thing.link, .thing.comment
 *
 * Intercepts:
 *   - Post titles in feeds and listing pages
 *   - Self-post (text post) body content
 *   - Top-level comments
 *
 * All classification logic lives in core/classifier.js.
 */

// ---- Reddit variant detection ----

function isOldReddit() {
  return window.location.hostname === 'old.reddit.com';
}

function isShreddit() {
  // Shreddit uses a custom <shreddit-app> root element
  return document.querySelector('shreddit-app') !== null;
}

// ---- Text extraction: Shreddit ----

function extractShredditPostText(element) {
  const parts = [];

  // Title lives in the [slot="title"] or as a direct attribute
  const titleSlot = element.querySelector('[slot="title"]');
  if (titleSlot) {
    parts.push(titleSlot.textContent.trim());
  } else {
    // Fallback: read from the post-title attribute on the custom element
    const attrTitle = element.getAttribute('post-title');
    if (attrTitle) parts.push(attrTitle.trim());
  }

  // Subreddit context helps with tone calibration
  const sub = element.getAttribute('subreddit-name') || element.getAttribute('subreddit-prefixed-name');
  if (sub) parts.push(`[${sub}]`);

  // Post flair can indicate community norms
  const flair = element.querySelector('[slot="flair"]');
  if (flair) {
    const flairText = flair.textContent.trim();
    if (flairText) parts.push(`[Flair: ${flairText}]`);
  }

  return parts.join(' | ');
}

function extractShredditCommentText(element) {
  const parts = [];

  const author = element.getAttribute('author');
  if (author) parts.push(`[u/${author}]`);

  // Comment body is in [slot="comment"]
  const body = element.querySelector('[slot="comment"]');
  if (body) {
    const text = body.textContent.trim();
    // Cap at 400 chars - comments can be essays; first 400 captures the tone
    if (text) parts.push(text.slice(0, 400));
  }

  return parts.join(' | ');
}

// ---- Text extraction: Old new Reddit ----

function extractNewRedditPostText(element) {
  const parts = [];

  const title = element.querySelector('h3, [data-click-id="text"] h3, h1');
  if (title) parts.push(title.textContent.trim());

  // Subreddit badge
  const sub = element.querySelector('[data-click-id="subreddit"], h3[id^="post-title"] ~ *');
  if (sub) {
    const subText = sub.textContent.trim();
    if (subText.startsWith('r/')) parts.push(`[${subText}]`);
  }

  // Post flair
  const flair = element.querySelector('[class*="flair"]');
  if (flair) {
    const flairText = flair.textContent.trim();
    if (flairText) parts.push(`[Flair: ${flairText}]`);
  }

  return parts.join(' | ');
}

function extractNewRedditCommentText(element) {
  const parts = [];

  const author = element.querySelector('[data-testid="comment_author_link"], a[href*="/user/"]');
  if (author) parts.push(`[${author.textContent.trim()}]`);

  // Comment body - RichTextJSON or plain paragraph
  const body = element.querySelector('.RichTextJSON-root, [data-testid="comment"] > div p');
  if (body) {
    const text = body.textContent.trim();
    if (text) parts.push(text.slice(0, 400));
  }

  return parts.join(' | ');
}

// ---- Text extraction: Old Reddit ----

function extractOldRedditPostText(element) {
  const parts = [];

  const title = element.querySelector('.title > a.title, p.title > a');
  if (title) parts.push(title.textContent.trim());

  // Subreddit link visible in front page feeds
  const sub = element.querySelector('.subreddit');
  if (sub) {
    const subText = sub.textContent.trim();
    if (subText) parts.push(`[${subText}]`);
  }

  // Flair
  const flair = element.querySelector('.linkflairlabel');
  if (flair) {
    const flairText = flair.textContent.trim();
    if (flairText) parts.push(`[Flair: ${flairText}]`);
  }

  return parts.join(' | ');
}

function extractOldRedditCommentText(element) {
  const parts = [];

  const author = element.querySelector('.author');
  if (author) parts.push(`[u/${author.textContent.trim()}]`);

  // Comment markdown body
  const body = element.querySelector('.md > p, .usertext-body .md');
  if (body) {
    const text = body.textContent.trim();
    if (text) parts.push(text.slice(0, 400));
  }

  return parts.join(' | ');
}

// ---- Adapter ----

const redditAdapter = {
  platform: 'reddit',

  /**
   * CSS selectors for content elements to classify.
   * Covers all three Reddit DOM variants in a single union selector.
   * IntentKeeperCore will call extractText() to dispatch to the right extractor.
   */
  get baseSelector() {
    if (isOldReddit()) {
      return [
        '.thing.link',     // Feed post (link or self post)
        '.thing.comment',  // Top-level and nested comments
      ].join(', ');
    }
    if (isShreddit()) {
      return [
        'shreddit-post',    // Feed cards and post page header
        'shreddit-comment', // Comments (top-level and nested)
      ].join(', ');
    }
    // Old new Reddit fallback
    return [
      'div[data-testid="post-container"]', // Feed post card
      'div[data-testid="comment"]',        // Comment
    ].join(', ');
  },

  /**
   * The element to receive visual treatment (blur/tag/hide class).
   * For posts: the post title container.
   * For comments: the comment body.
   */
  getContentElement(element) {
    const tag = element.tagName.toLowerCase();

    if (tag === 'shreddit-comment') {
      return element.querySelector('[slot="comment"]') || element;
    }
    if (tag === 'shreddit-post') {
      return element.querySelector('[slot="title"]') || element;
    }
    if (element.classList.contains('comment')) {
      return element.querySelector('.usertext-body, .md') || element;
    }
    if (element.classList.contains('link')) {
      return element.querySelector('p.title, .title') || element;
    }
    // New Reddit post container
    if (element.dataset.testid === 'post-container') {
      return element.querySelector('h3') || element;
    }
    // New Reddit comment
    if (element.dataset.testid === 'comment') {
      return element.querySelector('.RichTextJSON-root, p') || element;
    }
    return element;
  },

  /**
   * No thumbnail blur container needed for Reddit (text-based).
   * Returns null to fall back to blurring the content element directly.
   */
  getBlurContainer(_element) {
    return null;
  },

  /**
   * Dispatch to the correct text extractor based on DOM variant and element type.
   */
  extractText(element) {
    const tag = element.tagName.toLowerCase();

    // Shreddit
    if (tag === 'shreddit-post') return extractShredditPostText(element);
    if (tag === 'shreddit-comment') return extractShredditCommentText(element);

    // Old Reddit
    if (isOldReddit()) {
      if (element.classList.contains('comment')) return extractOldRedditCommentText(element);
      if (element.classList.contains('link')) return extractOldRedditPostText(element);
    }

    // Old new Reddit
    if (element.dataset.testid === 'comment') return extractNewRedditCommentText(element);
    return extractNewRedditPostText(element);
  },
};

if (typeof IntentKeeperCore !== 'undefined') {
  IntentKeeperCore.init(redditAdapter);
}

if (typeof module !== 'undefined') {
  module.exports = { redditAdapter };
}
