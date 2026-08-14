import { el, field, runAction } from '../dom.js';
import { showManualEventPreview } from '../dialogs/manual-event.js';

export function renderEventView({ body, state, services, saveState }) {
  const doc = body.ownerDocument;
  body.append(
    el(doc, 'h3', {}, '创建事件'),
    el(doc, 'p', { class: 'stpd-muted' }, '设置事件想法，生成完成后将在剧本页查看完整策划案。'),
  );
  const idea = el(doc, 'textarea', { 'aria-label': '事件想法', rows: '2', placeholder: '留空则随机生成事件，例如：让角色策划旅行' });
  const expand = el(doc, 'input', { type: 'checkbox', checked: true });
  const create = el(doc, 'button', { type: 'button' }, '创建事件');
  const submit = async (text, shouldExpand) => {
    const result = await services.onManualEvent?.(text, shouldExpand);
    if (result?.status === 'planned' && result.scriptId) idea.value = '';
    return result;
  };
  create.onclick = () => {
    const text = idea.value.trim();
    const shouldExpand = expand.checked;
    showManualEventPreview(body, { idea: text, expand: shouldExpand, onConfirm: () => runAction(() => submit(text, shouldExpand), services.notice) });
  };
  body.append(field(doc, '事件想法', idea), field(doc, '允许 AI 扩展', expand), create);
  if (state.generation?.error) {
    const status = el(doc, 'div', { class: 'stpd-generation-status', role: 'status' });
    const retry = el(doc, 'button', { type: 'button' }, '重新尝试');
    retry.onclick = () => runAction(() => submit(idea.value.trim(), expand.checked), services.notice);
    status.append(el(doc, 'p', { class: 'stpd-error' }, state.generation.error), retry);
    body.append(status);
  }
  const notes = el(doc, 'textarea', { 'aria-label': '导演指令', rows: '3', placeholder: '告诉导演长期需要遵守的指令' });
  notes.value = state.directorNotes ?? '';
  notes.onchange = () => { state.directorNotes = notes.value.trim(); saveState(); };
  body.append(field(doc, '导演指令', notes));
}
