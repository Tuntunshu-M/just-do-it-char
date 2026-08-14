import assert from 'node:assert/strict';
import test from 'node:test';

import { renderProfileGuidanceView } from '../../src/ui/views/profile-guidance.js';

function createDocument() {
  const doc = {
    createElement(tagName) {
      return {
        ownerDocument: doc,
        tagName,
        children: [],
        attributes: {},
        textContent: '',
        checked: false,
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

test('profile guidance settings persist Gemini and Claude independently', () => {
  const doc = createDocument();
  const body = doc.createElement('section');
  const settings = { profileGuidance: { gemini: false, claude: true } };
  let saves = 0;

  renderProfileGuidanceView({ body, settings, saveSettings: () => { saves += 1; } });

  const labels = all(body).filter((node) => node.tagName === 'label');
  assert.ok(all(labels[0]).some((node) => node.textContent === 'Gemini 角色塑造特化'));
  assert.ok(all(labels[1]).some((node) => node.textContent === 'Claude 主动表达特化'));
  const [gemini, claude] = all(body).filter((node) => node.tagName === 'input');
  assert.equal(gemini.checked, false);
  assert.equal(claude.checked, true);

  gemini.checked = true;
  gemini.onchange();
  assert.deepEqual(settings.profileGuidance, { gemini: true, claude: true });
  claude.checked = false;
  claude.onchange();
  assert.deepEqual(settings.profileGuidance, { gemini: true, claude: false });
  assert.equal(saves, 2);
});
