import { SCHEMA_VERSION } from '../constants.js';
import { createDirectorState, createGlobalSettings } from './default-state.js';

export function cloneValue(value) {
  if (value === undefined) return undefined;
  return structuredClone(value);
}

export function mergeDefaults(defaults, value) {
  if (Array.isArray(defaults)) return Array.isArray(value) ? cloneValue(value) : cloneValue(defaults);
  if (!defaults || typeof defaults !== 'object') return value === undefined ? defaults : value;

  const source = value && typeof value === 'object' && !Array.isArray(value) ? value : {};
  const result = cloneValue(source);
  for (const [key, defaultValue] of Object.entries(defaults)) {
    result[key] = mergeDefaults(defaultValue, source[key]);
  }
  return result;
}

function assertSupportedVersion(raw) {
  const version = Number.isInteger(raw?.schemaVersion) ? raw.schemaVersion : 0;
  if (version > SCHEMA_VERSION) {
    throw new Error(`Cannot load newer schema version ${version}`);
  }
}

export function migrateState(raw = {}) {
  assertSupportedVersion(raw);
  const migrated = mergeDefaults(
    createDirectorState(raw.chatKey ?? null, raw.characterFingerprint ?? null),
    raw,
  );
  migrated.schemaVersion = SCHEMA_VERSION;
  migrated.scripts ??= [];
  if (raw.activeEvent) {
    const id = raw.activeEvent.id ?? `legacy-${raw.chatKey ?? 'chat'}`;
    const existing = migrated.scripts.find((script) => script.id === id);
    if (!existing) {
      const now = raw.activeEvent.createdAt ?? raw.updatedAt ?? new Date().toISOString();
      migrated.scripts.push({
        id,
        title: raw.activeEvent.title ?? '未命名剧本',
        category: raw.activeEvent.category ?? '',
        premise: raw.activeEvent.premise ?? '',
        conflict: raw.activeEvent.conflict ?? '',
        climax: raw.activeEvent.climax ?? '',
        ending: raw.activeEvent.ending ?? '',
        steps: cloneValue(raw.activeEvent.steps ?? []),
        foreshadowing: cloneValue(raw.activeEvent.foreshadowing ?? []),
        facts: cloneValue(raw.activeEvent.facts ?? []),
        revisions: cloneValue(raw.activeEvent.revisions ?? []),
        status: raw.activeEvent.status === 'awaiting-user' ? 'running' : (raw.activeEvent.status ?? 'running'),
        currentStepIndex: raw.activeEvent.currentStepIndex ?? 0,
        pendingTurn: cloneValue(raw.activeEvent.pendingTurn ?? null),
        createdAt: now,
        updatedAt: raw.activeEvent.updatedAt ?? now,
      });
    }
    migrated.selectedScriptId ??= id;
    migrated.activeScriptId ??= id;
    migrated.activeEvent = migrated.scripts.find((script) => script.id === migrated.activeScriptId) ?? null;
  }
  return migrated;
}

export function migrateGlobalSettings(raw = {}) {
  assertSupportedVersion(raw);
  const migrated = mergeDefaults(createGlobalSettings(), raw);
  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}
