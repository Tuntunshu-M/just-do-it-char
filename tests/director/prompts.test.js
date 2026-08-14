import assert from 'node:assert/strict';
import test from 'node:test';
import { readFile } from 'node:fs/promises';
import { buildDirectorMessages } from '../../src/director/prompts.js';

test('production prompts contain no known test-topic contamination anchors', async () => {
  const source = await readFile(new URL('../../src/director/prompts.js', import.meta.url), 'utf8');
  assert.doesNotMatch(source, /蛇化者|兽化者|警局|水箱|刑侦|法医|凶手|死者/);
});

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
  assert.match(system.content, /以下字段都必须保留/);
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
  assert.match(system.content, /"premise"\s*:/);
  for (const field of ['conflict', 'climax', 'ending']) assert.doesNotMatch(system.content, new RegExp(`"${field}"\\s*:`));
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
  assert.match(system.content, /世界书.*优先.*角色卡.*上下文/s);
  assert.match(system.content, /全部.*候选人物/s);
  assert.match(system.content, /"members"\s*:/);
});

test('multi profile contract extracts all evidenced candidates and relations', () => {
  const [system] = buildDirectorMessages({ cast: { mode: 'multi' } }, { type: 'profile-character', castMode: 'multi' });
  assert.match(system.content, /"members"\s*:/);
  assert.match(system.content, /"relations"\s*:/);
  assert.match(system.content, /角色卡.*世界书/);
  assert.match(system.content, /认知边界/);
});

test('profile guidance templates are optional, independent, and resolve dual-template conflicts', () => {
  const profilePrompt = (profileGuidance) => buildDirectorMessages(
    { cast: { mode: 'single' } },
    { type: 'profile-character', profileGuidance },
  )[0].content;
  const none = profilePrompt([]);
  const gemini = profilePrompt(['gemini']);
  const claude = profilePrompt(['claude']);
  const both = profilePrompt(['gemini', 'claude']);

  assert.doesNotMatch(none, /角色塑造红线|主动性与情感表达/);
  assert.match(gemini, /【角色塑造红线·请严格遵守】/);
  assert.match(gemini, /请始终尊重 user 的自主性/);
  assert.doesNotMatch(gemini, /【主动性与情感表达·请严格遵守】/);
  assert.match(claude, /【主动性与情感表达·请严格遵守】/);
  assert.match(claude, /角色必须主动推进剧情和关系/);
  assert.doesNotMatch(claude, /【角色塑造红线·请严格遵守】/);
  assert.match(both, /【角色塑造红线·请严格遵守】/);
  assert.match(both, /【主动性与情感表达·请严格遵守】/);
  assert.match(both, /Gemini.*边界.*user 自主性.*优先/s);
});

test('profile guidance never enters event, step, or reaction prompts', () => {
  for (const type of ['plan-event', 'prepare-step', 'evaluate-reaction']) {
    const [system] = buildDirectorMessages({}, { type, profileGuidance: ['gemini', 'claude'] });
    assert.doesNotMatch(system.content, /角色塑造红线|主动性与情感表达/);
  }
});

test('event intent composes multi-card stages, category tones, and anti-conspiracy rules', () => {
  const [system] = buildDirectorMessages(
    { cast: { mode: 'multi', members: Array.from({ length: 6 }, (_, index) => ({ id: `c${index}` })) }, genre: { mode: 'fantasy' } },
    { type: 'plan-event', castMode: 'multi', mainCategory: 'daily', auxiliaryTones: { crisis: 0.25 } },
  );
  assert.match(system.content, /编剧兼群像角色策划者/);
  assert.match(system.content, /保留全部.*cast\.members/s);
  assert.match(system.content, /每个阶段.*至少 1 名.*活跃人物/s);
  assert.doesNotMatch(system.content, /每个阶段.*2-4.*活跃人物/s);
  assert.match(system.content, /5-7.*阶段/);
  assert.match(system.content, /4-6.*伏笔/);
  assert.match(system.content, /主类型.*daily/);
  assert.match(system.content, /辅助调性.*crisis/);
  assert.match(system.content, /巧合.*阴谋/s);
  assert.match(system.content, /普通.*非阴谋解释/s);
  assert.match(system.content, /"splitSteps"\s*:\s*\[/);
  assert.match(system.content, /每(?:个)?阶段.*非空 splitSteps/s);
  assert.match(system.content, /小标题.*具体行为/s);
  assert.match(system.content, /不得预设 user.*行动/s);
  assert.match(system.content, /角色主动活动/s);
  assert.match(system.content, /已回收.*未注入.*使用中.*待使用/s);
  assert.match(system.content, /connectedStepTitle/);
  assert.match(system.content, /多人.*interaction.*不得.*user/s);
  assert.match(system.content, /角色之间.*互动.*user/s);
});

test('event prompt uses only current sources and contains no crime-story example anchors', () => {
  const [system] = buildDirectorMessages(
    { cast: { mode: 'multi' }, latestUserMessage: '安排一次周末聚餐' },
    { type: 'plan-event', castMode: 'multi', mainCategory: 'daily' },
  );
  assert.doesNotMatch(system.content, /警局|刑侦|水箱|法医|凶手|死者/);
  assert.match(system.content, /只能.*当前角色卡.*所选世界书.*当前聊天上下文.*本次事件想法/s);
  assert.match(system.content, /结构示例.*禁止照抄.*剧情/s);
  assert.match(system.content, /仅供参考.*禁止照抄/s);
  assert.match(system.content, /不得引入.*无关.*旧剧本/s);
});

test('single-card event stages also require non-empty split steps', () => {
  const [system] = buildDirectorMessages(
    { cast: { mode: 'single' } },
    { type: 'plan-event', castMode: 'single', mainCategory: 'daily' },
  );
  assert.match(system.content, /"splitSteps"\s*:\s*\[/);
  assert.match(system.content, /每(?:个)?阶段.*非空 splitSteps/s);
});

test('prepare-step injects only the current stage and eligible clues', () => {
  const [system] = buildDirectorMessages({}, { type: 'prepare-step' });
  assert.match(system.content, /只使用当前阶段/);
  assert.match(system.content, /eligibleForeshadowing/);
  assert.match(system.content, /不得注入.*未来阶段/s);
  assert.match(system.content, /未成熟.*未揭示.*伏笔/s);
  assert.doesNotMatch(system.content, /"event"\s*:/);
});
