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

export function correctCast(cast, correction) {
  const next = cloneValue(cast ?? { mode: 'single', locked: false, members: [] });
  if (correction.type === 'merge') {
    const sourceIds = new Set(correction.memberIds ?? []);
    const merged = next.members.filter((member) => sourceIds.has(member.id));
    next.members = next.members.filter((member) => !sourceIds.has(member.id));
    next.members.push({
      id: correction.id,
      name: correction.name,
      aliases: [...new Set([...merged.flatMap((member) => [member.name, ...(member.aliases ?? [])]), ...(correction.aliases ?? [])].filter(Boolean))],
      evidence: merged.flatMap((member) => member.evidence ?? []),
      sharedBackground: cloneValue(correction.sharedBackground ?? []),
    });
  } else if (correction.type === 'split') {
    next.members = next.members.filter((member) => member.id !== correction.memberId);
    next.members.push(...cloneValue(correction.members ?? []));
  } else if (correction.type === 'replace') {
    const index = next.members.findIndex((member) => member.id === correction.member?.id);
    if (index >= 0) next.members[index] = cloneValue(correction.member);
    else next.members.push(cloneValue(correction.member));
  }
  next.mode = next.members.length > 1 ? 'multi' : 'single';
  return next;
}
