function entryUid(entry) {
  return String(entry.id ?? entry.uid ?? entry.name ?? '');
}

export function worldEntryKey(bookName, entry) {
  return `${bookName}::${entryUid(entry)}`;
}

export function setBookSelected(selection, book, checked) {
  if (checked) selection[book.name] = { all: true, entries: book.entries.map((entry) => worldEntryKey(book.name, entry)) };
  else delete selection[book.name];
  return selection;
}

export function setEntrySelected(selection, bookName, entry, checked) {
  const current = selection[bookName] ?? { all: false, entries: [] };
  const selected = new Set(current.entries);
  const key = worldEntryKey(bookName, entry);
  if (checked) selected.add(key);
  else selected.delete(key);
  selection[bookName] = { all: false, entries: [...selected] };
  return selection;
}

export function bookSelectionState(selection, book) {
  const current = selection[book.name];
  if (!current) return { checked: false, indeterminate: false };
  if (current.all) return { checked: true, indeterminate: false };
  const valid = new Set(book.entries.map((entry) => worldEntryKey(book.name, entry)));
  const count = (current.entries ?? []).filter((key) => valid.has(key)).length;
  return {
    checked: count > 0 && count === book.entries.length,
    indeterminate: count > 0 && count < book.entries.length,
  };
}

export function selectedWorldEntries(books, selection) {
  return books.flatMap((book) => {
    const current = selection[book.name];
    if (!current) return [];
    const selected = new Set(current.entries ?? []);
    return book.entries.filter((entry) => current.all || selected.has(worldEntryKey(book.name, entry))).map((entry) => ({
      id: worldEntryKey(book.name, entry),
      uid: entryUid(entry),
      bookName: book.name,
      name: entry.name ?? entry.comment ?? entryUid(entry),
      content: entry.content ?? entry.text ?? '',
    }));
  });
}
