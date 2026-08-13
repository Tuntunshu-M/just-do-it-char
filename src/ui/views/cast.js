import { el, field, runAction } from '../dom.js';
import { showCastCorrectionDialog } from '../dialogs/cast-correction.js';

function compactLine(value, limit = 180) {
  const line = String(value ?? '').replace(/\s+/g, ' ').trim();
  return line.length > limit ? `${line.slice(0, limit)}…` : line;
}

function disclosure(doc, label, values, className = '') {
  const details = el(doc, 'details', { class: `stpd-collapsible ${className}`.trim() });
  details.append(el(doc, 'summary', {}, `${label}（${values.length}）`));
  const list = el(doc, 'ul', { class: 'stpd-profile-list' });
  for (const value of values) list.append(el(doc, 'li', {}, value));
  details.append(list);
  return details;
}

export function renderCastView({ body, state, settings, services }) {
  const doc = body.ownerDocument;
  const profile = services.personalityProfile?.(settings.context) ?? { name: '', lines: [], sources: [] };
  body.append(el(doc, 'h3', {}, '人物侧写'), el(doc, 'p', { class: 'stpd-muted' }, state.cast?.mode === 'multi' ? `多人卡：${state.cast?.members?.length ?? 0} 人` : '单角色模式：根据角色卡与世界书整理'));
  if (profile.name) body.append(el(doc, 'h4', {}, profile.name));
  const locked = el(doc, 'input', { type: 'checkbox', checked: state.cast?.locked });
  locked.onchange = () => runAction(() => services.lockCast?.(locked.checked), services.notice);
  body.append(field(doc, '锁定人物识别', locked));
  const correct = el(doc, 'button', { type: 'button' }, '校正人物');
  correct.onclick = () => showCastCorrectionDialog(body, state.cast ?? { members: [] }, (correction) => runAction(() => services.correctCast?.(correction), services.notice));
  body.append(correct);
  if (profile.lines.length) {
    const preview = el(doc, 'ul', { class: 'stpd-profile-list stpd-profile-preview' });
    for (const line of profile.lines.slice(0, 3)) preview.append(el(doc, 'li', {}, compactLine(line)));
    body.append(
      preview,
      disclosure(doc, '全部侧写', profile.lines),
      disclosure(doc, '引用资料', profile.sources, 'stpd-evidence-list'),
    );
  } else body.append(el(doc, 'p', { class: 'stpd-muted' }, '暂无人物资料，请先选择角色或填写世界书条目。'));
}
