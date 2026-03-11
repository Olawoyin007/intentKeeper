/**
 * IntentKeeper - Twitter/X Platform Adapter
 *
 * Knows how to find tweets and extract rich text for classification.
 * All classification logic lives in core/classifier.js.
 */

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
   * Extract tweet text including author name, quoted tweets, link cards,
   * video context, poll options, image alt text, and social context banners.
   * Richer context improves classification accuracy.
   */
  extractText(tweetElement) {
    const parts = [];

    // Author display name - helps detect mockery and quote-tweet dunking
    const author = tweetElement.querySelector('[data-testid="User-Name"]');
    if (author) {
      const displayName = author.querySelector('span');
      if (displayName) parts.push(`[Author: ${displayName.textContent.trim()}]`);
    }

    // Main tweet text
    const text = tweetElement.querySelector('[data-testid="tweetText"]');
    if (text) parts.push(text.textContent.trim());

    // Quoted tweet text (nested tweet inside this tweet).
    // Requires two levels of [data-testid="tweet"] nesting to avoid matching
    // the main tweet's own tweetText, which is also a descendant of the outer
    // tweet element and would be returned first by querySelector.
    const quoted = tweetElement.querySelector(
      '[data-testid="tweet"] [data-testid="tweet"] [data-testid="tweetText"]'
    );
    if (quoted) parts.push(quoted.textContent.trim());

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

    return parts.join(' | ');
  }
};

if (typeof IntentKeeperCore !== 'undefined') {
  IntentKeeperCore.init(twitterAdapter);
}

if (typeof module !== 'undefined') {
  module.exports = { twitterAdapter };
}
