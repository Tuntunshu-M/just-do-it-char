const STOP_PATTERNS = [/\b(?:ooc|out of character)\s*[:：]?\s*(?:stop|停止)\b/i, /场外.{0,4}(?:停止|停下|结束)/i];

export function normalizeWeights(categories = {}) {
  const enabled = Object.entries(categories).filter(([, value]) => value?.enabled && Number(value.weight) > 0);
  const total = enabled.reduce((sum, [, value]) => sum + Number(value.weight), 0);
  return Object.fromEntries(enabled.map(([key, value]) => [key, Number(value.weight) / total]));
}

function stopState(state) {
  state.activeEvent = null;
  state.pendingTransaction = null;
  if (state.sceneSafety) state.sceneSafety.stopped = true;
  state.status = 'stopped';
}

function hasStopSignal(text, safety = {}) {
  const normalized = String(text ?? '').trim().toLocaleLowerCase();
  const safeword = (safety.safewords ?? []).some((word) => word && normalized.includes(String(word).toLocaleLowerCase()));
  return safeword || STOP_PATTERNS.some((pattern) => pattern.test(normalized));
}

export function evaluatePolicy({ proposal, state, settings, userText = '', stopRequested = false }) {
  if (stopRequested || hasStopSignal(userText, state.sceneSafety)) {
    stopState(state);
    return { allowed: false, action: 'stop', reasons: ['Scene halted'] };
  }
  const category = settings.categories?.[proposal.category];
  if (!category?.enabled) return { allowed: false, action: 'block', reasons: ['Event category is disabled'] };
  if (proposal.category === 'erotic' && proposal.cnc && !state.sceneSafety?.cncEnabled) {
    return { allowed: false, action: 'block', reasons: ['High-risk mode is disabled'] };
  }
  const hardLimits = new Set(state.sceneSafety?.hardLimits ?? []);
  if ((proposal.tags ?? []).some((tag) => hardLimits.has(tag))) {
    return { allowed: false, action: 'block', reasons: ['Proposal intersects a hard limit'] };
  }
  for (const consequence of proposal.consequences ?? []) {
    const permission = state.preference?.consequencePermissions?.[consequence]
      ?? settings.defaults?.consequencePermissions?.[consequence]
      ?? 'ask';
    if (permission === 'forbidden') return { allowed: false, action: 'block', reasons: [`Consequence is forbidden: ${consequence}`] };
    if (permission === 'ask') return { allowed: false, action: 'ask', reasons: [`Consequence requires confirmation: ${consequence}`] };
  }
  const userAgency = state.preference?.userAgency ?? settings.defaults?.userAgency ?? 80;
  const userAgencyLevel = userAgency >= 67 ? 'user-led' : userAgency >= 34 ? 'shared' : 'character-led';
  return { allowed: true, action: 'allow', reasons: [], userAgency, userAgencyLevel };
}
