import { el } from '../dom.js';

export function showManualEventPreview(container, { idea, expand, onConfirm }) {
  const doc = container.ownerDocument;
  const random = !idea;
  const panel = el(doc, 'section', { class: 'stpd-dialog', role: 'alertdialog', 'aria-label': '事件预览' });
  panel.append(el(doc, 'h4', {}, '事件预览'), el(doc, 'p', {}, random ? '随机事件' : idea));
  panel.append(el(doc, 'p', { class: 'stpd-muted' }, random ? '导演会根据当前聊天、人物和所选世界书随机创建事件。' : expand ? '导演会补全细节，确认前不会启动事件。' : '导演会严格按当前想法创建事件。'));
  const actions = el(doc, 'div', { class: 'stpd-actions' });
  const cancel = el(doc, 'button', { type: 'button' }, '取消');
  const confirm = el(doc, 'button', { type: 'button', class: 'stpd-primary' }, '确认创建');
  cancel.onclick = () => panel.remove();
  confirm.onclick = () => { panel.remove(); onConfirm(); };
  actions.append(cancel, confirm);
  panel.append(actions);
  container.append(panel);
}
