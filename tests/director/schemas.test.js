import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDirectorResult, validateDirectorResult, validateReactionResult, validateStepResult, validateProfileResult } from '../../src/director/schemas.js';

const valid = {
  event: { title: 'Trip', category: 'daily', premise: 'Japan', steps: [{ id: 's1', goal: 'depart' }] },
  feedback: { classification: 'accept', confidence: 0.8 },
  actions: [{ characterId: 'a', action: 'buys tickets', evidence: ['card: decisive'] }],
  branches: [], risks: [], foreshadowing: [], ruleLedgerUpdate: {},
  injection: 'A has already bought tickets and now leads the departure.',
};

test('director schema accepts a complete structured result', () => {
  assert.deepEqual(validateDirectorResult(valid), valid);
});

test('director schema rejects unknown feedback and unsupported key actions', () => {
  assert.throws(() => validateDirectorResult({ ...valid, feedback: { classification: 'maybe' } }), /feedback/i);
  assert.throws(() => validateDirectorResult({ ...valid, actions: [{ characterId: 'a', action: 'go', evidence: [] }] }), /evidence/i);
});

test('lead changes require motivation, location, and knowledge state', () => {
  assert.throws(() => validateDirectorResult({ ...valid, leadChange: { nextLeadId: 'b', motivation: '接手' } }), /lead change/i);
  assert.doesNotThrow(() => validateDirectorResult({ ...valid, leadChange: { nextLeadId: 'b', motivation: '接手', location: '现场', knowledgeState: '知情' } }));
});

test('parser distinguishes an empty response from malformed JSON', () => {
  assert.throws(() => parseDirectorResult('  '), /empty content/i);
});

test('schema reports a missing event field explicitly', () => {
  const { event: _event, ...withoutEvent } = valid;
  assert.throws(() => validateDirectorResult(withoutEvent), /event field is required/i);
});

test('parser normalizes a provider action text field', () => {
  const providerResult = {
    ...valid,
    actions: [{ characterId: 'a', text: 'buys tickets', evidence: ['card: decisive'] }],
  };
  assert.deepEqual(parseDirectorResult(JSON.stringify(providerResult)), valid);
});

test('reaction, step, and profile contracts are independent from event planning', () => {
  assert.deepEqual(validateReactionResult({ decision: 'revise', reason: 'user declined', steps: [{ id: 's2', goal: 'Offer a nearby option' }] }).decision, 'revise');
  assert.equal(validateStepResult({ injection: 'Guide A to offer the nearby option.' }).injection.includes('Guide'), true);
  assert.deepEqual(validateProfileResult({ content: 'Calm and observant.', citations: [{ source: 'card:description', excerpt: 'calm' }] }).citations.length, 1);
  assert.throws(() => validateReactionResult({ decision: 'invalid' }), /decision/i);
});

test('multi profile requires independently identified members and relations', () => {
  const profile = { content: '群像', members: [{ id: 'a', name: 'A', personality: '冷静', background: '记者', relationship: '朋友', attitude: '信任', goal: '查明事实', speechStyle: '简短', activeApproach: '主动约谈', knowledgeBoundary: '只知道公开信息' }], relations: [], citations: [] };
  assert.doesNotThrow(() => validateProfileResult(profile, { castMode: 'multi' }));
  assert.throws(() => validateProfileResult({ content: '群像', citations: [] }, { castMode: 'multi' }), /members/);
});

function plannedResult({ steps = 5, clues = 3, category = 'daily' } = {}) {
  return {
    event: {
      title: 'Plan', category, premise: '完整开端', conflict: '主要矛盾', climax: '高潮事件', ending: '结局走向',
      steps: Array.from({ length: steps }, (_, index) => ({ id: `s${index + 1}`, title: `阶段 ${index + 1}`, goal: `goal ${index + 1}`, activity: '{{char}}主动推进当前目标', splitSteps: ['start', 'advance'] })),
    },
    feedback: { classification: 'neutral', confidence: 1, reason: 'ok' },
    actions: [], branches: [], risks: [],
    foreshadowing: Array.from({ length: clues }, (_, index) => ({
      id: `f${index + 1}`,
      conditionFactId: `fact-${index + 1}`,
      maturity: 0,
      threshold: 1,
      status: '未注入',
      connectedStepTitle: `阶段 ${(index % steps) + 1}`,
    })),
    ruleLedgerUpdate: {}, injection: 'Prepare the first stage.',
  };
}

test('planned scripts require outline conflict climax and ending', () => {
  for (const field of ['premise', 'conflict', 'climax', 'ending']) {
    const result = plannedResult(); delete result.event[field];
    assert.throws(() => validateDirectorResult(result, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), new RegExp(field));
  }
});

test('event schema enforces five to seven unique stages', () => {
  assert.throws(() => validateDirectorResult(plannedResult({ steps: 4 }), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /5 to 7/);
  assert.throws(() => validateDirectorResult(plannedResult({ steps: 8 }), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /5 to 7/);
  const duplicate = plannedResult(); duplicate.event.steps[1].id = duplicate.event.steps[0].id;
  assert.throws(() => validateDirectorResult(duplicate, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /unique/);
});

test('event schema enforces cast-specific foreshadowing counts and selected category', () => {
  assert.doesNotThrow(() => validateDirectorResult(plannedResult(), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }));
  assert.throws(() => validateDirectorResult(plannedResult({ clues: 2 }), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /3 to 5/);
  const multi = plannedResult({ clues: 3 });
  multi.event.steps = multi.event.steps.map((step) => ({ ...step, activeCharacterIds: ['a', 'b'], interaction: 'They cooperate.', userPlan: 'Invite user.', characterActions: [{ characterId: 'a', goal: 'A goal', action: 'A acts' }, { characterId: 'b', goal: 'B goal', action: 'B acts' }] }));
  assert.throws(() => validateDirectorResult(multi, { type: 'plan-event', castMode: 'multi', castCharacterIds: ['a', 'b'], mainCategory: 'daily' }), /4 to 6/);
  assert.throws(() => validateDirectorResult(plannedResult({ category: 'crisis' }), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /selected main category/);
});

test('multi-cast stages accept one or more known active characters without an upper bound', () => {
  const result = plannedResult({ clues: 4 });
  result.event.steps = result.event.steps.map((step, index) => ({
    ...step,
    activeCharacterIds: index === 0 ? ['a'] : ['a', 'b', 'c', 'd', 'e'],
    interaction: 'They cooperate and challenge each other.',
    userPlan: 'Invite user to participate.',
    characterActions: (index === 0 ? ['a'] : ['a', 'b', 'c', 'd', 'e']).map((characterId) => ({ characterId, goal: `${characterId} goal`, action: `${characterId} acts` })),
  }));
  const intent = { type: 'plan-event', castMode: 'multi', castCharacterIds: ['a', 'b', 'c', 'd', 'e'], mainCategory: 'daily' };
  assert.doesNotThrow(() => validateDirectorResult(result, intent));
  const nobodyActive = structuredClone(result);
  nobodyActive.event.steps[0].activeCharacterIds = [];
  nobodyActive.event.steps[0].characterActions = [];
  assert.throws(() => validateDirectorResult(nobodyActive, intent), /at least one/i);
  const missingInteraction = structuredClone(result);
  missingInteraction.event.steps[0].interaction = '';
  assert.throws(() => validateDirectorResult(missingInteraction, intent), /interaction/);
  const unknownCharacter = structuredClone(result);
  unknownCharacter.event.steps[0].activeCharacterIds = ['a', 'unknown'];
  assert.throws(() => validateDirectorResult(unknownCharacter, intent), /unknown/);
});

test('planned stages require a subtitle and concrete character behavior', () => {
  const result = plannedResult();
  assert.doesNotThrow(() => validateDirectorResult(result, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }));
  result.event.steps[0].title = '';
  assert.throws(() => validateDirectorResult(result, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /step title/i);
  result.event.steps[0].title = '保护 user';
  result.event.steps[0].activity = '';
  assert.throws(() => validateDirectorResult(result, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /character activity/i);
});

test('foreshadowing requires a lifecycle status and an existing connected stage title', () => {
  const intent = { type: 'plan-event', castMode: 'single', mainCategory: 'daily' };
  const result = plannedResult();
  for (const status of ['已回收', '未注入', '使用中', '待使用']) {
    result.foreshadowing[0].status = status;
    assert.doesNotThrow(() => validateDirectorResult(result, intent));
  }
  result.foreshadowing[0].status = '未知';
  assert.throws(() => validateDirectorResult(result, intent), /foreshadowing status/i);
  result.foreshadowing[0].status = '待使用';
  result.foreshadowing[0].connectedStepTitle = '不存在的阶段';
  assert.throws(() => validateDirectorResult(result, intent), /connected stage title/i);
});

test('planned stages require split actions and multi-character goals, actions, and user plans', () => {
  const single = plannedResult();
  single.event.steps = single.event.steps.map((step) => ({ ...step, splitSteps: ['主动发起', '推进结果'] }));
  assert.doesNotThrow(() => validateDirectorResult(single, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }));
  delete single.event.steps[0].splitSteps;
  assert.throws(() => validateDirectorResult(single, { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /split/i);

  const multi = plannedResult({ clues: 4 });
  multi.event.steps = multi.event.steps.map((step) => ({
    ...step,
    splitSteps: ['发起', '回应'], activeCharacterIds: ['a', 'b'], interaction: '两人交锋', userPlan: '邀请 user 到场',
    characterActions: [{ characterId: 'a', goal: '查明真相', action: '主动询问' }, { characterId: 'b', goal: '保护秘密', action: '安排会面' }],
  }));
  const intent = { type: 'plan-event', castMode: 'multi', castCharacterIds: ['a', 'b'], mainCategory: 'daily' };
  assert.doesNotThrow(() => validateDirectorResult(multi, intent));
  delete multi.event.steps[0].userPlan;
  assert.throws(() => validateDirectorResult(multi, intent), /user plan/i);
});

test('multi profile requires the complete editable member fields', () => {
  const complete = { content: '群像', citations: [], relations: [], members: [{
    id: 'a', name: 'A', personality: '冷静', background: '记者', relationship: '朋友', attitude: '信任', goal: '查明事实', speechStyle: '简短', activeApproach: '主动约谈', knowledgeBoundary: '只知道公开信息',
  }] };
  assert.doesNotThrow(() => validateProfileResult(complete, { castMode: 'multi' }));
  for (const field of ['personality', 'background', 'relationship', 'attitude', 'goal', 'speechStyle', 'activeApproach']) {
    const incomplete = structuredClone(complete); delete incomplete.members[0][field];
    assert.throws(() => validateProfileResult(incomplete, { castMode: 'multi' }), new RegExp(field, 'i'));
  }
});
