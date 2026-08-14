import assert from 'node:assert/strict';
import test from 'node:test';

import { renderEventView } from '../../src/ui/views/event.js';

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
        value: '',
        append(...children) { this.children.push(...children); },
        remove() { this.removed = true; },
        setAttribute(key, value) { this.attributes[key] = String(value); },
      };
    },
  };
  return doc;
}

function all(node) {
  return [node, ...(node.children ?? []).flatMap(all)];
}

test('blank event idea opens a random-event preview and submits an empty prompt', async () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  const calls = [];
  renderEventView({
    body,
    state: { activeEvent: null, directorNotes: '' },
    services: { onManualEvent: async (...args) => calls.push(args) },
    saveState() {},
  });

  all(body).find((node) => node.tagName === 'button' && node.textContent === '创建事件').onclick();

  assert.ok(all(body).some((node) => node.textContent === '随机事件'));
  await all(body).find((node) => node.tagName === 'button' && node.textContent === '确认创建').onclick();
  assert.deepEqual(calls, [['', true]]);
});

test('event page contains generation controls but no script outline or runtime controls', () => {
  const doc = createDocument(); const body = doc.createElement('section');
  renderEventView({ body, state: { activeEvent: { title: '旧事件', premise: '不应显示' }, directorNotes: '' }, services: {}, saveState() {} });
  const text = all(body).map((node) => node.textContent).join('|');
  assert.match(text, /创建事件/);
  assert.doesNotMatch(text, /剧情大纲|拆分步骤|暂停事件|编辑大纲|旧事件/);
});

test('event page keeps a blocked generation reason visible and offers retry', async () => {
  const doc = createDocument(); const body = doc.createElement('section'); const calls = [];
  renderEventView({
    body,
    state: { generation: { phase: 'idle', error: '导演还在看人设' }, directorNotes: '' },
    services: { onManualEvent: async (...args) => calls.push(args) },
    saveState() {},
  });

  const text = all(body).map((node) => node.textContent).join('|');
  assert.match(text, /导演还在看人设/);
  const retry = all(body).find((node) => node.tagName === 'button' && node.textContent === '重新尝试');
  assert.ok(retry);
  await retry.onclick();
  assert.deepEqual(calls, [['', true]]);
});

test('event idea survives a failed confirmation and clears only after planning succeeds', async () => {
  const doc = createDocument(); const body = doc.createElement('section');
  const calls = [];
  let result = { status: 'failed' };
  renderEventView({
    body,
    state: { activeEvent: null, directorNotes: '', generation: { error: '失败' } },
    services: { onManualEvent: async (...args) => { calls.push(args); return result; } },
    saveState() {},
  });
  const idea = all(body).find((node) => node.tagName === 'textarea');
  idea.value = '保留这条想法';
  all(body).find((node) => node.tagName === 'button' && !node.className).onclick();
  await all(body).find((node) => node.tagName === 'button' && node.className === 'stpd-primary').onclick();
  assert.equal(idea.value, '保留这条想法');

  result = { status: 'planned', scriptId: 'script-1' };
  all(body).find((node) => node.tagName === 'button' && !node.className).onclick();
  await all(body).find((node) => node.tagName === 'button' && node.className === 'stpd-primary').onclick();
  assert.equal(all(body).find((node) => node.tagName === 'textarea').value, '');
});
