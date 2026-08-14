import assert from 'node:assert/strict';
import test from 'node:test';
import { createScriptRepository } from '../../src/scripts/script-repository.js';
import { createScriptRuntime } from '../../src/scripts/script-runtime.js';

function fixture() {
  const state = { chatKey: 'c', scripts: [], selectedScriptId: null, activeScriptId: null, activeEvent: null, status: 'idle', pendingTransaction: null };
  const store = { loadChat: () => state, async transaction(_c, _f, work) { const result = await work(state); return result ?? state; } };
  const repository = createScriptRepository(store);
  return { state, repository, runtime: createScriptRuntime({ store, repository }) };
}

test('performs the selected draft from stage one', async () => {
  const { state, repository, runtime } = fixture();
  const script = await repository.createDraft('c', 'f', { title: 'A', steps: [{ id: 's1' }, { id: 's2' }] });
  await runtime.perform('c', 'f', script.id);
  assert.equal(state.activeScriptId, script.id);
  assert.equal(state.scripts[0].status, 'running');
  assert.equal(state.scripts[0].steps[0].status, 'current');
  assert.equal(state.activeEvent.id, script.id);
});

test('requires confirmation before replacing a running script and preserves old progress', async () => {
  const { state, repository, runtime } = fixture();
  const first = await repository.createDraft('c', 'f', { title: 'A', steps: [{ id: 'a' }] });
  await runtime.perform('c', 'f', first.id);
  state.scripts[0].currentStepIndex = 1;
  const second = await repository.createDraft('c', 'f', { title: 'B', steps: [{ id: 'b' }] });
  await assert.rejects(runtime.perform('c', 'f', second.id, { confirmConflict: async () => false }), /cancelled/i);
  await runtime.perform('c', 'f', second.id, { confirmConflict: async () => true });
  assert.equal(state.scripts[0].status, 'stopped');
  assert.equal(state.scripts[0].currentStepIndex, 1);
  assert.equal(state.activeScriptId, second.id);
});

test('pause resume redirect and stop preserve the script record', async () => {
  const { state, repository, runtime } = fixture();
  const script = await repository.createDraft('c', 'f', { title: 'A', steps: [{ id: 'a' }] });
  await runtime.perform('c', 'f', script.id);
  await runtime.pause('c', 'f', script.id);
  await runtime.resume('c', 'f', script.id);
  await runtime.changeDirection('c', 'f', script.id, '改去海边');
  await runtime.stop('c', 'f', script.id);
  assert.equal(state.scripts.length, 1);
  assert.equal(state.scripts[0].status, 'stopped');
  assert.equal(state.scripts[0].revisions.at(-1).reason, '改去海边');
  assert.equal(state.activeScriptId, null);
  assert.equal(state.activeEvent, null);
});

test('runtime controls reject a non-active script without changing either script', async () => {
  const { state, repository, runtime } = fixture();
  const active = await repository.createDraft('c', 'f', { title: 'Active', steps: [{ id: 'a' }] });
  await runtime.perform('c', 'f', active.id);
  const inactive = await repository.createDraft('c', 'f', { title: 'Inactive', steps: [{ id: 'b' }] });
  const before = structuredClone(state);

  for (const operation of [
    () => runtime.pause('c', 'f', inactive.id),
    () => runtime.resume('c', 'f', inactive.id),
    () => runtime.changeDirection('c', 'f', inactive.id, 'wrong target'),
    () => runtime.stop('c', 'f', inactive.id),
  ]) {
    await assert.rejects(operation(), /not active/i);
    assert.deepEqual(state, before);
  }
});

test('perform rejects scripts that are already running paused or completed', async () => {
  for (const status of ['running', 'paused', 'completed']) {
    const { state, repository, runtime } = fixture();
    const script = await repository.createDraft('c', 'f', { title: status, steps: [{ id: 'a' }] });
    state.scripts[0].status = status;
    if (status !== 'completed') state.activeScriptId = script.id;
    await assert.rejects(runtime.perform('c', 'f', script.id), /cannot be performed/i, status);
  }
});
