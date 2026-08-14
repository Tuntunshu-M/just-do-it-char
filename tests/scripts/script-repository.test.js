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

test('repository removes selected inactive scripts but preserves running and paused scripts', async () => {
  const { states, repository } = fixture();
  const draft = await repository.createDraft('a', 'f', { id: 'draft', title: '草稿' });
  const running = await repository.createDraft('a', 'f', { id: 'running', title: '运行中', status: 'running' });
  const paused = await repository.createDraft('a', 'f', { id: 'paused', title: '已暂停', status: 'paused' });
  states.get('a').selectedScriptId = draft.id;
  states.get('a').activeScriptId = running.id;
  states.get('a').activeEvent = states.get('a').scripts.find((script) => script.id === running.id);

  const result = await repository.remove('a', 'f', [draft.id, running.id, paused.id]);

  assert.deepEqual(result.removedIds, [draft.id]);
  assert.deepEqual(result.protectedIds, [running.id, paused.id]);
  assert.deepEqual(states.get('a').scripts.map((script) => script.id), [running.id, paused.id]);
  assert.equal(states.get('a').selectedScriptId, running.id);
  assert.equal(states.get('a').activeScriptId, running.id);
  assert.equal(states.get('a').activeEvent.id, running.id);
});

test('repository clears all inactive scripts only in the requested chat', async () => {
  const { states, repository } = fixture();
  await repository.createDraft('a', 'f', { id: 'a-draft', title: '本聊天草稿' });
  await repository.createDraft('a', 'f', { id: 'a-running', title: '本聊天运行中', status: 'running' });
  await repository.createDraft('b', 'f', { id: 'b-draft', title: '另一个聊天草稿' });
  states.get('a').activeScriptId = 'a-running';
  states.get('a').activeEvent = states.get('a').scripts.find((script) => script.id === 'a-running');

  const result = await repository.clear('a', 'f');

  assert.deepEqual(result.removedIds, ['a-draft']);
  assert.deepEqual(result.protectedIds, ['a-running']);
  assert.deepEqual(states.get('a').scripts.map((script) => script.id), ['a-running']);
  assert.deepEqual(states.get('b').scripts.map((script) => script.id), ['b-draft']);
  assert.equal(states.get('a').selectedScriptId, 'a-running');
  assert.equal(states.get('a').activeScriptId, 'a-running');
});

test('repository updates editable content without allowing runtime identity changes', async () => {
  const { states, repository } = fixture();
  const script = await repository.createDraft('a', 'f', { id: 'script', title: '旧标题' });
  const updated = await repository.update('a', 'f', script.id, { title: '新标题', premise: '新大纲', id: 'changed', status: 'running', currentStepIndex: 9, pendingTurn: { id: 'turn' }, createdAt: 'changed' });
  assert.equal(updated.title, '新标题');
  assert.equal(updated.premise, '新大纲');
  assert.equal(updated.id, script.id);
  assert.equal(updated.status, 'draft');
  assert.equal(updated.currentStepIndex, 0);
  assert.equal(updated.pendingTurn, null);
  assert.equal(updated.createdAt, script.createdAt);
});
