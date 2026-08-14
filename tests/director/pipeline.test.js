import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorPipeline } from '../../src/director/pipeline.js';

function harness({ state, response, settings = {} } = {}) {
  const order = [];
  const current = state ?? { chatKey: 'c', characterFingerprint: 'f', status: 'idle', activeEvent: null, personalityProfile: { status: 'ready', content: 'profile' }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} };
  current.personalityProfile ??= { status: 'ready', content: 'profile' };
  const global = { enabled: true, connection: {}, defaults: { revisionRetention: 3 }, ...settings };
  const pipeline = createDirectorPipeline({
    adapter: {
      getCurrentChatKey: () => 'c',
      injectPrompt: async (_key, value) => order.push(value ? `inject:${value}` : 'clear'),
      generateReply: async () => order.push('generate'),
    },
    store: { loadGlobal: () => global, loadChat: () => current, saveChat: async () => {} },
    client: { requestDirector: async ({ intent }) => { order.push(intent.type); return typeof response === 'function' ? response(intent) : response; } },
    policy: { evaluatePolicy: () => ({ allowed: true }) },
    repository: {
      createDraft: async (_chat, _fingerprint, plan) => { const script = { ...plan, id: 'script-1', status: 'draft' }; current.scripts = [script]; current.selectedScriptId = script.id; order.push('draft'); return script; },
    },
    engine: {
      applyReaction: async () => order.push('react'),
    },
    collector: async () => ({ cast: {}, worldInfo: [] }),
    onNotice: (message) => order.push(`notice:${message}`),
    onScriptCreated: (id) => order.push(`open:${id}`),
  });
  return { pipeline, order, state: current };
}

test('planning stores a draft script without activating it and opens its detail', async () => {
  const { pipeline, order, state } = harness({ response: { event: { title: 'Trip', category: 'daily', premise: 'Start', conflict: 'Conflict', climax: 'Climax', ending: 'Ending', steps: [{ id: 's1', goal: 'invite' }] }, foreshadowing: [], facts: [], ruleLedgerUpdate: {} } });
  const result = await pipeline.manualCreate('');
  assert.equal(state.scripts[0].title, 'Trip');
  assert.equal(state.activeEvent, null);
  assert.equal(result.scriptId, 'script-1');
  assert.ok(order.includes('draft'));
  assert.ok(order.includes('open:script-1'));
  assert.ok(order.some((item) => item.startsWith('notice:')));
  assert.equal(order.includes('generate'), false);
  assert.equal(order.some((item) => item.startsWith('inject:')), false);
});

test('the first real user message prepares one step and never generates the reply', async () => {
  const { pipeline, order, state } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [{ id: 's1', goal: 'invite', status: 'current' }], currentStepIndex: 0, pendingTurn: null }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} }, response: { injection: 'Invite the user to travel.' } });
  await pipeline.handleUserMessage('好呀', 7);
  assert.deepEqual(order, ['prepare-step', 'inject:Invite the user to travel.']);
  assert.equal(state.activeEvent.pendingTurn.messageId, 7);
  assert.equal(order.includes('generate'), false);
});

test('the next real user message evaluates the previous reaction before preparing the next step', async () => {
  const { pipeline, order } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [{ id: 's1', goal: 'invite', status: 'current' }], currentStepIndex: 0, pendingTurn: { messageId: 1 } }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} }, response: (intent) => intent.type === 'evaluate-reaction' ? { decision: 'advance', reason: 'accepted' } : { injection: 'Buy tickets.' } });
  await pipeline.handleUserMessage('我们走吧', 2);
  assert.deepEqual(order, ['evaluate-reaction', 'react', 'prepare-step', 'inject:Buy tickets.']);
});

test('clearTurnInjection removes the temporary prompt while preserving the pending reaction', async () => {
  const { pipeline, order, state } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [], currentStepIndex: 0, pendingTurn: { messageId: 1 } }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} } });
  await pipeline.clearTurnInjection();
  assert.deepEqual(order, ['clear']);
  assert.equal(state.activeEvent.pendingTurn.messageId, 1);
  await pipeline.clearTurnInjection({ resetTurn: true });
  assert.equal(state.activeEvent.pendingTurn, null);
});

test('duplicate host event for the same message is coalesced', async () => {
  const { pipeline, order } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [{ id: 's1', goal: 'invite', status: 'current' }], currentStepIndex: 0, pendingTurn: null }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} }, response: { injection: 'Invite.' } });
  await Promise.all([pipeline.handleUserMessage('x', 1), pipeline.handleUserMessage('x', 1)]);
  assert.equal(order.filter((item) => item === 'prepare-step').length, 1);
});

test('a missing event does not inject anything', async () => {
  const { pipeline, order } = harness();
  const result = await pipeline.handleUserMessage('x', 1);
  assert.equal(result.skipped, true);
  assert.deepEqual(order, []);
});

test('event planning waits for the profile and exposes progress', async () => {
  const { pipeline, order, state } = harness({ state: { chatKey: 'c', status: 'idle', personalityProfile: { status: 'generating' } } });
  const result = await pipeline.manualCreate('x');
  assert.equal(result.reason, '导演还在看人设');
  assert.deepEqual(order, ['notice:导演还在看人设']);
  assert.equal(state.generation.phase, 'idle');
  assert.equal(state.generation.error, '导演还在看人设');
});
