import { createSillyTavernAdapter } from './src/host/sillytavern-adapter.js';

function resolveContext() {
  return globalThis.SillyTavern?.getContext?.() ?? {};
}

export const hostAdapter = createSillyTavernAdapter(resolveContext);

export function initializeExtension() {
  return hostAdapter.capabilities;
}

if (typeof document !== 'undefined') {
  const start = () => initializeExtension();
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start, { once: true });
  } else {
    start();
  }
}
