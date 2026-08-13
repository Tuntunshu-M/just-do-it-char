function profileSources(card = {}, entries = [], cast = null) {
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
    cast: cast ? {
      mode: cast.mode ?? 'single',
      members: cast.members ?? [],
      relations: cast.relations ?? [],
    } : null,
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
  const inFlight = new Map();
  async function generate({ state, card, cast, entries, connection }) {
    const sources = profileSources(card, entries, cast);
    const sourceFingerprint = fingerprint(sources);
    const previous = { ...state.personalityProfile };
    if (connection?.mode !== 'independent' || !connection.endpoint || !connection.model) {
      state.personalityProfile = { ...state.personalityProfile, status: 'failed', error: '还没连接副 API' };
      return state.personalityProfile;
    }
    state.personalityProfile = { ...state.personalityProfile, status: 'generating', error: '', activeFingerprint: sourceFingerprint };
    try {
      const result = await client.requestDirector({ context: sources, intent: { type: 'profile-character' } }, connection);
      state.personalityProfile = {
        status: 'ready', fingerprint: sourceFingerprint, activeFingerprint: sourceFingerprint, ignoredFingerprint: '', content: result.content,
        citations: result.citations, generatedAt: new Date().toISOString(), error: '',
      };
    } catch (error) {
      state.personalityProfile = previous.content
        ? { ...previous, status: 'stale-pending', activeFingerprint: sourceFingerprint, error: error.message }
        : { ...state.personalityProfile, status: 'failed', error: error.message };
    }
    return state.personalityProfile;
  }

  return {
    async ensureProfile(options) {
      const sources = profileSources(options.card, options.entries, options.cast);
      const sourceFingerprint = fingerprint(sources);
      const profile = options.state.personalityProfile;
      if (profile?.fingerprint && profile.fingerprint !== sourceFingerprint && profile.ignoredFingerprint !== sourceFingerprint) {
        profile.status = 'stale-pending';
        profile.activeFingerprint = sourceFingerprint;
        return profile;
      }
      if (profile?.status === 'stale-pending' || profile?.status === 'ready-ignored') return profile;
      if (profile?.content) return profile;
      const key = options.state.chatKey ?? 'profile';
      if (!inFlight.has(key)) inFlight.set(key, generate(options).finally(() => inFlight.delete(key)));
      return inFlight.get(key);
    },
    refreshProfile(options) {
      const key = options.state.chatKey ?? 'profile';
      if (!inFlight.has(key)) inFlight.set(key, generate(options).finally(() => inFlight.delete(key)));
      return inFlight.get(key);
    },
    ignoreProfile({ state, fingerprint: ignoredFingerprint }) {
      const profile = state.personalityProfile ?? {};
      profile.status = 'ready-ignored';
      profile.ignoredFingerprint = ignoredFingerprint ?? profile.activeFingerprint ?? '';
      state.personalityProfile = profile;
      return profile;
    },
  };
}
