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
  renderScriptsView({ body, state: { selectedScriptId: 's', activeScriptId: null, scripts: [{ id: 's', title: '雨夜', status: 'draft', premise: '大纲', steps: [{ id: '1', goal: '阶段', activity: '角色主动活动' }], foreshadowing: [{ id: 'f', surface: '旧物' }], revisions: [] }] }, services: {} });
  const text = flatten(body).map((node) => node.textContent).join('|');
  for (const label of ['雨夜', '开演', '暂停', '继续', '改变方向', '停止', '完整大纲', '阶段', '伏笔', '角色主动活动']) assert.match(text, new RegExp(label));
  for (const label of ['关键冲突', '高潮', '结局']) assert.doesNotMatch(text, new RegExp(label));
  assert.ok(flatten(body).some((node) => node.className === 'stpd-script-layout'));
});

test('script detail keeps edit action in the top header before outline content', () => {
  const doc = documentFixture(); const body = doc.createElement('section');
  renderScriptsView({ body, state: { selectedScriptId: 's', scripts: [{ id: 's', title: 'Top', status: 'draft', premise: 'Outline', steps: [], foreshadowing: [] }] }, services: {} });
  const detail = flatten(body).find((node) => node.className === 'stpd-script-detail');
  assert.equal(detail.children[0]?.className, 'stpd-script-detail-header');
  assert.ok(flatten(detail.children[0]).some((node) => node.tagName === 'button'));
  assert.equal(detail.children[1]?.className, 'stpd-script-section');
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
      id: 's', title: '群像', status: 'paused', premise: '完整大纲', currentStepIndex: 0,
      steps: [{ id: 'stage-1', title: '在会面中立足', status: 'current', goal: '取得信任', activity: '甲展示自己的能力', activeCharacterIds: ['a', 'b'],
        characterPlans: [{ characterId: 'a', name: '甲', goal: '确认身份', action: '主动邀请' }, { characterId: 'b', name: '乙', goal: '隐藏秘密', action: '转移话题' }],
        interaction: '甲乙互相试探', splitSteps: ['发出邀请', '等待响应'] }],
      foreshadowing: [{ id: 'f', status: '待使用', connectedStepTitle: '在会面中立足', source: '乙的旧物', content: '刻字戒指', surface: '普通饰品', plantStepId: 'stage-1', revealStepId: 'stage-4', recovery: '公开来历', impact: '联盟破裂', condition: '角色观察到刻字' }],
      revisions: [{ id: 'r', createdAt: '2026-08-13T10:00:00.000Z', reason: '改去海边', currentStepIndex: 0, outline: { premise: '修订大纲' } }],
    }],
  }, services: {} });
  const text = flatten(body).map((node) => node.textContent).join('|');
  for (const value of ['在会面中立足', '甲展示自己的能力', '取得信任', '角色主动活动', '甲', '确认身份', '主动邀请', '甲乙互相试探', '发出邀请', '等待响应', '乙的旧物', '普通饰品', 'stage-4', '公开来历', '联盟破裂', '角色观察到刻字', '改去海边', '修订大纲']) assert.match(text, new RegExp(value));
  assert.doesNotMatch(text, /核心事件|对 user 的策划/);
  assert.match(text, /\[待使用\]刻字戒指\[在会面中立足\]/);
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

test('script editor submits editable content without overwriting runtime state', async () => {
  const doc = documentFixture(); const body = doc.createElement('section'); let args;
  renderScriptsView({ body, state: { selectedScriptId: 's', activeScriptId: null, scripts: [{ id: 's', title: '旧标题', category: '日常', premise: '旧大纲', steps: [{ title: '旧阶段' }], foreshadowing: [{ content: '旧伏笔' }], facts: [{ id: 'fact' }], revisions: [{ id: 'revision' }], status: 'draft', currentStepIndex: 0, pendingTurn: null }] }, services: { updateScript: async (...value) => { args = value; } } });
  const edit = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '编辑');
  await edit.onclick();
  const inputs = flatten(body).filter((node) => ['input', 'textarea'].includes(node.tagName));
  const title = inputs.find((node) => node.attributes?.['aria-label'] === '标题');
  const premise = inputs.find((node) => node.attributes?.['aria-label'] === '完整大纲');
  const clues = inputs.find((node) => node.attributes?.['aria-label'] === '伏笔 JSON');
  title.value = '新标题'; premise.value = '新大纲'; clues.value = '[{"content":"新伏笔"}]';
  const save = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '保存剧本');
  await save.onclick();
  assert.equal(args[0], 's');
  assert.deepEqual(args[1], { title: '新标题', category: '日常', premise: '新大纲', steps: [{ title: '旧阶段' }], foreshadowing: [{ content: '新伏笔' }], facts: [{ id: 'fact' }], revisions: [{ id: 'revision' }] });
});

test('script deletion supports multi-select and protects running records', async () => {
  const doc = documentFixture(); const body = doc.createElement('section'); let deleted;
  renderScriptsView({ body, state: { selectedScriptId: 'a', scripts: [{ id: 'a', title: 'A', status: 'draft' }, { id: 'b', title: 'B', status: 'stopped' }, { id: 'r', title: 'R', status: 'running' }] }, services: { confirm: async () => true, deleteScripts: async (ids) => { deleted = ids; } } });
  const checkboxes = flatten(body).filter((node) => node.tagName === 'input' && node.attributes?.type === 'checkbox');
  assert.equal(checkboxes.find((node) => node.attributes['aria-label'] === '选择R').disabled, true);
  for (const label of ['选择A', '选择B']) { const checkbox = checkboxes.find((node) => node.attributes['aria-label'] === label); checkbox.checked = true; checkbox.onchange(); }
  const remove = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '删除所选');
  assert.equal(remove.disabled, false);
  await remove.onclick();
  assert.deepEqual(new Set(deleted), new Set(['a', 'b']));
});

test('clear current chat delegates to the protected repository service', async () => {
  const doc = documentFixture(); const body = doc.createElement('section'); let cleared = 0;
  renderScriptsView({ body, state: { scripts: [] }, services: { confirm: async () => true, clearScripts: async () => { cleared += 1; } } });
  const clear = flatten(body).find((node) => node.tagName === 'button' && node.textContent === '清空本聊天');
  await clear.onclick();
  assert.equal(cleared, 1);
});
