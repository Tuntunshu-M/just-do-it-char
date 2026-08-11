import { el, field } from '../dom.js';

export function showDirectionDialog(container, event, onConfirm) {
  const doc = container.ownerDocument;
  const panel = el(doc, 'section', { class: 'stpd-dialog', role: 'dialog', 'aria-label': '改变方向' });
  const input = el(doc, 'textarea', { rows: '3', placeholder: '输入新的事件方向' });
  input.value = event?.direction ?? '';
  panel.append(el(doc, 'h4', {}, '改变方向'), field(doc, '新方向', input));
  const actions = el(doc, 'div', { class: 'stpd-actions' });
  const cancel = el(doc, 'button', { type: 'button' }, '取消');
  const save = el(doc, 'button', { type: 'button', class: 'stpd-primary' }, '确认改变');
  cancel.onclick = () => panel.remove();
  save.onclick = () => { const value = input.value.trim(); if (value) { panel.remove(); onConfirm(value); } };
  actions.append(cancel, save); panel.append(actions); container.append(panel); input.focus();
}
