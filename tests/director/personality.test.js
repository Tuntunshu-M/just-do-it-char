import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePersonalityConsistency } from '../../src/director/personality.js';

test('actions require evidence owned by the acting character', () => {
  const cast = { members: [{ id: 'a', evidence: [{ id: 'a1', priority: 2 }] }, { id: 'b', evidence: [{ id: 'b1', priority: 1 }] }] };
  assert.equal(evaluatePersonalityConsistency({ characterId: 'a', evidenceIds: ['a1'] }, cast).allowed, true);
  assert.equal(evaluatePersonalityConsistency({ characterId: 'a', evidenceIds: ['b1'] }, cast).allowed, false);
});

test('explicit evidence outranks conflicting weak inference', () => {
  const cast = { members: [{ id: 'a', evidence: [{ id: 'strong', priority: 2, stance: 'gentle' }, { id: 'weak', priority: 5, stance: 'forceful' }] }] };
  const result = evaluatePersonalityConsistency({ characterId: 'a', evidenceIds: ['weak'], stance: 'forceful' }, cast);
  assert.equal(result.allowed, false);
  assert.match(result.reasons.join(' '), /higher-priority/i);
});
