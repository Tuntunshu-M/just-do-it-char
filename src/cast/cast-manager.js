import { cloneValue } from '../state/migrations.js';

const DETECTION_THRESHOLD = 0.65;

function normalizedNames(member) {
  return [member.name, ...(member.aliases ?? [])]
    .filter(Boolean)
    .map((name) => name.trim().toLocaleLowerCase());
}

export function mergeDetectedCast(current, detected) {
  if (current?.locked) return cloneValue(current);
  if (!detected || detected.confidence < DETECTION_THRESHOLD || !Array.isArray(detected.members) || detected.members.length < 2) {
    return { ...cloneValue(current), mode: 'single' };
  }
  const existing = new Map((current.members ?? []).map((member) => [member.id, member]));
  const members = detected.members.map((member) => ({
    ...cloneValue(existing.get(member.id) ?? {}),
    ...cloneValue(member),
    aliases: [...new Set([...(existing.get(member.id)?.aliases ?? []), ...(member.aliases ?? [])])],
    evidence: cloneValue(existing.get(member.id)?.evidence ?? member.evidence ?? []),
  }));
  return { ...cloneValue(current), mode: 'multi', members, detectionConfidence: detected.confidence };
}

export function mapImportedCast(source, target) {
  const mapping = {};
  for (const sourceMember of source ?? []) {
    const sourceNames = new Set(normalizedNames(sourceMember));
    const match = (target ?? []).find((targetMember) => normalizedNames(targetMember).some((name) => sourceNames.has(name)));
    if (match) mapping[sourceMember.id] = match.id;
  }
  return mapping;
}

export function lockCast(cast, locked = true) {
  return { ...cloneValue(cast), locked };
}
