/**
 * Tests for extension/platforms/reddit.js
 * Covers text extraction, content-element selection, and author extraction
 * across all three Reddit DOM variants: Shreddit, old new Reddit, and old Reddit.
 */

const { redditAdapter } = require('../platforms/reddit');

// Default jsdom URL is http://localhost/, so isOldReddit()/isShreddit() are both
// false and baseSelector resolves to the new-Reddit branch. Old-Reddit extraction
// depends on window.location.hostname, which jsdom makes non-configurable - those
// tests live in reddit.oldreddit.test.js with a file-level old.reddit.com URL.

// Elements must be attached to the document for jsdom to compute textContent.
afterEach(() => {
  document.body.innerHTML = '';
});

// ---- DOM helpers: Shreddit (current Reddit) ----

/**
 * Build a mock <shreddit-post>. Pass loaded:false to simulate the element
 * shell appearing before its title content has rendered.
 */
function makeShredditPost({ title = '', subreddit = '', flair = '', loaded = true } = {}) {
  const el = document.createElement('shreddit-post');
  if (subreddit) el.setAttribute('subreddit-prefixed-name', subreddit);
  if (loaded && title) {
    const slot = document.createElement('h3');
    slot.setAttribute('slot', 'title');
    slot.textContent = title;
    el.appendChild(slot);
  }
  if (flair) {
    const flairEl = document.createElement('span');
    flairEl.setAttribute('slot', 'flair');
    flairEl.textContent = flair;
    el.appendChild(flairEl);
  }
  document.body.appendChild(el);
  return el;
}

function makeShredditComment({ body = '', author = '' } = {}) {
  const el = document.createElement('shreddit-comment');
  if (author) el.setAttribute('author', author);
  if (body) {
    const slot = document.createElement('div');
    slot.setAttribute('slot', 'comment');
    slot.textContent = body;
    el.appendChild(slot);
  }
  document.body.appendChild(el);
  return el;
}

// ---- DOM helpers: old new Reddit (pre-Shreddit) ----

function makeNewRedditPost({ title = '' } = {}) {
  const el = document.createElement('div');
  el.setAttribute('data-testid', 'post-container');
  if (title) {
    const h3 = document.createElement('h3');
    h3.textContent = title;
    el.appendChild(h3);
  }
  document.body.appendChild(el);
  return el;
}

// ---- DOM helpers: old Reddit (old.reddit.com) ----

function makeOldRedditPost({ title = '', subreddit = '' } = {}) {
  const el = document.createElement('div');
  el.className = 'thing link';
  const titleWrap = document.createElement('p');
  titleWrap.className = 'title';
  if (title) {
    const a = document.createElement('a');
    a.className = 'title';
    a.textContent = title;
    titleWrap.appendChild(a);
  }
  el.appendChild(titleWrap);
  if (subreddit) {
    const sub = document.createElement('a');
    sub.className = 'subreddit';
    sub.textContent = subreddit;
    el.appendChild(sub);
  }
  document.body.appendChild(el);
  return el;
}

// ---- Adapter metadata ----

describe('redditAdapter metadata', () => {
  test('platform is reddit', () => {
    expect(redditAdapter.platform).toBe('reddit');
  });

  test('baseSelector targets shreddit-post in the default (Shreddit) branch', () => {
    // jsdom has no <shreddit-app>, so baseSelector falls through to the
    // old-new-Reddit branch by default; assert that branch's selectors.
    expect(redditAdapter.baseSelector).toContain('post-container');
  });
});

// ---- extractText: Shreddit ----

describe('redditAdapter.extractText - Shreddit', () => {
  test('extracts post title from the title slot', () => {
    const el = makeShredditPost({ title: 'Scientists discover new species' });
    expect(redditAdapter.extractText(el)).toContain('Scientists discover new species');
  });

  test('includes subreddit context when present', () => {
    const el = makeShredditPost({ title: 'A post', subreddit: 'r/science' });
    expect(redditAdapter.extractText(el)).toContain('[r/science]');
  });

  test('includes flair when present', () => {
    const el = makeShredditPost({ title: 'A post', flair: 'Discussion' });
    expect(redditAdapter.extractText(el)).toContain('[Flair: Discussion]');
  });

  test('returns empty string for an unloaded post shell', () => {
    const el = makeShredditPost({ title: 'Not rendered yet', loaded: false });
    expect(redditAdapter.extractText(el)).toBe('');
  });

  test('extracts comment body and includes author', () => {
    const el = makeShredditComment({ body: 'This is a terrible take.', author: 'spez' });
    const result = redditAdapter.extractText(el);
    expect(result).toContain('This is a terrible take.');
    expect(result).toContain('[u/spez]');
  });

  test('returns empty string for an unrendered comment', () => {
    const el = makeShredditComment({ body: '' });
    expect(redditAdapter.extractText(el)).toBe('');
  });
});

// ---- extractText: old new Reddit ----

describe('redditAdapter.extractText - old new Reddit', () => {
  test('extracts post title from h3', () => {
    const el = makeNewRedditPost({ title: 'Breaking: something happened' });
    expect(redditAdapter.extractText(el)).toContain('Breaking: something happened');
  });

  test('returns empty string when the title has not loaded', () => {
    const el = makeNewRedditPost({ title: '' });
    expect(redditAdapter.extractText(el)).toBe('');
  });
});

// Old-Reddit extractText coverage lives in reddit.oldreddit.test.js (it needs a
// file-level old.reddit.com URL). getContentElement and extractAuthor for old
// Reddit are below - they key off classes/selectors, not hostname.

// ---- getContentElement ----

describe('redditAdapter.getContentElement', () => {
  test('Shreddit post returns the title slot', () => {
    const el = makeShredditPost({ title: 'Title here' });
    const content = redditAdapter.getContentElement(el);
    expect(content.getAttribute('slot')).toBe('title');
  });

  test('Shreddit comment returns the comment slot', () => {
    const el = makeShredditComment({ body: 'A comment' });
    const content = redditAdapter.getContentElement(el);
    expect(content.getAttribute('slot')).toBe('comment');
  });

  test('old Reddit link returns the title container', () => {
    const el = makeOldRedditPost({ title: 'Old title' });
    const content = redditAdapter.getContentElement(el);
    expect(content.classList.contains('title')).toBe(true);
  });

  test('new Reddit post container returns its h3', () => {
    const el = makeNewRedditPost({ title: 'New title' });
    const content = redditAdapter.getContentElement(el);
    expect(content.tagName.toLowerCase()).toBe('h3');
  });
});

// ---- extractAuthor ----

describe('redditAdapter.extractAuthor', () => {
  test('reads the author attribute on Shreddit elements, lowercased', () => {
    const el = makeShredditComment({ body: 'x', author: 'SpezHimself' });
    expect(redditAdapter.extractAuthor(el)).toBe('spezhimself');
  });

  test('reads the .author element on old Reddit', () => {
    const el = makeOldRedditPost({ title: 'x' });
    const author = document.createElement('a');
    author.className = 'author';
    author.textContent = 'OldRedditor';
    el.appendChild(author);
    expect(redditAdapter.extractAuthor(el)).toBe('oldredditor');
  });

  test('returns null when no author is present', () => {
    const el = makeNewRedditPost({ title: 'No author here' });
    expect(redditAdapter.extractAuthor(el)).toBeNull();
  });
});

// ---- getBlurContainer ----

describe('redditAdapter.getBlurContainer', () => {
  test('returns null - Reddit is text-based, blur falls back to content element', () => {
    const el = makeShredditPost({ title: 'x' });
    expect(redditAdapter.getBlurContainer(el)).toBeNull();
  });
});
