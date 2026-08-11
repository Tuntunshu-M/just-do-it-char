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
