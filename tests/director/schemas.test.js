import assert from 'node:assert/strict';
import test from 'node:test';
import { parseDirectorResult, validateDirectorResult } from '../../src/director/schemas.js';

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
