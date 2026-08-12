import assert from 'node:assert/strict';
import test from 'node:test';

import {
  bookSelectionState,
  selectedWorldEntries,
  setBookSelected,
  setEntrySelected,
  worldEntryKey,
} from '../../src/world-info/selection.js';

const books = [
  { name: 'Book A', entries: [{ id: '7', name: 'A rule', content: 'alpha' }, { id: '8', name: 'A place', content: 'beta' }] },
  { name: 'Book B', entries: [{ id: '7', name: 'B rule', content: 'gamma' }] },
];

test('world entry keys preserve duplicate entry ids from different books', () => {
  assert.equal(worldEntryKey('Book A', books[0].entries[0]), 'Book A::7');
  assert.equal(worldEntryKey('Book B', books[1].entries[0]), 'Book B::7');
});

test('whole-book selection defaults to every entry and becomes partial after one removal', () => {
  const selection = {};
  setBookSelected(selection, books[0], true);
  assert.deepEqual(bookSelectionState(selection, books[0]), { checked: true, indeterminate: false });

  setEntrySelected(selection, 'Book A', books[0].entries[0], false);

  assert.deepEqual(bookSelectionState(selection, books[0]), { checked: false, indeterminate: true });
  assert.deepEqual(selectedWorldEntries(books, selection), [
    { id: 'Book A::8', uid: '8', bookName: 'Book A', name: 'A place', content: 'beta' },
  ]);
});

test('selected world entries ignore stale keys and keep both books with duplicate ids', () => {
  const selection = {
    'Book A': { all: false, entries: ['Book A::7', 'Book A::missing'] },
    'Book B': { all: true, entries: [] },
    Deleted: { all: true, entries: [] },
  };

  assert.deepEqual(selectedWorldEntries(books, selection), [
    { id: 'Book A::7', uid: '7', bookName: 'Book A', name: 'A rule', content: 'alpha' },
    { id: 'Book B::7', uid: '7', bookName: 'Book B', name: 'B rule', content: 'gamma' },
  ]);
});
