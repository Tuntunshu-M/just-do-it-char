import { el, field } from '../dom.js';
import { showCastCorrectionDialog } from '../dialogs/cast-correction.js';

export function renderCastView({ body, state, settings, services }) {
  const doc = body.ownerDocument;
  const profile = services.personalityProfile?.(settings.context) ?? { name: '', lines: [], sources: [] };
  body.append(el(doc, 'h3', {}, '人物侧写'), el(doc, 'p', { class: 'stpd-muted' }, state.cast?.mode === 'multi' ? `多人卡：${state.cast?.members?.length ?? 0} 人` : '单角色模式：根据角色卡与世界书整理'));
  if (profile.name) body.append(el(doc, 'h4', {}, profile.name));
  const locked = el(doc, 'input', { type: 'checkbox', checked: state.cast?.locked });
  locked.onchange = () => services.lockCast?.(locked.checked);
  body.append(field(doc, '锁定人物识别', locked));
  const correct = el(doc, 'button', { type: 'button' }, '校正人物');
  correct.onclick = () => showCastCorrectionDialog(body, state.cast ?? { members: [] }, (correction) => services.correctCast?.(correction));
  body.append(correct);
  if (profile.lines.length) {
    const list = el(doc, 'ul', { class: 'stpd-profile-list' });
    for (const line of profile.lines) list.append(el(doc, 'li', {}, line));
    body.append(list, el(doc, 'p', { class: 'stpd-muted' }, `已纳入 ${profile.sources.length} 项人物证据`));
  } else body.append(el(doc, 'p', { class: 'stpd-muted' }, '暂无人物资料，请先选择角色或填写世界书条目。'));
}
