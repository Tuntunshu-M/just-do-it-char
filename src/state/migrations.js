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
  return migrated;
}

export function migrateGlobalSettings(raw = {}) {
  assertSupportedVersion(raw);
  const migrated = mergeDefaults(createGlobalSettings(), raw);
  migrated.schemaVersion = SCHEMA_VERSION;
  return migrated;
}
