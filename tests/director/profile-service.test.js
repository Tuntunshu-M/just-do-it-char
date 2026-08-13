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
  await service.ensureProfile({
    state,
    card: { name: 'A', description: 'gentle', mes_example: 'hello' },
    cast: { mode: 'multi', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }], relations: [{ from: 'a', to: 'b', type: 'rivals' }] },
    entries: [{ bookName: 'B', name: 'Rule', content: 'secret' }],
    connection: { mode: 'independent', endpoint: 'https://api.test', model: 'director' },
  });
  assert.match(JSON.stringify(request.context), /gentle/);
  assert.match(JSON.stringify(request.context), /secret/);
  assert.deepEqual(request.context.cast.members.map((member) => member.id), ['a', 'b']);
  assert.equal(state.personalityProfile.content, 'A concise profile');
});

test('changed sources mark a cached profile stale without calling AI', async () => {
  let calls = 0;
  const service = createProfileService({ client: { requestDirector: async () => { calls += 1; } } });
  const state = { personalityProfile: { status: 'ready', fingerprint: 'old', content: 'cached', citations: [] } };
  const result = await service.ensureProfile({ state, card: { description: 'changed' }, entries: [], connection: {} });
  assert.equal(result.status, 'stale-pending');
  assert.equal(calls, 0);
});

test('ignoring a stale fingerprint suppresses prompts until sources change again', async () => {
  const service = createProfileService({ client: { requestDirector: async () => assert.fail('must not regenerate') } });
  const state = { chatKey: 'c', personalityProfile: { status: 'ready', fingerprint: 'old', content: 'cached', citations: [] } };
  const first = await service.ensureProfile({ state, card: { description: 'changed' }, entries: [], connection: {} });
  service.ignoreProfile({ state });
  const ignored = await service.ensureProfile({ state, card: { description: 'changed' }, entries: [], connection: {} });
  assert.equal(ignored.status, 'ready-ignored');
  assert.equal(ignored.ignoredFingerprint, first.activeFingerprint);
  const changedAgain = await service.ensureProfile({ state, card: { description: 'changed again' }, entries: [], connection: {} });
  assert.equal(changedAgain.status, 'stale-pending');
});

test('missing independent API connection fails with the user-facing reason', async () => {
  const service = createProfileService({ client: { requestDirector: async () => assert.fail('must not call API') } });
  const state = { personalityProfile: { status: 'empty', content: '' } };
  const result = await service.ensureProfile({ state, card: {}, entries: [], connection: { mode: 'main' } });
  assert.equal(result.error, '还没连接副 API');
});

test('failed refresh preserves the old profile and returns to stale confirmation', async () => {
  const service = createProfileService({ client: { requestDirector: async () => { throw new Error('offline'); } } });
  const state = { chatKey: 'c', personalityProfile: { status: 'stale-pending', fingerprint: 'old', content: 'cached', citations: [] } };
  const result = await service.refreshProfile({ state, card: { description: 'changed' }, entries: [], connection: { mode: 'independent', endpoint: 'https://api.test', model: 'director' } });
  assert.equal(result.status, 'stale-pending');
  assert.equal(result.content, 'cached');
  assert.equal(result.error, 'offline');
});

test('first multi switch extracts members and relations once from selected sources', async () => {
  let calls = 0;
  const service = createProfileService({ client: { requestDirector: async () => {
    calls += 1;
    return { content: '群像侧写', members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }, { id: 'd', name: 'D' }], relations: [{ from: 'b', to: 'c', type: '竞争' }], citations: [] };
  } } });
  const state = { chatKey: 'chat', cast: { mode: 'multi', members: [], multiMembers: [] }, personalityProfile: { status: 'empty', content: '' } };
  await service.switchModeAndEnsureProfile({ state, card: { name: 'A' }, cast: state.cast, entries: [{ name: 'B/C/D', content: 'B C D' }], connection: { mode: 'independent', endpoint: 'x', model: 'm' } });
  await service.switchModeAndEnsureProfile({ state, card: { name: 'A' }, cast: state.cast, entries: [], connection: { mode: 'independent', endpoint: 'x', model: 'm' } });
  assert.equal(calls, 1);
  assert.deepEqual(state.cast.multiMembers.map((member) => member.name), ['A', 'B', 'C', 'D']);
  assert.equal(state.cast.relations[0].type, '竞争');
});
