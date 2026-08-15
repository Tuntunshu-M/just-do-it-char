import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorPipeline } from '../../src/director/pipeline.js';

function harness({ state, response, settings = {}, requestUpdate } = {}) {
  const order = [];
  const current = state ?? { chatKey: 'c', characterFingerprint: 'f', status: 'idle', activeEvent: null, personalityProfile: { status: 'ready', content: 'profile' }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} };
  current.personalityProfile ??= { status: 'ready', content: 'profile' };
  const global = { enabled: true, connection: {}, defaults: { revisionRetention: 3 }, ...settings };
  const pipeline = createDirectorPipeline({
    adapter: {
      getCurrentChatKey: () => 'c',
      injectPrompt: async (_key, value, position, depth, scan, role) => order.push(value ? `inject:${value}:p${position}:d${depth}:s${scan}:r${role}` : `clear:p${position}:d${depth}:s${scan}:r${role}`),
      generateReply: async () => order.push('generate'),
    },
    store: { loadGlobal: () => global, loadChat: () => current, saveChat: async () => {} },
    client: { requestDirector: async (payload, _connection, onUpdate) => { order.push(payload.intent.type); requestUpdate?.(payload, onUpdate); return typeof response === 'function' ? response(payload.intent, payload.context) : response; } },
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
  assert.deepEqual(order, ['prepare-step', 'inject:Invite the user to travel.:p1:d0:sfalse:r0']);
  assert.equal(state.activeEvent.pendingTurn.messageId, 7);
  assert.equal(order.includes('generate'), false);
});

test('the next real user message evaluates the previous reaction before preparing the next step', async () => {
  const { pipeline, order } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [{ id: 's1', goal: 'invite', status: 'current' }], currentStepIndex: 0, pendingTurn: { messageId: 1 } }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} }, response: (intent) => intent.type === 'evaluate-reaction' ? { decision: 'advance', reason: 'accepted' } : { injection: 'Buy tickets.' } });
  await pipeline.handleUserMessage('我们走吧', 2);
  assert.deepEqual(order, ['evaluate-reaction', 'react', 'prepare-step', 'inject:Buy tickets.:p1:d0:sfalse:r0']);
});

test('reaction evaluation includes the current preference weights for revise decisions', async () => {
  let reactionContext = null;
  const { pipeline } = harness({
    state: {
      chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user',
      activeEvent: { steps: [{ id: 's1', goal: 'invite', status: 'current' }], currentStepIndex: 0, pendingTurn: { messageId: 1 } },
      preference: { userAgency: 90 }, sceneSafety: {}, counters: {}, cooldowns: {},
    },
    response: (intent, context) => {
      if (intent.type === 'evaluate-reaction') reactionContext = context;
      return intent.type === 'evaluate-reaction'
        ? { decision: 'revise', reason: 'changed mind', steps: [{ id: 's2', goal: 'Ask for another destination' }] }
        : { injection: 'Buy tickets.' };
    },
  });

  await pipeline.handleUserMessage('我不想去', 2);

  assert.equal(reactionContext?.preferences?.userAgency, 90);
  assert.deepEqual(reactionContext?.completedSteps, []);
});

test('reaction evaluation includes completed stages when revising after progress', async () => {
  let reactionContext = null;
  const { pipeline } = harness({
    state: {
      chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user',
      activeEvent: {
        steps: [
          { id: 's1', title: '邀请旅行', goal: 'invite', status: 'completed' },
          { id: 's2', title: '订机票', goal: 'book', status: 'current' },
        ],
        currentStepIndex: 1,
        pendingTurn: { messageId: 1 },
      },
      preference: {}, sceneSafety: {}, counters: {}, cooldowns: {},
    },
    response: (intent, context) => {
      if (intent.type === 'evaluate-reaction') reactionContext = context;
      return intent.type === 'evaluate-reaction'
        ? { decision: 'revise', reason: 'changed mind', steps: [{ id: 's3', goal: 'Ask for another destination' }] }
        : { injection: 'Buy tickets.' };
    },
  });

  await pipeline.handleUserMessage('还是算了', 2);

  assert.deepEqual(reactionContext?.completedSteps?.map((step) => step.id), ['s1']);
});

test('clearTurnInjection removes the temporary prompt while preserving the pending reaction', async () => {
  const { pipeline, order, state } = harness({ state: { chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user', activeEvent: { steps: [], currentStepIndex: 0, pendingTurn: { messageId: 1 } }, preference: {}, sceneSafety: {}, counters: {}, cooldowns: {} } });
  await pipeline.clearTurnInjection();
  assert.deepEqual(order, ['clear:p1:d0:sfalse:r0']);
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

test('a pending event injects stage one on the same message that matches its trigger', async () => {
  const { pipeline, order, state } = harness({
    state: {
      chatKey: 'c', characterFingerprint: 'f', status: 'awaiting-user',
      activeEvent: {
        trigger: { status: 'pending', condition: '用户明确进入旅行话题', keywords: ['旅行'] },
        steps: [{ id: 's1', goal: 'invite', status: 'current' }],
        currentStepIndex: 0, pendingTurn: null,
      },
      preference: {}, sceneSafety: {}, counters: {}, cooldowns: {},
    },
    response: { injection: 'Invite the user to travel.' },
  });

  const before = await pipeline.handleUserMessage('今天吃什么？', 1);
  assert.equal(before.status, 'waiting-trigger');
  assert.equal(state.activeEvent.trigger.status, 'pending');
  assert.deepEqual(order, []);

  const triggered = await pipeline.handleUserMessage('我们去旅行吧', 2);
  assert.equal(triggered.status, 'prepared');
  assert.equal(state.activeEvent.trigger.status, 'active');
  assert.equal(state.activeEvent.trigger.completed, true);
  assert.equal(state.activeEvent.pendingTurn.messageId, 2);
  assert.deepEqual(order, ['prepare-step', 'inject:Invite the user to travel.:p1:d0:sfalse:r0']);

  const prepared = await pipeline.handleUserMessage('好呀', 3);
  assert.equal(prepared.status, 'prepared');
  assert.equal(state.activeEvent.trigger.status, 'active');
  assert.deepEqual(order, ['prepare-step', 'inject:Invite the user to travel.']);
});

test('planning records sanitized raw generation boundary data for diagnostics', async () => {
  const { pipeline, state } = harness({
    response: { event: { title: 'Trip', category: 'daily', premise: 'Start', steps: [{ id: 's1', goal: 'invite' }] }, foreshadowing: [], facts: [], ruleLedgerUpdate: {} },
    requestUpdate: (_intent, onUpdate) => onUpdate?.({
      phase: 'boundary',
      event: 'raw-request',
      intentType: 'plan-event',
      promptLength: 42,
      promptEmpty: false,
      systemPromptLength: 24,
      systemPromptEmpty: false,
      enteredHost: true,
    }),
  });

  await pipeline.manualCreate('go to D city');

  assert.match(state.diagnostics.records.at(-1).message, /raw-request/);
  assert.match(state.diagnostics.records.at(-1).message, /promptLength=42/);
  assert.equal(state.diagnostics.records.at(-1).message.includes('go to D city'), false);
});
