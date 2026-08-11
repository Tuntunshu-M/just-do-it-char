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
