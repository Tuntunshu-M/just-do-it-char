import { evaluatePolicy as defaultPolicy, selectEventCategory } from './policy.js';
import { EXTENSION_PROMPT_KEY } from '../constants.js';
import { startDiagnostic, updateDiagnostic } from '../diagnostics/records.js';
import { formatDirectorDiagnostic } from './failure-reasons.js';

function generationState(phase, previous = {}, error = '') {
  const finished = ['idle', 'completed', 'failed'].includes(phase);
  return { ...previous, phase, startedAt: previous.startedAt ?? new Date().toISOString(), finishedAt: finished ? new Date().toISOString() : null, error };
}

export function createDirectorPipeline({ adapter, store, client, policy, personality, engine, repository, collector, scheduler, onProgress, onOutcome, onNotice, onScriptCreated }) {
  const inFlight = new Map();
  let generation = 0;

  async function persist(state, phase, error = '') {
    state.generation = generationState(phase, state.generation, error);
    await store.saveChat?.(state);
    onProgress?.(state);
  }

  async function request(context, intent, connection, state) {
    const result = await client.requestDirector({ context, intent }, connection, (update) => {
      state.generation.phase = update.phase;
      onProgress?.(state);
    });
    if (!personality?.validate || intent.type !== 'plan-event') return result;
    const validation = personality.validate(result, context);
    if (validation.allowed) return result;
    const retry = await client.requestDirector({ context, intent: { ...intent, type: 'repair-personality', reasons: validation.reasons ?? [] } }, connection);
    const retryValidation = personality.validate(retry, context);
    if (!retryValidation.allowed) throw new Error('导演结果连续两次未通过人物证据校验');
    return retry;
  }

  async function finish(state, diagnostic, stage, status, message, secrets) {
    const record = updateDiagnostic(state, diagnostic.id, { status, stage, message }, { secrets });
    await store.saveChat?.(state);
    onProgress?.(state);
    try { await onOutcome?.({ ...record }); } catch { /* notices must not break host generation */ }
    return record;
  }

  async function planEvent(text, intent, token, chatKey) {
    const settings = store.loadGlobal();
    if (!settings.enabled) return { skipped: true };
    const state = store.loadChat(chatKey);
    const profile = state.personalityProfile ?? {};
    if (!['ready', 'ready-ignored'].includes(profile.status)) {
      const reason = profile.status === 'stale-pending'
        ? '角色资料有改动，要重新生成侧写吗？'
        : profile.error === '还没连接副 API' ? profile.error : '导演还在看人设';
      await persist(state, 'idle', reason);
      onNotice?.(reason);
      return { skipped: true, reason };
    }
    const secrets = settings.connection ?? {};
    const diagnostic = startDiagnostic(state, { trigger: intent.type, stage: 'collecting' }, { secrets });
    let stage = 'collecting';
    try {
      await persist(state, 'collecting');
      const context = await collector(adapter, state, settings);
      stage = 'generating'; await persist(state, stage);
      const category = selectEventCategory(settings.categories, { requestedCategory: intent.requestedCategory });
      const eventIntent = {
        ...intent,
        type: 'plan-event',
        userText: text,
        ...category,
        castMode: state.cast?.mode ?? 'single',
        castCharacterIds: state.cast?.members?.map((member) => member.id).filter(Boolean) ?? [],
      };
      const result = await request(context, eventIntent, settings.connection, state);
      if (token !== generation || adapter.getCurrentChatKey() !== chatKey) return { cancelled: true };
      await store.saveGlobal?.(settings);
      if (!result.event) {
        const message = result.feedback?.reason ?? '本次没有生成事件';
        await persist(state, 'idle', message); await finish(state, diagnostic, stage, 'not-generated', message, secrets);
        return { status: 'not-generated', reason: message };
      }
      stage = 'policy'; await persist(state, stage);
      const check = (policy?.evaluatePolicy ?? defaultPolicy)({ proposal: result.event, state, settings, userText: text });
      if (!check.allowed) {
        const message = check.reasons?.join('; ') || '事件未通过当前规则检查';
        await persist(state, 'idle', message); await finish(state, diagnostic, stage, 'not-generated', message, secrets);
        return check;
      }
      const plan = { ...result.event, foreshadowing: result.foreshadowing, ruleLedgerUpdate: result.ruleLedgerUpdate, facts: result.facts };
      stage = 'commit'; await persist(state, stage);
      const script = await repository.createDraft(chatKey, state.characterFingerprint, plan);
      Object.assign(state, store.loadChat(chatKey));
      await persist(state, 'completed');
      await finish(state, diagnostic, stage, 'success', '剧本已准备', secrets);
      onScriptCreated?.(script.id);
      onNotice?.('新剧本已准备');
      return { ...result, status: 'planned', scriptId: script.id };
    } catch (error) {
      await persist(state, 'failed', error.message);
      await finish(state, diagnostic, stage, 'failed', formatDirectorDiagnostic(error), secrets);
      throw error;
    }
  }

  async function prepareTurn(text, messageId, token, chatKey) {
    const settings = store.loadGlobal();
    const state = store.loadChat(chatKey);
    const event = state.activeEvent;
    if (!settings.enabled || !event || state.status !== 'awaiting-user') return { skipped: true };
    if (event.pendingTurn?.messageId === messageId) return { reused: true };
    const context = await collector(adapter, state, settings);
    if (event.pendingTurn && event.pendingTurn.messageId !== messageId) {
      const reaction = await request({ ...context, latestUserMessage: text, activeEvent: event }, { type: 'evaluate-reaction' }, settings.connection, state);
      await engine.applyReaction(chatKey, state.characterFingerprint, reaction, settings.defaults?.revisionRetention ?? 3);
      Object.assign(state, store.loadChat(chatKey));
    }
    const current = state.activeEvent?.steps?.[state.activeEvent.currentStepIndex];
    if (!current || state.activeEvent.status === 'completed') return { status: 'completed' };
    const eligibleForeshadowing = engine.getEligibleForeshadowing?.(chatKey, state.characterFingerprint) ?? [];
    const stepContext = {
      latestUserMessage: text,
      currentStep: current,
      activeCharacters: current.activeCharacterIds ?? current.characterIds ?? [],
      occurredFacts: state.activeEvent?.facts ?? [],
      characterKnowledge: context.cast?.members?.map((member) => ({ id: member.id, knowledgeState: member.knowledgeState ?? '' })) ?? [],
      eligibleForeshadowing,
      personalityProfile: context.personalityProfile,
    };
    const result = await request(stepContext, { type: 'prepare-step' }, settings.connection, state);
    if (token !== generation || adapter.getCurrentChatKey() !== chatKey) return { cancelled: true };
    await adapter.injectPrompt(EXTENSION_PROMPT_KEY, result.injection);
    state.activeEvent.pendingTurn = { messageId, stepId: current.id, injection: result.injection };
    state.lastInjection = result.injection;
    state.status = 'awaiting-user';
    await store.saveChat?.(state); onProgress?.(state);
    return { ...result, status: 'prepared' };
  }

  function run(work, chatKey) {
    if (inFlight.has(chatKey)) return inFlight.get(chatKey);
    const token = ++generation;
    const promise = work(token).finally(() => { if (inFlight.get(chatKey) === promise) inFlight.delete(chatKey); });
    inFlight.set(chatKey, promise);
    return promise;
  }

  return {
    manualCreate(text, expand = true) {
      const chatKey = adapter.getCurrentChatKey();
      return chatKey ? run((token) => planEvent(text, { type: 'manual', expand }, token, chatKey), chatKey) : Promise.resolve({ skipped: true, reason: 'no-chat' });
    },
    handleUserMessage(text, messageId = `message-${Date.now()}`) {
      const chatKey = adapter.getCurrentChatKey();
      return chatKey ? run((token) => prepareTurn(text, messageId, token, chatKey), chatKey) : Promise.resolve({ skipped: true, reason: 'no-chat' });
    },
    clearTurnInjection: async ({ resetTurn = false } = {}) => {
      await adapter.injectPrompt(EXTENSION_PROMPT_KEY, '');
      const chatKey = adapter.getCurrentChatKey();
      const state = chatKey && store.loadChat(chatKey);
      if (resetTurn && state?.activeEvent?.pendingTurn) {
        state.activeEvent.pendingTurn = null;
        await store.saveChat?.(state);
        onProgress?.(state);
      }
    },
    regeneratePlan(text = '') { return this.manualCreate(text, true); },
    cancel() { generation += 1; },
  };
}
