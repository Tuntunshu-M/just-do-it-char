import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import test from 'node:test';

test('manifest exposes the files and metadata required for URL installation', async () => {
  const raw = await readFile(new URL('../manifest.json', import.meta.url), 'utf8');
  const manifest = JSON.parse(raw);

  assert.equal(manifest.display_name, '主动导演');
  assert.equal(typeof manifest.version, 'string');
  assert.match(manifest.version, /^\d+\.\d+\.\d+$/);
  assert.equal(typeof manifest.loading_order, 'number');
  assert.equal(manifest.js, 'index.js');
  assert.equal(manifest.css, 'style.css');
  assert.equal(typeof manifest.author, 'string');
  assert.equal(typeof manifest.homePage, 'string');
  assert.equal(typeof manifest.auto_update, 'boolean');
});
