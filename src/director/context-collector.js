import { resolveGenre } from './world-genre.js';

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

export async function collectDirectorContext(adapter, state, settings) {
  const host = adapter.getContext?.() ?? {};
  const card = adapter.getCharacterData?.() ?? null;
  const allMessages = adapter.getMessages?.() ?? [];
  const options = settings.context ?? {};
  const messages = compactMessages(allMessages, options.messageLimit ?? 24);
  const evidence = [];

  if (options.directorNotes && host.chatMetadata?.proactive_director_notes) {
    evidence.push({ source: 'directorNotes', priority: 1, value: host.chatMetadata.proactive_director_notes });
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

  return {
    chatKey: state.chatKey,
    characterFingerprint: state.characterFingerprint,
    genre: resolveGenre(settings.genre, card, messages),
    personalityEvidence: evidence,
    messages,
    cast: state.cast,
    activeEvent: state.activeEvent,
    foreshadowing: state.foreshadowing,
    ruleLedger: state.ruleLedger,
    preferences: state.preference,
    sceneSafety: state.sceneSafety,
    worldInfo: options.worldInfo ? (host.worldInfo ?? null) : null,
  };
}
