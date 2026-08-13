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

function plannedResult({ steps = 5, clues = 3, category = 'daily' } = {}) {
  return {
    event: {
      title: 'Plan', category, premise: '完整开端', conflict: '主要矛盾', climax: '高潮事件', ending: '结局走向',
      steps: Array.from({ length: steps }, (_, index) => ({ id: `s${index + 1}`, goal: `goal ${index + 1}` })),
    },
    feedback: { classification: 'neutral', confidence: 1, reason: 'ok' },
    actions: [], branches: [], risks: [],
    foreshadowing: Array.from({ length: clues }, (_, index) => ({
      id: `f${index + 1}`,
      conditionFactId: `fact-${index + 1}`,
      maturity: 0,
      threshold: 1,
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
  multi.event.steps = multi.event.steps.map((step) => ({ ...step, activeCharacterIds: ['a', 'b'], interaction: 'They cooperate.' }));
  assert.throws(() => validateDirectorResult(multi, { type: 'plan-event', castMode: 'multi', castCharacterIds: ['a', 'b'], mainCategory: 'daily' }), /4 to 6/);
  assert.throws(() => validateDirectorResult(plannedResult({ category: 'crisis' }), { type: 'plan-event', castMode: 'single', mainCategory: 'daily' }), /selected main category/);
});

test('multi-cast stages require two to four known active characters and interaction', () => {
  const result = plannedResult({ clues: 4 });
  result.event.steps = result.event.steps.map((step, index) => ({
    ...step,
    activeCharacterIds: index % 2 ? ['b', 'c'] : ['a', 'b'],
    interaction: 'They cooperate and challenge each other.',
  }));
  const intent = { type: 'plan-event', castMode: 'multi', castCharacterIds: ['a', 'b', 'c'], mainCategory: 'daily' };
  assert.doesNotThrow(() => validateDirectorResult(result, intent));
  const missingInteraction = structuredClone(result);
  missingInteraction.event.steps[0].interaction = '';
  assert.throws(() => validateDirectorResult(missingInteraction, intent), /interaction/);
  const unknownCharacter = structuredClone(result);
  unknownCharacter.event.steps[0].activeCharacterIds = ['a', 'unknown'];
  assert.throws(() => validateDirectorResult(unknownCharacter, intent), /unknown/);
});
