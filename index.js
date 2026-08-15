import { createSillyTavernAdapter } from './src/host/sillytavern-adapter.js';
import { createStore } from './src/state/store.js';
import { createDirectorConsole } from './src/ui/director-console.js';
import { createDirectorClient } from './src/director/client.js';
import { collectDirectorContext } from './src/director/context-collector.js';
import { createEventEngine } from './src/director/event-engine.js';
import { createDirectorPipeline } from './src/director/pipeline.js';
import { evaluatePolicy } from './src/director/policy.js';
import { createScheduler } from './src/director/scheduler.js';
import { createCssTemplate, createThemeManager } from './src/theme/theme-manager.js';
import { applyImport, exportSnapshot, previewImport, undoLastImport } from './src/snapshots/snapshot-manager.js';
import { createDirectorState } from './src/state/default-state.js';
import { addCastMember, correctCast, lockCast, removeCastMember, setCastMode, setLeadMember, setSingleSelection, updateCastMember } from './src/cast/cast-manager.js';
import { showSnapshotImportDialog } from './src/ui/dialogs/snapshot-import.js';
import { selectedWorldEntries } from './src/world-info/selection.js';
import { runDiagnostics } from './src/diagnostics/inspector.js';
import { formatDiagnosticReport } from './src/diagnostics/records.js';
import { classifyDirectorFailure } from './src/director/failure-reasons.js';
import { createProfileService } from './src/director/profile-service.js';
import { createScriptRepository } from './src/scripts/script-repository.js';
import { createScriptRuntime } from './src/scripts/script-runtime.js';
import { applyWorldSelectionPolicy } from './src/world-info/policy.js';

function resolveContext() {
  return globalThis.SillyTavern?.getContext?.() ?? {};
}

// Load the host module only when the main connection actually generates. This keeps
// the extension entry importable in tests while resolving SillyTavern's real API.
const hostApi = {
  generateRaw: (...args) => import('/script.js').then(({ generateRaw }) => generateRaw(...args)),
};

export const hostAdapter = createSillyTavernAdapter(resolveContext, hostApi);
let consoleInstance;
let runtime;

const OUTCOME_STAGE_LABELS = {
  collecting: '上下文采集',
  generating: '导演生成',
  validating: '人格校验',
  policy: '规则检查',
  injecting: '提示注入',
  reply: '正文生成',
  commit: '结果提交',
};

export function eventOutcomeNotice(outcome = {}) {
  if (!['failed', 'not-generated'].includes(outcome.status)) return '';
  const result = outcome.status === 'failed' ? '事件生成失败' : '事件未生成';
  const stage = OUTCOME_STAGE_LABELS[outcome.stage] ?? outcome.stage ?? '未知阶段';
  const message = outcome.status === 'failed'
    ? classifyDirectorFailure(outcome.message)
    : (outcome.message || '本次判断没有创建事件');
  return `${result}（${stage}）：${message}。可在 设置 → 检查 查看详情。`;
}

function openAfterMenuDismissal(entry) {
  let opened = false;
  const open = () => {
    if (opened) return;
    opened = true;
    entry.__stpdOpenConsole?.();
  };
  if (typeof requestAnimationFrame === 'function') {
    requestAnimationFrame(() => requestAnimationFrame(open));
  }
  setTimeout(open, 80);
}

export function mountWandEntry(openConsole) {
  const menu = document.querySelector('#extensionsMenu');
  if (!menu) return () => {};
  const existing = document.querySelector('#stpd-menu-entry');
  if (existing) {
    existing.__stpdOpenConsole = openConsole;
    const container = document.querySelector('#stpd-menu-container');
    if (container && container.parentElement !== menu) menu.append(container);
  }
  else {
    const container = document.createElement('div');
    container.id = 'stpd-menu-container';
    container.className = 'extension_container interactable';
    container.tabIndex = 0;
    const entry = document.createElement('div');
    entry.id = 'stpd-menu-entry';
    entry.className = 'stpd-menu-entry list-group-item flex-container flexGap5 interactable';
    const icon = document.createElement('span');
    icon.className = 'stpd-menu-icon fa-solid fa-clapperboard extensionsMenuExtensionButton';
    icon.setAttribute('aria-hidden', 'true');
    const label = document.createElement('span');
    label.className = 'stpd-menu-label';
    label.textContent = '导演时间';
    entry.append(icon, label);
    entry.title = '打开导演时间';
    entry.setAttribute('aria-label', '打开导演时间');
    entry.setAttribute('role', 'button');
    entry.tabIndex = 0;
    entry.__stpdOpenConsole = openConsole;
    entry.addEventListener('click', (event) => {
      event.preventDefault();
      openAfterMenuDismissal(entry);
    });
    entry.addEventListener('keydown', (event) => {
      if (event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openAfterMenuDismissal(entry);
      }
    });
    container.append(entry);
    menu.append(container);
  }
  return () => document.querySelector('#stpd-menu-container')?.remove();
}

export function initializeExtension() {
  const capabilities = hostAdapter.capabilities;
  if (consoleInstance || typeof document === 'undefined') return capabilities;
  const root = document.createElement('div');
  document.body.append(root);
  const store = createStore(hostAdapter);
  let settings = store.loadGlobal();
  let chatKey = hostAdapter.getCurrentChatKey();
  let state = chatKey ? store.loadChat(chatKey) : createDirectorState(null);
  const engine = createEventEngine(store);
  const repository = createScriptRepository(store);
  const scriptRuntime = createScriptRuntime({ store, repository });
  const theme = createThemeManager(document, { save: async (value) => {
    settings.theme = value;
    await store.saveGlobal(settings);
  } });
  theme.load(settings.theme);
  const directorClient = createDirectorClient({ adapter: hostAdapter });
  const profileService = createProfileService({
    client: directorClient,
    getCurrentChatKey: () => hostAdapter.getCurrentChatKey(),
    onStatus: async (nextState) => {
      await store.saveChat(nextState);
      if (nextState.chatKey === chatKey) {
        state = nextState;
        rerender();
      }
    },
  });
  let rerender = () => {};
  const notice = (message) => hostAdapter.showSystemMessage?.(message);
  const pipeline = createDirectorPipeline({
    adapter: hostAdapter,
    store,
    client: directorClient,
    policy: { evaluatePolicy },
    engine,
    repository,
    collector: collectDirectorContext,
    scheduler: createScheduler(),
    personality: {
      validate: (result, context) => {
        const members = context.cast?.members ?? [];
        if (!members.length || !(result.actions?.length)) return { allowed: true };
        const ids = new Set(members.map((member) => member.id));
        const invalid = result.actions.filter((action) => !ids.has(action.characterId) || !action.evidence?.length);
        return { allowed: invalid.length === 0, reasons: invalid.map((action) => `人物 ${action.characterId} 缺少自身证据`) };
      },
    },
    onProgress: (nextState) => { state = nextState; rerender(); },
    onOutcome: (outcome) => {
      const message = eventOutcomeNotice(outcome);
      if (message) notice(message);
      rerender();
    },
    onNotice: notice,
    onScriptCreated: (scriptId) => {
      refresh();
      consoleInstance?.openTab('scripts');
    },
  });
  const refresh = () => {
    settings = store.loadGlobal();
    chatKey = hostAdapter.getCurrentChatKey();
    if (chatKey) state = store.loadChat(chatKey);
    else state = createDirectorState(null);
    rerender();
  };
  rerender = () => consoleInstance?.render({ settings, state });
  const worldBookCache = new Map();
  const worldInfoNames = () => hostAdapter.getWorldInfoNames();
  const loadWorldInfoBook = async (name) => {
    if (!worldBookCache.has(name)) {
      const pending = hostAdapter.loadWorldInfoBook(name).then((book) => {
        worldBookCache.set(name, book);
        return book;
      }).catch((error) => {
        worldBookCache.delete(name);
        throw error;
      });
      worldBookCache.set(name, pending);
    }
    return worldBookCache.get(name);
  };
  const cachedSelectedEntries = () => {
    const books = [];
    for (const [name, value] of worldBookCache) {
      if (value && typeof value.then !== 'function' && value.name === name) books.push(value);
    }
    return selectedWorldEntries(books, settings.context.worldInfoBooks ?? {});
  };
  const loadSelectedWorldBooks = async () => {
    if (!settings.context.worldInfo) return [];
    const selectedBooks = Object.keys(settings.context.worldInfoBooks ?? {});
    if (!selectedBooks.length) return [];
    await Promise.all(selectedBooks.map((name) => loadWorldInfoBook(name)));
    return cachedSelectedEntries();
  };
  const profileOptions = () => ({
    state,
    card: hostAdapter.getCharacterData(),
    cast: state.cast,
    entries: settings.context.worldInfo ? cachedSelectedEntries() : [],
    profileGuidance: settings.profileGuidance,
    connection: settings.connection,
  });
  const ensureCurrentProfile = async ({ notify = true } = {}) => {
    if (!chatKey || isGroupChat()) return;
    const entries = await loadSelectedWorldBooks();
    const result = await profileService.ensureProfile({ ...profileOptions(), entries });
    await store.saveChat(state);
    if (notify && result.error === '还没连接副 API') notice('还没连接副 API');
    rerender();
  };
  const markProfileFromCastChange = async () => {
    const entries = await loadSelectedWorldBooks();
    await profileService.ensureProfile({ ...profileOptions(), entries });
    await store.saveChat(state);
    refresh();
  };
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
  const importSnapshotFile = async (file, options, container) => {
    try {
      const snapshot = JSON.parse(await file.text());
      const preview = previewImport(snapshot, state, options);
      showSnapshotImportDialog(container, preview, async (acceptedPreview) => {
        const imported = applyImport(acceptedPreview);
        Object.assign(state, imported);
        await store.saveChat(state);
        refresh();
      });
    } catch (error) {
      console.error('[导演时间] snapshot import failed', error);
      notice?.('副本导入失败，请检查 JSON 文件。');
    }
  };
  consoleInstance = createDirectorConsole({
    root,
    services: {
      saveSettings: async (next) => {
        await store.saveGlobal(next);
        settings = store.loadGlobal();
        await ensureCurrentProfile({ notify: false });
      },
      saveState: (next) => store.saveChat(next),
      previewTheme: (value) => theme.preview(value),
      confirm: (message) => hostAdapter.showConfirm(message),
      notice,
      listModels: (connection) => directorClient.listModels(connection),
      worldInfoNames,
      loadWorldInfoBook: async (name) => {
        const book = await loadWorldInfoBook(name);
        worldBookCache.set(name, book);
        return book;
      },
      personalityProfile: (contextSettings) => {
        const card = hostAdapter.getCharacterData();
        return { ...state.personalityProfile, name: card?.name ?? '' };
      },
      refreshPersonalityProfile: async () => {
        const included = await loadSelectedWorldBooks();
        await profileService.refreshProfile({ ...profileOptions(), entries: included });
        await store.saveChat(state);
        refresh();
      },
      ignorePersonalityProfile: async () => {
        profileService.ignoreProfile({ state });
        await store.saveChat(state);
        refresh();
      },
      exportSnapshot: downloadSnapshot,
      importSnapshot: importSnapshotFile,
      undoImport: async () => {
        const previous = undoLastImport();
        if (!previous) return;
        Object.assign(state, previous);
        await store.saveChat(state);
        refresh();
      },
      stop: async () => {
        if (chatKey) await engine.stop(chatKey, state.characterFingerprint);
        state.status = 'stopped'; state.activeEvent = null;
        state.generation = { ...state.generation, phase: 'idle', finishedAt: new Date().toISOString() };
        refresh();
      },
      onManualEvent: async (text, expand) => {
        const result = await pipeline.manualCreate(text, expand);
        refresh();
        return result;
      },
      selectScript: async (scriptId) => { await repository.select(chatKey, state.characterFingerprint, scriptId); refresh(); },
      deleteScripts: async (scriptIds) => { await repository.remove(chatKey, state.characterFingerprint, scriptIds); refresh(); },
      clearScripts: async () => { await repository.clear(chatKey, state.characterFingerprint); refresh(); },
      updateScript: async (scriptId, changes) => { await repository.update(chatKey, state.characterFingerprint, scriptId, changes); refresh(); },
      performScript: async (scriptId) => {
        await scriptRuntime.perform(chatKey, state.characterFingerprint, scriptId, {
          confirmConflict: (current, next) => hostAdapter.showConfirm(`“${current.title}”正在演出。开演“${next.title}”会停止当前剧本，但保留历史进度。是否继续？`),
        });
        refresh();
      },
      pauseScript: async (scriptId) => { await scriptRuntime.pause(chatKey, state.characterFingerprint, scriptId); refresh(); },
      resumeScript: async (scriptId) => { await scriptRuntime.resume(chatKey, state.characterFingerprint, scriptId); refresh(); },
      changeScriptDirection: async (scriptId, direction) => { await scriptRuntime.changeDirection(chatKey, state.characterFingerprint, scriptId, direction); refresh(); },
      stopScript: async (scriptId) => { await scriptRuntime.stop(chatKey, state.characterFingerprint, scriptId); refresh(); },
      pauseEvent: async () => { await engine.pause(chatKey, state.characterFingerprint); refresh(); },
      resumeEvent: async () => { await engine.resume(chatKey, state.characterFingerprint, { source: 'manual' }); refresh(); },
      rerollEvent: () => pipeline.regeneratePlan(),
      restoreScriptRevision: async (scriptId, revisionId) => {
        if (state.activeScriptId !== scriptId) throw new Error('只能恢复当前开演剧本的修订');
        await engine.restoreRevision(chatKey, state.characterFingerprint, revisionId);
        refresh();
      },
      changeDirection: async (direction) => { await engine.changeDirection(chatKey, state.characterFingerprint, { direction }); refresh(); },
      lockCast: async (locked) => { state.cast = lockCast(state.cast, locked); await store.saveChat(state); refresh(); },
      correctCast: async (correction) => { state.cast = correctCast(state.cast, correction); await store.saveChat(state); refresh(); },
      setCastMode: async (mode) => {
        state.cast = setCastMode(state.cast, mode);
        await store.saveChat(state);
        if (mode === 'multi') {
          const entries = await loadSelectedWorldBooks();
          const request = profileService.switchModeAndEnsureProfile({ ...profileOptions(), entries });
          refresh();
          const result = await request;
          await store.saveChat(state);
          if (result?.error === '还没连接副 API') notice('还没连接副 API');
        } else await markProfileFromCastChange();
        refresh();
      },
      setSingleCastMember: async (id) => {
        const member = state.cast.multiMembers?.find((item) => item.id === id) ?? state.cast.members?.find((item) => item.id === id);
        state.cast = setSingleSelection(state.cast, member);
        await store.saveChat(state);
        await markProfileFromCastChange();
      },
      addCastMember: async (member) => { state.cast = addCastMember(state.cast, member); await store.saveChat(state); await markProfileFromCastChange(); },
      updateCastMember: async (id, changes) => { state.cast = updateCastMember(state.cast, id, changes); await store.saveChat(state); await markProfileFromCastChange(); },
      removeCastMember: async (id) => { state.cast = removeCastMember(state.cast, id); await store.saveChat(state); await markProfileFromCastChange(); },
      setLeadMember: async (id) => { state.cast = setLeadMember(state.cast, id); await store.saveChat(state); await markProfileFromCastChange(); },
      isGroupChat: () => Boolean(hostAdapter.getContext().groupId ?? hostAdapter.getContext().group_id),
      testConnection: (connection) => directorClient.testConnection(connection),
      runDiagnostics: () => runDiagnostics({ adapter: hostAdapter, settings, state }),
      copyDiagnosticReport: async (snapshot) => {
        if (!globalThis.navigator?.clipboard?.writeText) throw new Error('当前环境无法访问剪贴板。');
        await globalThis.navigator.clipboard.writeText(formatDiagnosticReport(snapshot));
        notice('诊断报告已复制。');
      },
      saveTheme: async (value) => { theme.preview(value); await theme.save(); settings.theme = value; await store.saveGlobal(settings); refresh(); },
      disableTheme: async () => { theme.disable(); settings.theme.enabled = false; await store.saveGlobal(settings); refresh(); },
      rollbackTheme: async () => { settings.theme = theme.rollback(); await store.saveGlobal(settings); refresh(); },
      resetTheme: async () => { theme.reset(); settings.theme = { mode: 'night', enabled: false, allowGlobalCss: false, variables: {}, css: '' }; await store.saveGlobal(settings); refresh(); },
      exportTheme: () => {
        const blob = new Blob([JSON.stringify(theme.exportTheme(), null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'proactive-director-theme.json'; link.click(); URL.revokeObjectURL(url);
      },
      exportCssTemplate: () => {
        const blob = new Blob([createCssTemplate()], { type: 'text/css;charset=utf-8' });
        const url = URL.createObjectURL(blob); const link = document.createElement('a'); link.href = url; link.download = 'proactive-director-template.css'; link.click(); URL.revokeObjectURL(url);
      },
      importTheme: async (file) => { try { theme.importTheme(JSON.parse(await file.text())); settings.theme = theme.exportTheme().theme; await store.saveGlobal(settings); refresh(); } catch (error) { notice(`主题导入失败：${error.message}`); } },
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
  const isGroupChat = () => {
    const current = hostAdapter.getContext();
    return Boolean(current.groupId ?? current.group_id);
  };
  const userEvent = eventTypes.USER_MESSAGE_RENDERED ?? 'USER_MESSAGE_RENDERED';
  unsubscribers.push(hostAdapter.on(userEvent, async (messageIndex) => {
    if (!chatKey || isGroupChat()) return;
    const message = hostAdapter.getMessages()[messageIndex] ?? hostAdapter.getMessages().at(-1);
    await pipeline.handleUserMessage(message?.mes ?? '', messageIndex);
  }));
  if (isGroupChat()) {
    state.status = 'paused';
    rerender();
  }
  else ensureCurrentProfile().catch((error) => console.error('[导演时间] profile', error));
  const chatEvent = eventTypes.CHAT_CHANGED ?? 'CHAT_CHANGED';
  unsubscribers.push(hostAdapter.on(chatEvent, () => {
    const previousChatKey = chatKey;
    pipeline.cancel();
    pipeline.clearTurnInjection({ resetTurn: true }).catch((error) => console.error('[导演时间]', error));
    refresh();
    if (applyWorldSelectionPolicy(settings, previousChatKey, chatKey)) {
      store.saveGlobal(settings).catch((error) => console.error('[导演时间] world selection policy', error));
    }
    if (isGroupChat()) state.status = 'paused';
    rerender();
    worldBookCache.clear();
    if (!isGroupChat()) ensureCurrentProfile().catch((error) => console.error('[导演时间] profile', error));
  }));
  for (const eventName of [eventTypes.GENERATION_ENDED ?? 'GENERATION_ENDED', eventTypes.GENERATION_STOPPED ?? 'GENERATION_STOPPED']) {
    unsubscribers.push(hostAdapter.on(eventName, () => pipeline.clearTurnInjection().catch((error) => console.error('[导演时间]', error))));
  }
  const editedEvent = eventTypes.MESSAGE_EDITED ?? 'MESSAGE_EDITED';
  unsubscribers.push(hostAdapter.on(editedEvent, async (messageIndex) => {
    const message = hostAdapter.getMessages()[messageIndex];
    if (message && chatKey) await engine.reconcileEditedMessage(chatKey, state.characterFingerprint, { messageId: messageIndex, text: message.mes ?? '' });
    refresh();
  }));
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
