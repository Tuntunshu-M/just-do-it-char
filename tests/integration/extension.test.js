import assert from 'node:assert/strict';
import test from 'node:test';

test('extension entry exports lifecycle and keeps host access in adapter', async () => {
  const entry = await import('../../index.js');
  assert.equal(typeof entry.initializeExtension, 'function');
  assert.equal(typeof entry.destroyExtension, 'function');
  const fs = await import('node:fs/promises');
  const files = (await fs.readdir(new URL('../../src/director/', import.meta.url))).filter((name) => name.endsWith('.js'));
  for (const file of files) {
    const source = await fs.readFile(new URL(`../../src/director/${file}`, import.meta.url), 'utf8');
    assert.equal(source.includes('SillyTavern.getContext'), false, `${file} bypasses host adapter`);
  }
});

test('extension reloads chat state and world books after chat changes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');
  assert.match(source, /let chatKey =/);
  assert.match(source, /chatKey = hostAdapter\.getCurrentChatKey\(\)/);
  assert.match(source, /CHAT_CHANGED/);
  assert.match(source, /reloadWorldInfo\(\)/);
  assert.match(source, /scheduleIdle\(\)/);
  assert.match(source, /if \(!settings\.trigger\.idleEnabled \|\| !chatKey \|\| isGroupChat\(\)\) return/);
  assert.match(source, /if \(isGroupChat\(\)\) state\.status = 'paused';\s*rerender\(\);/);
  assert.doesNotMatch(source, /const chatKey = hostAdapter\.getCurrentChatKey/);
});

test('native menu entry uses a clapperboard and the Director Time label', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');

  assert.match(source, /fa-clapperboard/);
  assert.match(source, /label\.textContent = '导演时间'/);
  assert.doesNotMatch(source, /fa-wand-magic-sparkles/);
});

test('native menu entry keeps the host pointer-blocking class on its icon and opens when clicked', async () => {
  const { mountWandEntry } = await import('../../index.js');
  const byId = new Map();
  const createElement = (tagName) => {
    const listeners = new Map();
    const classes = new Set();
    return {
      tagName,
      children: [],
      classList: { contains: (name) => classes.has(name) },
      set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); },
      get className() { return [...classes].join(' '); },
      set id(value) { this._id = value; byId.set(value, this); },
      get id() { return this._id; },
      append(...children) { this.children.push(...children); },
      setAttribute() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      dispatchEvent(event) { listeners.get(event.type)?.(event); },
      remove() { byId.delete(this.id); },
    };
  };
  const container = createElement('div');
  const menu = createElement('div');
  menu.querySelector = (selector) => selector === '.extension_container' ? container : null;
  const previousDocument = globalThis.document;
  const previousAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.document = {
    createElement,
    querySelector: (selector) => selector === '#extensionsMenu' ? menu : byId.get(selector.slice(1)) ?? null,
  };
  globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
  try {
    let opened = 0;
    mountWandEntry(() => { opened += 1; });
    const entry = byId.get('stpd-menu-entry');
    const icon = entry.children[0];

    assert.equal(entry.classList.contains('extensionsMenuExtensionButton'), false);
    assert.equal(icon.classList.contains('extensionsMenuExtensionButton'), true);
    entry.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(opened, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousAnimationFrame;
  }
});
