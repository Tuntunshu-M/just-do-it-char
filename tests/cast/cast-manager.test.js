import assert from 'node:assert/strict';
import test from 'node:test';
import {
  addCastMember,
  mapImportedCast,
  mergeDetectedCast,
  removeCastMember,
  setCastMode,
  setLeadMember,
  setSingleSelection,
  updateCastMember,
} from '../../src/cast/cast-manager.js';

test('low confidence detection falls back to single card role', () => {
  const result = mergeDetectedCast({ mode: 'single', locked: false, members: [] }, { confidence: 0.4, members: [{ id: 'a' }] });
  assert.equal(result.mode, 'single');
});

test('locked cast is not overwritten and aliases support import mapping', () => {
  const current = { mode: 'multi', locked: true, members: [{ id: 'a', name: 'Alice', aliases: ['A'] }] };
  assert.deepEqual(mergeDetectedCast(current, { confidence: 1, members: [{ id: 'b' }] }), current);
  assert.deepEqual(mapImportedCast([{ id: 'old', name: 'A' }], current.members), { old: 'a' });
});

test('explicit mode switching preserves single and multi datasets', () => {
  const initial = {
    mode: 'single',
    members: [{ id: 'legacy', name: '旧成员' }],
    singleSelection: { id: 'a', name: '角色 A' },
    multiMembers: [{ id: 'b', name: '角色 B' }],
  };
  const multi = setCastMode(initial, 'multi');
  const back = setCastMode(multi, 'single');
  assert.equal(multi.mode, 'multi');
  assert.deepEqual(multi.members, initial.multiMembers);
  assert.equal(back.mode, 'single');
  assert.deepEqual(back.members, [initial.singleSelection]);
  assert.deepEqual(back.multiMembers, initial.multiMembers);
});

test('multi member CRUD and lead selection never silently change mode', () => {
  let cast = setCastMode({ mode: 'multi', multiMembers: [], members: [] }, 'multi');
  cast = addCastMember(cast, { id: 'b', name: '角色 B' });
  cast = addCastMember(cast, { id: 'c', name: '角色 C' });
  cast = updateCastMember(cast, 'c', { name: '角色 C2', goal: '接近 user' });
  cast = setLeadMember(cast, 'c');
  cast = removeCastMember(cast, 'b');
  assert.equal(cast.mode, 'multi');
  assert.deepEqual(cast.members.map((member) => member.name), ['角色 C2']);
  assert.equal(cast.leadId, 'c');
  cast = setSingleSelection(cast, { id: 'a', name: '角色 A' });
  assert.equal(cast.mode, 'multi');
  assert.equal(cast.singleSelection.name, '角色 A');
});

test('detected cast updates multi data without overriding explicit mode', () => {
  const result = mergeDetectedCast(
    { mode: 'single', members: [{ id: 'a', name: '角色 A' }], singleSelection: { id: 'a', name: '角色 A' }, multiMembers: [] },
    { confidence: 0.9, members: [{ id: 'b', name: '角色 B' }, { id: 'c', name: '角色 C' }] },
  );
  assert.equal(result.mode, 'single');
  assert.deepEqual(result.members.map((member) => member.id), ['a']);
  assert.deepEqual(result.multiMembers.map((member) => member.id), ['b', 'c']);
});
