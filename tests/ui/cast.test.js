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

test('cast page exposes explicit modes and multi member management', () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  renderCastView({
    body,
    state: { cast: { mode: 'multi', members: [{ id: 'b', name: '角色 B' }], multiMembers: [{ id: 'b', name: '角色 B' }], leadId: 'b' } },
    settings: { context: {} },
    services: { personalityProfile: () => ({ status: 'empty', content: '', citations: [] }) },
  });
  const text = all(body).map((node) => node.textContent).join('|');
  for (const label of ['单角色', '多角色', '角色 B', '添加人物', '编辑', '移除', '主推手']) assert.match(text, new RegExp(label));
  assert.ok(all(body).some((node) => node.className === 'stpd-cast-mode'));
  assert.ok(all(body).some((node) => node.className === 'stpd-cast-members'));
});
