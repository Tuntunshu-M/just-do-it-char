import assert from 'node:assert/strict';
import test from 'node:test';

import { createScriptRepository, normalizeScript } from '../../src/scripts/script-repository.js';

function fixture() {
  const states = new Map();
  const store = {
    loadChat(chatKey) { return states.get(chatKey); },
    async transaction(chatKey, _fingerprint, work) {
      const state = states.get(chatKey);
      const result = await work(state);
      return result === undefined ? state : result;
    },
  };
  states.set('a', { chatKey: 'a', scripts: [], selectedScriptId: null, activeScriptId: null, activeEvent: null });
  states.set('b', { chatKey: 'b', scripts: [], selectedScriptId: null, activeScriptId: null, activeEvent: null });
  return { states, repository: createScriptRepository(store) };
}

test('normalizes a plan into a complete draft script', () => {
  const script = normalizeScript({ title: '雨夜', steps: [{ id: 's1', status: 'current' }, { id: 's2' }] }, { now: '2026-08-13T00:00:00.000Z', id: 'script-1', status: 'draft' });
  assert.equal(script.id, 'script-1');
  assert.equal(script.status, 'draft');
  assert.equal(script.currentStepIndex, 0);
  assert.deepEqual(script.steps.map((step) => step.status), ['pending', 'pending']);
  assert.deepEqual(script.foreshadowing, []);
  assert.equal(script.createdAt, script.updatedAt);
});

test('retains multiple drafts and keeps selection separate from activation per chat', async () => {
  const { states, repository } = fixture();
  const first = await repository.createDraft('a', 'f', { title: '一' });
  const second = await repository.createDraft('a', 'f', { title: '二' });
  await repository.createDraft('b', 'f', { title: '另一个聊天' });
  await repository.select('a', 'f', first.id);

  assert.equal(states.get('a').scripts.length, 2);
  assert.equal(states.get('b').scripts.length, 1);
  assert.equal(repository.getSelected('a').id, first.id);
  assert.equal(states.get('a').activeScriptId, null);
  assert.notEqual(first.id, second.id);
});

test('migrates a legacy active event exactly once without dropping planning data', async () => {
  const { states, repository } = fixture();
  const state = states.get('a');
  state.activeEvent = {
    id: 'legacy', title: '旧事件', premise: '开端', steps: [{ id: 's1' }],
    foreshadowing: [{ id: 'f1' }], facts: [{ id: 'fact' }], revisions: [{ id: 'r1' }], status: 'awaiting-user',
  };
  await repository.migrateLegacyEvent('a', 'f');
  await repository.migrateLegacyEvent('a', 'f');

  assert.equal(state.scripts.length, 1);
  assert.equal(state.scripts[0].premise, '开端');
  assert.deepEqual(state.scripts[0].foreshadowing, [{ id: 'f1' }]);
  assert.deepEqual(state.scripts[0].facts, [{ id: 'fact' }]);
  assert.deepEqual(state.scripts[0].revisions, [{ id: 'r1' }]);
  assert.equal(state.activeScriptId, 'legacy');
});

test('repository migration does not activate a legacy event without running status', async () => {
  const { states, repository } = fixture();
  const state = states.get('a');
  state.activeEvent = { id: 'legacy-idle', title: '旧策划', premise: '开端', steps: [{ id: 's1' }] };

  await repository.migrateLegacyEvent('a', 'f');

  assert.equal(state.scripts[0].status, 'stopped');
  assert.equal(state.selectedScriptId, 'legacy-idle');
  assert.equal(state.activeScriptId, null);
  assert.equal(state.activeEvent, null);
});
