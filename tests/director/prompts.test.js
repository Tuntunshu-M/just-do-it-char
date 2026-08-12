import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectorMessages } from '../../src/director/prompts.js';

test('prompt preserves character authority and requests compact JSON only', () => {
  const messages = buildDirectorMessages({ personalityEvidence: [{ source: 'card', value: 'calm' }] }, { type: 'advance' });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /不得修改.*人格/);
  assert.match(messages[0].content, /JSON/);
  assert.match(messages[1].content, /personalityEvidence/);
});

test('prompt includes a complete required JSON contract and null-event fallback', () => {
  const [system] = buildDirectorMessages({}, { type: 'advance' });
  for (const field of ['event', 'feedback', 'actions', 'branches', 'risks', 'foreshadowing', 'ruleLedgerUpdate', 'injection']) {
    assert.match(system.content, new RegExp(`"${field}"`));
  }
  assert.match(system.content, /"event"\s*:\s*null/);
  assert.match(system.content, /exactly one JSON object/i);
  assert.match(system.content, /never omit required fields/i);
});

test('prompt defines every required action field', () => {
  const [system] = buildDirectorMessages({}, { type: 'advance' });
  assert.match(system.content, /"characterId"\s*:/);
  assert.match(system.content, /"action"\s*:/);
  assert.match(system.content, /"evidence"\s*:/);
});
