function profileSources(card = {}, entries = []) {
  return {
    card: {
      name: card.name ?? '',
      description: card.description ?? '',
      personality: card.personality ?? '',
      scenario: card.scenario ?? '',
      exampleDialogue: card.mes_example ?? '',
    },
    worldInfo: entries.map((entry) => ({
      bookName: entry.bookName ?? '',
      name: entry.name ?? '',
      content: entry.content ?? entry.text ?? '',
    })),
  };
}

function fingerprint(value) {
  const text = JSON.stringify(value);
  let hash = 2166136261;
  for (let index = 0; index < text.length; index += 1) {
    hash ^= text.charCodeAt(index);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(36);
}

export function createProfileService({ client }) {
  async function generate({ state, card, entries, connection }) {
    const sources = profileSources(card, entries);
    const sourceFingerprint = fingerprint(sources);
    state.personalityProfile = { ...state.personalityProfile, status: 'generating', error: '' };
    try {
      const result = await client.requestDirector({ context: sources, intent: { type: 'profile-character' } }, connection);
      state.personalityProfile = {
        status: 'ready', fingerprint: sourceFingerprint, content: result.content,
        citations: result.citations, generatedAt: new Date().toISOString(), error: '',
      };
    } catch (error) {
      state.personalityProfile = { ...state.personalityProfile, status: 'failed', error: error.message };
    }
    return state.personalityProfile;
  }

  return {
    async ensureProfile(options) {
      const sources = profileSources(options.card, options.entries);
      const sourceFingerprint = fingerprint(sources);
      const profile = options.state.personalityProfile;
      if (profile?.status === 'ready' && profile.fingerprint !== sourceFingerprint) {
        profile.status = 'stale';
        return profile;
      }
      if (profile?.content) return profile;
      return generate(options);
    },
    refreshProfile: generate,
  };
}
