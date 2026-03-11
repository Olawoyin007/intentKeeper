/**
 * Tests for extension/platforms/youtube.js
 * Covers text extraction, content element selection, and blur container
 * selection for all three YouTube content types.
 */

const { youtubeAdapter } = require('../platforms/youtube');

// ---- DOM helpers ----

// Elements must be attached to the document for jsdom to compute innerText.
afterEach(() => { document.body.innerHTML = ''; });

function attach(el) {
  document.body.appendChild(el);
  return el;
}

/**
 * Build a mock YouTube feed video card (ytd-rich-item-renderer).
 */
function makeVideoCard({ title = '', channel = '', views = '', date = '' } = {}) {
  const el = document.createElement('ytd-rich-item-renderer');
  el.innerHTML = `
    <ytd-thumbnail>
      <a id="thumbnail"><img src="thumb.jpg" alt="thumbnail"></a>
    </ytd-thumbnail>
    <div id="details">
      <yt-formatted-string id="video-title">${title}</yt-formatted-string>
      <ytd-channel-name><span id="text">${channel}</span></ytd-channel-name>
      <div id="metadata-line">
        <span>${views}</span>
        <span>${date}</span>
      </div>
    </div>
  `;
  return attach(el);
}

/**
 * Build a mock YouTube watch page metadata element (ytd-watch-metadata).
 */
function makeWatchMetadata({ title = '', description = '', channel = '' } = {}) {
  const el = document.createElement('ytd-watch-metadata');
  el.innerHTML = `
    <h1><yt-formatted-string id="title">${title}</yt-formatted-string></h1>
    <ytd-channel-name><span id="text">${channel}</span></ytd-channel-name>
    <div id="description-text">${description}</div>
  `;
  return attach(el);
}

/**
 * Build a mock YouTube comment thread (ytd-comment-thread-renderer).
 */
function makeComment({ author = '', body = '' } = {}) {
  const el = document.createElement('ytd-comment-thread-renderer');
  el.innerHTML = `
    <span id="author-text">${author}</span>
    <span id="content-text">${body}</span>
  `;
  return attach(el);
}

// ---- Adapter metadata ----

describe('youtubeAdapter metadata', () => {
  test('platform is youtube', () => {
    expect(youtubeAdapter.platform).toBe('youtube');
  });

  test('baseSelector covers video cards and comments (watch metadata excluded pending eval)', () => {
    const active = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-comment-thread-renderer',
    ];
    active.forEach(sel => {
      expect(youtubeAdapter.baseSelector).toContain(sel);
    });
    // ytd-watch-metadata is intentionally excluded until eval numbers justify it
    expect(youtubeAdapter.baseSelector).not.toContain('ytd-watch-metadata');
  });
});

// ---- extractText: video cards ----

describe('youtubeAdapter.extractText - video cards', () => {
  test('includes video title', () => {
    const el = makeVideoCard({ title: 'How to bake sourdough' });
    expect(youtubeAdapter.extractText(el)).toContain('How to bake sourdough');
  });

  test('includes channel name with label', () => {
    const el = makeVideoCard({ title: 'Test', channel: 'BakingChannel' });
    expect(youtubeAdapter.extractText(el)).toContain('[Channel: BakingChannel]');
  });

  test('includes metadata', () => {
    const el = makeVideoCard({ title: 'Test', views: '1.2M views', date: '3 days ago' });
    const text = youtubeAdapter.extractText(el);
    expect(text).toContain('1.2M views');
    expect(text).toContain('3 days ago');
  });

  test('returns empty string for card with no content', () => {
    const el = makeVideoCard();
    // Empty title + channel + metadata = empty parts joined by ' | ' = ''
    expect(youtubeAdapter.extractText(el).trim()).toBe('');
  });
});

// ---- extractText: watch metadata ----

describe('youtubeAdapter.extractText - watch metadata', () => {
  test('includes video title', () => {
    const el = makeWatchMetadata({ title: 'The real story behind the algorithm' });
    expect(youtubeAdapter.extractText(el)).toContain('The real story behind the algorithm');
  });

  test('includes description', () => {
    const el = makeWatchMetadata({ title: 'Title', description: 'A thoughtful description here.' });
    expect(youtubeAdapter.extractText(el)).toContain('A thoughtful description here.');
  });

  test('truncates description at 300 characters', () => {
    const longDesc = 'x'.repeat(500);
    const el = makeWatchMetadata({ title: 'T', description: longDesc });
    const text = youtubeAdapter.extractText(el);
    // Description should be sliced, so "x" repeated 300 times should appear, not 500
    expect(text).toContain('x'.repeat(300));
    expect(text).not.toContain('x'.repeat(301));
  });

  test('includes channel name', () => {
    const el = makeWatchMetadata({ title: 'T', channel: 'SomeChannel' });
    expect(youtubeAdapter.extractText(el)).toContain('[Channel: SomeChannel]');
  });
});

// ---- extractText: comments ----

describe('youtubeAdapter.extractText - comments', () => {
  test('includes comment body', () => {
    const el = makeComment({ author: 'Alice', body: 'This video changed my life.' });
    expect(youtubeAdapter.extractText(el)).toContain('This video changed my life.');
  });

  test('includes author with label', () => {
    const el = makeComment({ author: 'Alice', body: 'Great video!' });
    expect(youtubeAdapter.extractText(el)).toContain('[Author: Alice]');
  });
});

// ---- getContentElement ----

describe('youtubeAdapter.getContentElement', () => {
  test('video card returns thumbnail img', () => {
    const el = makeVideoCard({ title: 'Test' });
    const content = youtubeAdapter.getContentElement(el);
    expect(content).not.toBeNull();
    expect(content.tagName.toLowerCase()).toBe('img');
  });

  test('watch metadata returns description element', () => {
    const el = makeWatchMetadata({ title: 'T', description: 'desc' });
    const content = youtubeAdapter.getContentElement(el);
    expect(content).not.toBeNull();
    expect(content.id).toBe('description-text');
  });

  test('comment returns content-text element', () => {
    const el = makeComment({ author: 'Bob', body: 'hello' });
    const content = youtubeAdapter.getContentElement(el);
    expect(content).not.toBeNull();
    expect(content.id).toBe('content-text');
  });
});

// ---- getBlurContainer ----

describe('youtubeAdapter.getBlurContainer', () => {
  test('video card returns thumbnail container (overlay scoped to thumbnail)', () => {
    const el = makeVideoCard({ title: 'Test' });
    const container = youtubeAdapter.getBlurContainer(el);
    expect(container).not.toBeNull();
    // Should be the thumbnail anchor or ytd-thumbnail, not the whole card
    expect(container).not.toBe(el);
  });

  test('ytd-video-renderer also returns thumbnail container', () => {
    const el = document.createElement('ytd-video-renderer');
    el.innerHTML = `<a id="thumbnail"><img src="t.jpg"></a>`;
    const container = youtubeAdapter.getBlurContainer(el);
    expect(container).not.toBeNull();
  });

  test('watch metadata returns null (overlay covers whole element)', () => {
    const el = makeWatchMetadata({ title: 'T' });
    expect(youtubeAdapter.getBlurContainer(el)).toBeNull();
  });

  test('comment returns null (overlay covers whole element)', () => {
    const el = makeComment({ body: 'text' });
    expect(youtubeAdapter.getBlurContainer(el)).toBeNull();
  });
});
