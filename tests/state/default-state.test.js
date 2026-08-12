import assert from 'node:assert/strict';
import test from 'node:test';

import { SCHEMA_VERSION } from '../../src/constants.js';
import {
  createDirectorState,
  createGlobalSettings,
} from '../../src/state/default-state.js';

test('global settings keep connection secrets outside chat state', () => {
  const settings = createGlobalSettings();
  const state = createDirectorState('chat-a', 'card-a');

  assert.equal(settings.schemaVersion, SCHEMA_VERSION);
  assert.equal(settings.connection.mode, 'main');
  assert.equal(settings.connection.apiKey, '');
  assert.equal(settings.connection.temperature, 0.7);
  assert.equal(settings.connection.maxTokens, 2000);
  assert.equal(settings.connection.stream, false);
  assert.equal(settings.context.worldInfoMode, 'all');
  assert.equal(settings.theme.mode, 'night');
  assert.deepEqual(settings.context.worldInfoBooks, {});
  assert.deepEqual(settings.categories, {
    daily: { enabled: true, weight: 40 },
    crisis: { enabled: true, weight: 35 },
    erotic: { enabled: false, weight: 25 },
  });
  assert.equal('apiKey' in state, false);
  assert.equal(JSON.stringify(state).includes('apiKey'), false);
  assert.deepEqual(state.diagnostics, { records: [], lastCheck: null });
});

test('director state has isolated serializable event data', () => {
  const first = createDirectorState('chat-a', 'card-a');
  const second = createDirectorState('chat-b', 'card-b');

  first.foreshadowing.push({ id: 'thread-a' });
  assert.equal(second.foreshadowing.length, 0);
  assert.equal(first.chatKey, 'chat-a');
  assert.equal(first.characterFingerprint, 'card-a');
  assert.doesNotThrow(() => JSON.stringify(first));
  assert.deepEqual(Object.keys(first).sort(), [
    'activeEvent', 'cast', 'characterFingerprint', 'chatKey', 'cooldowns',
    'counters', 'foreshadowing', 'historySummary', 'pendingTransaction',
    'preference', 'ruleLedger', 'sceneSafety', 'schemaVersion', 'status', 'directorNotes', 'generation',
    'updatedAt', 'diagnostics',
  ].sort());
});
