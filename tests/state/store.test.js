import assert from 'node:assert/strict';
import test from 'node:test';

import { createStore } from '../../src/state/store.js';

function createAdapterFixture() {
  const host = {
    extensionSettings: {},
    chatMetadata: {},
    settingsSaves: 0,
    chatSaves: 0,
  };
  return {
    host,
    adapter: {
      getContext: () => host,
      saveSettings: () => { host.settingsSaves += 1; },
      saveChatState: () => { host.chatSaves += 1; },
    },
  };
}

test('store persists global and chat state in separate host containers', async () => {
  const { adapter, host } = createAdapterFixture();
  const store = createStore(adapter);
  const global = store.loadGlobal();
  global.connection.apiKey = 'secret';
  await store.saveGlobal(global);

  const chatA = store.loadChat('chat-a', 'card-a');
  chatA.historySummary = 'A only';
  await store.saveChat(chatA);
  const chatB = store.loadChat('chat-b', 'card-b');

  assert.equal(host.extensionSettings.proactive_director.connection.apiKey, 'secret');
  assert.equal(JSON.stringify(host.chatMetadata).includes('secret'), false);
  assert.equal(chatB.historySummary, '');
  assert.equal(host.settingsSaves, 1);
  assert.equal(host.chatSaves, 1);
});

test('transaction commits only after successful work', async () => {
  const { adapter, host } = createAdapterFixture();
  const store = createStore(adapter);
  await assert.rejects(
    store.transaction('chat-a', 'card-a', async (draft) => {
      draft.historySummary = 'must roll back';
      throw new Error('generation failed');
    }),
    /generation failed/,
  );
  assert.equal(store.loadChat('chat-a', 'card-a').historySummary, '');
  assert.equal(host.chatSaves, 0);

  await store.transaction('chat-a', 'card-a', async (draft) => {
    draft.historySummary = 'committed';
  });
  assert.equal(store.loadChat('chat-a', 'card-a').historySummary, 'committed');
  assert.equal(host.chatSaves, 1);
});

test('transactions for one chat are serialized', async () => {
  const { adapter } = createAdapterFixture();
  const store = createStore(adapter);
  let releaseFirst;
  const firstGate = new Promise((resolve) => { releaseFirst = resolve; });
  const order = [];

  const first = store.transaction('chat-a', 'card-a', async (draft) => {
    order.push('first-start');
    await firstGate;
    draft.counters.turns += 1;
    order.push('first-end');
  });
  const second = store.transaction('chat-a', 'card-a', async (draft) => {
    order.push('second-start');
    draft.counters.turns += 1;
  });

  await Promise.resolve();
  assert.deepEqual(order, ['first-start']);
  releaseFirst();
  await Promise.all([first, second]);
  assert.deepEqual(order, ['first-start', 'first-end', 'second-start']);
  assert.equal(store.loadChat('chat-a', 'card-a').counters.turns, 2);
});

test('failed host saves roll back chat containers and the caller state', async () => {
  const { adapter, host } = createAdapterFixture();
  const store = createStore(adapter);
  const initial = store.loadChat('chat-a', 'card-a');
  initial.historySummary = 'saved value';
  await store.saveChat(initial);

  adapter.saveChatState = async () => { throw new Error('disk unavailable'); };
  initial.historySummary = 'half committed value';

  await assert.rejects(store.saveChat(initial), /disk unavailable/);
  assert.equal(initial.historySummary, 'saved value');
  assert.equal(store.loadChat('chat-a', 'card-a').historySummary, 'saved value');
});

test('failed host saves roll back global containers and the caller settings', async () => {
  const { adapter } = createAdapterFixture();
  const store = createStore(adapter);
  const settings = store.loadGlobal();
  settings.genre.mode = 'fantasy';
  await store.saveGlobal(settings);

  adapter.saveSettings = async () => { throw new Error('settings unavailable'); };
  settings.genre.mode = 'reality';

  await assert.rejects(store.saveGlobal(settings), /settings unavailable/);
  assert.equal(settings.genre.mode, 'fantasy');
  assert.equal(store.loadGlobal().genre.mode, 'fantasy');
});
