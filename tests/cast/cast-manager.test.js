import assert from 'node:assert/strict';
import test from 'node:test';
import { mapImportedCast, mergeDetectedCast } from '../../src/cast/cast-manager.js';

test('low confidence detection falls back to single card role', () => {
  const result = mergeDetectedCast({ mode: 'single', locked: false, members: [] }, { confidence: 0.4, members: [{ id: 'a' }] });
  assert.equal(result.mode, 'single');
});

test('locked cast is not overwritten and aliases support import mapping', () => {
  const current = { mode: 'multi', locked: true, members: [{ id: 'a', name: 'Alice', aliases: ['A'] }] };
  assert.deepEqual(mergeDetectedCast(current, { confidence: 1, members: [{ id: 'b' }] }), current);
  assert.deepEqual(mapImportedCast([{ id: 'old', name: 'A' }], current.members), { old: 'a' });
});
