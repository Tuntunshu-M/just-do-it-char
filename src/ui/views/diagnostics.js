import { el, runAction } from '../dom.js';

const CHECK_STATUS_LABELS = { pass: '通过', warning: '提醒', fail: '失败' };
const RECORD_STATUS_LABELS = { running: '运行中', success: '成功', failed: '失败', 'not-generated': '未生成' };
const STAGE_LABELS = {
  collecting: '上下文采集', generating: '导演生成', validating: '人格校验', policy: '规则检查',
  injecting: '提示注入', reply: '正文生成', commit: '结果提交',
};
const TRIGGER_LABELS = { manual: '手动', message: '消息', idle: '空闲' };

function displayTime(value) {
  if (!value) return '尚未运行';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toLocaleString('zh-CN', { hour12: false });
}

function summaryRow(doc, label, value) {
  const row = el(doc, 'div', { class: 'stpd-diagnostic-summary-row' });
  row.append(el(doc, 'dt', {}, label), el(doc, 'dd', {}, value));
  return row;
}

export function renderDiagnosticsView({ body, state, services, saveState, rerender }) {
  const doc = body.ownerDocument;
  state.diagnostics ??= { records: [], lastCheck: null };
  state.diagnostics.records ??= [];
  const diagnostics = state.diagnostics;
  const lastCheck = diagnostics.lastCheck;

  body.append(el(doc, 'h3', {}, '当前状态'));
  const summary = el(doc, 'dl', { class: 'stpd-diagnostic-summary' });
  summary.append(
    summaryRow(doc, '生成阶段', STAGE_LABELS[state.generation?.phase] ?? state.generation?.phase ?? state.status ?? '空闲'),
    summaryRow(doc, '上次检查', displayTime(lastCheck?.checkedAt)),
    summaryRow(doc, '最近记录', `${diagnostics.records.length} / 20`),
  );
  const summaryScroll = el(doc, 'div', { class: 'stpd-diagnostic-scroll stpd-diagnostic-summary-scroll', tabindex: '0', 'aria-label': '当前状态' });
  summaryScroll.append(summary);
  body.append(summaryScroll);

  const actions = el(doc, 'div', { class: 'stpd-actions stpd-diagnostic-actions' });
  const run = el(doc, 'button', { type: 'button', class: 'stpd-primary' }, '运行检查');
  run.onclick = () => runAction(async () => {
    run.disabled = true;
    try {
      diagnostics.lastCheck = await services.runDiagnostics();
      await saveState();
      rerender();
    } finally {
      run.disabled = false;
    }
  }, services.notice);
  const copy = el(doc, 'button', { type: 'button' }, '复制诊断报告');
  copy.onclick = () => runAction(() => services.copyDiagnosticReport({ ...diagnostics.lastCheck, records: diagnostics.records }), services.notice);
  const clear = el(doc, 'button', { type: 'button' }, '清空记录');
  clear.onclick = () => runAction(async () => {
    diagnostics.records = [];
    await saveState();
    rerender();
  }, services.notice);
  actions.append(run, copy, clear);
  body.append(actions, el(doc, 'p', { class: 'stpd-muted' }, '运行检查只读取当前配置和宿主能力，不会请求模型或生成事件。'));

  body.append(el(doc, 'h3', {}, '检查结果'));
  const checks = el(doc, 'div', { class: 'stpd-diagnostic-checks' });
  if (!lastCheck?.checks?.length) checks.append(el(doc, 'p', { class: 'stpd-muted' }, '尚无检查结果。'));
  else for (const check of lastCheck.checks) {
    const row = el(doc, 'div', { class: `stpd-diagnostic-check stpd-diagnostic-status-${check.status}` });
    row.append(el(doc, 'strong', {}, check.label), el(doc, 'span', { class: 'stpd-diagnostic-badge' }, CHECK_STATUS_LABELS[check.status] ?? check.status), el(doc, 'p', {}, check.message));
    checks.append(row);
  }
  const checksScroll = el(doc, 'div', { class: 'stpd-diagnostic-scroll stpd-diagnostic-checks-scroll', tabindex: '0', 'aria-label': '检查结果' });
  checksScroll.append(checks);
  body.append(checksScroll, el(doc, 'h3', {}, '最近记录'));

  const records = el(doc, 'div', { class: 'stpd-diagnostic-records' });
  if (!diagnostics.records.length) records.append(el(doc, 'p', { class: 'stpd-muted' }, '当前聊天还没有事件生成记录。'));
  else for (const record of [...diagnostics.records].reverse()) {
    const row = el(doc, 'article', { class: `stpd-diagnostic-record stpd-diagnostic-status-${record.status}` });
    const heading = el(doc, 'div', { class: 'stpd-diagnostic-record-heading' });
    heading.append(
      el(doc, 'strong', {}, `${RECORD_STATUS_LABELS[record.status] ?? record.status} · ${STAGE_LABELS[record.stage] ?? record.stage ?? '未知阶段'}`),
      el(doc, 'span', { class: 'stpd-diagnostic-badge' }, TRIGGER_LABELS[record.trigger] ?? record.trigger ?? '未知触发'),
    );
    row.append(heading, el(doc, 'time', { datetime: record.startedAt ?? '' }, `${displayTime(record.startedAt)} · ${record.durationMs ?? '-'} ms`), el(doc, 'p', {}, record.message || '没有附加信息。'));
    records.append(row);
  }
  body.append(records);
}
