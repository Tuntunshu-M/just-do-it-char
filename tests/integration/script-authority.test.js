import assert from 'node:assert/strict';
import test from 'node:test';

import { createEventEngine } from '../../src/director/event-engine.js';
import { createScriptRepository } from '../../src/scripts/script-repository.js';
import { createScriptRuntime } from '../../src/scripts/script-runtime.js';
import { createStore } from '../../src/state/store.js';

function fixture() {
  const host = { extensionSettings: {}, chatMetadata: {} };
  const store = createStore({ getContext: () => host, saveChatState: async () => {} });
  return { store, repository: createScriptRepository(store), runtime: createScriptRuntime({ store }), engine: createEventEngine(store) };
}

test('the active script record remains authoritative through progress and completion', async () => {
  const { store, repository, runtime, engine } = fixture();
  const script = await repository.createDraft('chat', 'card', { title: 'Plan', steps: [{ id: 'one' }, { id: 'two' }] });
  await runtime.perform('chat', 'card', script.id);

  await engine.applyReaction('chat', 'card', { decision: 'advance' });
  let state = store.loadChat('chat', 'card');
  assert.strictEqual(state.activeEvent, state.scripts[0]);
  assert.equal(state.scripts[0].status, 'running');
  assert.equal(state.scripts[0].currentStepIndex, 1);
  assert.equal(state.scripts[0].steps[0].status, 'completed');

  await engine.applyReaction('chat', 'card', { decision: 'advance' });
  state = store.loadChat('chat', 'card');
  assert.equal(state.scripts[0].status, 'completed');
  assert.equal(state.activeScriptId, null);
  assert.equal(state.activeEvent, null);
});
