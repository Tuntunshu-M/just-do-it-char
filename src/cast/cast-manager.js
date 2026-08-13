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
    return cloneValue(current);
  }
  const existing = new Map((current.multiMembers ?? current.members ?? []).map((member) => [member.id, member]));
  const members = detected.members.map((member) => ({
    ...cloneValue(existing.get(member.id) ?? {}),
    ...cloneValue(member),
    aliases: [...new Set([...(existing.get(member.id)?.aliases ?? []), ...(member.aliases ?? [])])],
    evidence: cloneValue(existing.get(member.id)?.evidence ?? member.evidence ?? []),
  }));
  const next = { ...cloneValue(current), multiMembers: members, detectionConfidence: detected.confidence };
  if (next.mode === 'multi') next.members = cloneValue(members);
  return next;
}

function project(cast) {
  const next = cloneValue(cast ?? {});
  next.mode = next.mode === 'multi' ? 'multi' : 'single';
  next.singleSelection ??= next.mode === 'single' ? next.members?.[0] ?? null : null;
  next.multiMembers ??= next.mode === 'multi' ? cloneValue(next.members ?? []) : [];
  next.members = next.mode === 'multi'
    ? cloneValue(next.multiMembers)
    : (next.singleSelection ? [cloneValue(next.singleSelection)] : []);
  return next;
}

export function setCastMode(cast, mode) {
  return project({ ...cloneValue(cast), mode: mode === 'multi' ? 'multi' : 'single' });
}

export function setSingleSelection(cast, member) {
  return project({ ...cloneValue(cast), singleSelection: cloneValue(member ?? null) });
}

export function addCastMember(cast, member) {
  const next = project(cast);
  const value = cloneValue(member);
  value.id ??= `cast-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  next.multiMembers = [...next.multiMembers.filter((item) => item.id !== value.id), value];
  return project(next);
}

export function updateCastMember(cast, memberId, changes) {
  const next = project(cast);
  next.multiMembers = next.multiMembers.map((member) => member.id === memberId ? { ...member, ...cloneValue(changes), id: member.id } : member);
  return project(next);
}

export function removeCastMember(cast, memberId) {
  const next = project(cast);
  next.multiMembers = next.multiMembers.filter((member) => member.id !== memberId);
  if (next.leadId === memberId) next.leadId = next.multiMembers[0]?.id ?? null;
  return project(next);
}

export function setLeadMember(cast, memberId) {
  const next = project(cast);
  next.leadId = next.multiMembers.some((member) => member.id === memberId) ? memberId : null;
  return project(next);
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
  const next = project(cast ?? { mode: 'single', locked: false, members: [] });
  const working = next.mode === 'multi' ? next.multiMembers : next.members;
  if (correction.type === 'merge') {
    const sourceIds = new Set(correction.memberIds ?? []);
    const merged = working.filter((member) => sourceIds.has(member.id));
    const retained = working.filter((member) => !sourceIds.has(member.id));
    retained.push({
      id: correction.id,
      name: correction.name,
      aliases: [...new Set([...merged.flatMap((member) => [member.name, ...(member.aliases ?? [])]), ...(correction.aliases ?? [])].filter(Boolean))],
      evidence: merged.flatMap((member) => member.evidence ?? []),
      sharedBackground: cloneValue(correction.sharedBackground ?? []),
    });
  } else if (correction.type === 'split') {
    working.splice(0, working.length, ...working.filter((member) => member.id !== correction.memberId), ...cloneValue(correction.members ?? []));
  } else if (correction.type === 'replace') {
    const index = working.findIndex((member) => member.id === correction.member?.id);
    if (index >= 0) working[index] = cloneValue(correction.member);
    else working.push(cloneValue(correction.member));
  }
  if (correction.type === 'merge') working.splice(0, working.length, ...retained);
  if (next.mode === 'multi') next.multiMembers = working;
  else next.singleSelection = working[0] ?? null;
  return project(next);
}
