import assert from 'node:assert/strict';
import test from 'node:test';
import { createEventEngine } from '../../src/director/event-engine.js';

function fixture() {
  const state = { activeEvent: null, foreshadowing: [], pendingTransaction: null, status: 'idle', historySummary: '' };
  const store = { transaction: async (_key, _fp, work) => work(state) };
  return { state, engine: createEventEngine(store) };
}

test('only one active event exists and staged facts commit transactionally', async () => {
  const { state, engine } = fixture();
  await engine.start('c', 'f', { id: 'e1', title: 'Trip', facts: [] });
  await assert.rejects(engine.start('c', 'f', { id: 'e2' }), /active event/i);
  await engine.stage('c', 'f', { eventPatch: { stepIndex: 1 }, facts: ['tickets bought'] });
  assert.equal(state.activeEvent.stepIndex, undefined);
  await engine.commit('c', 'f');
  assert.equal(state.activeEvent.stepIndex, 1);
  assert.deepEqual(state.activeEvent.facts, ['tickets bought']);
});

test('rollback discards staged generation and stop cannot idle-resume', async () => {
  const { state, engine } = fixture();
  await engine.start('c', 'f', { id: 'e1' });
  await engine.stage('c', 'f', { eventPatch: { stepIndex: 2 } });
  await engine.rollback('c', 'f');
  assert.equal(state.pendingTransaction, null);
  await engine.stop('c', 'f');
  await assert.rejects(engine.resume('c', 'f', { source: 'idle' }), /stopped/i);
});

test('occurred facts remain immutable and edited messages reconcile without rewriting them', async () => {
  const { state, engine } = fixture();
  await engine.start('c', 'f', { id: 'e1', facts: [{ id: 'fact-1', text: '已买票', occurred: true }] });
  await assert.rejects(engine.stage('c', 'f', { facts: [{ id: 'fact-1', text: '其实没买票', occurred: true }] }), /immutable/i);
  const result = await engine.reconcileEditedMessage('c', 'f', { messageId: 'm1', text: '用户改写了后续对白' });
  assert.equal(result.historySummary, '用户改写了后续对白');
  assert.equal(state.activeEvent.facts[0].text, '已买票');
});

test('foreshadowing promotes only when mature', async () => {
  const { state, engine } = fixture();
  state.foreshadowing = [{ id: 'f1', maturity: 2, threshold: 2, title: '线索' }];
  await engine.promoteForeshadowing('c', 'f', 'f1');
  assert.equal(state.activeEvent.title, '线索');
});

test('activating a plan waits for a real user turn', async () => {
  const { state, engine } = fixture();
  await engine.activatePlan('c', 'f', { id: 'trip', title: 'Trip', steps: [{ id: 's1', goal: 'Invite' }] });
  assert.equal(state.status, 'awaiting-user');
  assert.equal(state.activeEvent.status, 'awaiting-user');
  assert.equal(state.activeEvent.currentStepIndex, 0);
  assert.equal(state.activeEvent.steps[0].status, 'current');
});

test('reaction revisions retain bounded history and preserve occurred facts', async () => {
  const { state, engine } = fixture();
  await engine.activatePlan('c', 'f', {
    id: 'trip', title: 'Trip', facts: [{ id: 'met', text: 'Met at home', occurred: true }],
    steps: [{ id: 's1', goal: 'Invite' }, { id: 's2', goal: 'Buy tickets' }],
  });
  await engine.applyReaction('c', 'f', { decision: 'advance', reason: 'accepted' }, 2);
  assert.equal(state.activeEvent.currentStepIndex, 1);
  assert.equal(state.activeEvent.steps[0].status, 'completed');
  await engine.applyReaction('c', 'f', { decision: 'revise', reason: 'changed mind', steps: [{ id: 's3', goal: 'Stay nearby' }] }, 2);
  await engine.applyReaction('c', 'f', { decision: 'revise', reason: 'rain', steps: [{ id: 's4', goal: 'Stay home' }] }, 2);
  await engine.applyReaction('c', 'f', { decision: 'revise', reason: 'sun', steps: [{ id: 's5', goal: 'Walk' }] }, 2);
  assert.equal(state.activeEvent.revisions.length, 2);
  assert.deepEqual(state.activeEvent.facts, [{ id: 'met', text: 'Met at home', occurred: true }]);
  assert.equal(state.activeEvent.steps.at(-1).id, 's5');
});

test('restoring a revision only restores unfinished planning', async () => {
  const { state, engine } = fixture();
  await engine.activatePlan('c', 'f', { id: 'e', title: 'Plan', steps: [{ id: 'done', goal: 'Done' }, { id: 'old', goal: 'Old' }] });
  await engine.applyReaction('c', 'f', { decision: 'advance' }, 3);
  await engine.applyReaction('c', 'f', { decision: 'revise', reason: 'change', steps: [{ id: 'new', goal: 'New' }] }, 3);
  const revisionId = state.activeEvent.revisions[0].id;
  await engine.restoreRevision('c', 'f', revisionId);
  assert.equal(state.activeEvent.steps[0].id, 'done');
  assert.equal(state.activeEvent.steps[0].status, 'completed');
  assert.equal(state.activeEvent.steps[1].id, 'old');
});
