import { el, field, selectField } from '../dom.js';

export function renderWorldInfoView({ body, settings, services, saveSettings, rerender }) {
  const doc = body.ownerDocument;
  const enabled = el(doc, 'input', { type: 'checkbox', checked: settings.context.worldInfo });
  enabled.onchange = () => { settings.context.worldInfo = enabled.checked; saveSettings(); rerender(); };
  body.append(field(doc, '读取世界书', enabled));
  if (!settings.context.worldInfo) return;
  body.append(el(doc, 'h4', {}, '世界书条目选择'));
  body.append(selectField(doc, '世界书模式', settings.context.worldInfoMode ?? 'all', [['all', '全部条目'], ['selected', '选择条目']], (value) => { settings.context.worldInfoMode = value; saveSettings(); rerender(); }));
  if (settings.context.worldInfoMode !== 'selected') return;
  const entries = services.worldInfoEntries?.() ?? [];
  if (!entries.length) body.append(el(doc, 'p', { class: 'stpd-muted' }, '当前聊天没有可读取的世界书条目。'));
  for (const entry of entries) {
    const id = entry.id ?? entry.uid ?? entry.name;
    const checkbox = el(doc, 'input', { type: 'checkbox', checked: settings.context.worldInfoEntries.includes(id) });
    checkbox.onchange = () => { settings.context.worldInfoEntries = checkbox.checked ? [...new Set([...settings.context.worldInfoEntries, id])] : settings.context.worldInfoEntries.filter((value) => value !== id); saveSettings(); };
    body.append(field(doc, entry.name || entry.comment || id, checkbox));
  }
}
