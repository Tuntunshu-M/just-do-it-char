import { el, field, lines, selectField } from '../dom.js';
import { confirmAction } from '../dialogs/confirm.js';

export function renderPreferencesView({ body, settings, state, services, saveSettings, saveState, rerender }) {
  const doc = body.ownerDocument;
  for (const [key, name] of [['daily', '生活日常'], ['crisis', '突发危机'], ['erotic', '色情向']]) {
    const enabled = el(doc, 'input', { type: 'checkbox', checked: settings.categories[key].enabled }); enabled.onchange = () => { settings.categories[key].enabled = enabled.checked; saveSettings(); };
    const weight = el(doc, 'input', { type: 'range', min: '0', max: '100', value: String(settings.categories[key].weight) }); weight.onchange = () => { settings.categories[key].weight = Number(weight.value); saveSettings(); };
    body.append(field(doc, name, enabled), field(doc, `${name}占比`, weight));
  }
  const agency = el(doc, 'input', { type: 'range', min: '0', max: '100', value: String(state.preference.userAgency) }); agency.onchange = () => { state.preference.userAgency = Number(agency.value); saveState(); };
  body.append(field(doc, '用户意愿优先', agency));
  body.append(selectField(doc, '题材', settings.genre.mode, [['auto', '自动'], ['reality', '现实'], ['fantasy', '奇幻'], ['sci-fi', '科幻'], ['infinite-flow', '无限流'], ['supernatural', '鬼怪灵异'], ['apocalypse', '末日'], ['custom', '自定义']], (value) => { settings.genre.mode = value; saveSettings(); rerender(); }));
  if (settings.genre.mode === 'custom') { const custom = el(doc, 'input', { type: 'text', value: settings.genre.custom ?? '', placeholder: '输入题材' }); custom.onchange = () => { settings.genre.custom = custom.value.trim(); saveSettings(); }; body.append(field(doc, '自定义题材', custom)); }
  body.append(selectField(doc, '触发方式', settings.trigger.mode, [['hybrid', '智能混合'], ['fixed', '固定回合'], ['every', '每回合']], (value) => { settings.trigger.mode = value; saveSettings(); rerender(); }));
  const turns = el(doc, 'input', { type: 'number', min: '1', max: '100', value: String(settings.trigger.fixedTurns ?? 4) }); turns.onchange = () => { settings.trigger.fixedTurns = Number(turns.value) || 4; saveSettings(); }; body.append(field(doc, '固定回合数', turns));
  body.append(el(doc, 'h4', {}, '重大后果'));
  for (const [key, label] of [['death', '死亡'], ['permanentDisability', '永久伤残'], ['pregnancy', '怀孕'], ['childbirth', '生育'], ['seriousIllness', '重大疾病'], ['longDisappearance', '长期失踪'], ['permanentBreakup', '永久关系破裂'], ['majorPropertyChange', '巨额财产变化']]) {
    const permission = state.preference.consequencePermissions[key] ?? settings.defaults.consequencePermissions[key] ?? 'ask';
    body.append(selectField(doc, label, permission, [['forbidden', '禁止'], ['ask', '先询问'], ['authorized', '允许']], (value) => { state.preference.consequencePermissions[key] = value; saveState(); }));
  }
  const safewords = el(doc, 'textarea', { rows: '2', placeholder: '支持中文逗号、英文逗号或换行分隔' }); safewords.value = state.sceneSafety.safewords.join(', ');
  safewords.onchange = () => { state.sceneSafety.safewords = lines(safewords.value); if (!state.sceneSafety.safewords.length) state.sceneSafety.cncEnabled = false; saveState(); rerender(); };
  const hardLimits = el(doc, 'textarea', { rows: '2', placeholder: '支持中文逗号、英文逗号或换行分隔' }); hardLimits.value = state.sceneSafety.hardLimits.join(', '); hardLimits.onchange = () => { state.sceneSafety.hardLimits = lines(hardLimits.value); saveState(); };
  body.append(field(doc, '安全词', safewords), field(doc, '硬禁区', hardLimits));
  const cnc = el(doc, 'input', { type: 'checkbox', checked: state.sceneSafety.cncEnabled });
  cnc.onchange = async () => { if (!cnc.checked) { state.sceneSafety.cncEnabled = false; saveState(); return; } if (!state.sceneSafety.safewords.length) { cnc.checked = false; services.notice?.('请先填写安全词。'); return; } const accepted = await confirmAction(services, '启用高风险模式后，导演只会在当前聊天授权范围内解释角色内口头反抗；安全词和硬禁区始终有效。'); if (accepted) { state.sceneSafety.cncEnabled = true; saveState(); } else cnc.checked = false; };
  body.append(field(doc, '高风险模式（色情向）', cnc));
  const idle = el(doc, 'input', { type: 'checkbox', checked: settings.trigger.idleEnabled, disabled: true });
  const idleMinutes = el(doc, 'input', { type: 'number', min: '1', max: '1440', value: String(settings.trigger.idleMinutes ?? 30), disabled: true });
  const windows = el(doc, 'input', { type: 'text', value: (settings.trigger.allowedWindows ?? []).map((item) => item.join('-')).join(', '), placeholder: '09:00-23:00', disabled: true });
  body.append(field(doc, '启用空闲触发（还没做）', idle), field(doc, '空闲分钟', idleMinutes), field(doc, '允许时段', windows));
}
