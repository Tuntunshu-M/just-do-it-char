import { el, field, runAction } from '../dom.js';
import { showCastCorrectionDialog } from '../dialogs/cast-correction.js';
import { renderCastMode } from '../components/cast-mode.js';
import { renderCastMembers } from '../components/cast-members.js';
import { renderSingleCastSelection } from '../components/single-cast-selection.js';

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

function profileAction(doc, services, label) {
  const action = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, label);
  action.onclick = async () => {
    action.disabled = true;
    action.textContent = '正在生成侧写...';
    await runAction(() => services.refreshPersonalityProfile?.(), services.notice);
    if (action.isConnected !== false) {
      action.disabled = false;
      action.textContent = label;
    }
  };
  return action;
}

export function renderCastView({ body, state, settings, services }) {
  const doc = body.ownerDocument;
  const profile = services.personalityProfile?.(settings.context) ?? { status: 'empty', name: '', content: '', citations: [] };
  body.append(el(doc, 'h3', {}, '人物侧写'), el(doc, 'p', { class: 'stpd-muted' }, state.cast?.mode === 'multi' ? `多人卡：${state.cast?.members?.length ?? 0} 人` : '单角色模式：根据角色卡与世界书整理'));
  body.append(renderCastMode({ doc, cast: state.cast ?? { mode: 'single' }, services }));
  if (state.cast?.mode === 'multi') body.append(renderCastMembers({ doc, body, cast: state.cast, services }));
  else body.append(renderSingleCastSelection({ doc, cast: state.cast ?? { mode: 'single' }, services }));
  if (profile.name) body.append(el(doc, 'h4', {}, profile.name));
  const locked = el(doc, 'input', { type: 'checkbox', checked: state.cast?.locked });
  locked.onchange = () => runAction(() => services.lockCast?.(locked.checked), services.notice);
  body.append(field(doc, '锁定人物识别', locked));
  const correct = el(doc, 'button', { type: 'button' }, '校正人物');
  correct.onclick = () => showCastCorrectionDialog(body, state.cast ?? { members: [] }, (correction) => runAction(() => services.correctCast?.(correction), services.notice));
  body.append(correct);
  if (profile.status === 'stale-pending') {
    body.append(el(doc, 'p', { class: 'stpd-alert' }, '角色资料有改动，要重新生成侧写吗？'));
    const refresh = profileAction(doc, services, '重新生成侧写');
    const ignore = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '暂时不用');
    ignore.onclick = () => runAction(() => services.ignorePersonalityProfile?.(), services.notice);
    body.append(refresh, ignore);
  } else if (profile.status === 'generating') {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '正在生成压缩人物侧写…'));
  } else if (profile.status === 'failed') {
    body.append(el(doc, 'p', { class: 'stpd-alert' }, `人物侧写生成失败：${profile.error || '模型未返回有效结果'}`));
    body.append(profileAction(doc, services, '重新生成侧写'));
  } else if (profile.content) {
    body.append(disclosure(doc, '全部侧写', [profile.content]));
    const citations = (profile.citations ?? []).map((item) => `${item.source}: ${item.excerpt}`);
    if (citations.length) body.append(disclosure(doc, '引用资料', citations, 'stpd-evidence-list'));
    body.append(profileAction(doc, services, '重新生成侧写'));
  } else {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '尚未生成人物侧写。'));
    body.append(profileAction(doc, services, '生成侧写'));
  }
}
