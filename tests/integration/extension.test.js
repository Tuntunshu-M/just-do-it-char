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

test('extension reloads chat state and clears the world-book cache after chat changes', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');
  assert.match(source, /let chatKey =/);
  assert.match(source, /chatKey = hostAdapter\.getCurrentChatKey\(\)/);
  assert.match(source, /CHAT_CHANGED/);
  assert.match(source, /worldBookCache\.clear\(\)/);
  assert.match(source, /const loadSelectedWorldBooks = async \(\) =>/);
  assert.match(source, /await Promise\.all\(selectedBooks\.map\(\(name\) => loadWorldInfoBook\(name\)\)\)/);
  assert.match(source, /profileService\.ensureProfile\(\{ \.\.\.profileOptions\(\), entries \}\)/);
  assert.match(source, /profileService\.refreshProfile\(\{ \.\.\.profileOptions\(\), entries: included \}\)/);
  assert.match(source, /GENERATION_ENDED/);
  assert.match(source, /pipeline\.clearTurnInjection\(\)/);
  assert.match(source, /pipeline\.handleUserMessage\(message\?\.mes \?\? '', messageIndex\)/);
  assert.match(source, /if \(isGroupChat\(\)\) state\.status = 'paused';\s*rerender\(\);/);
  assert.doesNotMatch(source, /const chatKey = hostAdapter\.getCurrentChatKey/);
});

test('event outcomes produce immediate guidance for failed and unsuccessful attempts', async () => {
  const { eventOutcomeNotice } = await import('../../index.js');

  assert.equal(
    eventOutcomeNotice({ status: 'failed', stage: 'generating', message: 'Director API returned empty content' }),
    '事件生成失败（导演生成）：模型返回空内容。可在 设置 → 检查 查看详情。',
  );
  assert.equal(
    eventOutcomeNotice({ status: 'failed', stage: 'generating', message: 'Unexpected end of JSON input' }),
    '事件生成失败（导演生成）：模型输出被截断。可在 设置 → 检查 查看详情。',
  );
  assert.equal(
    eventOutcomeNotice({ status: 'failed', stage: 'generating', message: 'Invalid director result: event must be an object or null' }),
    '事件生成失败（导演生成）：模型返回的数据结构不符合要求。可在 设置 → 检查 查看详情。',
  );
  assert.equal(
    eventOutcomeNotice({ status: 'not-generated', stage: 'policy', message: '触及硬禁区' }),
    '事件未生成（规则检查）：触及硬禁区。可在 设置 → 检查 查看详情。',
  );
  assert.equal(eventOutcomeNotice({ status: 'success', stage: 'commit', message: 'ok' }), '');
});

test('native menu entry uses a clapperboard and the Director Time label', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');

  assert.match(source, /fa-clapperboard/);
  assert.match(source, /label\.textContent = '导演时间'/);
  assert.doesNotMatch(source, /fa-wand-magic-sparkles/);
});

test('native menu entry mounts as its own host menu item and opens when clicked', async () => {
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
      append(...children) {
        this.children.push(...children);
        children.forEach((child) => { child.parentElement = this; });
      },
      setAttribute() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      dispatchEvent(event) { listeners.get(event.type)?.(event); },
      remove() { byId.delete(this.id); },
    };
  };
  const existingContainer = createElement('div');
  const menu = createElement('div');
  menu.querySelector = (selector) => selector === '.extension_container' ? existingContainer : null;
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
    const container = entry.parentElement;

    assert.notEqual(container, existingContainer);
    assert.equal(container.parentElement, menu);
    assert.equal(container.classList.contains('extension_container'), true);
    assert.equal(entry.classList.contains('list-group-item'), true);
    assert.equal(entry.classList.contains('interactable'), true);
    assert.equal(entry.classList.contains('extensionsMenuExtensionButton'), false);
    assert.equal(icon.classList.contains('extensionsMenuExtensionButton'), true);
    entry.dispatchEvent({ type: 'click', preventDefault() {} });
    assert.equal(opened, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousAnimationFrame;
  }
});

test('native menu entry ignores the settings drawer and mounts in the wand menu', async () => {
  const { mountWandEntry } = await import('../../index.js');
  const byId = new Map();
  const make = (tagName, rect = { width: 0, height: 0 }) => {
    const listeners = new Map();
    const classes = new Set();
    return {
      tagName,
      children: [],
      parentElement: null,
      classList: { contains: (name) => classes.has(name) },
      set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); },
      get className() { return [...classes].join(' '); },
      set id(value) { this._id = value; byId.set(value, this); },
      get id() { return this._id; },
      append(...children) { this.children.push(...children); children.forEach((child) => { child.parentElement = this; }); },
      closest(selector) { return selector === '.drawer' ? this.drawer : null; },
      getBoundingClientRect() { return rect; },
      setAttribute() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      dispatchEvent(event) { listeners.get(event.type)?.(event); },
      remove() { byId.delete(this.id); },
    };
  };
  const oldMenu = make('div'); oldMenu.id = 'extensionsMenu';
  const drawer = make('div', { width: 300, height: 500 }); drawer.className = 'drawer';
  const settingsDrawer = make('div'); settingsDrawer.id = 'rm_extensions_block'; settingsDrawer.drawer = drawer;
  const previousDocument = globalThis.document;
  const previousAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.document = {
    createElement: (tagName) => make(tagName),
    querySelectorAll: () => [settingsDrawer, oldMenu],
    querySelector: (selector) => byId.get(selector.slice(1)) ?? null,
  };
  globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
  try {
    mountWandEntry(() => {});
    assert.equal(oldMenu.children[0].id, 'stpd-menu-container');
    assert.equal(settingsDrawer.children.length, 0);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousAnimationFrame;
  }
});

test('native menu entry stays in the wand menu when the settings drawer appears later', async () => {
  const { mountWandEntry } = await import('../../index.js');
  const byId = new Map();
  const make = (tagName) => {
    const listeners = new Map();
    const classes = new Set();
    return {
      tagName,
      children: [],
      parentElement: null,
      classList: { contains: (name) => classes.has(name) },
      set className(value) { classes.clear(); value.split(/\s+/).filter(Boolean).forEach((name) => classes.add(name)); },
      get className() { return [...classes].join(' '); },
      set id(value) { this._id = value; byId.set(value, this); },
      get id() { return this._id; },
      append(...children) {
        children.forEach((child) => {
          if (child.parentElement) child.parentElement.children = child.parentElement.children.filter((item) => item !== child);
          child.parentElement = this;
          this.children.push(child);
        });
      },
      setAttribute() {},
      addEventListener(type, listener) { listeners.set(type, listener); },
      dispatchEvent(event) { listeners.get(event.type)?.(event); },
      remove() {
        if (this.parentElement) this.parentElement.children = this.parentElement.children.filter((item) => item !== this);
        byId.delete(this.id);
      },
    };
  };
  const oldMenu = make('div'); oldMenu.id = 'extensionsMenu';
  const settingsDrawer = make('div'); settingsDrawer.id = 'rm_extensions_block';
  let settingsAvailable = false;
  const previousDocument = globalThis.document;
  const previousAnimationFrame = globalThis.requestAnimationFrame;
  globalThis.document = {
    createElement: (tagName) => make(tagName),
    querySelectorAll: () => settingsAvailable ? [settingsDrawer, oldMenu] : [oldMenu],
    querySelector: (selector) => byId.get(selector.slice(1)) ?? null,
  };
  globalThis.requestAnimationFrame = (callback) => { callback(); return 1; };
  try {
    let opened = 0;
    mountWandEntry(() => { opened += 1; });
    assert.equal(byId.get('stpd-menu-container').parentElement, oldMenu);

    settingsAvailable = true;
    mountWandEntry(() => { opened += 1; });
    const entry = byId.get('stpd-menu-entry');
    entry.dispatchEvent({ type: 'click', preventDefault() {} });

    assert.equal(byId.get('stpd-menu-container').parentElement, oldMenu);
    assert.equal(opened, 1);
  } finally {
    globalThis.document = previousDocument;
    globalThis.requestAnimationFrame = previousAnimationFrame;
  }
});
