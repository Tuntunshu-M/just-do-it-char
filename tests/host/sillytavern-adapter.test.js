import assert from 'node:assert/strict';
import test from 'node:test';

import { createSillyTavernAdapter } from '../../src/host/sillytavern-adapter.js';

test('adapter reports unavailable host capabilities explicitly', () => {
  const adapter = createSillyTavernAdapter(() => ({}));

  assert.deepEqual(adapter.capabilities, {
    context: true,
    chat: false,
    character: false,
    messages: false,
    promptInjection: false,
    rawGeneration: false,
    normalGeneration: false,
    generation: false,
    settings: false,
    chatState: false,
    confirmation: false,
    events: false,
  });
});

test('adapter exposes raw and normal generation capabilities independently', () => {
  const rawOnly = createSillyTavernAdapter(() => ({ generateRaw() {} }));
  const normalOnly = createSillyTavernAdapter(() => ({ generate() {} }));

  assert.equal(rawOnly.capabilities.rawGeneration, true);
  assert.equal(rawOnly.capabilities.normalGeneration, false);
  assert.equal(rawOnly.capabilities.generation, false);
  assert.equal(normalOnly.capabilities.rawGeneration, false);
  assert.equal(normalOnly.capabilities.normalGeneration, true);
  assert.equal(normalOnly.capabilities.generation, false);
});

test('adapter delegates every supported operation to the host context', async () => {
  const calls = [];
  const context = {
    chatId: 'chat-1',
    characterId: 3,
    characters: [{ name: 'A' }, { name: 'B' }, { name: 'C' }, { name: 'D' }],
    chat: [{ mes: 'hello' }],
    extensionSettings: {},
    setExtensionPrompt: (...args) => calls.push(['prompt', ...args]),
    generate: async (...args) => {
      calls.push(['generate', ...args]);
      return 'reply';
    },
    saveSettingsDebounced: () => calls.push(['settings']),
    saveMetadata: async () => calls.push(['chat-state']),
    popup: {
      confirm: async (message) => {
        calls.push(['confirm', message]);
        return true;
      },
    },
    eventSource: {
      on: (...args) => calls.push(['on', ...args]),
      off: (...args) => calls.push(['off', ...args]),
    },
  };
  const adapter = createSillyTavernAdapter(() => context);

  assert.equal(adapter.getContext(), context);
  assert.equal(adapter.getCurrentChatKey(), 'chat-1');
  assert.deepEqual(adapter.getCharacterData(), { name: 'D' });
  assert.deepEqual(adapter.getMessages(), context.chat);
  adapter.injectPrompt('key', 'value', 1, 2);
  assert.equal(await adapter.generateReply('normal'), 'reply');
  adapter.saveSettings();
  await adapter.saveChatState();
  assert.equal(await adapter.showConfirm('sure?'), true);
  const unsubscribe = adapter.on('message', () => {});
  unsubscribe();

  assert.deepEqual(calls.map(([name]) => name), [
    'prompt',
    'generate',
    'settings',
    'chat-state',
    'confirm',
    'on',
    'off',
  ]);
});

test('adapter uses SillyTavern 1.18 raw generation, normal generation, and Popup APIs', async () => {
  const calls = [];
  const context = {
    generateRaw: async (options) => { calls.push(['raw', options]); return 'director'; },
    generate: async (...args) => calls.push(['normal', ...args]),
    Popup: { show: { confirm: async (message) => { calls.push(['confirm', message]); return true; } } },
  };
  const adapter = createSillyTavernAdapter(() => context);
  assert.equal(await adapter.generateDirector([{ role: 'system', content: 'plan' }]), 'director');
  await adapter.generateReply();
  assert.equal(await adapter.showConfirm('notice'), true);
  assert.deepEqual(calls, [
    ['raw', { prompt: '', systemPrompt: 'plan' }],
    ['normal', 'normal'],
    ['confirm', 'notice'],
  ]);
});

test('adapter uses the host module raw generator when getContext omits generateRaw', async () => {
  const calls = [];
  const adapter = createSillyTavernAdapter(() => ({
    Popup: { show: { confirm: async () => false } },
  }), {
    generateRaw: async (options) => {
      calls.push(options);
      return 'director';
    },
  });

  assert.equal(await adapter.generateDirector([
    { role: 'system', content: '完整的导演规则' },
    { role: 'user', content: '{"userText":"密封水箱"}' },
  ]), 'director');
  assert.deepEqual(calls, [{
    prompt: '{"userText":"密封水箱"}',
    systemPrompt: '完整的导演规则',
  }]);
});

test('adapter reports sanitized raw generation boundary diagnostics', async () => {
  const boundaries = [];
  const adapter = createSillyTavernAdapter(() => ({}), {
    generateRaw: async () => 'director response',
  });

  assert.equal(await adapter.generateDirector([
    { role: 'system', content: 'system secret text' },
    { role: 'user', content: 'prompt secret text' },
  ], { intentType: 'plan-event', onBoundary: (event) => boundaries.push(event) }), 'director response');

  assert.deepEqual(boundaries, [
    {
      event: 'raw-request',
      mode: 'main',
      intentType: 'plan-event',
      promptEmpty: false,
      promptLength: 18,
      systemPromptEmpty: false,
      systemPromptLength: 18,
      hostSource: 'host-module',
      enteredHost: true,
    },
    {
      event: 'raw-response',
      mode: 'main',
      intentType: 'plan-event',
      responseEmpty: false,
      responseLength: 17,
      responseType: 'string',
    },
  ]);
  assert.equal(JSON.stringify(boundaries).includes('secret text'), false);
});

test('adapter can asynchronously load selected external world-book entries', async () => {
  const adapter = createSillyTavernAdapter(() => ({
    selected_world_info: 'lore',
    world_names: ['lore'],
    loadWorldInfo: async () => ({ entries: [{ uid: 7, comment: '规则', content: '不可回头' }] }),
  }));
  assert.deepEqual(await adapter.getWorldInfoEntriesAsync(), [{ id: '7', name: '规则', content: '不可回头' }]);
});

test('adapter lists every installed world book and loads normalized entries by name', async () => {
  const loaded = [];
  const adapter = createSillyTavernAdapter(() => ({
    getWorldInfoNames: () => ['Global Lore', 'Other Story'],
    loadWorldInfo: async (name) => {
      loaded.push(name);
      return { entries: { 7: { uid: 7, comment: `${name} rule`, content: name } } };
    },
  }));

  assert.deepEqual(adapter.getWorldInfoNames(), ['Global Lore', 'Other Story']);
  assert.deepEqual(await adapter.loadWorldInfoBook('Global Lore'), {
    name: 'Global Lore',
    entries: [{ id: '7', name: 'Global Lore rule', content: 'Global Lore', bookName: 'Global Lore' }],
  });
  assert.deepEqual(loaded, ['Global Lore']);
});
