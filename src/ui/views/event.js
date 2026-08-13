import { el, field, runAction } from '../dom.js';
import { showManualEventPreview } from '../dialogs/manual-event.js';
import { showDirectionDialog } from '../dialogs/change-direction.js';

function list(doc, values, className = '') {
  const node = el(doc, 'ul', { class: `stpd-event-list ${className}`.trim() });
  for (const value of values ?? []) {
    const text = typeof value === 'string' ? value : (value.text ?? value.content ?? value.title ?? JSON.stringify(value));
    node.append(el(doc, 'li', {}, text));
  }
  return node;
}

function outline(doc, event, services, body) {
  const plan = el(doc, 'section', { class: 'stpd-event-outline' });
  plan.append(el(doc, 'h4', {}, '剧情大纲'), el(doc, 'p', {}, event.premise ?? ''));
  const steps = (event.steps ?? []).map((step, index) => {
    const state = step.status === 'completed' ? '已完成' : step.status === 'current' ? '当前' : '待推进';
    return `${index + 1}. [${state}] ${step.goal ?? step.description ?? step.title ?? ''}`;
  });
  plan.append(el(doc, 'h4', {}, '拆分步骤'), list(doc, steps));
  if (event.foreshadowing?.length) plan.append(el(doc, 'h4', {}, '伏笔'), list(doc, event.foreshadowing));
  if (event.revisions?.length) {
    const details = el(doc, 'details', { class: 'stpd-collapsible stpd-event-revisions' });
    details.append(el(doc, 'summary', {}, `历史大纲（${event.revisions.length}）`));
    for (const revision of [...event.revisions].reverse()) {
      const row = el(doc, 'div', { class: 'stpd-revision-row' });
      row.append(el(doc, 'span', {}, revision.reason || revision.createdAt || '历史版本'));
      const restore = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '恢复');
      restore.onclick = () => runAction(() => services.restoreRevision?.(revision.id), services.notice);
      row.append(restore); details.append(row);
    }
    plan.append(details);
  }
  return plan;
}

export function renderEventView({ body, state, services, saveState }) {
  const doc = body.ownerDocument;
  const activeEvent = state.activeEvent;
  body.append(el(doc, 'h3', {}, activeEvent?.title ?? '暂无活动事件'), el(doc, 'p', { class: 'stpd-muted' }, activeEvent?.premise ?? '导演会在合适时机准备事件大纲。'));
  const idea = el(doc, 'textarea', { 'aria-label': '事件想法', rows: '2', placeholder: '留空则随机生成事件，例如：让 char 策划旅行' });
  const expand = el(doc, 'input', { type: 'checkbox', checked: true });
  const create = el(doc, 'button', { type: 'button' }, '创建事件');
  create.onclick = () => showManualEventPreview(body, { idea: idea.value.trim(), expand: expand.checked, onConfirm: () => runAction(() => services.onManualEvent?.(idea.value.trim(), expand.checked), services.notice) });
  body.append(field(doc, '事件想法', idea), field(doc, '让 AI 扩展', expand), create);
  if (activeEvent) {
    body.append(outline(doc, activeEvent, services, body));
    const actions = el(doc, 'div', { class: 'stpd-actions' });
    const paused = state.status === 'paused';
    const pause = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, paused ? '恢复事件' : '暂停事件');
    pause.onclick = () => runAction(() => paused ? services.resumeEvent?.() : services.pauseEvent?.(), services.notice);
    const reroll = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '重新生成');
    reroll.onclick = () => runAction(() => services.rerollEvent?.(), services.notice);
    const direction = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '编辑大纲');
    direction.onclick = () => showDirectionDialog(body, activeEvent, (value) => runAction(() => services.changeDirection?.(value), services.notice));
    actions.append(pause, reroll, direction); body.append(actions);
  }
  const notes = el(doc, 'textarea', { 'aria-label': '导演指令', rows: '3', placeholder: '告诉导演长期需要遵守的指令' });
  notes.value = state.directorNotes ?? '';
  notes.onchange = () => { state.directorNotes = notes.value.trim(); saveState(); };
  body.append(field(doc, '导演指令', notes));
}
