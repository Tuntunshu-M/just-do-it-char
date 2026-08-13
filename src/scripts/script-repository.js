function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createId() {
  return `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

export function normalizeScript(plan = {}, options = {}) {
  const now = options.now ?? new Date().toISOString();
  return {
    id: options.id ?? plan.id ?? createId(),
    title: plan.title ?? '未命名剧本',
    category: plan.category ?? '',
    premise: plan.premise ?? '',
    conflict: plan.conflict ?? '',
    climax: plan.climax ?? '',
    ending: plan.ending ?? '',
    steps: clone(plan.steps ?? []),
    foreshadowing: clone(plan.foreshadowing ?? []),
    facts: clone(plan.facts ?? []),
    revisions: clone(plan.revisions ?? []),
    status: options.status ?? plan.status ?? 'draft',
    currentStepIndex: plan.currentStepIndex ?? 0,
    pendingTurn: clone(plan.pendingTurn ?? null),
    createdAt: plan.createdAt ?? now,
    updatedAt: options.updatedAt ?? plan.updatedAt ?? now,
  };
}

export function createScriptRepository(store) {
  const tx = (chatKey, fingerprint, work) => store.transaction(chatKey, fingerprint, work);
  const find = (state, id) => state.scripts?.find((script) => script.id === id) ?? null;

  return {
    async createDraft(chatKey, fingerprint, plan) {
      const script = normalizeScript(plan, { status: 'draft' });
      await tx(chatKey, fingerprint, (state) => {
        state.scripts ??= [];
        state.scripts.push(script);
        state.selectedScriptId = script.id;
      });
      return clone(script);
    },
    async select(chatKey, fingerprint, scriptId) {
      return tx(chatKey, fingerprint, (state) => {
        if (!find(state, scriptId)) throw new Error('Script not found');
        state.selectedScriptId = scriptId;
        return clone(find(state, scriptId));
      });
    },
    getSelected(chatKey) {
      const state = store.loadChat(chatKey);
      return clone(find(state, state.selectedScriptId));
    },
    getActive(chatKey) {
      const state = store.loadChat(chatKey);
      return clone(find(state, state.activeScriptId));
    },
    async update(chatKey, fingerprint, scriptId, changes) {
      return tx(chatKey, fingerprint, (state) => {
        const script = find(state, scriptId);
        if (!script) throw new Error('Script not found');
        Object.assign(script, clone(changes), { updatedAt: new Date().toISOString() });
        if (state.activeScriptId === scriptId) state.activeEvent = script;
        return clone(script);
      });
    },
    async migrateLegacyEvent(chatKey, fingerprint) {
      return tx(chatKey, fingerprint, (state) => {
        state.scripts ??= [];
        if (!state.activeEvent) return null;
        const existing = find(state, state.activeEvent.id);
        const script = existing ?? normalizeScript(state.activeEvent, {
          status: state.activeEvent.status === 'awaiting-user' ? 'running' : state.activeEvent.status,
        });
        if (!existing) state.scripts.push(script);
        state.selectedScriptId ??= script.id;
        state.activeScriptId ??= script.id;
        state.activeEvent = find(state, state.activeScriptId);
        return clone(script);
      });
    },
  };
}
