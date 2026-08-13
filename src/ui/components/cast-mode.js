import { el, runAction } from '../dom.js';

export function renderCastMode({ doc, cast, services }) {
  const control = el(doc, 'div', { class: 'stpd-cast-mode', role: 'group', 'aria-label': '人物模式' });
  for (const [mode, label] of [['single', '单角色'], ['multi', '多角色']]) {
    const button = el(doc, 'button', { type: 'button', class: cast.mode === mode ? 'is-selected' : '', 'aria-pressed': String(cast.mode === mode) }, label);
    button.onclick = () => runAction(() => services.setCastMode?.(mode), services.notice);
    control.append(button);
  }
  return control;
}
