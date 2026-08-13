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
  const profile = services.personalityProfile?.(settings.context) ?? { status: 'empty', name: '', content: '', citations: [] };
  body.append(el(doc, 'h3', {}, '人物侧写'), el(doc, 'p', { class: 'stpd-muted' }, state.cast?.mode === 'multi' ? `多人卡：${state.cast?.members?.length ?? 0} 人` : '单角色模式：根据角色卡与世界书整理'));
  if (profile.name) body.append(el(doc, 'h4', {}, profile.name));
  const locked = el(doc, 'input', { type: 'checkbox', checked: state.cast?.locked });
  locked.onchange = () => runAction(() => services.lockCast?.(locked.checked), services.notice);
  body.append(field(doc, '锁定人物识别', locked));
  const correct = el(doc, 'button', { type: 'button' }, '校正人物');
  correct.onclick = () => showCastCorrectionDialog(body, state.cast ?? { members: [] }, (correction) => runAction(() => services.correctCast?.(correction), services.notice));
  body.append(correct);
  if (profile.status === 'stale') {
    body.append(el(doc, 'p', { class: 'stpd-alert' }, '角色资料已变化，人物侧写需要刷新。'));
    const refresh = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '刷新人物侧写');
    refresh.onclick = () => runAction(() => services.refreshPersonalityProfile?.(), services.notice);
    body.append(refresh);
  } else if (profile.status === 'generating') {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '正在生成压缩人物侧写…'));
  } else if (profile.status === 'failed') {
    body.append(el(doc, 'p', { class: 'stpd-alert' }, `人物侧写生成失败：${profile.error || '模型未返回有效结果'}`));
    const refresh = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '重新生成侧写');
    refresh.onclick = () => runAction(() => services.refreshPersonalityProfile?.(), services.notice);
    body.append(refresh);
  } else if (profile.content) {
    body.append(disclosure(doc, '全部侧写', [profile.content]));
    const citations = (profile.citations ?? []).map((item) => `${item.source}: ${item.excerpt}`);
    if (citations.length) body.append(disclosure(doc, '引用资料', citations, 'stpd-evidence-list'));
  } else body.append(el(doc, 'p', { class: 'stpd-muted' }, '正在准备人物侧写。'));
}
