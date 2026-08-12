import assert from 'node:assert/strict';
import test from 'node:test';

import { createDirectorConsole } from '../../src/ui/director-console.js';
import { renderAppearanceView } from '../../src/ui/views/appearance.js';

function createDocument() {
  const listeners = new Map();
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
        replaceChildren(...children) { this.children = children; },
        setAttribute(key, value) { this.attributes[key] = String(value); },
        querySelector(selector) {
          if (!selector.startsWith('.')) return undefined;
          const className = selector.slice(1);
          return all(this).find((node) => node.className.split(' ').includes(className));
        },
        click() { this.clicked = true; },
        focus() {},
      };
    },
    addEventListener(type, handler) { listeners.set(type, handler); },
    removeEventListener(type) { listeners.delete(type); },
  };
  return doc;
}

function all(node) {
  return [node, ...(node.children ?? []).flatMap(all)];
}

test('title theme button shows the current mode and toggles night to day', async () => {
  const doc = createDocument();
  const root = doc.createElement('div');
  const settings = { theme: { mode: 'night', css: '' } };
  const state = { status: 'idle', generation: { phase: 'idle' }, activeEvent: null, directorNotes: '' };
  const previews = [];
  let saves = 0;
  const console = createDirectorConsole({
    root,
    services: {
      previewTheme(value) { previews.push({ ...value }); },
      async saveSettings() { saves += 1; },
    },
  });

  console.mount({ settings, state });
  let toggle = all(root).find((node) => node.className.includes('stpd-theme-toggle'));
  assert.equal(toggle.attributes['aria-label'], '切换到白天模式');
  assert.ok(all(toggle).some((node) => node.className.includes('fa-moon')));

  await toggle.onclick();

  assert.equal(settings.theme.mode, 'day');
  assert.deepEqual(previews, [{ mode: 'day', css: '' }]);
  assert.equal(saves, 1);
  toggle = all(root).find((node) => node.className.includes('stpd-theme-toggle'));
  assert.equal(toggle.attributes['aria-label'], '切换到夜晚模式');
  assert.ok(all(toggle).some((node) => node.className.includes('fa-sun')));
});

test('appearance page no longer renders a separate day and night selector', () => {
  const doc = createDocument();
  const body = doc.createElement('section');

  renderAppearanceView({
    body,
    settings: { theme: { mode: 'night', css: '', allowGlobalCss: false } },
    services: {},
    saveSettings() {},
    rerender() {},
  });

  assert.equal(all(body).some((node) => node.className.includes('stpd-theme-mode')), false);
  assert.equal(all(body).some((node) => node.textContent === '白天' || node.textContent === '夜晚'), false);
});

test('appearance page exposes a compact button that opens the theme file picker', () => {
  const doc = createDocument();
  const body = doc.createElement('section');

  renderAppearanceView({
    body,
    settings: { theme: { mode: 'night', css: '', allowGlobalCss: false } },
    services: {},
    saveSettings() {},
    rerender() {},
  });

  const importButton = all(body).find((node) => node.tagName === 'button' && node.textContent === '导入主题');
  const file = all(body).find((node) => node.tagName === 'input' && node.attributes.type === 'file');
  assert.ok(importButton.className.includes('stpd-compact'));
  assert.ok(file.className.includes('stpd-visually-hidden'));
  importButton.onclick();
  assert.equal(file.clicked, true);
});
