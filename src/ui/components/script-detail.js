import { el, runAction } from '../dom.js';

function textOf(value) {
  if (typeof value === 'string') return value;
  return value?.goal ?? value?.description ?? value?.title ?? value?.content ?? value?.surface ?? JSON.stringify(value);
}

function section(doc, title, value) {
  const node = el(doc, 'section', { class: 'stpd-script-section' });
  node.append(el(doc, 'h4', {}, title), el(doc, 'p', {}, value || '未提供'));
  return node;
}

function itemSection(doc, title, values) {
  const node = el(doc, 'section', { class: 'stpd-script-section' });
  node.append(el(doc, 'h4', {}, title));
  const list = el(doc, 'ol', { class: 'stpd-script-items' });
  for (const value of values ?? []) list.append(el(doc, 'li', {}, textOf(value)));
  if (!(values?.length)) list.append(el(doc, 'li', { class: 'stpd-muted' }, '未提供'));
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
    itemSection(doc, '阶段', script.steps),
    itemSection(doc, '伏笔', script.foreshadowing),
    section(doc, '关键冲突', script.conflict),
    section(doc, '高潮', script.climax),
    section(doc, '结局', script.ending),
  );
  if (script.revisions?.length) {
    const revisions = el(doc, 'section', { class: 'stpd-script-section stpd-script-revisions' });
    revisions.append(el(doc, 'h4', {}, '修改记录'));
    for (const revision of [...script.revisions].reverse()) {
      const row = el(doc, 'div', { class: 'stpd-revision-row' });
      row.append(el(doc, 'span', {}, revision.reason || revision.createdAt || '历史版本'));
      const restore = el(doc, 'button', { type: 'button', class: 'stpd-compact' }, '恢复');
      restore.onclick = () => runAction(() => services.restoreScriptRevision?.(script.id, revision.id), services.notice);
      row.append(restore);
      revisions.append(row);
    }
    detail.append(revisions);
  }
  return detail;
}
