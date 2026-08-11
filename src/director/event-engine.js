import { cloneValue } from '../state/migrations.js';

export function createEventEngine(store) {
  const tx = (chatKey, fingerprint, work) => store.transaction(chatKey, fingerprint, work);
  return {
    propose(event) { return { ...cloneValue(event), status: 'preview' }; },
    start(chatKey, fingerprint, event) { return tx(chatKey, fingerprint, (state) => {
      if (state.activeEvent) throw new Error('An active event already exists');
      state.activeEvent = { ...cloneValue(event), status: 'active', facts: cloneValue(event.facts ?? []) };
      state.status = 'active';
    }); },
    pause(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => { state.status = 'paused'; }); },
    resume(chatKey, fingerprint, options = {}) { return tx(chatKey, fingerprint, (state) => {
      if (state.status === 'stopped' && options.source === 'idle') throw new Error('Stopped events cannot be resumed by idle trigger');
      if (state.activeEvent) state.status = 'active';
    }); },
    stop(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => {
      state.activeEvent = null; state.pendingTransaction = null; state.status = 'stopped';
    }); },
    stage(chatKey, fingerprint, change) { return tx(chatKey, fingerprint, (state) => {
      state.pendingTransaction = cloneValue(change);
    }); },
    commit(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => {
      const pending = state.pendingTransaction;
      if (!pending) return;
      if (pending.eventPatch && state.activeEvent) Object.assign(state.activeEvent, cloneValue(pending.eventPatch));
      if (pending.facts?.length && state.activeEvent) state.activeEvent.facts.push(...cloneValue(pending.facts));
      if (pending.foreshadowing) state.foreshadowing.push(...cloneValue(pending.foreshadowing));
      if (pending.historySummary) state.historySummary = pending.historySummary;
      state.pendingTransaction = null;
    }); },
    rollback(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => { state.pendingTransaction = null; }); },
    promoteForeshadowing(chatKey, fingerprint, id) { return tx(chatKey, fingerprint, (state) => {
      if (state.activeEvent) throw new Error('An active event already exists');
      const index = state.foreshadowing.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Foreshadowing not found');
      state.activeEvent = { ...state.foreshadowing.splice(index, 1)[0], status: 'active' };
    }); },
    changeDirection(chatKey, fingerprint, patch) { return tx(chatKey, fingerprint, (state) => {
      if (state.activeEvent) Object.assign(state.activeEvent, cloneValue(patch));
    }); },
    reroll(chatKey, fingerprint, proposal) { return tx(chatKey, fingerprint, (state) => { state.pendingTransaction = { proposal: cloneValue(proposal) }; }); },
  };
}
