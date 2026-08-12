import { el, field, runAction } from '../dom.js';
import { showManualEventPreview } from '../dialogs/manual-event.js';
import { showDirectionDialog } from '../dialogs/change-direction.js';

export function renderEventView({ body, state, services, saveState }) {
  const doc = body.ownerDocument;
  body.append(el(doc, 'h3', {}, state.activeEvent?.title ?? '暂无活动事件'), el(doc, 'p', { class: 'stpd-muted' }, state.activeEvent?.premise ?? '导演将在合适时机创建事件。'));
  const idea = el(doc, 'textarea', { 'aria-label': '事件想法', rows: '3', placeholder: '输入事件想法，例如：让 char 策划旅行' });
  const expand = el(doc, 'input', { type: 'checkbox', checked: true });
  const create = el(doc, 'button', { type: 'button' }, '创建事件');
  create.onclick = () => {
    const value = idea.value.trim();
    showManualEventPreview(body, { idea: value, expand: expand.checked, onConfirm: () => runAction(() => services.onManualEvent?.(value, expand.checked), services.notice) });
  };
  body.append(field(doc, '事件想法', idea), field(doc, '让 AI 扩展', expand), create);
  if (state.activeEvent) {
    const actions = el(doc, 'div', { class: 'stpd-actions' });
    const paused = state.status === 'paused';
    const pause = el(doc, 'button', { type: 'button' }, paused ? '恢复事件' : '暂停事件');
    pause.onclick = () => runAction(() => paused ? services.resumeEvent?.() : services.pauseEvent?.(), services.notice);
    const reroll = el(doc, 'button', { type: 'button' }, '重新抽取');
    reroll.onclick = () => runAction(() => services.rerollEvent?.(), services.notice);
    const direction = el(doc, 'button', { type: 'button' }, '改变方向');
    direction.onclick = () => showDirectionDialog(body, state.activeEvent, (value) => runAction(() => services.changeDirection?.(value), services.notice));
    actions.append(pause, reroll, direction); body.append(actions);
  }
  const notes = el(doc, 'textarea', { 'aria-label': '导演指令', rows: '4', placeholder: '告诉导演本聊天要遵守的长期指令' });
  notes.value = state.directorNotes ?? '';
  notes.onchange = () => { state.directorNotes = notes.value.trim(); saveState(); };
  body.append(field(doc, '导演指令', notes));
}
