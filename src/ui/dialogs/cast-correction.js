import { el, field, lines, selectField } from '../dom.js';

function memberInput(doc, member = {}) {
  const name = el(doc, 'input', { type: 'text', value: member.name ?? '', placeholder: '人物名称' });
  const aliases = el(doc, 'input', { type: 'text', value: (member.aliases ?? []).join(', '), placeholder: '别名' });
  return { name, aliases };
}

export function showCastCorrectionDialog(container, cast, onConfirm) {
  const doc = container.ownerDocument;
  const panel = el(doc, 'section', { class: 'stpd-dialog', role: 'dialog', 'aria-label': '校正人物' });
  panel.append(el(doc, 'h4', {}, '校正人物'));
  let mode = 'replace';
  const controls = el(doc, 'div', { class: 'stpd-dialog-content' });
  const renderControls = () => {
    controls.replaceChildren();
    if (mode === 'replace') {
      const memberSelect = el(doc, 'select', { 'aria-label': '选择人物' });
      for (const member of cast.members ?? []) memberSelect.append(el(doc, 'option', { value: member.id }, member.name));
      const current = () => cast.members?.find((member) => member.id === memberSelect.value) ?? cast.members?.[0] ?? {};
      const inputs = memberInput(doc, current());
      memberSelect.onchange = () => { const next = current(); inputs.name.value = next.name ?? ''; inputs.aliases.value = (next.aliases ?? []).join(', '); };
      controls.append(field(doc, '人物', memberSelect), field(doc, '人物名称', inputs.name), field(doc, '别名', inputs.aliases));
      controls.dataset.submit = 'replace';
      controls.submitValue = () => ({ type: 'replace', member: { ...current(), id: current().id || `manual-${Date.now()}`, name: inputs.name.value.trim(), aliases: lines(inputs.aliases.value) } });
    } else if (mode === 'merge') {
      const checks = [];
      for (const member of cast.members ?? []) { const input = el(doc, 'input', { type: 'checkbox' }); checks.push([member, input]); controls.append(field(doc, member.name, input)); }
      const inputs = memberInput(doc);
      controls.append(field(doc, '人物名称', inputs.name), field(doc, '别名', inputs.aliases));
      controls.submitValue = () => ({ type: 'merge', memberIds: checks.filter(([, input]) => input.checked).map(([member]) => member.id), id: `manual-${Date.now()}`, name: inputs.name.value.trim(), aliases: lines(inputs.aliases.value) });
    } else {
      const memberSelect = el(doc, 'select', { 'aria-label': '选择人物' });
      for (const member of cast.members ?? []) memberSelect.append(el(doc, 'option', { value: member.id }, member.name));
      const names = el(doc, 'textarea', { rows: '3', placeholder: '每行一个人物名称' });
      controls.append(field(doc, '人物', memberSelect), field(doc, '拆分人物', names));
      controls.submitValue = () => ({ type: 'split', memberId: memberSelect.value, members: lines(names.value).map((name, index) => ({ id: `manual-${Date.now()}-${index}`, name, aliases: [], evidence: [] })) });
    }
  };
  panel.append(selectField(doc, '校正方式', mode, [['replace', '修改人物'], ['merge', '合并人物'], ['split', '拆分人物']], (value) => { mode = value; renderControls(); }));
  renderControls();
  panel.append(controls);
  const actions = el(doc, 'div', { class: 'stpd-actions' });
  const cancel = el(doc, 'button', { type: 'button' }, '取消');
  const save = el(doc, 'button', { type: 'button', class: 'stpd-primary' }, '保存校正');
  cancel.onclick = () => panel.remove();
  save.onclick = () => {
    const correction = controls.submitValue();
    const valid = correction?.type === 'replace' ? correction.member.name
      : correction?.type === 'merge' ? correction.name && correction.memberIds.length >= 2
        : correction?.members?.length >= 2;
    if (!valid) return;
    panel.remove(); onConfirm(correction);
  };
  actions.append(cancel, save); panel.append(actions); container.append(panel);
}
