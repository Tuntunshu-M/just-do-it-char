import assert from 'node:assert/strict';
import test from 'node:test';
import { renderScriptsView } from '../../src/ui/views/scripts.js';

function documentFixture() {
  const doc = { createElement(tagName) { return { ownerDocument: doc, tagName, children: [], attributes: {}, textContent: '', className: '', append(...items) { this.children.push(...items); }, setAttribute(k, v) { this.attributes[k] = String(v); } }; } };
  return doc;
}
const flatten = (node) => [node, ...(node.children ?? []).flatMap(flatten)];

test('script page renders history toolbar and complete selected detail', () => {
  const doc = documentFixture(); const body = doc.createElement('section');
  renderScriptsView({ body, state: { selectedScriptId: 's', activeScriptId: null, scripts: [{ id: 's', title: '雨夜', status: 'draft', premise: '大纲', conflict: '冲突', climax: '高潮', ending: '结局', steps: [{ id: '1', goal: '阶段' }], foreshadowing: [{ id: 'f', surface: '旧物' }], revisions: [] }] }, services: {} });
  const text = flatten(body).map((node) => node.textContent).join('|');
  for (const label of ['雨夜', '开演', '暂停', '继续', '改变方向', '停止', '完整大纲', '阶段', '伏笔', '关键冲突', '高潮', '结局']) assert.match(text, new RegExp(label));
  assert.ok(flatten(body).some((node) => node.className === 'stpd-script-layout'));
});

test('script list shows timestamps and the current stage summary', () => {
  const doc = documentFixture(); const body = doc.createElement('section');
  renderScriptsView({ body, state: {
    selectedScriptId: 's', activeScriptId: 's', scripts: [{
      id: 's', title: '雨夜', status: 'running', createdAt: '2026-08-13T08:00:00.000Z', updatedAt: '2026-08-13T09:30:00.000Z',
      currentStepIndex: 1, steps: [{ title: '相遇' }, { title: '追踪', goal: '找到线索' }], revisions: [],
    }],
  }, services: {} });
  const text = flatten(body).map((node) => node.textContent).join('|');
  assert.match(text, /2026/);
  assert.match(text, /追踪/);
});

test('script detail renders complete stage, cast, clue and revision fields', () => {
  const doc = documentFixture(); const body = doc.createElement('section');
  renderScriptsView({ body, state: {
    selectedScriptId: 's', activeScriptId: 's', scripts: [{
      id: 's', title: '群像', status: 'paused', premise: '完整大纲', conflict: '主要矛盾', climax: '高潮事件', ending: '结局走向', currentStepIndex: 0,
      steps: [{ id: 'stage-1', title: '在警局下马威中立足', status: 'current', goal: '取得信任', coreEvent: '共同赴约', activity: '甲展示自己的能力', activeCharacterIds: ['a', 'b'],
        characterPlans: [{ characterId: 'a', name: '甲', goal: '确认身份', action: '主动邀请' }, { characterId: 'b', name: '乙', goal: '隐藏秘密', action: '转移话题' }],
        interaction: '甲乙互相试探', userPlan: '安排 user 参与晚餐', splitSteps: ['发出邀请', '抵达餐厅'] }],
      foreshadowing: [{ id: 'f', status: '待使用', connectedStepTitle: '在警局下马威中立足', source: '乙的旧物', content: '刻字戒指', surface: '普通饰品', plantStepId: 'stage-1', revealStepId: 'stage-4', recovery: '公开来历', impact: '联盟破裂', condition: 'user 发现刻字' }],
      revisions: [{ id: 'r', createdAt: '2026-08-13T10:00:00.000Z', reason: '改去海边', currentStepIndex: 0, outline: { premise: '修订大纲' } }],
    }],
  }, services: {} });
  const text = flatten(body).map((node) => node.textContent).join('|');
  for (const value of ['在警局下马威中立足', '甲展示自己的能力', '取得信任', '共同赴约', '甲', '确认身份', '主动邀请', '甲乙互相试探', '安排 user 参与晚餐', '发出邀请', '抵达餐厅', '乙的旧物', '普通饰品', 'stage-4', '公开来历', '联盟破裂', 'user 发现刻字', '改去海边', '修订大纲']) assert.match(text, new RegExp(value));
  assert.match(text, /\[待使用\]刻字戒指\[在警局下马威中立足\]/);
});

test('perform is enabled only for a selected draft or stopped script', () => {
  for (const [status, expectedDisabled] of [['draft', false], ['stopped', false], ['running', true], ['paused', true], ['completed', true]]) {
    const doc = documentFixture(); const body = doc.createElement('section');
    renderScriptsView({ body, state: { selectedScriptId: 's', activeScriptId: ['running', 'paused'].includes(status) ? 's' : null, scripts: [{ id: 's', title: status, status, steps: [] }] }, services: {} });
    const perform = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '开演');
    assert.equal(Boolean(perform.disabled), expectedDisabled, status);
  }
});

test('revision restore calls the wired script revision service', async () => {
  const doc = documentFixture(); const body = doc.createElement('section'); let args;
  renderScriptsView({ body, state: { selectedScriptId: 's', activeScriptId: 's', scripts: [{ id: 's', title: 'A', status: 'paused', steps: [], revisions: [{ id: 'r', reason: '方向' }] }] }, services: { restoreScriptRevision: async (...value) => { args = value; } } });
  const restore = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '恢复');
  await restore.onclick();
  assert.deepEqual(args, ['s', 'r']);
});

test('script detail selection prefers saved selection, then active, then newest script', () => {
  const cases = [
    {
      state: { activeScriptId: 'active', selectedScriptId: 'saved', scripts: [{ id: 'saved', title: 'Saved', status: 'draft' }, { id: 'active', title: 'Active', status: 'running' }] },
      expected: 'Saved',
    },
    {
      state: { activeScriptId: 'active', selectedScriptId: 'missing', scripts: [{ id: 'active', title: 'Active', status: 'running' }, { id: 'newer', title: 'Newer', status: 'draft' }] },
      expected: 'Active',
    },
    {
      state: { activeScriptId: null, selectedScriptId: 'saved', scripts: [{ id: 'newer', title: 'Newer', status: 'draft', createdAt: '2026-08-13T11:00:00Z' }, { id: 'saved', title: 'Saved', status: 'draft', createdAt: '2026-08-13T10:00:00Z' }] },
      expected: 'Saved',
    },
    {
      state: { activeScriptId: null, selectedScriptId: 'missing', scripts: [{ id: 'older', title: 'Older', status: 'draft', createdAt: '2026-08-13T10:00:00Z' }, { id: 'newer', title: 'Newest', status: 'draft', createdAt: '2026-08-13T11:00:00Z' }] },
      expected: 'Newest',
    },
  ];
  for (const { state, expected } of cases) {
    const doc = documentFixture(); const body = doc.createElement('section');
    renderScriptsView({ body, state, services: {} });
    const heading = flatten(body).find((node) => node.tagName === 'h3');
    assert.equal(heading?.textContent, expected);
  }
});

test('script selection relies on the persisted service refresh without rerendering stale view state', async () => {
  const doc = documentFixture(); const body = doc.createElement('section');
  let selectedId = null;
  let staleRerenders = 0;
  renderScriptsView({
    body,
    state: {
      selectedScriptId: 'first',
      activeScriptId: null,
      scripts: [
        { id: 'first', title: 'First', status: 'draft', steps: [] },
        { id: 'second', title: 'Second', status: 'draft', steps: [] },
      ],
    },
    services: { selectScript: async (id) => { selectedId = id; } },
    rerender: () => { staleRerenders += 1; },
  });

  const second = flatten(body).find((node) => node.tagName === 'button' && node.children?.[0]?.textContent === 'Second');
  await second.onclick();

  assert.equal(selectedId, 'second');
  assert.equal(staleRerenders, 0);
});
