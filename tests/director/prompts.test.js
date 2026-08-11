import assert from 'node:assert/strict';
import test from 'node:test';
import { buildDirectorMessages } from '../../src/director/prompts.js';

test('prompt preserves character authority and requests compact JSON only', () => {
  const messages = buildDirectorMessages({ personalityEvidence: [{ source: 'card', value: 'calm' }] }, { type: 'advance' });
  assert.equal(messages[0].role, 'system');
  assert.match(messages[0].content, /不得修改.*人格/);
  assert.match(messages[0].content, /JSON/);
  assert.match(messages[1].content, /personalityEvidence/);
});
