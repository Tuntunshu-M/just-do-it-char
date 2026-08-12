import { el } from '../dom.js';

export function createThemeToggle({ doc, settings, services, saveSettings, rerender }) {
  const currentMode = settings.theme?.mode === 'day' ? 'day' : 'night';
  const nextMode = currentMode === 'night' ? 'day' : 'night';
  const label = nextMode === 'day' ? '切换到白天模式' : '切换到夜晚模式';
  const button = el(doc, 'button', { type: 'button', class: 'stpd-theme-toggle', 'aria-label': label, title: label });
  button.append(el(doc, 'span', { class: `fa-solid ${currentMode === 'night' ? 'fa-moon' : 'fa-sun'}`, 'aria-hidden': 'true' }));
  button.onclick = async () => {
    settings.theme.mode = nextMode;
    services.previewTheme?.(settings.theme);
    await saveSettings();
    rerender();
  };
  return button;
}
