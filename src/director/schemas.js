const FEEDBACK = new Set(['accept', 'reject', 'hesitate', 'redirect', 'neutral', 'stop']);
const CATEGORIES = new Set(['daily', 'crisis', 'erotic']);
const REACTION_DECISIONS = new Set(['advance', 'revise', 'neutral', 'stop']);
const FORESHADOWING_STATUSES = new Set(['已回收', '未注入', '使用中', '待使用']);
const USER_REFERENCE = String.raw`(?:\{\{\s*user\s*\}\}|user|用户)`;
const USER_PREPLANNED_BEHAVIOR = String.raw`(?:已经|已|将要|将|会|随后|最终|必然|被迫|必须)?\s*(?:决定|选择(?!空间|机会|余地|窗口|权利)|行动(?!空间|自由|选择)|前往|接受|拒绝|受伤|摔倒|死亡|成功|失败|答应|同意|说出|做出)`;
const USER_AGENCY_RE = new RegExp(String.raw`${USER_REFERENCE}\s*${USER_PREPLANNED_BEHAVIOR}`, 'i');

function requireType(condition, message) {
  if (!condition) throw new TypeError(`Invalid director result: ${message}`);
}

function assertUserAgencySafe(value, path = 'event') {
  if (typeof value === 'string') {
    requireType(!USER_AGENCY_RE.test(value), `user agency is preplanned in ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertUserAgencySafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) {
      if (key === 'userPlan') requireType(false, 'user agency field userPlan is forbidden');
      assertUserAgencySafe(item, `${path}.${key}`);
    }
  }
}

function assertMultiCharacterInteractionSafe(value, path) {
  if (typeof value === 'string') {
    requireType(!new RegExp(USER_REFERENCE, 'i').test(value), `multi-character interaction must not reference user in ${path}`);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertMultiCharacterInteractionSafe(item, `${path}[${index}]`));
    return;
  }
  if (value && typeof value === 'object') {
    for (const [key, item] of Object.entries(value)) assertMultiCharacterInteractionSafe(item, `${path}.${key}`);
  }
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
      requireType(typeof value.event.premise === 'string' && value.event.premise.trim(), 'event premise is required');
      requireType(value.event.steps.length >= 2 && value.event.steps.length <= 4, 'event steps must contain 2 to 4 stages');
      requireType(value.event.trigger && typeof value.event.trigger === 'object' && !Array.isArray(value.event.trigger), 'event trigger is required');
      requireType(new Set(['keywords', 'phrases']).has(value.event.trigger.mode), 'event trigger mode is unknown');
      requireType(typeof value.event.trigger.condition === 'string' && value.event.trigger.condition.trim(), 'event trigger condition is required');
      const triggerTerms = value.event.trigger[value.event.trigger.mode];
      requireType(Array.isArray(triggerTerms) && triggerTerms.some((term) => typeof term === 'string' && term.trim()), `event trigger ${value.event.trigger.mode} are required`);
      const stepIds = value.event.steps.map((step) => step?.id);
      requireType(stepIds.every((id) => typeof id === 'string' && id), 'event step id is required');
      requireType(new Set(stepIds).size === stepIds.length, 'event step ids must be unique');
      for (const step of value.event.steps) {
        requireType(typeof step.title === 'string' && step.title.trim(), 'event step title is required');
        requireType(typeof step.activity === 'string' && step.activity.trim(), 'event step character activity is required');
        requireType(Array.isArray(step.splitSteps) && step.splitSteps.length > 0, 'event step splitSteps are required');
      }
      assertUserAgencySafe(value.event);
      if (intent.mainCategory) requireType(value.event.category === intent.mainCategory, 'event category must match selected main category');
      if (intent.castMode === 'multi') {
        const castIds = new Set(intent.castCharacterIds ?? []);
        requireType(castIds.size > 0, 'multi cast ids are required');
        for (const step of value.event.steps) {
          requireType(Array.isArray(step.activeCharacterIds), 'multi step activeCharacterIds are required');
          requireType(step.activeCharacterIds.length >= 1, 'multi step must activate at least one character');
          requireType(new Set(step.activeCharacterIds).size === step.activeCharacterIds.length, 'multi step character ids must be unique');
          requireType(step.activeCharacterIds.every((id) => castIds.has(id)), 'multi step character id is unknown');
          requireType(typeof step.interaction === 'string' && step.interaction.trim(), 'multi step interaction is required');
          requireType(Array.isArray(step.characterActions), 'multi step characterActions are required');
          assertMultiCharacterInteractionSafe(step.activity, 'event step activity');
          assertMultiCharacterInteractionSafe(step.interaction, 'event step interaction');
          assertMultiCharacterInteractionSafe(step.characterActions, 'event step characterActions');
          const actionIds = new Set(step.characterActions.map((item) => item?.characterId));
          requireType(step.activeCharacterIds.every((id) => actionIds.has(id)), 'multi step character action is required for every active character');
          for (const action of step.characterActions) {
            requireType(typeof action?.goal === 'string' && action.goal.trim(), 'multi step character goal is required');
            requireType(typeof action?.action === 'string' && action.action.trim(), 'multi step character action is required');
          }
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
    const stepTitles = new Set(value.event.steps.map((step) => step.title.trim()));
    requireType(value.foreshadowing.length >= minimum && value.foreshadowing.length <= maximum, `foreshadowing must contain ${minimum} to ${maximum} items`);
    for (const clue of value.foreshadowing) {
      requireType(typeof clue?.id === 'string' && clue.id, 'foreshadowing id is required');
      requireType(typeof clue?.conditionFactId === 'string' && clue.conditionFactId, 'foreshadowing conditionFactId is required');
      requireType(Number.isFinite(Number(clue.maturity)), 'foreshadowing maturity is required');
      requireType(Number.isFinite(Number(clue.threshold)), 'foreshadowing threshold is required');
      requireType(FORESHADOWING_STATUSES.has(clue.status), 'foreshadowing status is unknown');
      requireType(typeof clue.connectedStepTitle === 'string' && stepTitles.has(clue.connectedStepTitle.trim()), 'foreshadowing connected stage title is unknown');
    }
    assertUserAgencySafe(value.foreshadowing, 'foreshadowing');
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
  if (value.decision === 'advance') {
    requireType(value.advanceSatisfied === true, 'advanceSatisfied must be true to advance');
    requireType(typeof value.evidence === 'string' && value.evidence.trim(), 'advance evidence is required');
  }
  if (value.decision === 'revise') requireType(Array.isArray(value.steps) && value.steps.length > 0, 'revised steps are required');
  if (value.steps != null) requireType(Array.isArray(value.steps), 'reaction steps must be an array');
  return value;
}

export function validateStepResult(value) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'step root must be an object');
  requireType(typeof value.injection === 'string' && value.injection.trim(), 'step injection is required');
  return value;
}

export function validateProfileResult(value, intent = {}) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'profile root must be an object');
  requireType(typeof value.content === 'string' && value.content.trim(), 'profile content is required');
  requireType(Array.isArray(value.citations), 'profile citations must be an array');
  for (const citation of value.citations) {
    requireType(typeof citation?.source === 'string' && citation.source, 'profile citation source is required');
    requireType(typeof citation?.excerpt === 'string', 'profile citation excerpt is required');
  }
  if (intent.castMode === 'multi') {
    requireType(Array.isArray(value.members), 'profile members must be an array');
    requireType(Array.isArray(value.relations), 'profile relations must be an array');
    for (const member of value.members) {
      requireType(typeof member?.id === 'string' && member.id, 'profile member id is required');
      requireType(typeof member?.name === 'string' && member.name, 'profile member name is required');
      requireType(typeof member?.knowledgeBoundary === 'string', 'profile member knowledgeBoundary is required');
      for (const field of ['personality', 'background', 'relationship', 'attitude', 'goal', 'speechStyle', 'activeApproach']) {
        requireType(typeof member?.[field] === 'string' && member[field].trim(), `profile member ${field} is required`);
      }
    }
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
  if (intentType === 'profile-character') return validateProfileResult(value, typeof intent === 'string' ? {} : intent);
  return validateDirectorResult(normalizeDirectorResult(value), typeof intent === 'string' ? { type: intent } : intent);
}

export function parseDirectorResult(content) {
  return validateDirectorResult(normalizeDirectorResult(parseJsonContent(content)));
}
