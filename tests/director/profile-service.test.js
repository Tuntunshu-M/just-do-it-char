import assert from 'node:assert/strict';
import test from 'node:test';
import { createProfileService } from '../../src/director/profile-service.js';

test('profile service sends card description and selected world entries to AI', async () => {
  let request;
  const service = createProfileService({ client: { requestDirector: async (value) => {
    request = value;
    return { content: 'A concise profile', citations: [{ source: 'card:description', excerpt: 'gentle' }] };
  } } });
  const state = { personalityProfile: { status: 'empty', fingerprint: '', content: '', citations: [] } };
  await service.ensureProfile({ state, card: { name: 'A', description: 'gentle', mes_example: 'hello' }, entries: [{ bookName: 'B', name: 'Rule', content: 'secret' }], connection: {} });
  assert.match(JSON.stringify(request.context), /gentle/);
  assert.match(JSON.stringify(request.context), /secret/);
  assert.equal(state.personalityProfile.content, 'A concise profile');
});

test('changed sources mark a cached profile stale without calling AI', async () => {
  let calls = 0;
  const service = createProfileService({ client: { requestDirector: async () => { calls += 1; } } });
  const state = { personalityProfile: { status: 'ready', fingerprint: 'old', content: 'cached', citations: [] } };
  const result = await service.ensureProfile({ state, card: { description: 'changed' }, entries: [], connection: {} });
  assert.equal(result.status, 'stale');
  assert.equal(calls, 0);
});
