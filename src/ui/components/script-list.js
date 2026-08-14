import { el, runAction } from '../dom.js';

const STATUS_LABELS = {
  draft: '未开演',
  running: '演出中',
  paused: '已暂停',
  stopped: '已停止',
  completed: '已完成',
  failed: '失败',
};

function formatTimestamp(value) {
  if (!value) return '';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString('zh-CN', { hour12: false });
}

function currentStageSummary(script) {
  if (!['running', 'paused'].includes(script.status)) return '';
  const step = script.steps?.[script.currentStepIndex ?? 0];
  return step?.title ?? step?.name ?? step?.goal ?? step?.description ?? '';
}

export function renderScriptList({ doc, state, services }) {
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
      el(doc, 'time', { class: 'stpd-script-time', datetime: script.updatedAt ?? script.createdAt ?? '' }, formatTimestamp(script.updatedAt ?? script.createdAt)),
    );
    const summary = currentStageSummary(script);
    if (summary) button.append(el(doc, 'span', { class: 'stpd-script-stage-summary' }, summary));
    button.onclick = () => runAction(async () => {
      await services.selectScript?.(script.id);
    }, services.notice);
    list.append(button);
  }
  return list;
}
