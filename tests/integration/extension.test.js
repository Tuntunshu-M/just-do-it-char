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

test('native wand menu entry remains visible when its icon font is unavailable', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');

  assert.match(source, /entry\.textContent = '主动导演'/);
});
