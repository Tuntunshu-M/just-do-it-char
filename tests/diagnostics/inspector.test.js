import assert from 'node:assert/strict';
import test from 'node:test';

import { runDiagnostics } from '../../src/diagnostics/inspector.js';

function check(result, id) {
  return result.checks.find((item) => item.id === id);
}

test('main connection inspection reports host readiness without generating content', async () => {
  let generated = 0;
  const adapter = {
    capabilities: { chat: true, promptInjection: true, rawGeneration: true, normalGeneration: true, settings: true, chatState: true },
    getCurrentChatKey: () => 'chat-a',
    generateDirector: async () => { generated += 1; },
    generateReply: async () => { generated += 1; },
    getWorldInfoNames: () => ['Global', 'Card'],
  };

  const result = await runDiagnostics({
    adapter,
    settings: { enabled: true, connection: { mode: 'main' }, context: { worldInfo: true, worldInfoBooks: { Global: { mode: 'all' } } } },
    state: { generation: { phase: 'idle' } },
    now: () => Date.parse('2026-08-13T12:00:00.000Z'),
  });

  assert.equal(generated, 0);
  assert.equal(result.checkedAt, '2026-08-13T12:00:00.000Z');
  assert.equal(result.summary.installedWorldBooks, 2);
  assert.equal(result.summary.selectedWorldBooks, 1);
  assert.equal(check(result, 'chat').status, 'pass');
  assert.equal(check(result, 'connection').status, 'pass');
  assert.equal(check(result, 'world-books').status, 'pass');
});

test('inspection distinguishes missing chat, disabled extension, and incomplete independent connection', async () => {
  const result = await runDiagnostics({
    adapter: {
      capabilities: { chat: false, promptInjection: false, rawGeneration: false, normalGeneration: false, settings: false, chatState: false },
      getCurrentChatKey: () => null,
      getWorldInfoNames: () => [],
    },
    settings: { enabled: false, connection: { mode: 'independent', endpoint: '', model: '' }, context: { worldInfo: false } },
    state: { generation: { phase: 'failed' } },
  });

  assert.equal(check(result, 'chat').status, 'fail');
  assert.equal(check(result, 'enabled').status, 'warning');
  assert.equal(check(result, 'connection').status, 'fail');
  assert.equal(check(result, 'host-generation').status, 'fail');
  assert.equal(check(result, 'storage').status, 'fail');
  assert.equal(check(result, 'world-books').status, 'warning');
});

test('world-book listing errors become failed checks instead of rejecting inspection', async () => {
  const result = await runDiagnostics({
    adapter: {
      capabilities: { chat: true, promptInjection: true, rawGeneration: true, normalGeneration: true, settings: true, chatState: true },
      getCurrentChatKey: () => 'chat-a',
      getWorldInfoNames: () => { throw new Error('world list unavailable'); },
    },
    settings: { enabled: true, connection: { mode: 'main' }, context: { worldInfo: true, worldInfoBooks: {} } },
    state: { generation: { phase: 'idle' } },
  });

  assert.equal(check(result, 'world-books').status, 'fail');
  assert.match(check(result, 'world-books').message, /world list unavailable/);
});
