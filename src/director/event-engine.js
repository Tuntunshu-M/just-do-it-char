import { cloneValue } from '../state/migrations.js';
import { mergeRuleLedger } from './rule-ledger.js';

export function createEventEngine(store) {
  const tx = (chatKey, fingerprint, work) => store.transaction(chatKey, fingerprint, work);

  function activeRecord(state) {
    return state.scripts?.find((script) => script.id === state.activeScriptId) ?? state.activeEvent ?? null;
  }

  function syncActiveAlias(state, event) {
    if (state.activeScriptId) state.activeEvent = event;
  }

  function finishEvent(state, event) {
    event.status = 'completed';
    event.updatedAt = new Date().toISOString();
    state.status = 'completed';
    if (state.activeScriptId && event.id === state.activeScriptId) {
      state.activeScriptId = null;
      state.activeEvent = null;
    }
  }

  function normalizeSteps(steps = [], currentStepIndex = 0, completedIds = new Set()) {
    return steps.map((step, index) => ({
      ...cloneValue(step),
      order: step.order ?? index + 1,
      status: completedIds.has(step.id) ? 'completed' : (index === currentStepIndex ? 'current' : 'pending'),
    }));
  }

  function normalizePlan(plan) {
    const currentStepIndex = Math.max(0, Math.min(plan.currentStepIndex ?? 0, Math.max(0, (plan.steps?.length ?? 1) - 1)));
    return {
      ...cloneValue(plan),
      steps: normalizeSteps(plan.steps, currentStepIndex),
      currentStepIndex,
      status: plan.steps?.length ? 'awaiting-user' : 'completed',
      facts: cloneValue(plan.facts ?? []),
      foreshadowing: cloneValue(plan.foreshadowing ?? []),
      revisions: cloneValue(plan.revisions ?? []),
      lastEvaluatedUserMessageId: plan.lastEvaluatedUserMessageId ?? null,
      pendingTurn: null,
    };
  }

  function revisionSnapshot(event, reason = '') {
    return {
      id: `revision-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      createdAt: new Date().toISOString(),
      reason,
      outline: {
        title: event.title,
        premise: event.premise ?? '',
        steps: cloneValue(event.steps ?? []),
        foreshadowing: cloneValue(event.foreshadowing ?? []),
      },
      currentStepIndex: event.currentStepIndex ?? 0,
    };
  }
  function assertFactsImmutable(state, incoming = []) {
    const occurred = new Map((activeRecord(state)?.facts ?? [])
      .filter((fact) => typeof fact === 'object' && fact.occurred)
      .map((fact) => [fact.id, fact]));
    for (const fact of incoming) {
      const previous = typeof fact === 'object' ? occurred.get(fact.id) : null;
      if (previous && JSON.stringify(previous) !== JSON.stringify(fact)) {
        throw new Error(`Occurred fact ${fact.id} is immutable`);
      }
    }
  }
  return {
    propose(event) { return { ...cloneValue(event), status: 'preview' }; },
    activatePlan(chatKey, fingerprint, plan) { return tx(chatKey, fingerprint, (state) => {
      state.activeEvent = normalizePlan(plan);
      state.status = state.activeEvent.status;
      state.pendingTransaction = null;
      return state;
    }); },
    getEligibleForeshadowing(chatKey, fingerprint) {
      const state = store.loadChat(chatKey);
      const event = activeRecord(state);
      const index = event?.currentStepIndex ?? 0;
      const currentId = event?.steps?.[index]?.id;
      const occurred = new Set((event?.facts ?? []).filter((fact) => fact?.occurred).map((fact) => fact.id));
      return (event?.foreshadowing ?? []).filter((clue) => {
        const mature = Number.isFinite(Number(clue.maturity))
          && Number.isFinite(Number(clue.threshold))
          && Number(clue.maturity) >= Number(clue.threshold);
        const revealMatches = !clue.revealStepId || clue.revealStepId === currentId;
        const conditionMet = occurred.has(clue.conditionFactId);
        return mature && revealMatches && conditionMet;
      }).map((clue) => cloneValue(clue));
    },
    applyReaction(chatKey, fingerprint, reaction, retention = 3) { return tx(chatKey, fingerprint, (state) => {
      const event = activeRecord(state);
      if (!event) throw new Error('No active event');
      const decision = reaction?.decision ?? 'neutral';
      if (decision === 'stop') {
        finishEvent(state, event);
        return state;
      }
      if (decision === 'advance') {
        if (reaction?.advanceSatisfied !== true || typeof reaction?.evidence !== 'string' || !reaction.evidence.trim()) return state;
        const current = event.steps?.[event.currentStepIndex];
        if (current) current.status = 'completed';
        event.currentStepIndex += 1;
        if (event.currentStepIndex >= (event.steps?.length ?? 0)) {
          finishEvent(state, event);
        } else {
          event.steps[event.currentStepIndex].status = 'current';
          if (state.activeScriptId) event.status = 'running';
          event.updatedAt = new Date().toISOString();
          syncActiveAlias(state, event);
        }
        return state;
      }
    if (decision === 'revise') {
      const limit = Math.max(1, Math.min(3, Number(retention) || 3));
      event.revisions ??= [];
      event.revisions.push(revisionSnapshot(event, reaction.reason));
      event.revisions = event.revisions.slice(-limit);
      const completed = (event.steps ?? []).filter((step) => step.status === 'completed');
      const completedIds = new Set(completed.map((step) => step.id));
      const future = cloneValue(reaction.steps ?? []);
      event.currentStepIndex = completed.length;
      event.steps = [
        ...completed,
        ...normalizeSteps(future, 0, completedIds),
      ];
      if (future.length) {
        event.status = state.activeScriptId ? 'running' : 'awaiting-user';
        event.updatedAt = new Date().toISOString();
        state.status = 'awaiting-user';
        syncActiveAlias(state, event);
        } else finishEvent(state, event);
      }
      return state;
    }); },
    restoreRevision(chatKey, fingerprint, revisionId) { return tx(chatKey, fingerprint, (state) => {
      const event = activeRecord(state);
      const revision = event?.revisions?.find((item) => item.id === revisionId);
      if (!event || !revision) throw new Error('Revision not found');
      const completed = (event.steps ?? []).filter((step) => step.status === 'completed');
      const completedIds = new Set(completed.map((step) => step.id));
      const restoredFuture = (revision.outline.steps ?? []).filter((step) => !completedIds.has(step.id));
      event.title = revision.outline.title ?? event.title;
      event.premise = revision.outline.premise ?? event.premise;
      event.foreshadowing = cloneValue(revision.outline.foreshadowing ?? []);
      event.currentStepIndex = completed.length;
      event.steps = [...completed, ...normalizeSteps(restoredFuture, 0, completedIds)];
      if (restoredFuture.length) {
        event.status = state.activeScriptId ? 'running' : 'awaiting-user';
        event.updatedAt = new Date().toISOString();
        state.status = 'awaiting-user';
        syncActiveAlias(state, event);
      } else finishEvent(state, event);
      return state;
    }); },
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
      assertFactsImmutable(state, change.facts);
      state.pendingTransaction = cloneValue(change);
    }); },
    commit(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => {
      const pending = state.pendingTransaction;
      if (!pending) return;
      if (pending.proposal && !state.activeEvent) {
        state.activeEvent = { ...cloneValue(pending.proposal), status: 'active', facts: cloneValue(pending.proposal.facts ?? []) };
        state.status = 'active';
      }
      if (pending.eventPatch && state.activeEvent) Object.assign(state.activeEvent, cloneValue(pending.eventPatch));
      if (pending.facts?.length && state.activeEvent) state.activeEvent.facts.push(...cloneValue(pending.facts));
      if (pending.foreshadowing) state.foreshadowing.push(...cloneValue(pending.foreshadowing));
      if (pending.ruleLedgerUpdate) state.ruleLedger = mergeRuleLedger(state.ruleLedger, pending.ruleLedgerUpdate);
      if (pending.historySummary) state.historySummary = pending.historySummary;
      if (pending.lastInjection) state.lastInjection = pending.lastInjection;
      state.pendingTransaction = null;
    }); },
    rollback(chatKey, fingerprint) { return tx(chatKey, fingerprint, (state) => { state.pendingTransaction = null; }); },
    promoteForeshadowing(chatKey, fingerprint, id) { return tx(chatKey, fingerprint, (state) => {
      if (state.activeEvent) throw new Error('An active event already exists');
      const index = state.foreshadowing.findIndex((item) => item.id === id);
      if (index < 0) throw new Error('Foreshadowing not found');
      const clue = state.foreshadowing[index];
      if ((clue.maturity ?? 0) < (clue.threshold ?? 1)) throw new Error('Foreshadowing is not mature');
      state.activeEvent = { ...state.foreshadowing.splice(index, 1)[0], status: 'active' };
    }); },
    changeDirection(chatKey, fingerprint, patch) { return tx(chatKey, fingerprint, (state) => {
      if ('facts' in patch) throw new Error('Occurred facts are immutable during direction changes');
      if (state.activeEvent) Object.assign(state.activeEvent, cloneValue(patch));
    }); },
    reroll(chatKey, fingerprint, proposal) { return tx(chatKey, fingerprint, (state) => { state.pendingTransaction = { proposal: cloneValue(proposal) }; }); },
    reconcileEditedMessage(chatKey, fingerprint, message) { return tx(chatKey, fingerprint, (state) => {
      state.historySummary = String(message?.text ?? '').trim();
      state.pendingTransaction = null;
      return { historySummary: state.historySummary, facts: cloneValue(state.activeEvent?.facts ?? []) };
    }); },
  };
}
