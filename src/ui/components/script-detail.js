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
      ['阶段目标：', step.goal], ['核心事件：', step.coreEvent ?? step.activity], ['主动活动：', step.activity],
      ['推进点：', step.advancePoint], ['活跃人物：', step.activeCharacterIds],
      ['角色互动：', step.interaction], ['对 user 的策划：', step.userPlan],
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
    section(doc, '关键冲突', script.conflict),
    section(doc, '高潮', script.climax),
    section(doc, '结局', script.ending),
  );
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
