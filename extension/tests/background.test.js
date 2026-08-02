/**
 * Tests for extension/background.js - the service worker's logic layer:
 * API proxying (classify / batch / health), correction loading, and the badge.
 *
 * The worker's fetch calls are mocked; chrome.* is mocked in tests/setup.js.
 */

const {
  checkApiHealth,
  classifyContent,
  classifyBatch,
  loadCorrectionsForPrompt,
  updateBadge,
  DEFAULT_SETTINGS,
} = require('../background');

beforeEach(() => {
  global.fetch = jest.fn();
  chrome.storage.local.get.mockResolvedValue({});
  chrome.action.setBadgeText.mockClear();
  chrome.action.setBadgeBackgroundColor.mockClear();
});

describe('checkApiHealth', () => {
  test('returns the parsed health payload when the server responds', async () => {
    const payload = { status: 'ok', ollama_connected: true, model: 'llama3.1:8b' };
    fetch.mockResolvedValue({ json: async () => payload });

    await expect(checkApiHealth()).resolves.toEqual(payload);
    expect(fetch).toHaveBeenCalledWith('http://localhost:8420/health');
  });

  test('fails open to a disconnected payload when the fetch throws', async () => {
    fetch.mockRejectedValue(new Error('ECONNREFUSED'));

    await expect(checkApiHealth()).resolves.toEqual({
      status: 'disconnected',
      ollama_connected: false,
      model: 'none',
    });
  });
});

describe('classifyContent', () => {
  test('POSTs the content to /classify and returns the JSON result', async () => {
    const result = { intent: 'ragebait', confidence: 0.9, action: 'blur' };
    fetch.mockResolvedValue({ ok: true, json: async () => result });

    await expect(classifyContent('some tweet', 'twitter')).resolves.toEqual(result);
    const [url, opts] = fetch.mock.calls[0];
    expect(url).toBe('http://localhost:8420/classify');
    expect(opts.method).toBe('POST');
    expect(JSON.parse(opts.body)).toEqual({ content: 'some tweet', source: 'twitter' });
  });

  test('defaults the source to twitter when none is given', async () => {
    fetch.mockResolvedValue({ ok: true, json: async () => ({}) });

    await classifyContent('x');
    expect(JSON.parse(fetch.mock.calls[0][1].body).source).toBe('twitter');
  });

  test('returns null on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 500 });
    await expect(classifyContent('x', 'twitter')).resolves.toBeNull();
  });

  test('returns null when the fetch throws', async () => {
    fetch.mockRejectedValue(new Error('network'));
    await expect(classifyContent('x', 'twitter')).resolves.toBeNull();
  });
});

describe('loadCorrectionsForPrompt', () => {
  test('maps stored corrections to the server field names', async () => {
    chrome.storage.local.get.mockResolvedValue({
      ik_corrections: [
        { snippet: 'a', originalIntent: 'hype', correctedIntent: 'genuine', timestamp: 1 },
      ],
    });

    await expect(loadCorrectionsForPrompt()).resolves.toEqual([
      { snippet: 'a', original_intent: 'hype', corrected_intent: 'genuine' },
    ]);
  });

  test('returns only the 5 most recent corrections', async () => {
    const many = Array.from({ length: 8 }, (_, i) => ({
      snippet: `s${i}`, originalIntent: 'hype', correctedIntent: 'genuine',
    }));
    chrome.storage.local.get.mockResolvedValue({ ik_corrections: many });

    const result = await loadCorrectionsForPrompt();
    expect(result).toHaveLength(5);
    expect(result[0].snippet).toBe('s3'); // last 5 -> s3..s7
    expect(result[4].snippet).toBe('s7');
  });

  test('returns an empty array when there are no corrections', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    await expect(loadCorrectionsForPrompt()).resolves.toEqual([]);
  });

  test('returns an empty array when storage throws', async () => {
    chrome.storage.local.get.mockRejectedValue(new Error('storage'));
    await expect(loadCorrectionsForPrompt()).resolves.toEqual([]);
  });
});

describe('classifyBatch', () => {
  test('POSTs items to /classify/batch and returns data.results', async () => {
    const results = [{ intent: 'hype' }, { intent: 'genuine' }];
    fetch.mockResolvedValue({ ok: true, json: async () => ({ results }) });

    const out = await classifyBatch([{ content: 'a' }, { content: 'b' }]);
    expect(out).toEqual(results);
    expect(fetch.mock.calls[0][0]).toBe('http://localhost:8420/classify/batch');
  });

  test('enriches each item with user_corrections when corrections exist', async () => {
    chrome.storage.local.get.mockResolvedValue({
      ik_corrections: [{ snippet: 'a', originalIntent: 'hype', correctedIntent: 'genuine' }],
    });
    fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

    await classifyBatch([{ content: 'a' }]);
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.items[0].user_corrections).toEqual([
      { snippet: 'a', original_intent: 'hype', corrected_intent: 'genuine' },
    ]);
  });

  test('omits user_corrections when there are none', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    fetch.mockResolvedValue({ ok: true, json: async () => ({ results: [] }) });

    await classifyBatch([{ content: 'a' }]);
    const sent = JSON.parse(fetch.mock.calls[0][1].body);
    expect(sent.items[0]).not.toHaveProperty('user_corrections');
  });

  test('returns null on a non-ok response', async () => {
    fetch.mockResolvedValue({ ok: false, status: 502 });
    await expect(classifyBatch([{ content: 'a' }])).resolves.toBeNull();
  });
});

describe('updateBadge', () => {
  test('clears the badge and goes green when the server is ok', async () => {
    fetch.mockResolvedValue({ json: async () => ({ status: 'ok' }) });

    await updateBadge();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#4CAF50' });
  });

  test('shows a red "!" when the server is unreachable', async () => {
    fetch.mockRejectedValue(new Error('down'));

    await updateBadge();
    expect(chrome.action.setBadgeText).toHaveBeenCalledWith({ text: '!' });
    expect(chrome.action.setBadgeBackgroundColor).toHaveBeenCalledWith({ color: '#f44336' });
  });
});

describe('DEFAULT_SETTINGS', () => {
  test('ships every intent toggle enabled by default', () => {
    expect(DEFAULT_SETTINGS.enabled).toBe(true);
    for (const key of ['ragebait', 'fearmongering', 'hype', 'engagement_bait', 'divisive']) {
      expect(DEFAULT_SETTINGS.intentEnabled[key]).toBe(true);
    }
  });
});
