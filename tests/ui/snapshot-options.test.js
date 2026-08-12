import assert from 'node:assert/strict';
import test from 'node:test';

import { applySnapshotMode, customizeSnapshotOption } from '../../src/ui/snapshot-options.js';

test('snapshot modes apply visible checkbox presets', () => {
  const options = { mode: 'custom', eventFramework: false, history: true, personality: true, rules: false, safety: false };

  applySnapshotMode(options, 'adapt');
  assert.deepEqual(options, { mode: 'adapt', eventFramework: true, history: false, personality: false, rules: true, safety: true });

  applySnapshotMode(options, 'clone');
  assert.deepEqual(options, { mode: 'clone', eventFramework: true, history: true, personality: true, rules: true, safety: true });
});

test('manual snapshot option changes switch preset modes to custom', () => {
  const options = { mode: 'clone', eventFramework: true, history: true, personality: true, rules: true, safety: true };

  customizeSnapshotOption(options, 'history', false);

  assert.equal(options.mode, 'custom');
  assert.equal(options.history, false);
});
