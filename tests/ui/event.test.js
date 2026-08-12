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
