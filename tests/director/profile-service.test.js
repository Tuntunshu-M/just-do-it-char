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
    profileGuidance: { gemini: true, claude: false },
    connection: { mode: 'independent', endpoint: 'https://api.test', model: 'director' },
  });
  assert.match(JSON.stringify(request.context), /gentle/);
  assert.match(JSON.stringify(request.context), /secret/);
  assert.deepEqual(request.context.sourceAuthority, ['worldInfo', 'card', 'context']);
  assert.deepEqual(request.context.cast.members.map((member) => member.id), ['a', 'b']);
  assert.deepEqual(request.intent.profileGuidance, ['gemini']);
  assert.equal(state.personalityProfile.content, 'A concise profile');
});

test('changing only profile guidance marks an existing profile stale', async () => {
  const service = createProfileService({ client: { requestDirector: async () => ({ content: 'profile', citations: [] }) } });
  const state = { chatKey: 'chat', cast: { mode: 'multi', members: [] }, personalityProfile: { status: 'empty', fingerprint: '', content: '' } };
  const base = {
    state,
    card: { name: 'A', description: 'steady' },
    cast: state.cast,
    entries: [],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  };

  await service.refreshProfile({ ...base, profileGuidance: { gemini: false, claude: false } });
  const originalFingerprint = state.personalityProfile.fingerprint;
  const result = await service.ensureProfile({ ...base, profileGuidance: { gemini: false, claude: true } });

  assert.equal(result.status, 'stale-pending');
  assert.notEqual(result.activeFingerprint, originalFingerprint);
});

test('single profile extraction keeps every evidenced candidate available for user selection', async () => {
  const service = createProfileService({ client: { requestDirector: async () => ({
    content: '候选人物侧写',
    members: [{ id: 'a', name: 'A' }, { id: 'b', name: 'B' }, { id: 'c', name: 'C' }],
    relations: [],
    citations: [{ source: 'worldInfo:人物', excerpt: 'A、B、C' }],
  }) } });
  const state = {
    chatKey: 'chat',
    cast: { mode: 'single', members: [], multiMembers: [], singleSelection: null },
    personalityProfile: { status: 'empty', content: '' },
  };

  await service.refreshProfile({
    state,
    card: { name: '多人卡' },
    cast: state.cast,
    entries: [{ name: '人物', content: 'A、B、C' }],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  });

  assert.deepEqual(state.cast.multiMembers.map((member) => member.name), ['A', 'B', 'C']);
  assert.deepEqual(state.cast.members, []);
  assert.equal(state.cast.singleSelection, null);
  assert.equal(state.cast.candidateProfileInitialized, true);
});

test('single profile refresh preserves existing candidates omitted by a partial extraction', async () => {
  const service = createProfileService({ client: { requestDirector: async () => ({
    content: 'refreshed candidate profile',
    members: [
      { id: 'a', name: 'A', personality: 'updated' },
      { id: 'c-new', name: 'C', personality: 'discovered again' },
    ],
    relations: [],
    citations: [],
  }) } });
  const state = {
    chatKey: 'chat',
    cast: {
      mode: 'single',
      members: [],
      multiMembers: [
        { id: 'a', name: 'A', personality: 'old' },
        { id: 'b', name: 'B', personality: 'keep me' },
        { id: 'c', name: 'C', personality: 'old C' },
      ],
      singleSelection: { id: 'a', name: 'A' },
      candidateProfileInitialized: true,
    },
    personalityProfile: { status: 'ready', content: 'old profile' },
  };

  await service.refreshProfile({
    state,
    card: { name: 'Group card' },
    cast: state.cast,
    entries: [],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  });

  assert.deepEqual(state.cast.multiMembers.map((member) => member.name), ['A', 'B', 'C']);
  assert.equal(state.cast.multiMembers[0].personality, 'updated');
  assert.equal(state.cast.multiMembers[1].personality, 'keep me');
  assert.equal(state.cast.multiMembers[2].personality, 'discovered again');
  assert.equal(state.cast.multiMembers[2].id, 'c');
  assert.equal(state.cast.singleSelection.id, 'a');
});

test('single mode refreshes a legacy ready profile once when candidates were never extracted', async () => {
  let calls = 0;
  const service = createProfileService({ client: { requestDirector: async () => {
    calls += 1;
    return { content: 'candidate profile', citations: [], members: [{ id: 'a', name: 'A' }] };
  } } });
  const state = {
    chatKey: 'chat',
    cast: { mode: 'single', members: [], multiMembers: [], singleSelection: null },
    personalityProfile: { status: 'ready', content: 'legacy profile', fingerprint: '' },
  };
  const options = {
    state,
    card: { name: 'Group card' },
    cast: state.cast,
    entries: [],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  };

  await service.ensureProfile(options);
  await service.ensureProfile(options);

  assert.equal(calls, 1);
  assert.equal(state.cast.candidateProfileInitialized, true);
  assert.deepEqual(state.cast.multiMembers.map((member) => member.name), ['A']);
  assert.equal(state.cast.singleSelection, null);
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

test('multi initialization retries an invalid legacy state with no members or profile', async () => {
  let calls = 0;
  const service = createProfileService({ client: { requestDirector: async () => {
    calls += 1;
    return { content: 'group profile', members: [{ id: 'a', name: 'A' }], relations: [], citations: [] };
  } } });
  const state = {
    chatKey: 'chat',
    cast: { mode: 'multi', members: [], multiMembers: [], multiProfileInitialized: true },
    personalityProfile: { status: 'empty', content: '' },
  };

  await service.switchModeAndEnsureProfile({
    state,
    card: { name: 'A' },
    cast: state.cast,
    entries: [{ name: 'B', content: 'B' }],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  });

  assert.equal(calls, 1);
  assert.equal(state.cast.multiProfileInitialized, true);
  assert.deepEqual(state.cast.multiMembers.map((member) => member.name), ['A']);
  assert.equal(state.personalityProfile.content, 'group profile');
});

test('empty multi extraction does not mark initialization complete', async () => {
  const service = createProfileService({ client: { requestDirector: async () => ({ content: '', members: [], relations: [], citations: [] }) } });
  const state = {
    chatKey: 'chat',
    cast: { mode: 'multi', members: [], multiMembers: [], multiProfileInitialized: false },
    personalityProfile: { status: 'empty', content: '' },
  };

  await service.switchModeAndEnsureProfile({
    state,
    card: { name: 'A' },
    cast: state.cast,
    entries: [],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  });

  assert.equal(state.cast.multiProfileInitialized, false);
  assert.equal(state.cast.multiMembers.length, 0);
});

test('concurrent first multi switches share one request', async () => {
  let calls = 0; let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const service = createProfileService({ client: { requestDirector: async () => { calls += 1; await pending; return { content: '群像', members: [] }; } } });
  const state = { chatKey: 'chat', cast: { mode: 'multi', members: [], multiMembers: [] }, personalityProfile: { status: 'empty', content: '' } };
  const options = { state, card: { name: 'A' }, cast: state.cast, entries: [], connection: { mode: 'independent', endpoint: 'x', model: 'm' } };
  const first = service.switchModeAndEnsureProfile(options);
  const second = service.switchModeAndEnsureProfile(options);
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(calls, 1);
  release();
  await Promise.all([first, second]);
});

test('profile generation publishes generating state before waiting for the secondary API', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  const published = [];
  const service = createProfileService({
    client: { requestDirector: async () => { await pending; return { content: 'ready', citations: [] }; } },
    onStatus: async (state) => { published.push({ ...state.personalityProfile }); },
  });
  const state = { chatKey: 'chat', cast: { mode: 'single', members: [] }, personalityProfile: { status: 'empty', content: '' } };

  const request = service.refreshProfile({
    state,
    card: { name: 'A' },
    cast: state.cast,
    entries: [],
    connection: { mode: 'independent', endpoint: 'x', model: 'm' },
  });

  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(published[0]?.status, 'generating');
  release();
  await request;
  assert.equal(published.at(-1)?.status, 'ready');
});

test('late profile response from an old chat is ignored', async () => {
  let release;
  const pending = new Promise((resolve) => { release = resolve; });
  let currentChatKey = 'old';
  const service = createProfileService({
    client: { requestDirector: async () => { await pending; return { content: 'late profile', members: [{ id: 'late', name: 'Late' }] }; } },
    getCurrentChatKey: () => currentChatKey,
  });
  const state = { chatKey: 'old', cast: { mode: 'multi', members: [], multiMembers: [] }, personalityProfile: { status: 'empty', content: '' } };
  const request = service.switchModeAndEnsureProfile({ state, card: {}, cast: state.cast, entries: [], connection: { mode: 'independent', endpoint: 'x', model: 'm' } });
  currentChatKey = 'new';
  release();
  await request;
  assert.notEqual(state.personalityProfile.content, 'late profile');
  assert.deepEqual(state.cast.multiMembers, []);
});
