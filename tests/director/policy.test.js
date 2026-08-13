import assert from 'node:assert/strict';
import test from 'node:test';
import { evaluatePolicy, normalizeWeights, selectEventCategory } from '../../src/director/policy.js';

test('weights include only independently enabled categories', () => {
  assert.deepEqual(normalizeWeights({ daily: { enabled: true, weight: 30 }, crisis: { enabled: false, weight: 60 }, erotic: { enabled: true, weight: 10 } }), { daily: 0.75, erotic: 0.25 });
});

test('event category selection uses enabled weights and exposes other enabled tones', () => {
  const categories = {
    daily: { enabled: true, weight: 40 }, crisis: { enabled: true, weight: 35 }, erotic: { enabled: false, weight: 25 },
  };
  assert.deepEqual(selectEventCategory(categories, { random: () => 0 }), { mainCategory: 'daily', auxiliaryTones: { crisis: 1 } });
  assert.deepEqual(selectEventCategory(categories, { random: () => 0.99 }), { mainCategory: 'crisis', auxiliaryTones: { daily: 1 } });
  assert.equal(selectEventCategory(categories, { requestedCategory: 'erotic', random: () => 0 }).mainCategory, 'daily');
  assert.equal(selectEventCategory(categories, { requestedCategory: 'crisis', random: () => 0 }).mainCategory, 'crisis');
});

test('disabled category and forbidden consequence are blocked locally', () => {
  const settings = { categories: { crisis: { enabled: false } } };
  assert.equal(evaluatePolicy({ proposal: { category: 'crisis' }, state: {}, settings, userText: '' }).allowed, false);
  const allowedCategory = { categories: { crisis: { enabled: true } } };
  const state = { preference: { consequencePermissions: { death: 'forbidden' } }, sceneSafety: {} };
  assert.equal(evaluatePolicy({ proposal: { category: 'crisis', consequences: ['death'] }, state, settings: allowedCategory, userText: '' }).allowed, false);
});

test('safeword stops event without exposing the matched word', () => {
  const state = { activeEvent: { id: 'e1' }, pendingTransaction: {}, sceneSafety: { cncEnabled: true, safewords: ['red'], hardLimits: [] } };
  const result = evaluatePolicy({ proposal: { category: 'erotic' }, state, settings: { categories: { erotic: { enabled: true } } }, userText: 'RED' });
  assert.equal(result.action, 'stop');
  assert.deepEqual(result.reasons, ['Scene halted']);
  assert.equal(result.reasons.join(' ').includes('red'), false);
  assert.equal(state.activeEvent, null);
  assert.equal(state.pendingTransaction, null);
});

test('all planned major consequences require explicit permissions', () => {
 const consequences=['death','permanentDisability','pregnancy','childbirth','seriousIllness','longDisappearance','permanentBreakup','majorPropertyChange'];
 const state={preference:{consequencePermissions:{}},sceneSafety:{}};
 const settings={categories:{crisis:{enabled:true}},defaults:{consequencePermissions:{}}};
 for(const consequence of consequences){
  const result=evaluatePolicy({proposal:{category:'crisis',consequences:[consequence]},state,settings});
  assert.equal(result.action,'ask',consequence);
 }
});

test('user agency maps to observe, shared, and character-led levels', () => {
 const settings={categories:{daily:{enabled:true}},defaults:{}};
 for(const [value,level] of [[90,'user-led'],[50,'shared'],[10,'character-led']]){
  const result=evaluatePolicy({proposal:{category:'daily'},state:{preference:{userAgency:value},sceneSafety:{}},settings});
  assert.equal(result.userAgencyLevel,level);
 }
});
