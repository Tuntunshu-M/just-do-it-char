import { el } from '../dom.js';

export function showSnapshotImportDialog(container, preview, onConfirm) {
  const doc = container.ownerDocument;
  const panel = el(doc, 'section', { class: 'stpd-dialog', role: 'alertdialog', 'aria-label': '导入预览' });
  panel.append(el(doc, 'h4', {}, '导入预览'));
  const summary = el(doc, 'dl', { class: 'stpd-summary' });
  for (const [label, value] of [
    ['活动事件', preview.summary.event ? '包含' : '不包含'],
    ['伏笔', String(preview.summary.foreshadowing)],
    ['人物', String(preview.summary.cast)],
    ['安全设置', preview.summary.safety ? '包含' : '不包含'],
  ]) summary.append(el(doc, 'dt', {}, label), el(doc, 'dd', {}, value));
  panel.append(summary);
  for (const warning of preview.warnings ?? []) panel.append(el(doc, 'p', { class: 'stpd-alert' }, warning));
  const actions = el(doc, 'div', { class: 'stpd-actions' });
  const cancel = el(doc, 'button', { type: 'button' }, '取消');
  const confirm = el(doc, 'button', { type: 'button', class: 'stpd-primary' }, '确认导入');
  cancel.onclick = () => panel.remove();
  confirm.onclick = () => { panel.remove(); onConfirm(preview); };
  actions.append(cancel, confirm);
  panel.append(actions);
  container.append(panel);
}
