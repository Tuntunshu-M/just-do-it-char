import assert from 'node:assert/strict';
import test from 'node:test';

import { renderWorldInfoView } from '../../src/ui/views/world-info.js';

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
        scrollTop: 0,
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

test('world-book entry selection keeps the current panel scroll position after async save rerender', async () => {
  const doc = createDocument();
  const settings = { context: { worldInfo: true, worldInfoBooks: {} } };
  const book = { name: 'Book A', entries: [{ uid: 1, name: 'Entry A' }] };
  let body;

  const render = () => {
    body = doc.createElement('section');
    renderWorldInfoView({
      body,
      settings,
      services: {
        worldInfoNames: () => ['Book A'],
        loadWorldInfoBook: async () => book,
      },
      saveSettings: async () => {
        render();
        await new Promise((resolve) => setTimeout(resolve, 0));
      },
      rerender: render,
    });
  };

  render();
  body.scrollTop = 180;
  all(body).find((node) => node.tagName === 'button' && node.className.includes('stpd-world-expand')).onclick();
  await new Promise((resolve) => setTimeout(resolve, 0));

  body.scrollTop = 240;
  const inputs = all(body).filter((node) => node.tagName === 'input');
  const entry = inputs.at(-1);
  entry.checked = true;
  await entry.onchange();

  assert.equal(body.scrollTop, 240);
});
