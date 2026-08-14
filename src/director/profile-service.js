function profileSources(card = {}, entries = [], cast = null) {
  return {
    sourceAuthority: ['worldInfo', 'card', 'context'],
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

function hasUsableMultiProfile(state, cast) {
  const members = cast?.multiMembers?.length ? cast.multiMembers : cast?.members;
  return Boolean(cast?.multiProfileInitialized
    && Array.isArray(members)
    && members.length > 0
    && String(state?.personalityProfile?.content ?? '').trim());
}

function mergeCandidateMembers(existing = [], extracted = []) {
  const merged = existing.map((member) => ({ ...member }));
  extracted.forEach((member) => {
    const name = String(member?.name ?? '').trim().toLocaleLowerCase();
    const matchIndex = merged.findIndex((candidate) => (
      (member?.id && candidate?.id === member.id)
      || (name && String(candidate?.name ?? '').trim().toLocaleLowerCase() === name)
    ));
    if (matchIndex < 0) {
      merged.push(member);
      return;
    }
    const previous = merged[matchIndex];
    merged[matchIndex] = { ...previous, ...member, id: previous.id ?? member.id };
  });
  return merged;
}

export function createProfileService({ client, getCurrentChatKey = null, onStatus = null }) {
  const inFlight = new Map();
  async function generate({ state, card, cast, entries, connection }) {
    const optionsChatKey = state.chatKey;
    const sources = profileSources(card, entries, cast);
    const sourceFingerprint = fingerprint(sources);
    const previous = { ...state.personalityProfile };
    if (connection?.mode !== 'independent' || !connection.endpoint || !connection.model) {
      state.personalityProfile = { ...state.personalityProfile, status: 'failed', error: '还没连接副 API' };
      await onStatus?.(state);
      return state.personalityProfile;
    }
    state.personalityProfile = { ...state.personalityProfile, status: 'generating', error: '', activeFingerprint: sourceFingerprint };
    await onStatus?.(state);
    try {
      const castMode = cast?.mode ?? 'single';
      const result = await client.requestDirector({ context: sources, intent: { type: 'profile-character', castMode } }, connection);
      if ((getCurrentChatKey && getCurrentChatKey() !== optionsChatKey) || state.chatKey !== optionsChatKey || state.personalityProfile.activeFingerprint !== sourceFingerprint) return state.personalityProfile;
      state.personalityProfile = {
        status: 'ready', fingerprint: sourceFingerprint, activeFingerprint: sourceFingerprint, ignoredFingerprint: '', content: result.content,
        citations: result.citations, generatedAt: new Date().toISOString(), error: '',
      };
      if (Array.isArray(result.members)) {
        state.cast.multiMembers = castMode === 'single'
          ? mergeCandidateMembers(state.cast.multiMembers, result.members)
          : result.members;
        state.cast.relations = result.relations ?? [];
        state.cast.candidateProfileInitialized = state.cast.multiMembers.length > 0;
        if (castMode === 'multi') {
          state.cast.members = result.members;
          state.cast.multiProfileInitialized = result.members.length > 0 && Boolean(String(result.content ?? '').trim());
        }
      }
    } catch (error) {
      state.personalityProfile = previous.content
        ? { ...previous, status: 'stale-pending', activeFingerprint: sourceFingerprint, error: error.message }
        : { ...state.personalityProfile, status: 'failed', error: error.message };
    }
    await onStatus?.(state);
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
      if (options.cast?.mode === 'single' && !options.cast.candidateProfileInitialized) {
        const key = options.state.chatKey ?? 'profile';
        if (!inFlight.has(key)) inFlight.set(key, generate(options).finally(() => inFlight.delete(key)));
        return inFlight.get(key);
      }
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
    async switchModeAndEnsureProfile(options) {
      const cast = options.state.cast ?? options.cast;
      if (cast?.mode !== 'multi') return options.state.personalityProfile;
      if (hasUsableMultiProfile(options.state, cast)) return options.state.personalityProfile;
      const key = options.state.chatKey ?? 'profile';
      if (!inFlight.has(key)) inFlight.set(key, generate({ ...options, cast }).finally(() => inFlight.delete(key)));
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
