import { el, runAction } from './dom.js';
import { renderEventView } from './views/event.js';
import { renderScriptsView } from './views/scripts.js';
import { renderCastView } from './views/cast.js';
import { renderPreferencesView } from './views/preferences.js';
import { renderConnectionView } from './views/connection.js';
import { renderWorldInfoView } from './views/world-info.js';
import { renderSnapshotsView } from './views/snapshots.js';
import { renderAppearanceView } from './views/appearance.js';
import { renderDiagnosticsView } from './views/diagnostics.js';
import { createThemeToggle } from './components/theme-toggle.js';
import { themeModeClass } from '../theme/theme-manager.js';
import './dialogs/manual-event.js';
import './dialogs/snapshot-import.js';
import './dialogs/cast-correction.js';
import './dialogs/confirm.js';

const TABS = [
  ['event', '事件'], ['scripts', '剧本'], ['cast', '人物'], ['world', '世界书'],
  ['preferences', '偏好'], ['snapshots', '副本'],
];

const SETTINGS_TABS = [['connection', '连接'], ['diagnostics', '检查'], ['appearance', '外观']];

export function createDirectorConsole({ root, services }) {
  let active = 'event';
  let settingsOpen = false;
  let settingsActive = 'connection';
  let settings;
  let state;
  let open = false;
  let escapeHandler;
  const snapshotOptions = { mode: 'custom', eventFramework: true, history: false, personality: false, rules: false, safety: false };
  const saveSettings = () => runAction(() => services.saveSettings?.(settings), services.notice);
  const saveState = () => runAction(() => services.saveState?.(state), services.notice);

  function renderView(body) {
    const shared = { body, settings, state, services, saveSettings, saveState, rerender: render };
    if (settingsOpen) {
      if (settingsActive === 'connection') renderConnectionView(shared);
      else if (settingsActive === 'diagnostics') renderDiagnosticsView(shared);
      else if (settingsActive === 'appearance') renderAppearanceView(shared);
      return;
    }
    if (active === 'event') renderEventView(shared);
    else if (active === 'scripts') renderScriptsView(shared);
    else if (active === 'cast') renderCastView(shared);
    else if (active === 'world') renderWorldInfoView(shared);
    else if (active === 'preferences') renderPreferencesView(shared);
    else if (active === 'snapshots') renderSnapshotsView({ ...shared, options: snapshotOptions });
  }

  function render() {
    root.replaceChildren();
    root.id = 'st-proactive-director';
    root.className = `stpd-console ${themeModeClass(settings.theme?.mode)}${open ? ' stpd-modal-open' : ''}`;
    const doc = root.ownerDocument;
    const overlay = el(doc, 'div', { class: 'stpd-overlay', role: 'presentation' });
    const modal = el(doc, 'section', { class: 'stpd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '导演时间' });
    const header = el(doc, 'header', { class: 'stpd-header stpd-row' });
    const phase = state.generation?.phase ?? state.status;
    const phaseLabels = { idle: '待机', collecting: '采集中', generating: '生成中', streaming: '流式生成中', injecting: '注入中', completed: '已完成', failed: '失败' };
    const titleGroup = el(doc, 'div', { class: 'stpd-title-group' });
    titleGroup.append(el(doc, 'strong', { class: 'stpd-title' }, settingsOpen ? '设置' : '导演时间'));
    if (!settingsOpen) titleGroup.append(createThemeToggle({ doc, settings, services, saveSettings, rerender: render }));
    header.append(titleGroup, el(doc, 'span', { class: `stpd-status stpd-status-${phase}` }, phaseLabels[phase] ?? '待机'));
    const settingsButton = el(doc, 'button', { type: 'button', class: 'stpd-settings', 'aria-label': '打开设置', title: '设置' });
    settingsButton.append(el(doc, 'span', { class: 'fa-solid fa-gear', 'aria-hidden': 'true' }));
    settingsButton.onclick = () => { settingsOpen = true; render(); };
    const closeButton = el(doc, 'button', { type: 'button', class: 'stpd-close', 'aria-label': '关闭导演时间', title: '关闭' }, '×');
    closeButton.onclick = close;
    header.append(settingsButton, closeButton);
    const nav = el(doc, 'nav', { class: 'stpd-tabs', 'aria-label': '导演控制台' });
    if (settingsOpen) {
      nav.className = 'stpd-settings-nav';
      const back = el(doc, 'button', { type: 'button', class: 'stpd-back fa-solid fa-arrow-left', 'aria-label': '返回导演时间', title: '返回' });
      back.onclick = () => { settingsOpen = false; render(); };
      nav.append(back);
      for (const [id, label] of SETTINGS_TABS) {
        const button = el(doc, 'button', { type: 'button', role: 'tab', 'aria-selected': String(settingsActive === id) }, label);
        button.onclick = () => { settingsActive = id; render(); };
        nav.append(button);
      }
    } else {
      for (const [id, label] of TABS) {
        const button = el(doc, 'button', { type: 'button', role: 'tab', 'aria-selected': String(active === id) }, label);
        button.onclick = () => { active = id; render(); }; nav.append(button);
      }
    }
    const body = el(doc, 'section', { class: 'stpd-modal-body stpd-view', role: 'tabpanel' });
    if (state.status === 'paused' && services.isGroupChat?.()) body.append(el(doc, 'p', { class: 'stpd-alert' }, '原生群聊中导演生成已暂停。'));
    renderView(body); modal.append(header, nav, body); overlay.append(modal); root.append(overlay);
  }

  function openModal() { open = true; render(); root.querySelector('.stpd-close')?.focus(); }
  function close() { open = false; render(); }

  return {
    mount(data) { settings = data.settings; state = data.state; escapeHandler = (event) => { if (event.key === 'Escape' && open) close(); }; root.ownerDocument.addEventListener('keydown', escapeHandler); render(); },
    open: openModal,
    openTab(tab) { active = tab; settingsOpen = false; render(); },
    close,
    render(data) { settings = data?.settings ?? settings; state = data?.state ?? state; render(); },
    destroy() { if (escapeHandler) root.ownerDocument.removeEventListener('keydown', escapeHandler); root.replaceChildren(); },
  };
}
