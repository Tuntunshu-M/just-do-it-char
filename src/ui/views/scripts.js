import { el } from '../dom.js';
import { renderScriptList } from '../components/script-list.js';
import { renderScriptToolbar } from '../components/script-toolbar.js';
import { renderScriptDetail } from '../components/script-detail.js';
import { confirmAction } from '../dialogs/confirm.js';
import { runAction } from '../dom.js';

export function renderScriptsView({ body, state, services, rerender }) {
  const doc = body.ownerDocument;
  const scripts = state.scripts ?? [];
  const selected = scripts.find((script) => script.id === state.selectedScriptId)
    ?? scripts.find((script) => script.id === state.activeScriptId)
    ?? [...scripts].sort((a, b) => Date.parse(b.createdAt ?? b.updatedAt ?? '') - Date.parse(a.createdAt ?? a.updatedAt ?? ''))[0]
    ?? null;
  const selectedIds = new Set();
  const actions = el(doc, 'div', { class: 'stpd-script-bulk-actions' });
  const deleteButton = el(doc, 'button', { type: 'button', class: 'stpd-compact', disabled: true }, '删除所选');
  const clearButton = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '清空本聊天');
  deleteButton.onclick = () => runAction(async () => {
    if (!await confirmAction(services, '删除选中的非运行中剧本？运行中和暂停中的剧本会保留。')) return;
    await services.deleteScripts?.([...selectedIds]);
  }, services.notice);
  clearButton.onclick = () => runAction(async () => {
    if (!await confirmAction(services, '清空本聊天的所有非运行中剧本？运行中和暂停中的剧本会保留。')) return;
    await services.clearScripts?.();
  }, services.notice);
  actions.append(deleteButton, clearButton);
  body.append(renderScriptToolbar({ doc, body, script: selected, state, services }), actions);
  const layout = el(doc, 'div', { class: 'stpd-script-layout' });
  layout.append(
    renderScriptList({ doc, state, services, rerender, selectedIds, onToggle: (id, checked) => { if (checked) selectedIds.add(id); else selectedIds.delete(id); deleteButton.disabled = selectedIds.size === 0; } }),
    renderScriptDetail({ doc, script: selected, services }),
  );
  body.append(layout);
}
