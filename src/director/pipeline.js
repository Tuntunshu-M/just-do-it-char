import { evaluatePolicy as defaultPolicy } from './policy.js';
import { EXTENSION_PROMPT_KEY } from '../constants.js';
import { startDiagnostic, updateDiagnostic } from '../diagnostics/records.js';
import { formatDirectorDiagnostic } from './failure-reasons.js';

function generationState(phase, previous = {}, error = '') {
  const finished = ['idle', 'completed', 'failed'].includes(phase);
  return {
    ...previous,
    phase,
    startedAt: previous.startedAt ?? new Date().toISOString(),
    finishedAt: finished ? new Date().toISOString() : null,
    error,
  };
}

export function createDirectorPipeline({ adapter, store, client, policy, personality, engine, collector, scheduler, onProgress, onOutcome }) {
  const inFlight = new Map();
  let generation = 0;

  async function persist(state, phase, error = '') {
    state.generation = generationState(phase, state.generation, error);
    await store.saveChat?.(state);
    onProgress?.(state);
  }

  async function requestWithPersonality(context, intent, connection, state, setStage) {
    let result = await client.requestDirector({ context, intent }, connection, (update) => {
      state.generation.phase = update.phase;
      onProgress?.(state);
    });
    if (!personality?.validate) return result;
    await setStage('validating');
    const validation = personality.validate(result, context);
    if (validation.allowed) return result;
    result = await client.requestDirector({
      context,
      intent: { ...intent, type: 'repair-personality', reasons: validation.reasons ?? [] },
    }, connection);
    const retryValidation = personality.validate(result, context);
    if (!retryValidation.allowed) throw new Error('导演结果连续两次未通过人格证据校验');
    return result;
  }

  async function execute(userText, intent, token, chatKey) {
    const settings = store.loadGlobal();
    if (!settings.enabled) return { skipped: true };
    let state = store.loadChat(chatKey);
    if (intent.type === 'advance') state.counters.turns = (state.counters.turns ?? 0) + 1;
    const automatic = intent.type === 'advance' || intent.type === 'idle';
    if (automatic && scheduler && !scheduler.shouldTrigger(state, settings.trigger, intent.environment)) return { skipped: true };

    const secrets = settings.connection ?? {};
    const diagnostic = startDiagnostic(state, { trigger: intent.type, stage: 'collecting' }, { secrets });
    let diagnosticStage = 'collecting';
    const setDiagnosticStage = async (stage) => {
      diagnosticStage = stage;
      updateDiagnostic(state, diagnostic.id, { stage }, { secrets });
      await store.saveChat?.(state);
      onProgress?.(state);
    };
    const finishDiagnostic = async (status, message = '') => {
      const record = updateDiagnostic(state, diagnostic.id, { status, stage: diagnosticStage, message }, { secrets });
      await store.saveChat?.(state);
      onProgress?.(state);
      try { await onOutcome?.({ ...record }); } catch { /* notifications must not break generation */ }
      return record;
    };

    await persist(state, 'collecting');
    let context;
    let result;
    let injectionCleared = false;
    try {
      context = await collector(adapter, state, settings);
      await setDiagnosticStage('generating');
      await persist(state, 'generating');
      result = await requestWithPersonality(context, intent, settings.connection, state, setDiagnosticStage);
    } catch (error) {
      await persist(state, 'failed', error.message);
      await finishDiagnostic('failed', formatDirectorDiagnostic(error));
      throw error;
    }

    if (token !== generation || adapter.getCurrentChatKey() !== chatKey) {
      await persist(state, 'idle');
      await finishDiagnostic('not-generated', '聊天已切换或本次生成已取消');
      return { cancelled: true };
    }

    await store.saveGlobal?.(settings);
    if (!result.event) {
      const message = result.feedback?.reason ?? result.feedback?.message ?? '本次判断未创建事件';
      await persist(state, 'idle', message);
      await finishDiagnostic('not-generated', message);
      return { status: 'not-generated', reason: message };
    }
    await setDiagnosticStage('policy');
    const check = (policy?.evaluatePolicy ?? defaultPolicy)({
      proposal: result.event, state, settings, userText,
    });
    if (!check.allowed) {
      const message = check.reasons?.join('; ') || '事件未通过当前规则检查';
      await persist(state, 'idle', message);
      await finishDiagnostic('not-generated', message);
      return check;
    }

    let staged = false;
    try {
      await engine.stage(chatKey, state.characterFingerprint, {
        proposal: result.event,
        foreshadowing: result.foreshadowing,
        ruleLedgerUpdate: result.ruleLedgerUpdate,
        lastInjection: result.injection,
      });
      staged = true;
      await setDiagnosticStage('injecting');
      await persist(state, 'injecting');
      await adapter.injectPrompt(EXTENSION_PROMPT_KEY, result.injection);
      await setDiagnosticStage('reply');
      await adapter.generateReply();
      await adapter.injectPrompt(EXTENSION_PROMPT_KEY, '');
      injectionCleared = true;
      await setDiagnosticStage('commit');
      const committedState = await engine.commit(chatKey, state.characterFingerprint);
      if (committedState?.chatKey) state = committedState;
      state.lastInjection = result.injection;
      if (result.event) {
        const dayKey = new Date().toISOString().slice(0, 10);
        if (state.counters.dayKey !== dayKey) state.counters.eventsToday = 0;
        state.counters.dayKey = dayKey;
        state.counters.eventsToday = (state.counters.eventsToday ?? 0) + 1;
        state.cooldowns.lastTurn = state.counters.turns ?? 0;
      }
      await persist(state, 'completed');
      await finishDiagnostic('success', result.event.title ?? '事件已生成');
      return result;
    } catch (error) {
      if (staged) await engine.rollback(chatKey, state.characterFingerprint);
      await persist(state, 'failed', error.message);
      await finishDiagnostic('failed', formatDirectorDiagnostic(error));
      throw error;
    } finally {
      if (!injectionCleared) await adapter.injectPrompt(EXTENSION_PROMPT_KEY, '');
    }
  }

  function run(userText, intent = { type: 'advance' }) {
    const chatKey = adapter.getCurrentChatKey();
    if (!chatKey) return Promise.resolve({ skipped: true, reason: 'no-chat' });
    if (inFlight.has(chatKey)) return inFlight.get(chatKey);
    const token = ++generation;
    const request = execute(userText, intent, token, chatKey).finally(() => {
      if (inFlight.get(chatKey) === request) inFlight.delete(chatKey);
    });
    inFlight.set(chatKey, request);
    return request;
  }

  async function regenerate({ rejudge = false } = {}) {
    const chatKey = adapter.getCurrentChatKey();
    const state = store.loadChat(chatKey);
    if (rejudge) return run('', { type: 'rejudge' });
    if (!state.lastInjection) return { skipped: true, reason: 'no-prior-instruction' };
    try {
      await adapter.injectPrompt(EXTENSION_PROMPT_KEY, state.lastInjection);
      await adapter.generateReply();
      return { reused: true };
    } finally {
      await adapter.injectPrompt(EXTENSION_PROMPT_KEY, '');
    }
  }

  return {
    handleUserMessage: (text) => run(text),
    handleIdle: (environment = {}) => run('', { type: 'idle', environment }),
    manualCreate: (text, expand = true) => run(text, { type: 'manual', expand }),
    regenerate,
    cancel() { generation += 1; },
  };
}
