import { el, runAction } from '../dom.js';

function section(doc, title, value) {
  const node = el(doc, 'section', { class: 'stpd-script-section' });
  node.append(el(doc, 'h4', {}, title), el(doc, 'p', {}, value || '未提供'));
  return node;
}

function valueText(value) {
  if (Array.isArray(value)) return value.join('、');
  if (value && typeof value === 'object') return JSON.stringify(value);
  return String(value ?? '');
}

function fieldRow(doc, label, value) {
  if (value == null || value === '' || (Array.isArray(value) && !value.length)) return null;
  const row = el(doc, 'div', { class: 'stpd-script-field' });
  row.append(el(doc, 'strong', {}, label), el(doc, 'span', {}, valueText(value)));
  return row;
}

function appendFields(node, doc, fields) {
  for (const [label, value] of fields) {
    const row = fieldRow(doc, label, value);
    if (row) node.append(row);
  }
}

function stageSection(doc, steps = [], currentStepIndex = 0) {
  const node = el(doc, 'section', { class: 'stpd-script-section' });
  node.append(el(doc, 'h4', {}, '阶段'));
  const list = el(doc, 'ol', { class: 'stpd-script-items stpd-script-stages' });
  steps.forEach((step, index) => {
    const item = el(doc, 'li', { class: `stpd-script-stage stpd-stage-${step.status ?? (index === currentStepIndex ? 'current' : 'pending')}` });
    item.append(el(doc, 'h5', {}, step.title ?? step.name ?? `阶段 ${index + 1}`));
    appendFields(item, doc, [
      ['状态：', step.status ?? (index === currentStepIndex ? 'current' : 'pending')],
      ['阶段目标：', step.goal], ['角色主动活动：', step.activity],
      ['推进点：', step.advancePoint], ['活跃人物：', step.activeCharacterIds],
      ['角色互动：', step.interaction],
      ['拆分步骤：', step.splitSteps ?? step.actions ?? step.substeps],
    ]);
    for (const plan of step.characterPlans ?? step.characterActions ?? []) {
      appendFields(item, doc, [[`${plan.name ?? plan.characterId ?? '角色'}目标：`, plan.goal], [`${plan.name ?? plan.characterId ?? '角色'}行动：`, plan.action]]);
    }
    list.append(item);
  });
  if (!steps.length) list.append(el(doc, 'li', { class: 'stpd-muted' }, '未提供'));
  node.append(list);
  return node;
}

function clueSection(doc, clues = []) {
  const node = el(doc, 'section', { class: 'stpd-script-section' });
  node.append(el(doc, 'h4', {}, '伏笔'));
  const list = el(doc, 'ol', { class: 'stpd-script-items stpd-script-clues' });
  for (const clue of clues) {
    const item = el(doc, 'li', { class: 'stpd-script-clue' });
    const status = clue.status ?? '未注入';
    const content = clue.content ?? clue.surface ?? clue.source ?? '未提供';
    const connectedStepTitle = clue.connectedStepTitle ?? clue.revealStage ?? clue.revealStepId ?? clue.plantStage ?? clue.plantStepId ?? '未连接阶段';
    item.append(el(doc, 'p', { class: 'stpd-script-clue-summary' }, `[${status}]${content}[${connectedStepTitle}]`));
    appendFields(item, doc, [
      ['来源：', clue.source], ['内容：', clue.content], ['表面呈现：', clue.surface],
      ['埋设阶段：', clue.plantStepId ?? clue.plantStage], ['回收阶段：', clue.revealStepId ?? clue.revealStage],
      ['回收方式：', clue.recovery], ['影响：', clue.impact], ['条件：', clue.condition ?? clue.conditionFactId],
      ['成熟度：', clue.maturity], ['阈值：', clue.threshold],
    ]);
    list.append(item);
  }
  if (!clues.length) list.append(el(doc, 'li', { class: 'stpd-muted' }, '未提供'));
  node.append(list);
  return node;
}

const EDITABLE_FIELDS = ['title', 'category', 'premise', 'steps', 'foreshadowing', 'facts', 'revisions'];
const PROTECTED_FIELDS = new Set(['id', 'status', 'currentStepIndex', 'pendingTurn', 'createdAt', 'updatedAt']);

function scriptEditor(doc, script, services) {
  const panel = el(doc, 'section', { class: 'stpd-script-editor' });
  panel.append(el(doc, 'h4', {}, '编辑剧本'));
  const input = (label, value, tag = 'input') => {
    const node = el(doc, tag, { 'aria-label': label, ...(tag === 'textarea' ? { rows: '8' } : { type: 'text' }) });
    node.value = value ?? '';
    panel.append(el(doc, 'label', { class: 'stpd-field' }, label), node);
    return node;
  };
  const title = input('标题', script.title);
  const category = input('分类', script.category);
  const premise = input('完整大纲', script.premise, 'textarea');
  const steps = input('阶段 JSON', JSON.stringify(script.steps ?? [], null, 2), 'textarea');
  const clues = input('伏笔 JSON', JSON.stringify(script.foreshadowing ?? [], null, 2), 'textarea');
  const facts = input('事实 JSON', JSON.stringify(script.facts ?? [], null, 2), 'textarea');
  const revisions = input('修订记录 JSON', JSON.stringify(script.revisions ?? [], null, 2), 'textarea');
  const extras = Object.fromEntries(Object.entries(script).filter(([key]) => !EDITABLE_FIELDS.includes(key) && !PROTECTED_FIELDS.has(key)));
  const extra = input('扩展内容 JSON', JSON.stringify(extras, null, 2), 'textarea');
  const actions = el(doc, 'div', { class: 'stpd-row' });
  const save = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '保存剧本');
  const cancel = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '取消');
  save.onclick = () => runAction(async () => {
    const parsedExtra = JSON.parse(extra.value || '{}');
    if (!parsedExtra || Array.isArray(parsedExtra) || typeof parsedExtra !== 'object') throw new Error('扩展内容必须是 JSON 对象');
    for (const key of PROTECTED_FIELDS) delete parsedExtra[key];
    await services.updateScript?.(script.id, {
      ...parsedExtra,
      title: title.value.trim(), category: category.value.trim(), premise: premise.value,
      steps: JSON.parse(steps.value || '[]'), foreshadowing: JSON.parse(clues.value || '[]'),
      facts: JSON.parse(facts.value || '[]'), revisions: JSON.parse(revisions.value || '[]'),
    });
    panel.remove?.();
  }, services.notice);
  cancel.onclick = () => panel.remove?.();
  actions.append(save, cancel);
  panel.append(actions);
  return panel;
}

export function renderScriptDetail({ doc, script, services }) {
  const detail = el(doc, 'article', { class: 'stpd-script-detail' });
  if (!script) {
    detail.append(el(doc, 'p', { class: 'stpd-muted' }, '选择左侧剧本查看完整策划案。'));
    return detail;
  }
  detail.append(
    el(doc, 'h3', {}, script.title || '未命名剧本'),
    section(doc, '完整大纲', script.premise),
    stageSection(doc, script.steps, script.currentStepIndex),
    clueSection(doc, script.foreshadowing),
  );
  const edit = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '编辑');
  edit.onclick = () => { if (!detail.children?.some((node) => node.className === 'stpd-script-editor')) detail.append(scriptEditor(doc, script, services)); };
  detail.append(edit);
  if (script.revisions?.length) {
    const revisions = el(doc, 'section', { class: 'stpd-script-section stpd-script-revisions' });
    revisions.append(el(doc, 'h4', {}, '修改记录'));
    for (const revision of [...script.revisions].reverse()) {
      const row = el(doc, 'div', { class: 'stpd-revision-row' });
      const summary = el(doc, 'div', { class: 'stpd-revision-summary' });
      appendFields(summary, doc, [['时间：', revision.createdAt], ['原因：', revision.reason], ['修订起点：', revision.currentStepIndex], ['修订大纲：', revision.outline?.premise], ['修订标题：', revision.outline?.title]]);
      row.append(summary);
      const restore = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '恢复');
      restore.onclick = () => runAction(() => services.restoreScriptRevision?.(script.id, revision.id), services.notice);
      row.append(restore);
      revisions.append(row);
    }
    detail.append(revisions);
  }
  return detail;
}
