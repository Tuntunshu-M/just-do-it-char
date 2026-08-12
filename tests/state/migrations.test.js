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
});
