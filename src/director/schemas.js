const FEEDBACK = new Set(['accept', 'reject', 'hesitate', 'redirect', 'neutral', 'stop']);
const CATEGORIES = new Set(['daily', 'crisis', 'erotic']);

function requireType(condition, message) {
  if (!condition) throw new TypeError(`Invalid director result: ${message}`);
}

export function validateDirectorResult(value) {
  requireType(value && typeof value === 'object' && !Array.isArray(value), 'root must be an object');
  if (value.event !== null) {
    requireType(value.event && typeof value.event === 'object', 'event must be an object or null');
    requireType(typeof value.event.title === 'string', 'event title is required');
    requireType(CATEGORIES.has(value.event.category), 'event category is unknown');
    requireType(Array.isArray(value.event.steps), 'event steps are required');
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

export function parseDirectorResult(content) {
  if (content && typeof content === 'object') return validateDirectorResult(content);
  const text = String(content ?? '').trim();
  const unfenced = text.replace(/^```(?:json)?\s*/i, '').replace(/\s*```$/, '');
  try {
    return validateDirectorResult(JSON.parse(unfenced));
  } catch (initialError) {
    const start = text.indexOf('{');
    const end = text.lastIndexOf('}');
    if (start < 0 || end <= start) throw initialError;
    return validateDirectorResult(JSON.parse(text.slice(start, end + 1)));
  }
}
