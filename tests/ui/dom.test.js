import assert from 'node:assert/strict';
import test from 'node:test';

import { lines } from '../../src/ui/dom.js';

test('safety list parser accepts Chinese commas, English commas, and newlines', () => {
  assert.deepEqual(lines('red， yellow,green\r\n blue\n\n'), ['red', 'yellow', 'green', 'blue']);
});
