import { createRuleLedger } from '../state/default-state.js';
import { cloneValue, mergeDefaults } from '../state/migrations.js';

const LIST_FIELDS = [
  'publishedRules', 'hypotheses', 'triggeredTaboos', 'objectives', 'items',
  'anomalies', 'hiddenTruths', 'falseRules',
];

function identity(value) {
  if (value && typeof value === 'object') return value.id ?? JSON.stringify(value);
  return String(value);
}

function mergeList(current = [], updates = []) {
  const result = cloneValue(current);
  const index = new Map(result.map((item, position) => [identity(item), position]));
  for (const item of updates ?? []) {
    const key = identity(item);
    if (index.has(key)) result[index.get(key)] = cloneValue(item);
    else {
      index.set(key, result.length);
      result.push(cloneValue(item));
    }
  }
  return result;
}

function protectPublishedRules(current, updates) {
  const known = new Map((current ?? []).filter((rule) => rule?.id).map((rule) => [rule.id, rule]));
  for (const rule of updates ?? []) {
    const previous = rule?.id ? known.get(rule.id) : null;
    if (previous && JSON.stringify(previous) !== JSON.stringify(rule)) {
      throw new Error(`Published rule ${rule.id} cannot be silently rewritten`);
    }
  }
}

export function mergeRuleLedger(current = {}, update = {}) {
  const next = mergeDefaults(createRuleLedger(), current);
  protectPublishedRules(next.publishedRules, update.publishedRules);
  for (const field of LIST_FIELDS) {
    if (field in update) next[field] = mergeList(next[field], update[field]);
  }
  if ('deadline' in update) next.deadline = cloneValue(update.deadline);
  if (update.knowledgeByCharacter) {
    for (const [character, knowledge] of Object.entries(update.knowledgeByCharacter)) {
      next.knowledgeByCharacter[character] = mergeList(
        next.knowledgeByCharacter[character], knowledge,
      );
    }
  }
  return next;
}
