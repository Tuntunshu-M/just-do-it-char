function clone(value) {
  return value === undefined ? undefined : structuredClone(value);
}

function normalizeRunningSteps(steps = []) {
  return steps.map((step, index) => ({ ...clone(step), status: index === 0 ? 'current' : 'pending', order: step.order ?? index + 1 }));
}

export function createScriptRuntime({ store }) {
  const tx = (chatKey, fingerprint, work) => store.transaction(chatKey, fingerprint, work);
  const find = (state, id) => state.scripts?.find((script) => script.id === id);
  const assertActive = (state, id) => {
    if (state.activeScriptId !== id) throw new Error('Script is not active');
    const script = find(state, id);
    if (!script) throw new Error('Script not found');
    return script;
  };

  return {
    async perform(chatKey, fingerprint, scriptId, { confirmConflict } = {}) {
      const state = store.loadChat(chatKey);
      if (state.selectedScriptId !== scriptId) throw new Error('Select the script before performance');
      if (state.activeScriptId && state.activeScriptId !== scriptId) {
        const confirmed = await confirmConflict?.(find(state, state.activeScriptId), find(state, scriptId));
        if (!confirmed) throw new Error('Performance cancelled');
      }
      return tx(chatKey, fingerprint, (draft) => {
        if (draft.activeScriptId && draft.activeScriptId !== scriptId) {
          const previous = find(draft, draft.activeScriptId);
          if (previous) previous.status = 'stopped';
        }
        const script = find(draft, scriptId);
        if (!script) throw new Error('Script not found');
        if (!['draft', 'stopped'].includes(script.status)) throw new Error(`Script cannot be performed from ${script.status} status`);
        script.status = 'running';
        script.currentStepIndex = 0;
        script.pendingTurn = null;
        if (script.trigger) {
          script.trigger.status = 'pending';
          script.trigger.lastCheck = null;
        }
        script.steps = normalizeRunningSteps(script.steps);
        script.updatedAt = new Date().toISOString();
        draft.activeScriptId = script.id;
        draft.activeEvent = script;
        draft.status = 'awaiting-user';
        draft.pendingTransaction = null;
        return clone(script);
      });
    },
    pause(chatKey, fingerprint, scriptId) { return tx(chatKey, fingerprint, (state) => {
      const script = assertActive(state, scriptId);
      script.status = 'paused'; state.status = 'paused'; state.activeEvent = script;
    }); },
    resume(chatKey, fingerprint, scriptId) { return tx(chatKey, fingerprint, (state) => {
      const script = assertActive(state, scriptId);
      script.status = 'running'; state.status = 'awaiting-user'; state.activeEvent = script;
    }); },
    changeDirection(chatKey, fingerprint, scriptId, direction) { return tx(chatKey, fingerprint, (state) => {
      const script = assertActive(state, scriptId);
      script.revisions ??= [];
      script.revisions.push({ id: `revision-${Date.now()}`, createdAt: new Date().toISOString(), reason: String(direction ?? '').trim(), currentStepIndex: script.currentStepIndex });
      script.direction = String(direction ?? '').trim();
      state.activeEvent = script;
    }); },
    stop(chatKey, fingerprint, scriptId) { return tx(chatKey, fingerprint, (state) => {
      const script = assertActive(state, scriptId);
      script.status = 'stopped'; script.pendingTurn = null;
      state.activeScriptId = null; state.activeEvent = null; state.pendingTransaction = null; state.status = 'stopped';
    }); },
  };
}
