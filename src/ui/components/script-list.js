import { el, runAction } from '../dom.js';

const STATUS_LABELS = {
  draft: '未开演',
  running: '演出中',
  paused: '已暂停',
  stopped: '已停止',
  completed: '已完成',
  failed: '失败',
};

export function renderScriptList({ doc, state, services, rerender }) {
  const list = el(doc, 'aside', { class: 'stpd-script-list', 'aria-label': '剧本记录' });
  list.append(el(doc, 'h4', {}, '剧本记录'));
  const scripts = [...(state.scripts ?? [])].reverse();
  if (!scripts.length) {
    list.append(el(doc, 'p', { class: 'stpd-muted' }, '还没有剧本。'));
    return list;
  }
  for (const script of scripts) {
    const selected = state.selectedScriptId === script.id;
    const button = el(doc, 'button', {
      type: 'button',
      class: `stpd-script-list-item${selected ? ' is-selected' : ''}`,
      'aria-pressed': String(selected),
    });
    button.append(
      el(doc, 'strong', {}, script.title || '未命名剧本'),
      el(doc, 'span', { class: 'stpd-script-status' }, STATUS_LABELS[script.status] ?? script.status ?? '未开演'),
    );
    button.onclick = () => runAction(async () => {
      await services.selectScript?.(script.id);
      rerender?.();
    }, services.notice);
    list.append(button);
  }
  return list;
}
