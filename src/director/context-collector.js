import { resolveGenre } from './world-genre.js';
import { buildPersonalityProfile } from './personality-profile.js';

function compactCard(card) {
  if (!card) return null;
  return {
    name: card.name ?? '',
    description: card.description ?? '',
    personality: card.personality ?? '',
    scenario: card.scenario ?? '',
    creatorNotes: card.creator_notes ?? card.creatorcomment ?? '',
    systemPrompt: card.system_prompt ?? '',
    postHistoryInstructions: card.post_history_instructions ?? '',
  };
}

function compactMessages(messages, limit) {
  return messages.slice(-limit).map((message) => ({
    role: message.is_user ? 'user' : 'assistant',
    name: message.name ?? null,
    text: message.mes ?? message.content ?? '',
  }));
}

function compactWorldInfo(entries, options) {
  if (!options.worldInfo) return [];
  const list = Array.isArray(entries) ? entries : Object.entries(entries ?? {}).map(([id, entry]) => ({ id, ...entry }));
  const selected = options.worldInfoMode === 'selected'
    ? new Set(options.worldInfoEntries ?? [])
    : null;
  return list.filter((entry) => !selected || selected.has(entry.id ?? entry.uid ?? entry.name))
    .map((entry) => ({
      id: entry.id ?? entry.uid ?? entry.name ?? '',
      ...(entry.uid !== undefined ? { uid: entry.uid } : {}),
      ...(entry.bookName ? { bookName: entry.bookName } : {}),
      name: entry.name ?? entry.comment ?? '',
      content: entry.content ?? entry.text ?? '',
    }));
}

export async function collectDirectorContext(adapter, state, settings) {
  const host = adapter.getContext?.() ?? {};
  const card = adapter.getCharacterData?.() ?? null;
  const allMessages = adapter.getMessages?.() ?? [];
  const options = settings.context ?? {};
  const messages = compactMessages(allMessages, options.messageLimit ?? 24);
  const evidence = [];

  const directorNotes = state.directorNotes ?? host.chatMetadata?.proactive_director_notes ?? '';
  if (options.directorNotes && directorNotes) {
    evidence.push({ source: 'directorNotes', priority: 1, value: directorNotes });
  }
  if (options.card && card) {
    evidence.push({ source: 'card', priority: 2, value: compactCard(card) });
  }
  if (options.exampleDialogue && card?.mes_example) {
    evidence.push({ source: 'exampleDialogue', priority: 3, value: card.mes_example });
  }
  if (options.chatBehavior && state.historySummary) {
    evidence.push({ source: 'chatBehavior', priority: 4, value: state.historySummary });
  }

  const rawWorldInfo = adapter.getSelectedWorldInfoEntries
    ? await adapter.getSelectedWorldInfoEntries(options)
    : adapter.getWorldInfoEntriesAsync
      ? await adapter.getWorldInfoEntriesAsync()
      : adapter.getWorldInfoEntries?.() ?? host.worldInfo;
  const worldInfoEntries = compactWorldInfo(rawWorldInfo, options);
  const personalityProfile = buildPersonalityProfile(card, worldInfoEntries, options);
  const storedActive = state.scripts?.find((script) => script.id === state.activeScriptId) ?? state.activeEvent;
  const currentStep = storedActive?.steps?.[storedActive.currentStepIndex ?? 0];
  const activeEvent = storedActive ? {
    id: storedActive.id,
    title: storedActive.title,
    category: storedActive.category,
    premise: storedActive.premise,
    conflict: storedActive.conflict,
    direction: storedActive.direction ?? '',
    currentStepIndex: storedActive.currentStepIndex ?? 0,
    steps: currentStep ? [structuredClone(currentStep)] : [],
    facts: structuredClone(storedActive.facts ?? []),
  } : null;
  return {
    chatKey: state.chatKey,
    characterFingerprint: state.characterFingerprint,
    genre: resolveGenre(settings.genre, card, messages),
    personalityEvidence: evidence,
    personalityProfile,
    directorNotes,
    messages,
    cast: state.cast,
    activeEvent,
    foreshadowing: state.foreshadowing,
    ruleLedger: state.ruleLedger,
    preferences: state.preference,
    sceneSafety: state.sceneSafety,
    worldInfo: worldInfoEntries,
    worldInfoEntries,
  };
}
