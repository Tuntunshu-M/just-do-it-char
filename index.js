import { createSillyTavernAdapter } from './src/host/sillytavern-adapter.js';
import { createStore } from './src/state/store.js';
import { createDirectorConsole } from './src/ui/director-console.js';

function resolveContext() {
  return globalThis.SillyTavern?.getContext?.() ?? {};
}

export const hostAdapter = createSillyTavernAdapter(resolveContext);
let consoleInstance;

export function initializeExtension() {
  const capabilities = hostAdapter.capabilities;
  const mountPoint = document.querySelector('#extensions_settings, #extensions-settings');
  if (!mountPoint || consoleInstance) return capabilities;
  const root = document.createElement('div');
  mountPoint.append(root);
  const store = createStore(hostAdapter);
  const settings = store.loadGlobal();
  const chatKey = hostAdapter.getCurrentChatKey();
  const state = chatKey ? store.loadChat(chatKey) : {
    status: 'idle', activeEvent: null, foreshadowing: [], cast: { mode: 'single', members: [] },
    preference: { userAgency: settings.defaults.userAgency },
  };
  consoleInstance = createDirectorConsole({
    root,
    services: {
      saveSettings: (next) => store.saveGlobal(next),
      stop: () => { state.status = 'stopped'; state.activeEvent = null; consoleInstance.render({ settings, state }); },
    },
  });
  consoleInstance.mount({ settings, state });
  return capabilities;
}

if (typeof document !== 'undefined') {
  const start = () => initializeExtension();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
