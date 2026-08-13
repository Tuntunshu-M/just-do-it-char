import { el, field, runAction } from '../dom.js';
import { showManualEventPreview } from '../dialogs/manual-event.js';

export function renderEventView({ body, state, services, saveState }) {
  const doc = body.ownerDocument;
  body.append(el(doc, 'h3', {}, '生成事件'), el(doc, 'p', { class: 'stpd-muted' }, '设置事件想法，生成完成后将在剧本页查看完整策划案。'));
  const idea = el(doc, 'textarea', { 'aria-label': '事件想法', rows: '2', placeholder: '留空则随机生成事件，例如：让 char 策划旅行' });
  const expand = el(doc, 'input', { type: 'checkbox', checked: true });
  const create = el(doc, 'button', { type: 'button' }, '创建事件');
  create.onclick = () => showManualEventPreview(body, { idea: idea.value.trim(), expand: expand.checked, onConfirm: () => runAction(() => services.onManualEvent?.(idea.value.trim(), expand.checked), services.notice) });
  body.append(field(doc, '事件想法', idea), field(doc, '让 AI 扩展', expand), create);
  const notes = el(doc, 'textarea', { 'aria-label': '导演指令', rows: '3', placeholder: '告诉导演长期需要遵守的指令' });
  notes.value = state.directorNotes ?? '';
  notes.onchange = () => { state.directorNotes = notes.value.trim(); saveState(); };
  body.append(field(doc, '导演指令', notes));
}
