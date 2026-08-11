import assert from 'node:assert/strict';
import test from 'node:test';
import { createRuleLedger } from '../../src/state/default-state.js';
import { mergeRuleLedger } from '../../src/director/rule-ledger.js';

test('rule ledger merges every supernatural tracking dimension', () => {
  const next = mergeRuleLedger(createRuleLedger(), {
    publishedRules: [{ id: 'r1', text: 'Do not look back' }],
    hypotheses: [{ id: 'h1', text: 'Mirrors lie' }],
    triggeredTaboos: ['whistling'], objectives: ['leave'], deadline: 'midnight',
    items: ['red key'], knowledgeByCharacter: { A: ['r1'] }, anomalies: ['cold spot'],
    hiddenTruths: ['the host is dead'], falseRules: ['always run'],
  });
  assert.equal(next.publishedRules.length, 1);
  assert.equal(next.deadline, 'midnight');
  assert.deepEqual(next.knowledgeByCharacter.A, ['r1']);
  assert.equal(next.falseRules[0], 'always run');
});

test('published rules cannot be silently rewritten', () => {
  const current = createRuleLedger();
  current.publishedRules = [{ id: 'r1', text: 'Do not look back' }];
  assert.throws(() => mergeRuleLedger(current, {
    publishedRules: [{ id: 'r1', text: 'Look back' }],
  }), /published rule/i);
});
