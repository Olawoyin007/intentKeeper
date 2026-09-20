/**
 * Tests for extension/popup/popup.js - settings load/save round-trip, the
 * connection-status rendering, correction count, and allowlist add/normalize.
 *
 * popup.js reads DOM elements at load, so each test rebuilds the popup DOM,
 * resets the module cache, then requires it fresh. chrome.* is mocked in
 * tests/setup.js.
 */

// Minimal DOM matching the IDs popup.js reads/writes.
const FIXTURE = `
  <input type="checkbox" id="enabled">
  <input type="checkbox" id="showTags">
  <input type="checkbox" id="blurRagebait">
  <input type="checkbox" id="hideEngagementBait">
  <input type="range" id="threshold" min="0" max="100" value="60">
  <span id="thresholdValue"></span>
  <div id="status"></div>
  <span id="status-text"></span>
  <input type="checkbox" id="intent-ragebait">
  <input type="checkbox" id="intent-fearmongering">
  <input type="checkbox" id="intent-hype">
  <input type="checkbox" id="intent-engagement_bait">
  <input type="checkbox" id="intent-divisive">
  <span id="corrections-count"></span>
  <span id="corrections-desc"></span>
  <button id="clear-corrections"></button>
  <div id="allowlist-list"></div>
  <div id="allowlist-empty"></div>
  <button id="allowlist-add"></button>
  <input id="allowlist-input">
`;

let popup;

beforeEach(() => {
  document.body.innerHTML = FIXTURE;
  chrome.storage.local.get.mockReset().mockResolvedValue({});
  chrome.storage.local.set.mockReset().mockResolvedValue({});
  chrome.storage.local.remove = jest.fn().mockResolvedValue({});
  chrome.runtime.sendMessage.mockReset();
  jest.resetModules();
  popup = require('../popup/popup');
});

describe('loadSettings', () => {
  test('reflects stored settings into the controls', async () => {
    chrome.storage.local.get.mockResolvedValue({
      intentkeeper_settings: {
        enabled: false,
        showTags: true,
        manipulationThreshold: 0.8,
        intentEnabled: { ragebait: false },
      },
    });

    await popup.loadSettings();

    expect(document.getElementById('enabled').checked).toBe(false);
    expect(document.getElementById('showTags').checked).toBe(true);
    expect(document.getElementById('threshold').value).toBe('80');
    expect(document.getElementById('thresholdValue').textContent).toBe('80%');
    expect(document.getElementById('intent-ragebait').checked).toBe(false);
    // A key absent from stored intentEnabled defaults to enabled.
    expect(document.getElementById('intent-hype').checked).toBe(true);
  });

  test('defaults to enabled / 60% when storage is empty', async () => {
    await popup.loadSettings();
    expect(document.getElementById('enabled').checked).toBe(true);
    expect(document.getElementById('threshold').value).toBe('60');
    expect(document.getElementById('thresholdValue').textContent).toBe('60%');
  });
});

describe('saveSettings', () => {
  test('writes the current control state to storage', async () => {
    document.getElementById('enabled').checked = true;
    document.getElementById('showTags').checked = false;
    document.getElementById('blurRagebait').checked = true;
    document.getElementById('hideEngagementBait').checked = false;
    document.getElementById('threshold').value = '75';
    document.getElementById('intent-ragebait').checked = true;
    document.getElementById('intent-divisive').checked = false;

    await popup.saveSettings();

    expect(chrome.storage.local.set).toHaveBeenCalledTimes(1);
    const saved = chrome.storage.local.set.mock.calls[0][0].intentkeeper_settings;
    expect(saved.enabled).toBe(true);
    expect(saved.showTags).toBe(false);
    expect(saved.manipulationThreshold).toBe(0.75);
    expect(saved.intentEnabled.divisive).toBe(false);
    expect(saved.intentEnabled.ragebait).toBe(true);
  });

  test('a checkbox change event triggers a save', async () => {
    const cb = document.getElementById('enabled');
    cb.dispatchEvent(new Event('change'));
    await Promise.resolve();
    expect(chrome.storage.local.set).toHaveBeenCalled();
  });
});

describe('checkHealth', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('shows Connected with the model when the server is ok', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ status: 'ok', model: 'llama3.1:8b' });
    await popup.checkHealth();
    expect(document.getElementById('status-text').textContent).toBe('Connected (llama3.1:8b)');
    expect(document.getElementById('status').className).toBe('status connected');
  });

  test('shows Ollama not connected when the server is up but Ollama is down', async () => {
    chrome.runtime.sendMessage.mockResolvedValue({ status: 'disconnected', ollama_connected: false });
    await popup.checkHealth();
    expect(document.getElementById('status-text').textContent).toBe('Ollama not connected');
  });

  test('shows Server not running when the message rejects', async () => {
    chrome.runtime.sendMessage.mockRejectedValue(new Error('no worker'));
    await popup.checkHealth();
    expect(document.getElementById('status-text').textContent).toBe('Server not running');
  });
});

describe('loadCorrectionsCount', () => {
  test('renders a pluralized description for multiple corrections', async () => {
    chrome.storage.local.get.mockResolvedValue({ ik_corrections: [{}, {}] });
    await popup.loadCorrectionsCount();
    expect(document.getElementById('corrections-count').textContent).toBe('2');
    expect(document.getElementById('corrections-desc').textContent).toContain('2 corrections');
  });

  test('renders the empty hint when there are no corrections', async () => {
    chrome.storage.local.get.mockResolvedValue({});
    await popup.loadCorrectionsCount();
    expect(document.getElementById('corrections-count').textContent).toBe('0');
    expect(document.getElementById('corrections-desc').textContent).toContain('Hover a tag');
  });
});

describe('allowlist add', () => {
  test('strips a leading @ and lowercases before storing', async () => {
    document.getElementById('allowlist-input').value = '@Alice';
    document.getElementById('allowlist-add').dispatchEvent(new Event('click'));
    await Promise.resolve(); await Promise.resolve();

    const call = chrome.storage.local.set.mock.calls.find(c => c[0].ik_allowlist);
    expect(call[0].ik_allowlist).toEqual(['alice']);
  });

  test('strips a leading u/ prefix', async () => {
    document.getElementById('allowlist-input').value = 'u/Bob';
    document.getElementById('allowlist-add').dispatchEvent(new Event('click'));
    await Promise.resolve(); await Promise.resolve();

    const call = chrome.storage.local.set.mock.calls.find(c => c[0].ik_allowlist);
    expect(call[0].ik_allowlist).toEqual(['bob']);
  });

  test('does nothing on empty input', async () => {
    document.getElementById('allowlist-input').value = '   ';
    document.getElementById('allowlist-add').dispatchEvent(new Event('click'));
    await Promise.resolve();
    expect(chrome.storage.local.set).not.toHaveBeenCalled();
  });
});
