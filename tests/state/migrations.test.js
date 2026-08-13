import assert from 'node:assert/strict';
import test from 'node:test';

import { SCHEMA_VERSION } from '../../src/constants.js';
import { migrateGlobalSettings, migrateState } from '../../src/state/migrations.js';

test('migration upgrades legacy state while preserving unknown fields', () => {
  const migrated = migrateState({
    schemaVersion: 0,
    chatKey: 'legacy',
    customPluginData: { keep: true },
    preference: { userAgency: 20 },
  });

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.equal(migrated.chatKey, 'legacy');
  assert.equal(migrated.preference.userAgency, 20);
  assert.deepEqual(migrated.customPluginData, { keep: true });
  assert.ok(Array.isArray(migrated.foreshadowing));
  assert.deepEqual(migrated.diagnostics, { records: [], lastCheck: null });
  assert.equal(migrated.personalityProfile.status, 'empty');
  assert.deepEqual(migrated.scripts, []);
  assert.equal(migrated.selectedScriptId, null);
  assert.equal(migrated.activeScriptId, null);
});

test('migration rejects state from a newer schema', () => {
  assert.throws(
    () => migrateState({ schemaVersion: SCHEMA_VERSION + 1 }),
    /newer schema/i,
  );
});

test('global migration adds an empty installed-world-book selection', () => {
  const migrated = migrateGlobalSettings({ schemaVersion: 1, context: { worldInfo: true } });

  assert.equal(migrated.schemaVersion, SCHEMA_VERSION);
  assert.deepEqual(migrated.context.worldInfoBooks, {});
  assert.equal(migrated.context.worldInfoSelectionPolicy, 'preserve');
  assert.equal(migrated.defaults.revisionRetention, 3);
});

test('migration converts a legacy active event into one repository script once', () => {
  const legacy = {
    schemaVersion: 2,
    chatKey: 'legacy',
    activeEvent: { id: 'event-1', title: '旧计划', premise: '开端', steps: [{ id: 's1' }], status: 'awaiting-user' },
  };
  const first = migrateState(legacy);
  const second = migrateState(first);
  assert.equal(first.scripts.length, 1);
  assert.equal(second.scripts.length, 1);
  assert.equal(second.activeScriptId, 'event-1');
  assert.equal(second.selectedScriptId, 'event-1');
});
