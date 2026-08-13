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
  assert.doesNotMatch(system.content, /900.*字/);
  assert.match(system.content, /"event"\s*:\s*\{[\s\S]*"title"\s*:/);
  for (const field of ['premise', 'conflict', 'climax', 'ending']) assert.match(system.content, new RegExp(`"${field}"\\s*:`));
  assert.match(system.content, /无法.*完整.*"event"\s*:\s*null/is);
});

test('profile intent uses a profile-only contract with knowledge fog', () => {
  const [system] = buildDirectorMessages({ cast: { mode: 'single' } }, { type: 'profile-character' });
  assert.match(system.content, /编剧兼角色策划者/);
  assert.match(system.content, /"content"\s*:/);
  assert.match(system.content, /"citations"\s*:/);
  assert.doesNotMatch(system.content, /"event"\s*:/);
  assert.match(system.content, /明确知道.*合理推断.*明确不知道/s);
  assert.match(system.content, /世界书.*不等于.*全知/s);
});

test('event intent composes multi-card stages, category tones, and anti-conspiracy rules', () => {
  const [system] = buildDirectorMessages(
    { cast: { mode: 'multi', members: Array.from({ length: 6 }, (_, index) => ({ id: `c${index}` })) }, genre: { mode: 'fantasy' } },
    { type: 'plan-event', castMode: 'multi', mainCategory: 'daily', auxiliaryTones: { crisis: 0.25 } },
  );
  assert.match(system.content, /编剧兼群像角色策划者/);
  assert.match(system.content, /保留全部.*cast\.members/s);
  assert.match(system.content, /每个阶段.*2-4.*活跃人物/s);
  assert.match(system.content, /5-7.*阶段/);
  assert.match(system.content, /4-6.*伏笔/);
  assert.match(system.content, /主类型.*daily/);
  assert.match(system.content, /辅助调性.*crisis/);
  assert.match(system.content, /巧合.*阴谋/s);
  assert.match(system.content, /普通.*非阴谋解释/s);
});

test('prepare-step injects only the current stage and eligible clues', () => {
  const [system] = buildDirectorMessages({}, { type: 'prepare-step' });
  assert.match(system.content, /只使用当前阶段/);
  assert.match(system.content, /eligibleForeshadowing/);
  assert.match(system.content, /不得注入.*未来阶段/s);
  assert.match(system.content, /未成熟.*未揭示.*伏笔/s);
  assert.doesNotMatch(system.content, /"event"\s*:/);
});
