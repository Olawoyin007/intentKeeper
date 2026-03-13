/**
 * Tests for extension/platforms/twitter.js
 * Covers text extraction and content/blur element selection.
 */

const { twitterAdapter } = require('../platforms/twitter');

// ---- DOM helpers ----

// Elements must be attached to the document for jsdom to compute innerText.
afterEach(() => { document.body.innerHTML = ''; });

/**
 * Build a minimal mock tweet element.
 */
function makeTweet({ text = '', author = '', quoted = '', pollOptions = [], hasVideo = false } = {}) {
  const el = document.createElement('article');
  el.setAttribute('data-testid', 'tweet');

  let html = '';

  if (author) {
    html += `<div data-testid="User-Name"><span>${author}</span></div>`;
  }

  if (text) {
    html += `<div data-testid="tweetText">${text}</div>`;
  }

  if (quoted) {
    // Nested tweet structure
    html += `
      <div data-testid="tweet">
        <div data-testid="tweetText">${quoted}</div>
      </div>
    `;
  }

  if (hasVideo) {
    html += `<div data-testid="videoPlayer" aria-label="Breaking news video"></div>`;
  }

  if (pollOptions.length > 0) {
    const options = pollOptions.map(o => `<span role="radio">${o}</span>`).join('');
    html += `<div data-testid="cardPoll">${options}</div>`;
  }

  el.innerHTML = html;
  document.body.appendChild(el);
  return el;
}

// ---- Adapter metadata ----

describe('twitterAdapter metadata', () => {
  test('platform is twitter', () => {
    expect(twitterAdapter.platform).toBe('twitter');
  });

  test('baseSelector targets tweet elements', () => {
    expect(twitterAdapter.baseSelector).toContain('[data-testid="tweet"]');
  });
});

// ---- extractText ----

describe('twitterAdapter.extractText', () => {
  test('extracts main tweet text', () => {
    const el = makeTweet({ text: 'This is an outrage!' });
    expect(twitterAdapter.extractText(el)).toContain('This is an outrage!');
  });

  test('includes author name with label', () => {
    const el = makeTweet({ text: 'Hello', author: 'JohnDoe' });
    expect(twitterAdapter.extractText(el)).toContain('[Author: JohnDoe]');
  });

  test('includes quoted tweet text', () => {
    const el = makeTweet({ text: 'My take:', quoted: 'The original claim' });
    const result = twitterAdapter.extractText(el);
    expect(result).toContain('My take:');
    expect(result).toContain('The original claim');
  });

  test('includes poll options with label', () => {
    const el = makeTweet({ text: 'Vote!', pollOptions: ['Yes', 'No'] });
    const result = twitterAdapter.extractText(el);
    expect(result).toContain('[Poll:');
    expect(result).toContain('Yes');
    expect(result).toContain('No');
  });

  test('includes video label when present', () => {
    const el = makeTweet({ hasVideo: true });
    expect(twitterAdapter.extractText(el)).toContain('[Video:');
  });

  test('returns empty string for empty tweet', () => {
    const el = makeTweet();
    expect(twitterAdapter.extractText(el)).toBe('');
  });
});

// ---- getContentElement ----

describe('twitterAdapter.getContentElement', () => {
  test('returns tweetText element', () => {
    const el = makeTweet({ text: 'Some content' });
    const content = twitterAdapter.getContentElement(el);
    expect(content).not.toBeNull();
    expect(content.getAttribute('data-testid')).toBe('tweetText');
  });

  test('returns null when no tweetText present', () => {
    const el = document.createElement('article');
    expect(twitterAdapter.getContentElement(el)).toBeNull();
  });
});

// ---- getBlurContainer (not defined on Twitter adapter - overlay covers whole tweet) ----

describe('twitterAdapter.getBlurContainer', () => {
  test('is not defined - core falls back to whole element', () => {
    expect(twitterAdapter.getBlurContainer).toBeUndefined();
  });
});
