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

test('native menu entry keeps its label horizontal and fully clickable', async () => {
  const css = await (await import('node:fs/promises')).readFile(new URL('../../style.css', import.meta.url), 'utf8');

  assert.match(css, /#stpd-menu-entry\s*\{[^}]*display:\s*flex/);
  assert.match(css, /#stpd-menu-entry\s*\{[^}]*flex-direction:\s*row/);
  assert.match(css, /#stpd-menu-entry\s*\{[^}]*white-space:\s*nowrap/);
  assert.match(css, /#stpd-menu-entry\s*\{[^}]*width:\s*100%/);
});

test('native menu click opens the console after the host menu dismisses', async () => {
  const source = await (await import('node:fs/promises')).readFile(new URL('../../index.js', import.meta.url), 'utf8');

  assert.match(source, /entry\.addEventListener\('click',\s*\(event\) => \{/);
  assert.match(source, /event\.preventDefault\(\);\s*openAfterMenuDismissal\(entry\);/);
  assert.match(source, /requestAnimationFrame\(\(\) => requestAnimationFrame\(open\)\)/);
  assert.doesNotMatch(source, /queueMicrotask/);
});
