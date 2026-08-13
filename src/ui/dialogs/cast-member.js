import { el, field } from '../dom.js';

export function showCastMemberDialog(container, member = {}, onSubmit) {
  const doc = container.ownerDocument;
  const panel = el(doc, 'section', { class: 'stpd-inline-dialog' });
  const inputs = {};
  for (const [key, label] of [['name', '人物名称'], ['aliases', '别名'], ['relationship', '与 user 的关系'], ['goal', '目标/秘密/执念'], ['knowledgeBoundary', '认知边界']]) {
    inputs[key] = el(doc, key === 'goal' || key === 'knowledgeBoundary' ? 'textarea' : 'input', { value: key === 'aliases' ? (member.aliases ?? []).join('，') : (member[key] ?? '') });
    inputs[key].value = key === 'aliases' ? (member.aliases ?? []).join('，') : (member[key] ?? '');
    panel.append(field(doc, label, inputs[key]));
  }
  const confirm = el(doc, 'button', { type: 'button' }, '保存人物');
  confirm.onclick = () => {
    const value = {
      ...member,
      name: inputs.name.value.trim(),
      aliases: inputs.aliases.value.split(/[,，]/).map((item) => item.trim()).filter(Boolean),
      relationship: inputs.relationship.value.trim(),
      goal: inputs.goal.value.trim(),
      knowledgeBoundary: inputs.knowledgeBoundary.value.trim(),
    };
    if (!value.name) return;
    onSubmit(value);
    panel.remove();
  };
  panel.append(confirm);
  container.append(panel);
}
