import { el } from '../dom.js';
import { renderScriptList } from '../components/script-list.js';
import { renderScriptToolbar } from '../components/script-toolbar.js';
import { renderScriptDetail } from '../components/script-detail.js';

export function renderScriptsView({ body, state, services, rerender }) {
  const doc = body.ownerDocument;
  const scripts = state.scripts ?? [];
  const selected = scripts.find((script) => script.id === state.selectedScriptId)
    ?? scripts.find((script) => script.id === state.activeScriptId)
    ?? [...scripts].sort((a, b) => Date.parse(b.createdAt ?? b.updatedAt ?? '') - Date.parse(a.createdAt ?? a.updatedAt ?? ''))[0]
    ?? null;
  body.append(renderScriptToolbar({ doc, body, script: selected, state, services }));
  const layout = el(doc, 'div', { class: 'stpd-script-layout' });
  layout.append(
    renderScriptList({ doc, state, services, rerender }),
    renderScriptDetail({ doc, script: selected, services }),
  );
  body.append(layout);
}
