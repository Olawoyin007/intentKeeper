/**
 * Tests for extension/core/classifier.js
 * Covers pure utility functions and the selector-building logic.
 */

const { hashContent, formatIntent, escapeHtml, buildSelector } = require('../core/classifier');

describe('hashContent', () => {
  test('same input produces same hash', () => {
    expect(hashContent('hello world')).toBe(hashContent('hello world'));
  });

  test('different inputs produce different hashes', () => {
    expect(hashContent('ragebait content')).not.toBe(hashContent('genuine content'));
  });

  test('returns a string', () => {
    expect(typeof hashContent('test')).toBe('string');
  });

  test('handles empty string', () => {
    expect(() => hashContent('')).not.toThrow();
  });

  test('handles unicode', () => {
    expect(() => hashContent('🔥💀🚨 breaking news')).not.toThrow();
    expect(hashContent('🔥 a')).not.toBe(hashContent('🔥 b'));
  });
});

describe('formatIntent', () => {
  test('formats all core Twitter intents', () => {
    expect(formatIntent('ragebait')).toBe('Ragebait');
    expect(formatIntent('fearmongering')).toBe('Fear-mongering');
    expect(formatIntent('hype')).toBe('Hype');
    expect(formatIntent('engagement_bait')).toBe('Engagement Bait');
    expect(formatIntent('divisive')).toBe('Divisive');
    expect(formatIntent('genuine')).toBe('Genuine');
    expect(formatIntent('neutral')).toBe('Neutral');
  });

  test('formats YouTube-specific intents added in Phase 3', () => {
    expect(formatIntent('clickbait')).toBe('Clickbait');
    expect(formatIntent('reaction_farming')).toBe('Reaction Farming');
  });

  test('returns the raw string for unknown intents rather than crashing', () => {
    expect(formatIntent('unknown_future_intent')).toBe('unknown_future_intent');
  });
});

describe('escapeHtml', () => {
  test('escapes script tags', () => {
    expect(escapeHtml('<script>alert(1)</script>')).toBe('&lt;script&gt;alert(1)&lt;/script&gt;');
  });

  test('escapes ampersands', () => {
    expect(escapeHtml('cats & dogs')).toBe('cats &amp; dogs');
  });

  test('does not escape quotes - innerHTML only escapes <, >, &', () => {
    // div.textContent + div.innerHTML only escapes HTML structural characters,
    // not attribute-context characters like quotes. This is correct behaviour
    // for our use case (we're injecting into element content, not attributes).
    expect(escapeHtml('"hello"')).toBe('"hello"');
  });

  test('leaves plain text unchanged', () => {
    expect(escapeHtml('just some text')).toBe('just some text');
  });

  test('handles empty string', () => {
    expect(escapeHtml('')).toBe('');
  });
});

describe('buildSelector', () => {
  const ATTR = 'data-intentkeeper-processed';

  test('single selector gets :not() appended', () => {
    const result = buildSelector('[data-testid="tweet"]', ATTR);
    expect(result).toBe(`[data-testid="tweet"]:not([${ATTR}])`);
  });

  test('each part of a comma-separated selector gets :not() - the multi-selector bug fix', () => {
    const base = 'ytd-rich-item-renderer, ytd-video-renderer, ytd-comment-thread-renderer';
    const result = buildSelector(base, ATTR);

    // Every part must have :not(), not just the last one
    result.split(',').forEach(part => {
      expect(part.trim()).toMatch(new RegExp(`:not\\(\\[${ATTR}\\]\\)$`));
    });
  });

  test('trims whitespace from each part', () => {
    const result = buildSelector('  foo  ,  bar  ', ATTR);
    expect(result).toBe(`foo:not([${ATTR}]), bar:not([${ATTR}])`);
  });

  test('all five YouTube selectors get filtered', () => {
    const youtubeBase = [
      'ytd-rich-item-renderer',
      'ytd-video-renderer',
      'ytd-compact-video-renderer',
      'ytd-watch-metadata',
      'ytd-comment-thread-renderer',
    ].join(', ');

    const result = buildSelector(youtubeBase, ATTR);
    const parts = result.split(',').map(s => s.trim());

    expect(parts).toHaveLength(5);
    parts.forEach(part => {
      expect(part).toContain(`:not([${ATTR}])`);
    });
  });
});
