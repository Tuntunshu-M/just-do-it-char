import { el, field, runAction } from '../dom.js';
import { bookSelectionState, setBookSelected, setEntrySelected, worldEntryKey } from '../../world-info/selection.js';

const viewStates = new WeakMap();

function stateFor(settings) {
  if (!viewStates.has(settings)) viewStates.set(settings, { expanded: new Set(), books: new Map(), loading: new Set(), errors: new Map(), search: '', busy: false, scrollTop: 0, body: null });
  return viewStates.get(settings);
}

function entryLabel(entry) {
  return entry.name || entry.comment || entry.keys?.join(', ') || String(entry.uid ?? entry.id ?? '未命名条目');
}

export function renderWorldInfoView({ body, settings, services, saveSettings, rerender }) {
  const doc = body.ownerDocument;
  const ui = stateFor(settings);
  ui.body = body;
  const rerenderInPlace = () => {
    ui.scrollTop = ui.body?.scrollTop ?? ui.scrollTop;
    rerender();
  };
  const restoreScroll = () => { body.scrollTop = ui.scrollTop; };
  const selection = settings.context.worldInfoBooks ??= {};
  const names = services.worldInfoNames?.() ?? [];
  const enabled = el(doc, 'input', { type: 'checkbox', checked: settings.context.worldInfo });
  enabled.onchange = () => { settings.context.worldInfo = enabled.checked; saveSettings(); rerenderInPlace(); };
  body.append(field(doc, '读取世界书', enabled));
  if (!settings.context.worldInfo) { restoreScroll(); return; }

  const loadBook = async (name) => {
    if (ui.books.has(name)) return ui.books.get(name);
    ui.loading.add(name); ui.errors.delete(name); rerenderInPlace();
    try {
      const book = await services.loadWorldInfoBook(name);
      ui.books.set(name, book);
      return book;
    } catch (error) {
      ui.errors.set(name, error?.message || '读取失败');
      throw error;
    } finally {
      ui.loading.delete(name); rerenderInPlace();
    }
  };

  const toolbar = el(doc, 'div', { class: 'stpd-world-toolbar' });
  const search = el(doc, 'input', { type: 'search', value: ui.search, placeholder: '搜索世界书或条目', 'aria-label': '搜索世界书或条目' });
  search.onchange = () => { ui.search = search.value.trim().toLowerCase(); rerenderInPlace(); };
  const selectAll = el(doc, 'button', { type: 'button', disabled: ui.busy }, '全选');
  selectAll.onclick = () => runAction(async () => {
    ui.busy = true; rerenderInPlace();
    try {
      for (const name of names) setBookSelected(selection, await loadBook(name), true);
      await saveSettings();
    } finally { ui.busy = false; rerenderInPlace(); }
  }, services.notice);
  const selectNone = el(doc, 'button', { type: 'button', disabled: ui.busy }, '全不选');
  selectNone.onclick = () => { settings.context.worldInfoBooks = {}; saveSettings(); rerenderInPlace(); };
  toolbar.append(search, selectAll, selectNone);
  body.append(el(doc, 'h4', {}, '世界书条目选择'), toolbar);

  const staleNames = Object.keys(selection).filter((name) => !names.includes(name));
  if (staleNames.length) body.append(el(doc, 'p', { class: 'stpd-alert' }, `有 ${staleNames.length} 本已选择的世界书当前未安装。`));
  if (!names.length) {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '酒馆中没有可读取的世界书。'));
    restoreScroll();
    return;
  }

  const list = el(doc, 'div', { class: 'stpd-world-list' });
  const query = ui.search;
  for (const name of names) {
    const book = ui.books.get(name);
    const matchingEntries = book?.entries.filter((entry) => entryLabel(entry).toLowerCase().includes(query)) ?? [];
    if (query && !name.toLowerCase().includes(query) && !matchingEntries.length) continue;
    const section = el(doc, 'section', { class: 'stpd-world-book' });
    const row = el(doc, 'div', { class: 'stpd-world-book-row' });
    const expand = el(doc, 'button', { type: 'button', class: `stpd-world-expand fa-solid ${ui.expanded.has(name) ? 'fa-chevron-down' : 'fa-chevron-right'}`, 'aria-label': `${ui.expanded.has(name) ? '收起' : '展开'} ${name}` });
    expand.onclick = () => {
      if (ui.expanded.has(name)) { ui.expanded.delete(name); rerenderInPlace(); return; }
      ui.expanded.add(name); rerenderInPlace();
      runAction(() => loadBook(name), services.notice);
    };
    const checkbox = el(doc, 'input', { type: 'checkbox', disabled: ui.loading.has(name), 'aria-label': `选择世界书 ${name}` });
    if (book) {
      const status = bookSelectionState(selection, book);
      checkbox.checked = status.checked;
      checkbox.indeterminate = status.indeterminate;
    } else checkbox.checked = Boolean(selection[name]?.all);
    checkbox.onchange = () => runAction(async () => {
      const loaded = await loadBook(name);
      setBookSelected(selection, loaded, checkbox.checked);
      await saveSettings(); rerenderInPlace();
    }, services.notice);
    row.append(expand, checkbox, el(doc, 'strong', {}, name));
    section.append(row);
    if (ui.loading.has(name)) section.append(el(doc, 'p', { class: 'stpd-world-message' }, '正在读取条目...'));
    if (ui.errors.has(name)) section.append(el(doc, 'p', { class: 'stpd-world-error' }, `读取失败：${ui.errors.get(name)}`));
    if (ui.expanded.has(name) && book) {
      const entries = query && !name.toLowerCase().includes(query) ? matchingEntries : book.entries;
      const entriesNode = el(doc, 'div', { class: 'stpd-world-entries' });
      for (const entry of entries) {
        const key = worldEntryKey(name, entry);
        const current = selection[name];
        const input = el(doc, 'input', { type: 'checkbox', checked: Boolean(current?.all || current?.entries?.includes(key)) });
        input.onchange = () => { setEntrySelected(selection, name, entry, input.checked); saveSettings(); rerenderInPlace(); };
        entriesNode.append(field(doc, entryLabel(entry), input));
      }
      if (!entries.length) entriesNode.append(el(doc, 'p', { class: 'stpd-muted' }, '没有匹配的条目。'));
      section.append(entriesNode);
    }
    list.append(section);
  }
  body.append(list);
  restoreScroll();
}
