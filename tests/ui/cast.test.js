import assert from 'node:assert/strict';
import test from 'node:test';

import { renderCastView } from '../../src/ui/views/cast.js';
import { showCastMemberDialog } from '../../src/ui/dialogs/cast-member.js';

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
        append(...children) { for (const child of children) { child.parentNode = this; this.children.push(child); } },
        remove() { if (this.parentNode) this.parentNode.children = this.parentNode.children.filter((child) => child !== this); },
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

test('single mode lets the user choose a protagonist from detected people', async () => {
  const doc = createDocument(); const body = doc.createElement('section'); let selected;
  renderCastView({
    body,
    state: { cast: { mode: 'single', singleSelection: { id: 'a', name: '角色 A' }, members: [{ id: 'a', name: '角色 A' }], multiMembers: [{ id: 'a', name: '角色 A' }, { id: 'b', name: '角色 B' }] } },
    settings: { context: {} },
    services: { personalityProfile: () => ({ status: 'empty', content: '', citations: [] }), setSingleCastMember: async (id) => { selected = id; } },
  });
  const selector = all(body).find((node) => node.tagName === 'select');
  assert.ok(selector);
  assert.match(all(selector).map((node) => node.textContent).join('|'), /角色 A/);
  assert.match(all(selector).map((node) => node.textContent).join('|'), /角色 B/);
  selector.value = 'b';
  await selector.onchange();
  assert.equal(selected, 'b');
});

test('cast member editor exposes all profile fields needed by event planning', () => {
  const doc = createDocument(); const body = doc.createElement('section');
  showCastMemberDialog(body, {}, () => {});
  const text = all(body).map((node) => node.textContent).join('|');
  for (const label of ['人物名称', '别名', '性格', '背景', '与 user 的关系', '对 user 的态度', '目标/秘密/执念', '说话风格', '主动推动方式', '认知边界']) assert.match(text, new RegExp(label));
});

test('cast member dialog is a closable modal and cancel does not submit', () => {
  const doc = createDocument(); const body = doc.createElement('section'); let submissions = 0;
  showCastMemberDialog(body, {}, () => { submissions += 1; });
  assert.ok(all(body).some((node) => node.attributes.role === 'dialog'));
  const cancel = all(body).find((node) => node.tagName === 'button' && node.textContent === '取消');
  assert.ok(cancel);
  cancel.onclick();
  assert.equal(submissions, 0);
  assert.equal(all(body).some((node) => node.attributes.role === 'dialog'), false);
});

test('cast member dialog accepts a name without requiring generated profile fields', () => {
  const doc = createDocument(); const body = doc.createElement('section'); let submitted;
  showCastMemberDialog(body, {}, (value) => { submitted = value; });
  const inputs = all(body).filter((node) => node.tagName === 'input');
  inputs[0].value = '新人物';
  const save = all(body).find((node) => node.tagName === 'button' && node.textContent === '保存人物');
  save.onclick();
  assert.equal(submitted.name, '新人物');
  assert.equal(submitted.personality, '');
  assert.equal(all(body).some((node) => node.attributes.role === 'dialog'), false);
});

test('editing a generated multi member updates that member id', async () => {
  const doc = createDocument(); const body = doc.createElement('section'); let updated;
  renderCastView({
    body,
    state: { cast: { mode: 'multi', multiMembers: [{ id: 'b', name: '角色 B', personality: '旧性格' }], leadId: 'b' } },
    settings: { context: {} },
    services: {
      personalityProfile: () => ({ status: 'ready', content: '群像', citations: [] }),
      updateCastMember: async (id, value) => { updated = { id, value }; },
    },
  });
  all(body).find((node) => node.tagName === 'button' && node.textContent === '编辑').onclick();
  const textareas = all(body).filter((node) => node.tagName === 'textarea');
  textareas[0].value = '新性格';
  await all(body).find((node) => node.tagName === 'button' && node.textContent === '保存人物').onclick();
  assert.equal(updated.id, 'b');
  assert.equal(updated.value.personality, '新性格');
});
