import { el, field } from '../dom.js';

export function showCastMemberDialog(container, member = {}, onSubmit) {
  const doc = container.ownerDocument;
  const overlay = el(doc, 'div', { class: 'stpd-cast-dialog-overlay', role: 'presentation' });
  const panel = el(doc, 'section', { class: 'stpd-cast-dialog', role: 'dialog', 'aria-modal': 'true', 'aria-label': member.id ? '编辑人物' : '添加人物' });
  const header = el(doc, 'header', { class: 'stpd-cast-dialog-header' });
  header.append(el(doc, 'h4', {}, member.id ? '编辑人物' : '添加人物'));
  const close = el(doc, 'button', { type: 'button', class: 'stpd-cast-dialog-close', 'aria-label': '关闭人物窗口', title: '关闭' }, '×');
  close.onclick = () => overlay.remove();
  header.append(close);
  panel.append(header);
  const inputs = {};
  const fields = [
    ['name', '人物名称'], ['aliases', '别名'], ['personality', '性格'], ['background', '背景'],
    ['relationship', '与 user 的关系'], ['attitude', '对 user 的态度'], ['goal', '目标/秘密/执念'],
    ['speechStyle', '说话风格'], ['activeApproach', '主动推动方式'], ['knowledgeBoundary', '认知边界'],
  ];
  for (const [key, label] of fields) {
    inputs[key] = el(doc, ['name', 'aliases'].includes(key) ? 'input' : 'textarea', { value: key === 'aliases' ? (member.aliases ?? []).join('，') : (member[key] ?? '') });
    inputs[key].value = key === 'aliases' ? (member.aliases ?? []).join('，') : (member[key] ?? '');
    panel.append(field(doc, label, inputs[key]));
  }
  const actions = el(doc, 'div', { class: 'stpd-actions stpd-cast-dialog-actions' });
  const cancel = el(doc, 'button', { type: 'button' }, '取消');
  cancel.onclick = () => overlay.remove();
  const confirm = el(doc, 'button', { type: 'button' }, '保存人物');
  confirm.onclick = () => {
    const value = {
      ...member,
      name: inputs.name.value.trim(),
      aliases: inputs.aliases.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      personality: inputs.personality.value.trim(),
      background: inputs.background.value.trim(),
      relationship: inputs.relationship.value.trim(),
      attitude: inputs.attitude.value.trim(),
      goal: inputs.goal.value.trim(),
      speechStyle: inputs.speechStyle.value.trim(),
      activeApproach: inputs.activeApproach.value.trim(),
      knowledgeBoundary: inputs.knowledgeBoundary.value.trim(),
    };
    if (!value.name) return;
    onSubmit(value);
    overlay.remove();
  };
  actions.append(cancel, confirm);
  panel.append(actions);
  overlay.append(panel);
  container.append(overlay);
}
