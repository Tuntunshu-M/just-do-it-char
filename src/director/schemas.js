const FEEDBACK = new Set(['accept', 'reject', 'hesitate', 'redirect', 'neutral', 'stop']);
const CATEGORIES = new Set(['daily', 'crisis', 'erotic']);
const REACTION_DECISIONS = new Set(['advance', 'revise', 'neutral', 'stop']);

function requireType(condition, message) {
  if (!condition) throw new TypeError(`Invalid director result: ${message}`);
}

function normalizeDirectorResult(value) {
  if (!value || typeof value !== 'object' || Array.isArray(value) || !Array.isArray(value.actions)) return value;
  return {
    ...value,
    actions: value.actions.map((item) => {
      if (!item || typeof item !== 'object' || Array.isArray(item) || item.action != null || typeof item.text !== 'string') return item;
      const { text, ...action } = item;
      return { ...action, action: text };
    }),
  };
}

export function validateDirectorResult(value, intent = {}) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'root must be an object');
  requireType(Object.hasOwn(value, 'event'), 'event field is required');
  if (value.event !== null) {
    requireType(value.event && typeof value.event === 'object', 'event must be an object or null');
    requireType(typeof value.event.title === 'string', 'event title is required');
    requireType(CATEGORIES.has(value.event.category), 'event category is unknown');
    requireType(Array.isArray(value.event.steps), 'event steps are required');
    if (intent.type === 'plan-event') {
      requireType(value.event.steps.length >= 5 && value.event.steps.length <= 7, 'event steps must contain 5 to 7 stages');
      const stepIds = value.event.steps.map((step) => step?.id);
      requireType(stepIds.every((id) => typeof id === 'string' && id), 'event step id is required');
      requireType(new Set(stepIds).size === stepIds.length, 'event step ids must be unique');
      if (intent.mainCategory) requireType(value.event.category === intent.mainCategory, 'event category must match selected main category');
      if (intent.castMode === 'multi') {
        const castIds = new Set(intent.castCharacterIds ?? []);
        requireType(castIds.size > 0, 'multi cast ids are required');
        for (const step of value.event.steps) {
          requireType(Array.isArray(step.activeCharacterIds), 'multi step activeCharacterIds are required');
          requireType(step.activeCharacterIds.length >= 2 && step.activeCharacterIds.length <= 4, 'multi step must activate 2 to 4 characters');
          requireType(new Set(step.activeCharacterIds).size === step.activeCharacterIds.length, 'multi step character ids must be unique');
          requireType(step.activeCharacterIds.every((id) => castIds.has(id)), 'multi step character id is unknown');
          requireType(typeof step.interaction === 'string' && step.interaction.trim(), 'multi step interaction is required');
        }
        requireType(new Set(value.event.steps.flatMap((step) => step.activeCharacterIds)).size >= Math.min(2, castIds.size), 'multi cast must rotate characters');
      }
    }
  }
  requireType(FEEDBACK.has(value.feedback?.classification), 'feedback classification is unknown');
  requireType(Array.isArray(value.actions), 'actions must be an array');
  for (const action of value.actions) {
    requireType(typeof action.characterId === 'string' && action.characterId, 'action characterId is required');
    requireType(typeof action.action === 'string' && action.action, 'action text is required');
    requireType(Array.isArray(action.evidence) && action.evidence.length > 0, 'action personality evidence is required');
  }
  for (const field of ['branches', 'risks', 'foreshadowing']) {
    requireType(Array.isArray(value[field]), `${field} must be an array`);
  }
  if (value.event !== null && intent.type === 'plan-event') {
    const [minimum, maximum] = intent.castMode === 'multi' ? [4, 6] : [3, 5];
    requireType(value.foreshadowing.length >= minimum && value.foreshadowing.length <= maximum, `foreshadowing must contain ${minimum} to ${maximum} items`);
    for (const clue of value.foreshadowing) {
      requireType(typeof clue?.id === 'string' && clue.id, 'foreshadowing id is required');
      requireType(typeof clue?.conditionFactId === 'string' && clue.conditionFactId, 'foreshadowing conditionFactId is required');
      requireType(Number.isFinite(Number(clue.maturity)), 'foreshadowing maturity is required');
      requireType(Number.isFinite(Number(clue.threshold)), 'foreshadowing threshold is required');
    }
  }
  if (value.leadChange != null) {
    requireType(typeof value.leadChange.nextLeadId === 'string' && value.leadChange.nextLeadId, 'lead change nextLeadId is required');
    requireType(typeof value.leadChange.motivation === 'string' && value.leadChange.motivation, 'lead change motivation is required');
    requireType(typeof value.leadChange.location === 'string' && value.leadChange.location, 'lead change location is required');
    requireType(typeof value.leadChange.knowledgeState === 'string' && value.leadChange.knowledgeState, 'lead change knowledge state is required');
  }
  requireType(value.ruleLedgerUpdate && typeof value.ruleLedgerUpdate === 'object', 'ruleLedgerUpdate is required');
  requireType(typeof value.injection === 'string' && value.injection.trim(), 'compact injection is required');
  return value;
}

export function validateReactionResult(value) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'reaction root must be an object');
  requireType(REACTION_DECISIONS.has(value.decision), 'reaction decision is unknown');
  if (value.decision === 'revise') requireType(Array.isArray(value.steps) && value.steps.length > 0, 'revised steps are required');
  if (value.steps != null) requireType(Array.isArray(value.steps), 'reaction steps must be an array');
  return value;
}

export function validateStepResult(value) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'step root must be an object');
  requireType(typeof value.injection === 'string' && value.injection.trim(), 'step injection is required');
  return value;
}

export function validateProfileResult(value) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'profile root must be an object');
  requireType(typeof value.content === 'string' && value.content.trim(), 'profile content is required');
  requireType(Array.isArray(value.citations), 'profile citations must be an array');
  for (const citation of value.citations) {
    requireType(typeof citation?.source === 'string' && citation.source, 'profile citation source is required');
    requireType(typeof citation?.excerpt === 'string', 'profile citation excerpt is required');
  }
  return value;
}

function parseJsonContent(content) {
  if (content && typeof content === 'object') return content;
  const text = String(content ?? '').trim();
  if (!text) throw new Error('Director API returned empty content');
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return JSON.parse(unfenced);
  } catch (initialError) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw initialError;
    return JSON.parse(text.slice(start, end + 1));
  }
}

export function parseDirectorResponse(content, intent = 'plan-event') {
  const value = parseJsonContent(content);
  const intentType = typeof intent === 'string' ? intent : intent?.type ?? 'plan-event';
  if (intentType === 'evaluate-reaction') return validateReactionResult(value);
  if (intentType === 'prepare-step') return validateStepResult(value);
  if (intentType === 'profile-character') return validateProfileResult(value);
  return validateDirectorResult(normalizeDirectorResult(value), typeof intent === 'string' ? { type: intent } : intent);
}

export function parseDirectorResult(content) {
  return validateDirectorResult(normalizeDirectorResult(parseJsonContent(content)));
}
