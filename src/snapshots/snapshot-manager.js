import { cloneValue } from '../state/migrations.js';
import { mapImportedCast } from '../cast/cast-manager.js';

let backup = null;

export function exportSnapshot(state, selection = {}) {
  const data = {};
  if (selection.eventFramework) {
    data.activeEvent = cloneValue(state.activeEvent);
    data.foreshadowing = cloneValue(state.foreshadowing ?? []);
  }
  if (selection.history) data.historySummary = state.historySummary ?? '';
  if (selection.personality) data.cast = cloneValue(state.cast);
  if (selection.rules) data.ruleLedger = cloneValue(state.ruleLedger);
  if (selection.safety) data.sceneSafety = {
    safewords: cloneValue(state.sceneSafety?.safewords ?? []),
    hardLimits: cloneValue(state.sceneSafety?.hardLimits ?? []),
  };
  return { version: 1, exportedAt: new Date().toISOString(), data };
}

function mergeSafety(target, source, strategy) {
  const current = target ?? { safewords: [], hardLimits: [] };
  if (strategy === 'replace') return { ...current, ...cloneValue(source), cncEnabled: false };
  return {
    ...current,
    safewords: [...new Set([...(current.safewords ?? []), ...(source?.safewords ?? [])])],
    hardLimits: [...new Set([...(current.hardLimits ?? []), ...(source?.hardLimits ?? [])])],
    cncEnabled: false,
  };
}

export function previewImport(snapshot, target, options = {}) {
  if (snapshot?.version !== 1) throw new Error('Unsupported snapshot version');
  const mode = options.mode ?? 'custom';
  const next = cloneValue(target);
  const data = snapshot.data ?? {};
  const include = (key) => mode === 'clone' || options[key];
  if (include('eventFramework')) {
    next.activeEvent = cloneValue(data.activeEvent ?? null);
    next.foreshadowing = cloneValue(data.foreshadowing ?? []);
  }
  if (include('history')) next.historySummary = data.historySummary ?? next.historySummary;
  if (include('personality') && data.cast) {
    const imported = cloneValue(data.cast);
    const castMapping = options.castMapping ?? mapImportedCast(imported.members, next.cast?.members);
    if (mode === 'adapt') {
      imported.members = imported.members.map((member) => ({ ...member, id: castMapping[member.id] ?? member.id }));
    }
    next.cast = imported;
  }
  if (include('rules') && data.ruleLedger) next.ruleLedger = cloneValue(data.ruleLedger);
  if (include('safety') && data.sceneSafety) next.sceneSafety = mergeSafety(next.sceneSafety, data.sceneSafety, options.safetyStrategy);
  next.chatKey = target.chatKey;
  next.characterFingerprint = target.characterFingerprint;
  next.pendingTransaction = null;
  if (next.sceneSafety) next.sceneSafety.cncEnabled = false;
  const warnings = [];
  if (include('personality') && data.cast) warnings.push('导入人格可能与当前角色资料冲突，请在人物页核对。');
  if (include('eventFramework') && data.activeEvent) warnings.push('活动事件将按当前聊天人物重新适配。');
  return {
    mode,
    before: cloneValue(target),
    after: next,
    castMapping: options.castMapping ?? {},
    summary: {
      event: Boolean(include('eventFramework') && data.activeEvent),
      foreshadowing: include('eventFramework') ? data.foreshadowing?.length ?? 0 : 0,
      cast: include('personality') ? data.cast?.members?.length ?? 0 : 0,
      safety: Boolean(include('safety') && data.sceneSafety),
    },
    warnings,
  };
}

export function applyImport(preview) {
  backup = cloneValue(preview.before);
  return cloneValue(preview.after);
}

export function undoLastImport() {
  const value = cloneValue(backup);
  backup = null;
  return value;
}
