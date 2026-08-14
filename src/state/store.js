import { EXTENSION_KEY } from '../constants.js';
import { createDirectorState } from './default-state.js';
import {
  cloneValue,
  migrateGlobalSettings,
  migrateState,
} from './migrations.js';

const CHAT_STATE_KEY = `${EXTENSION_KEY}_chats`;

function restoreObject(target, snapshot) {
  for (const key of Object.keys(target ?? {})) delete target[key];
  Object.assign(target, cloneValue(snapshot));
}

function getContainers(adapter) {
  const host = adapter.getContext?.() ?? {};
  host.extensionSettings ??= {};
  host.chatMetadata ??= {};
  host.chatMetadata[CHAT_STATE_KEY] ??= {};
  return {
    settings: host.extensionSettings,
    chats: host.chatMetadata[CHAT_STATE_KEY],
  };
}

export function createStore(adapter) {
  const queues = new Map();

  function loadGlobal() {
    const { settings } = getContainers(adapter);
    return migrateGlobalSettings(settings[EXTENSION_KEY]);
  }

  async function saveGlobal(value) {
    const { settings } = getContainers(adapter);
    const existed = Object.hasOwn(settings, EXTENSION_KEY);
    const previous = existed ? cloneValue(settings[EXTENSION_KEY]) : undefined;
    settings[EXTENSION_KEY] = migrateGlobalSettings(cloneValue(value));
    try {
      await adapter.saveSettings?.();
    } catch (error) {
      if (existed) settings[EXTENSION_KEY] = previous;
      else delete settings[EXTENSION_KEY];
      restoreObject(value, migrateGlobalSettings(previous));
      throw error;
    }
    return cloneValue(settings[EXTENSION_KEY]);
  }

  function loadChat(chatKey, fingerprint = null) {
    if (!chatKey) throw new Error('A chat key is required');
    const { chats } = getContainers(adapter);
    const raw = chats[chatKey] ?? createDirectorState(chatKey, fingerprint);
    const state = migrateState(raw);
    state.chatKey = chatKey;
    state.characterFingerprint ??= fingerprint;
    return state;
  }

  async function saveChat(value) {
    if (!value?.chatKey) throw new Error('Cannot save chat state without a chat key');
    const { chats } = getContainers(adapter);
    const state = migrateState(cloneValue(value));
    const existed = Object.hasOwn(chats, state.chatKey);
    const previous = existed ? cloneValue(chats[state.chatKey]) : createDirectorState(state.chatKey, state.characterFingerprint);
    state.updatedAt = new Date().toISOString();
    chats[state.chatKey] = state;
    try {
      await adapter.saveChatState?.();
    } catch (error) {
      if (existed) chats[state.chatKey] = previous;
      else delete chats[state.chatKey];
      restoreObject(value, migrateState(previous));
      throw error;
    }
    return cloneValue(state);
  }

  async function runTransaction(chatKey, fingerprint, work) {
    const draft = loadChat(chatKey, fingerprint);
    const result = await work(draft);
    const committed = await saveChat(draft);
    return result === undefined ? committed : result;
  }

  function transaction(chatKey, fingerprint, work) {
    if (typeof work !== 'function') throw new TypeError('Transaction work must be a function');
    const previous = queues.get(chatKey) ?? Promise.resolve();
    const current = previous.then(() => runTransaction(chatKey, fingerprint, work));
    const queued = current.catch(() => {});
    queues.set(chatKey, queued);
    return current.finally(() => {
      if (queues.get(chatKey) === queued) queues.delete(chatKey);
    });
  }

  return { loadGlobal, saveGlobal, loadChat, saveChat, transaction };
}
