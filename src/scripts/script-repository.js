function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function createId() {
  return `script-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function legacyScriptStatus(status) {
  if (['awaiting-user', 'active', 'running'].includes(status)) return 'running';
  if (status === 'paused') return 'paused';
  if (['completed', 'stopped'].includes(status)) return status;
  return 'stopped';
}

const PROTECTED_UPDATE_FIELDS = ['id', 'status', 'currentStepIndex', 'pendingTurn', 'createdAt', 'updatedAt'];

export function normalizeScript(plan = {}, options = {}) {
  const now = options.now ?? new Date().toISOString();
  const status = options.status ?? plan.status ?? 'draft';
  const steps = clone(plan.steps ?? []).map((step, index) => ({
    ...step,
    ...(status === 'draft' ? { status: 'pending' } : {}),
    order: step.order ?? index + 1,
  }));
  return {
    id: options.id ?? plan.id ?? createId(),
    title: plan.title ?? '未命名剧本',
    category: plan.category ?? '',
    premise: plan.premise ?? '',
    trigger: plan.trigger ? {
      ...clone(plan.trigger),
      status: plan.trigger.status ?? 'pending',
      lastCheck: clone(plan.trigger.lastCheck ?? null),
    } : null,
    steps,
    foreshadowing: clone(plan.foreshadowing ?? []),
    facts: clone(plan.facts ?? []),
    revisions: clone(plan.revisions ?? []),
    status,
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
      const script = normalizeScript(plan, { status: plan.status ?? 'draft' });
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
        const editable = clone(changes) ?? {};
        for (const key of PROTECTED_UPDATE_FIELDS) delete editable[key];
        Object.assign(script, editable, { updatedAt: new Date().toISOString() });
        if (state.activeScriptId === scriptId) state.activeEvent = script;
        return clone(script);
      });
    },
    async remove(chatKey, fingerprint, scriptIds = []) {
      return tx(chatKey, fingerprint, (state) => {
        const requested = new Set(Array.isArray(scriptIds) ? scriptIds : [scriptIds]);
        const protectedIds = state.scripts.filter((script) => requested.has(script.id) && ['running', 'paused'].includes(script.status)).map((script) => script.id);
        const removedIds = state.scripts.filter((script) => requested.has(script.id) && !['running', 'paused'].includes(script.status)).map((script) => script.id);
        state.scripts = state.scripts.filter((script) => !removedIds.includes(script.id));
        if (!state.scripts.some((script) => script.id === state.selectedScriptId)) {
          state.selectedScriptId = state.activeScriptId && state.scripts.some((script) => script.id === state.activeScriptId)
            ? state.activeScriptId
            : state.scripts[0]?.id ?? null;
        }
        return { removedIds, protectedIds };
      });
    },
    async clear(chatKey, fingerprint) {
      return tx(chatKey, fingerprint, (state) => {
        const protectedIds = state.scripts.filter((script) => ['running', 'paused'].includes(script.status)).map((script) => script.id);
        const removedIds = state.scripts.filter((script) => !['running', 'paused'].includes(script.status)).map((script) => script.id);
        state.scripts = state.scripts.filter((script) => ['running', 'paused'].includes(script.status));
        state.selectedScriptId = state.activeScriptId && state.scripts.some((script) => script.id === state.activeScriptId)
          ? state.activeScriptId
          : state.scripts[0]?.id ?? null;
        return { removedIds, protectedIds };
      });
    },
    async migrateLegacyEvent(chatKey, fingerprint) {
      return tx(chatKey, fingerprint, (state) => {
        state.scripts ??= [];
        if (!state.activeEvent) return null;
        const existing = find(state, state.activeEvent.id);
        const status = legacyScriptStatus(state.activeEvent.status);
        const script = existing ?? normalizeScript(state.activeEvent, {
          status,
        });
        if (!existing) state.scripts.push(script);
        state.selectedScriptId ??= script.id;
        if (['running', 'paused'].includes(script.status)) state.activeScriptId ??= script.id;
        else if (state.activeScriptId === script.id) state.activeScriptId = null;
        state.activeEvent = find(state, state.activeScriptId);
        return clone(script);
      });
    },
  };
}
