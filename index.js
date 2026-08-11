import { createSillyTavernAdapter } from './src/host/sillytavern-adapter.js';
import { createStore } from './src/state/store.js';
import { createDirectorConsole } from './src/ui/director-console.js';
import { createDirectorClient } from './src/director/client.js';
import { collectDirectorContext } from './src/director/context-collector.js';
import { createEventEngine } from './src/director/event-engine.js';
import { createDirectorPipeline } from './src/director/pipeline.js';
import { evaluatePolicy } from './src/director/policy.js';
import { createScheduler } from './src/director/scheduler.js';
import { createThemeManager } from './src/theme/theme-manager.js';
import { applyImport, exportSnapshot, previewImport, undoLastImport } from './src/snapshots/snapshot-manager.js';
import { createDirectorState } from './src/state/default-state.js';
import { buildPersonalityProfile } from './src/director/personality-profile.js';

function resolveContext() {
  return globalThis.SillyTavern?.getContext?.() ?? {};
}

export const hostAdapter = createSillyTavernAdapter(resolveContext);
let consoleInstance;
let runtime;

function mountWandEntry(openConsole) {
  const menu = document.querySelector('#extensionsMenu');
  if (!menu) return () => {};
  const existing = document.querySelector('#stpd-menu-entry');
  if (existing) existing.onclick = openConsole;
  else {
    const entry = document.createElement('div');
    entry.id = 'stpd-menu-entry';
    entry.className = 'extensionsMenuExtensionButton stpd-menu-entry fa-solid fa-wand-magic-sparkles';
    entry.title = '打开主动导演';
    entry.setAttribute('aria-label', '打开主动导演');
    entry.setAttribute('role', 'button');
    entry.tabIndex = 0;
    entry.onclick = openConsole;
    entry.onkeydown = (event) => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); openConsole(); } };
    const target = menu.querySelector('.extension_container') ?? menu;
    target.append(entry);
  }
  return () => document.querySelector('#stpd-menu-entry')?.remove();
}

export function initializeExtension() {
  const capabilities = hostAdapter.capabilities;
  if (consoleInstance || typeof document === 'undefined') return capabilities;
  const root = document.createElement('div');
  document.body.append(root);
  const store = createStore(hostAdapter);
  const settings = store.loadGlobal();
  const chatKey = hostAdapter.getCurrentChatKey();
  const state = chatKey ? store.loadChat(chatKey) : createDirectorState(null);
  state.preference.userAgency = settings.defaults.userAgency;
  const engine = createEventEngine(store);
  const theme = createThemeManager(document, { save: async (value) => {
    settings.theme = value;
    await store.saveGlobal(settings);
  } });
  theme.preview(settings.theme);
  const directorClient = createDirectorClient({ adapter: hostAdapter });
  let rerender = () => {};
  const pipeline = createDirectorPipeline({
    adapter: hostAdapter,
    store,
    client: directorClient,
    policy: { evaluatePolicy },
    engine,
    collector: collectDirectorContext,
    scheduler: createScheduler(),
    onProgress: () => rerender(),
  });
  rerender = () => consoleInstance?.render({ settings, state });
  const notice = (message) => hostAdapter.showSystemMessage?.(message);
  const downloadSnapshot = (options) => {
    const snapshot = exportSnapshot(state, options);
    const blob = new Blob([JSON.stringify(snapshot, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `proactive-director-${chatKey ?? 'snapshot'}.json`;
    link.click();
    URL.revokeObjectURL(url);
  };
  const importSnapshotFile = async (file, options) => {
    try {
      const snapshot = JSON.parse(await file.text());
      const preview = previewImport(snapshot, state, options);
      const accepted = await hostAdapter.showConfirm?.(`将导入所选副本内容。${preview.warnings?.join(' ') ?? ''}`);
      if (!accepted) return;
      const imported = applyImport(preview);
      Object.assign(state, imported);
      await store.saveChat(state);
      rerender();
    } catch (error) {
      console.error('[主动导演] snapshot import failed', error);
      notice?.('副本导入失败，请检查 JSON 文件。');
    }
  };
  consoleInstance = createDirectorConsole({
    root,
    services: {
      saveSettings: (next) => store.saveGlobal(next),
      saveState: (next) => store.saveChat(next),
      previewTheme: (value) => theme.preview(value),
      confirm: (message) => hostAdapter.showConfirm(message),
      notice,
      listModels: (connection) => directorClient.listModels(connection),
      worldInfoEntries: () => hostAdapter.getWorldInfoEntries(),
      personalityProfile: (contextSettings) => {
        const entries = hostAdapter.getWorldInfoEntries?.() ?? [];
        const list = Array.isArray(entries) ? entries : Object.entries(entries).map(([id, entry]) => ({ id, ...entry }));
        const selected = contextSettings?.worldInfoMode === 'selected'
          ? new Set(contextSettings.worldInfoEntries ?? [])
          : null;
        const included = contextSettings?.worldInfo
          ? list.filter((entry) => !selected || selected.has(entry.id ?? entry.uid ?? entry.name))
          : [];
        return buildPersonalityProfile(hostAdapter.getCharacterData(), included, contextSettings);
      },
      exportSnapshot: downloadSnapshot,
      importSnapshot: importSnapshotFile,
      undoImport: async () => {
        const previous = undoLastImport();
        if (!previous) return;
        Object.assign(state, previous);
        await store.saveChat(state);
        rerender();
      },
      stop: async () => {
        if (chatKey) await engine.stop(chatKey, state.characterFingerprint);
        state.status = 'stopped'; state.activeEvent = null;
        state.generation = { ...state.generation, phase: 'idle', finishedAt: new Date().toISOString() };
        rerender();
      },
      onManualEvent: (text, expand) => pipeline.manualCreate(text, expand),
    },
  });
  consoleInstance.mount({ settings, state });
  const menuCleanup = mountWandEntry(() => consoleInstance?.open());
  const menuObserver = new MutationObserver(() => mountWandEntry(() => consoleInstance?.open()));
  const menuParent = document.body;
  menuObserver.observe(menuParent, { childList: true, subtree: true });
  const host = hostAdapter.getContext();
  const eventTypes = host.event_types ?? globalThis.event_types ?? {};
  const unsubscribers = [];
  if (!host.groupId && !host.group_id && chatKey) {
    const userEvent = eventTypes.USER_MESSAGE_RENDERED ?? 'USER_MESSAGE_RENDERED';
    unsubscribers.push(hostAdapter.on(userEvent, (messageIndex) => {
      const message = hostAdapter.getMessages()[messageIndex] ?? hostAdapter.getMessages().at(-1);
      pipeline.handleUserMessage(message?.mes ?? '').catch((error) => console.error('[主动导演]', error));
    }));
  } else if (host.groupId || host.group_id) {
    state.status = 'paused';
    rerender();
  }
  const chatEvent = eventTypes.CHAT_CHANGED ?? 'CHAT_CHANGED';
  unsubscribers.push(hostAdapter.on(chatEvent, () => pipeline.cancel()));
  runtime = { pipeline, theme, destroy() { pipeline.cancel(); unsubscribers.forEach((off) => off()); menuObserver.disconnect(); menuCleanup(); theme.destroy(); consoleInstance?.destroy(); consoleInstance = null; } };
  return capabilities;
}

export function destroyExtension() {
  runtime?.destroy();
  runtime = null;
}

if (typeof document !== 'undefined') {
  const start = () => initializeExtension();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
