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
