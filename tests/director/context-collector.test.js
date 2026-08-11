import assert from 'node:assert/strict';
import test from 'node:test';
import { collectDirectorContext } from '../../src/director/context-collector.js';
import { detectGenreHints } from '../../src/director/world-genre.js';

test('collector preserves evidence priority and honors context switches', async () => {
  const adapter = {
    getCharacterData: () => ({ name: 'A', description: 'gentle', personality: 'calm', mes_example: 'Example' }),
    getMessages: () => [{ is_user: true, mes: 'hello' }, { is_user: false, mes: 'hi' }],
    getContext: () => ({ chatMetadata: { proactive_director_notes: 'Never abandon the user' }, worldInfo: 'Haunted hotel' }),
  };
  const context = await collectDirectorContext(adapter, { historySummary: 'stable behavior' }, {
    genre: { mode: 'auto' }, context: { directorNotes: true, card: true, exampleDialogue: false, chatBehavior: true, worldInfo: false, messageLimit: 10 },
  });
  assert.deepEqual(context.personalityEvidence.map((item) => item.source), ['directorNotes', 'card', 'chatBehavior']);
  assert.equal(JSON.stringify(context).includes('Example'), false);
  assert.equal(JSON.stringify(context).includes('Haunted hotel'), false);
});

test('genre detection recognizes infinite-flow and supernatural independently of event direction', () => {
  const hints = detectGenreHints({ description: '无限流副本中遵守规则怪谈' }, []);
  assert.ok(hints.includes('infinite-flow'));
  assert.ok(hints.includes('supernatural'));
});
