const DEFAULT_PRIORITY = ['directorNotes', 'card', 'exampleDialogue', 'chatBehavior', 'inference'];

export function rankEvidence(evidence, priority = DEFAULT_PRIORITY) {
  return [...(evidence ?? [])].sort((left, right) => {
    const leftRank = left.priority ?? priority.indexOf(left.source);
    const rightRank = right.priority ?? priority.indexOf(right.source);
    return leftRank - rightRank;
  });
}

export function evaluatePersonalityConsistency(action, cast, priority = DEFAULT_PRIORITY) {
  const member = cast?.members?.find((item) => item.id === action.characterId);
  if (!member) return { allowed: false, reasons: ['Acting character is not in the cast'] };
  const owned = new Map((member.evidence ?? []).map((item) => [item.id, item]));
  const selected = (action.evidenceIds ?? []).map((id) => owned.get(id)).filter(Boolean);
  if (!selected.length) return { allowed: false, reasons: ['No personality evidence belongs to the acting character'] };

  const ranked = rankEvidence(member.evidence, priority);
  const strongestConflict = ranked.find((item) => item.stance && action.stance && item.stance !== action.stance);
  const strongestSelected = rankEvidence(selected, priority)[0];
  if (strongestConflict && (strongestConflict.priority ?? 99) < (strongestSelected.priority ?? 99)) {
    return { allowed: false, reasons: ['Action conflicts with higher-priority personality evidence'] };
  }
  return { allowed: true, reasons: [], evidence: selected };
}

export function validateLeadChange({ nextLeadId, leadChangeReason, presentCharacterIds = [], cast }) {
  const exists = cast?.members?.some((member) => member.id === nextLeadId);
  if (!exists) return { allowed: false, reason: 'Lead character is unknown' };
  if (!presentCharacterIds.includes(nextLeadId)) return { allowed: false, reason: 'Lead character is not present' };
  const reason = leadChangeReason ?? {};
  if (!reason.motivation || !reason.location || !reason.knowledgeState) {
    return { allowed: false, reason: 'Lead change requires motivation, location, and knowledge state' };
  }
  return { allowed: true };
}
