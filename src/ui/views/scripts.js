import { el } from '../dom.js';
import { renderScriptList } from '../components/script-list.js';
import { renderScriptToolbar } from '../components/script-toolbar.js';
import { renderScriptDetail } from '../components/script-detail.js';

export function renderScriptsView({ body, state, services, rerender }) {
  const doc = body.ownerDocument;
  const selected = state.scripts?.find((script) => script.id === state.selectedScriptId) ?? null;
  body.append(renderScriptToolbar({ doc, body, script: selected, state, services }));
  const layout = el(doc, 'div', { class: 'stpd-script-layout' });
  layout.append(
    renderScriptList({ doc, state, services, rerender }),
    renderScriptDetail({ doc, script: selected, services }),
  );
  body.append(layout);
}
