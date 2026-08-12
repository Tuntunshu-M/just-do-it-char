import { el, field, runAction, selectField } from '../dom.js';
import { applySnapshotMode, customizeSnapshotOption } from '../snapshot-options.js';

export function renderSnapshotsView({ body, options, services, rerender }) {
  const doc = body.ownerDocument;
  body.append(el(doc, 'p', { class: 'stpd-muted' }, '选择要迁移的内容；副本不包含 API Key、授权或高风险开关状态。'));
  body.append(selectField(doc, '迁移模式', options.mode ?? 'custom', [['adapt', '适配新角色'], ['clone', '完整克隆'], ['custom', '自定义迁移']], (value) => { applySnapshotMode(options, value); rerender(); }));
  for (const [key, label] of [['eventFramework', '事件框架'], ['history', '角色专属历史'], ['personality', '原人格推断'], ['rules', '规则账本'], ['safety', '安全词与硬禁区']]) { const checkbox = el(doc, 'input', { type: 'checkbox', checked: options[key] }); checkbox.onchange = () => { customizeSnapshotOption(options, key, checkbox.checked); rerender(); }; body.append(field(doc, label, checkbox)); }
  const exportButton = el(doc, 'button', { type: 'button' }, '导出副本'); exportButton.onclick = () => runAction(() => services.exportSnapshot?.(options), services.notice);
  const file = el(doc, 'input', { type: 'file', accept: 'application/json', 'aria-label': '选择副本文件' }); file.onchange = () => { if (file.files?.[0]) runAction(() => services.importSnapshot?.(file.files[0], options, body), services.notice); };
  const undo = el(doc, 'button', { type: 'button' }, '撤销导入'); undo.onclick = () => runAction(() => services.undoImport?.(), services.notice);
  body.append(exportButton, field(doc, '导入副本', file), undo);
}
