/**
 * @jest-environment jsdom
 * @jest-environment-options {"url": "https://old.reddit.com/"}
 *
 * Old-Reddit extractText coverage. Split into its own file because the adapter's
 * extractText dispatches on window.location.hostname (isOldReddit()), and jsdom
 * makes window.location non-configurable - so the hostname is set per-file via
 * the @jest-environment-options URL above rather than mocked at runtime.
 */

const { redditAdapter } = require('../platforms/reddit');

afterEach(() => {
  document.body.innerHTML = '';
});

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

describe('redditAdapter.extractText - old Reddit (old.reddit.com)', () => {
  test('isOldReddit path is active under the old.reddit.com URL', () => {
    // Sanity: baseSelector should resolve to the old-Reddit branch here.
    expect(redditAdapter.baseSelector).toContain('.thing.link');
  });

  test('extracts post title from .title a', () => {
    const el = makeOldRedditPost({ title: 'An old.reddit post title' });
    expect(redditAdapter.extractText(el)).toContain('An old.reddit post title');
  });

  test('includes subreddit context when present', () => {
    const el = makeOldRedditPost({ title: 'A post', subreddit: 'r/AskHistorians' });
    expect(redditAdapter.extractText(el)).toContain('[r/AskHistorians]');
  });
});
