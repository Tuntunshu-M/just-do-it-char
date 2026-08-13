import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCastView } from '../../src/ui/views/cast.js';

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
        setAttribute(key, value) { this.attributes[key] = String(value); },
      };
    },
  };
  return doc;
}

function all(node) {
  return [node, ...(node.children ?? []).flatMap(all)];
}

test('empty personality profile exposes an active generation action', async () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  let refreshes = 0;

  renderCastView({
    body,
    state: { cast: { mode: 'single', members: [] } },
    settings: { context: {} },
    services: {
      personalityProfile: () => ({ status: 'empty', content: '', citations: [] }),
      refreshPersonalityProfile: async () => { refreshes += 1; },
    },
  });

  const generate = all(body).find((node) => node.tagName === 'button' && node.textContent === '生成侧写');
  assert.ok(generate);
  await generate.onclick();
  assert.equal(refreshes, 1);
});
