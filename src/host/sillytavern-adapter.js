function getHost(contextProvider) {
  return contextProvider?.() ?? {};
}

function hasFunction(value) {
  return typeof value === 'function';
}

function normalizeWorldEntries(entries) {
  const list = Array.isArray(entries)
    ? entries
    : Object.entries(entries ?? {}).map(([id, entry]) => ({ id, ...entry }));
  return list.map((entry, index) => ({
    id: String(entry.id ?? entry.uid ?? index),
    name: entry.name ?? entry.comment ?? entry.keys?.join(', ') ?? `条目 ${index + 1}`,
    content: entry.content ?? entry.text ?? '',
  }));
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
        generation: hasFunction(host.generate) && hasFunction(host.generateRaw),
        settings: hasFunction(host.saveSettingsDebounced),
        chatState: hasFunction(host.saveMetadataDebounced) || hasFunction(host.saveMetadata),
        confirmation: hasFunction(host.Popup?.show?.confirm) || hasFunction(host.popup?.confirm),
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

    getWorldInfoEntries() {
      const host = getHost(contextProvider);
      const direct = host.worldInfoEntries ?? host.worldInfo?.entries;
      if (Array.isArray(direct) || (direct && typeof direct === 'object')) return direct;
      const cardEntries = host.characters?.[host.characterId]?.data?.character_book?.entries;
      if (Array.isArray(cardEntries)) {
        return cardEntries.map((entry, index) => ({
          id: entry.id ?? entry.uid ?? String(index),
          name: entry.name ?? entry.comment ?? entry.keys?.join(', ') ?? `条目 ${index + 1}`,
          content: entry.content ?? entry.text ?? '',
        }));
      }
      return [];
    },

    async getWorldInfoEntriesAsync() {
      const immediate = adapter.getWorldInfoEntries();
      const host = getHost(contextProvider);
      if (!hasFunction(host.loadWorldInfo)) return normalizeWorldEntries(immediate);
      const names = [...new Set([
        ...(Array.isArray(host.selected_world_info) ? host.selected_world_info : [host.selected_world_info]),
        ...(Array.isArray(host.world_info) ? host.world_info : []),
      ].filter(Boolean))];
      if (!names.length) return normalizeWorldEntries(immediate);
      const loaded = await Promise.all(names.map((name) => host.loadWorldInfo(name)));
      const external = loaded.flatMap((book) => normalizeWorldEntries(book?.entries ?? book));
      const merged = new Map([...normalizeWorldEntries(immediate), ...external].map((entry) => [entry.id, entry]));
      return [...merged.values()];
    },

    showSystemMessage(message) {
      const host = getHost(contextProvider);
      if (hasFunction(host.showSystemMessage)) return host.showSystemMessage(message);
      if (typeof globalThis.toastr?.info === 'function') return globalThis.toastr.info(message);
      if (typeof globalThis.toastr?.warning === 'function') return globalThis.toastr.warning(message);
      return undefined;
    },

    injectPrompt(...args) {
      return getHost(contextProvider).setExtensionPrompt?.(...args);
    },

    generateDirector(messages) {
      const generateRaw = getHost(contextProvider).generateRaw;
      if (!hasFunction(generateRaw)) throw new Error('SillyTavern raw generation capability is unavailable');
      const systemPrompt = messages.filter((message) => message.role === 'system').map((message) => message.content).join('\n\n');
      const prompt = messages.filter((message) => message.role !== 'system').map((message) => message.content).join('\n\n');
      return generateRaw({ prompt, systemPrompt });
    },

    generateReply() {
      const generate = getHost(contextProvider).generate;
      if (!hasFunction(generate)) throw new Error('SillyTavern generation capability is unavailable');
      return generate('normal');
    },

    saveSettings() {
      return getHost(contextProvider).saveSettingsDebounced?.();
    },

    saveChatState() {
      const host = getHost(contextProvider);
      return (host.saveMetadataDebounced ?? host.saveMetadata)?.();
    },

    showConfirm(message) {
      const host = getHost(contextProvider);
      const confirm = host.Popup?.show?.confirm ?? host.popup?.confirm;
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
