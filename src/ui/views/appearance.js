import { el, field, runAction } from '../dom.js';
import { confirmAction } from '../dialogs/confirm.js';

export function renderAppearanceView({ body, settings, services, saveSettings, rerender }) {
  const doc = body.ownerDocument;
  const mode = el(doc, 'div', { class: 'stpd-theme-mode', role: 'group', 'aria-label': '界面颜色' });
  for (const [value, label] of [['day', '白天'], ['night', '夜晚']]) {
    const button = el(doc, 'button', { type: 'button', 'aria-pressed': String((settings.theme.mode ?? 'night') === value) }, label);
    button.onclick = () => {
      settings.theme.mode = value;
      services.previewTheme?.(settings.theme);
      saveSettings();
      rerender();
    };
    mode.append(button);
  }
  const area = el(doc, 'textarea', { 'aria-label': '自定义 CSS', rows: '10', placeholder: '.stpd-status { color: var(--stpd-accent); }' }); area.value = settings.theme.css ?? '';
  const preview = el(doc, 'button', { type: 'button' }, '预览'); preview.onclick = () => services.previewTheme?.({ ...settings.theme, enabled: true, css: area.value });
  const globalCss = el(doc, 'input', { type: 'checkbox', checked: settings.theme.allowGlobalCss }); globalCss.onchange = async () => { if (globalCss.checked && !await confirmAction(services, '全局 CSS 会影响酒馆和其他扩展，确认启用？')) { globalCss.checked = false; return; } settings.theme.allowGlobalCss = globalCss.checked; saveSettings(); };
  const actions = el(doc, 'div', { class: 'stpd-actions' });
  for (const [label, handler] of [['保存主题', () => services.saveTheme?.({ ...settings.theme, enabled: true, css: area.value })], ['停用主题', () => services.disableTheme?.()], ['恢复已保存', () => services.rollbackTheme?.()], ['重置主题', () => services.resetTheme?.()], ['导出主题', () => services.exportTheme?.()], ['导出 CSS 模板', () => services.exportCssTemplate?.()]]) { const button = el(doc, 'button', { type: 'button' }, label); button.onclick = () => runAction(handler, services.notice); actions.append(button); }
  const file = el(doc, 'input', { type: 'file', accept: 'application/json', 'aria-label': '导入主题文件' }); file.onchange = () => file.files?.[0] && runAction(() => services.importTheme?.(file.files[0]), services.notice);
  body.append(field(doc, '界面颜色', mode), field(doc, '自定义 CSS', area), field(doc, '允许全局 CSS', globalCss), preview, actions, field(doc, '导入主题', file));
}
