import assert from 'node:assert/strict';
import test from 'node:test';

import { renderDiagnosticsView } from '../../src/ui/views/diagnostics.js';

function createDocument() {
  const doc = {
    createElement(tagName) {
      return {
        ownerDocument: doc,
        tagName,
        children: [],
        attributes: {},
        className: '',
        textContent: '',
        append(...children) { this.children.push(...children); },
        replaceChildren(...children) { this.children = children; },
        setAttribute(key, value) { this.attributes[key] = String(value); },
      };
    },
  };
  return doc;
}

function all(node) {
  return [node, ...(node.children ?? []).flatMap(all)];
}

function button(body, label) {
  return all(body).find((node) => node.tagName === 'button' && node.textContent === label);
}

test('diagnostics view runs checks, persists the result, and renders retained attempts', async () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  const state = {
    generation: { phase: 'failed', error: 'reply failed' },
    diagnostics: {
      lastCheck: null,
      records: [{ id: 'r1', trigger: 'manual', status: 'failed', stage: 'reply', startedAt: '2026-08-13T10:00:00.000Z', durationMs: 120, message: 'reply failed' }],
    },
  };
  let saves = 0;
  let renders = 0;
  const result = { checkedAt: '2026-08-13T11:00:00.000Z', summary: { connectionMode: 'main' }, checks: [{ id: 'chat', label: '当前聊天', status: 'pass', message: '已连接' }] };

  renderDiagnosticsView({ body, state, services: { runDiagnostics: async () => result }, saveState: async () => { saves += 1; }, rerender: () => { renders += 1; } });
  await button(body, '运行检查').onclick();

  assert.deepEqual(state.diagnostics.lastCheck, result);
  assert.equal(saves, 1);
  assert.equal(renders, 1);
  assert.ok(all(body).some((node) => node.textContent.includes('reply failed')));
});

test('diagnostics view copies a sanitized report and clears retained records', async () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  const state = { generation: { phase: 'idle' }, diagnostics: { lastCheck: { checkedAt: 'now', summary: {}, checks: [] }, records: [{ id: 'r1', message: 'safe' }] } };
  let copied;
  let saves = 0;
  let renders = 0;

  renderDiagnosticsView({
    body,
    state,
    services: { copyDiagnosticReport: async (snapshot) => { copied = snapshot; } },
    saveState: async () => { saves += 1; },
    rerender: () => { renders += 1; },
  });
  await button(body, '复制诊断报告').onclick();
  await button(body, '清空记录').onclick();

  assert.equal(copied.records.length, 1);
  assert.deepEqual(state.diagnostics.records, []);
  assert.equal(saves, 1);
  assert.equal(renders, 1);
});
