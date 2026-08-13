import assert from 'node:assert/strict';
import test from 'node:test';
import { applyWorldSelectionPolicy } from '../../src/world-info/policy.js';

test('clear policy only clears plugin selection on an actual chat change', () => {
  const settings = { context: { worldInfoSelectionPolicy: 'clear-on-chat-change', worldInfoBooks: { Lore: { all: true } } } };
  assert.equal(applyWorldSelectionPolicy(settings, null, 'a'), false);
  assert.ok(settings.context.worldInfoBooks.Lore);
  assert.equal(applyWorldSelectionPolicy(settings, 'a', 'a'), false);
  assert.equal(applyWorldSelectionPolicy(settings, 'a', 'b'), true);
  assert.deepEqual(settings.context.worldInfoBooks, {});
});

test('preserve policy retains plugin selection across chats', () => {
  const settings = { context: { worldInfoSelectionPolicy: 'preserve', worldInfoBooks: { Lore: { all: true } } } };
  assert.equal(applyWorldSelectionPolicy(settings, 'a', 'b'), false);
  assert.ok(settings.context.worldInfoBooks.Lore);
});
