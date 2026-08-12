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
    generation: false,
    settings: false,
    chatState: false,
    confirmation: false,
    events: false,
  });
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
