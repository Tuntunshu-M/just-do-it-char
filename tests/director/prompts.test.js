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
  assert.match(system.content, /只输出一个 JSON 对象/);
  assert.match(system.content, /所有字段都必须保留/);
});

test('prompt defines every required action field', () => {
  const [system] = buildDirectorMessages({}, { type: 'advance' });
  assert.match(system.content, /"characterId"\s*:/);
  assert.match(system.content, /"action"\s*:/);
  assert.match(system.content, /"evidence"\s*:/);
});

test('prompt prioritizes a complete compact JSON object and shows a valid created event', () => {
  const [system] = buildDirectorMessages({}, { type: 'manual' });
  assert.match(system.content, /event.*只能.*对象.*null/is);
  assert.match(system.content, /优先保证.*JSON.*完整/is);
  assert.match(system.content, /缩短.*文字/is);
  assert.match(system.content, /900.*字/);
  assert.match(system.content, /"event"\s*:\s*\{[\s\S]*"title"\s*:/);
  assert.match(system.content, /无法.*完整.*"event"\s*:\s*null/is);
});
