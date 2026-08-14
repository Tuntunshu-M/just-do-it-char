import { el, runAction } from '../dom.js';
import { showDirectionDialog } from '../dialogs/change-direction.js';

export function renderScriptToolbar({ doc, body, script, state, services }) {
  const toolbar = el(doc, 'div', { class: 'stpd-script-toolbar', role: 'toolbar', 'aria-label': '剧本运行控制' });
  const isActive = state.activeScriptId === script?.id;
  const paused = isActive && script?.status === 'paused';
  const canPerform = Boolean(script && ['draft', 'stopped'].includes(script.status));
  const controls = [
    ['开演', () => services.performScript?.(script.id), !canPerform],
    ['暂停', () => services.pauseScript?.(script.id), !isActive || paused],
    ['继续', () => services.resumeScript?.(script.id), !paused],
    ['改变方向', () => showDirectionDialog(body, script, (value) => runAction(() => services.changeScriptDirection?.(script.id, value), services.notice)), !isActive],
    ['停止', () => services.stopScript?.(script.id), !isActive],
  ];
  for (const [label, action, disabled] of controls) {
    const button = el(doc, 'button', { type: 'button', class: 'stpd-compact', disabled }, label);
    button.onclick = () => runAction(action, services.notice);
    toolbar.append(button);
  }
  return toolbar;
}
