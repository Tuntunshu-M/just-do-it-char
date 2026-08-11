function getHost(contextProvider) {
  return contextProvider?.() ?? {};
}

function hasFunction(value) {
  return typeof value === 'function';
}

export function createSillyTavernAdapter(contextProvider) {
  const adapter = {
    get capabilities() {
      const host = getHost(contextProvider);
      return {
        context: hasFunction(contextProvider),
        chat: host.chatId !== undefined || host.chatMetadata !== undefined,
        character: Array.isArray(host.characters) && host.characterId !== undefined,
        messages: Array.isArray(host.chat),
        promptInjection: hasFunction(host.setExtensionPrompt),
        generation: hasFunction(host.generate),
        settings: hasFunction(host.saveSettingsDebounced),
        chatState: hasFunction(host.saveMetadata),
        confirmation: hasFunction(host.popup?.confirm),
        events: hasFunction(host.eventSource?.on),
      };
    },

    getContext() {
      return getHost(contextProvider);
    },

    getCurrentChatKey() {
      const host = getHost(contextProvider);
      return host.chatId ?? host.chatMetadata?.chat_id ?? null;
    },

    getCharacterData() {
      const host = getHost(contextProvider);
      return host.characters?.[host.characterId] ?? null;
    },

    getMessages() {
      return getHost(contextProvider).chat ?? [];
    },

    injectPrompt(...args) {
      return getHost(contextProvider).setExtensionPrompt?.(...args);
    },

    generateReply(...args) {
      const generate = getHost(contextProvider).generate;
      if (!hasFunction(generate)) throw new Error('SillyTavern generation capability is unavailable');
      return generate(...args);
    },

    saveSettings() {
      return getHost(contextProvider).saveSettingsDebounced?.();
    },

    saveChatState() {
      return getHost(contextProvider).saveMetadata?.();
    },

    showConfirm(message) {
      const confirm = getHost(contextProvider).popup?.confirm;
      if (!hasFunction(confirm)) return Promise.resolve(false);
      return confirm(message);
    },

    on(eventName, listener) {
      const eventSource = getHost(contextProvider).eventSource;
      if (!hasFunction(eventSource?.on)) return () => {};
      eventSource.on(eventName, listener);
      return () => eventSource.off?.(eventName, listener);
    },
  };

  return adapter;
}
