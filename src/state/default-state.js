import { SCHEMA_VERSION } from '../constants.js';

export function createRuleLedger() {
  return {
    publishedRules: [],
    hypotheses: [],
    triggeredTaboos: [],
    objectives: [],
    deadline: null,
    items: [],
    knowledgeByCharacter: {},
    anomalies: [],
    hiddenTruths: [],
    falseRules: [],
  };
}

export function createGlobalSettings() {
  return {
    schemaVersion: SCHEMA_VERSION,
    enabled: true,
    categories: {
      daily: { enabled: true, weight: 40 },
      crisis: { enabled: true, weight: 35 },
      erotic: { enabled: false, weight: 25 },
    },
    genre: { mode: 'auto', custom: '' },
    trigger: {
      mode: 'hybrid',
      fixedTurns: 4,
      cooldownTurns: 2,
      dailyLimit: 8,
      idleEnabled: false,
      idleMinutes: 30,
    },
    connection: {
      mode: 'main',
      endpoint: '',
      apiKey: '',
      model: '',
      timeoutMs: 45000,
      mainReminderUntil: 0,
    },
    context: {
      directorNotes: true,
      card: true,
      exampleDialogue: true,
      chatBehavior: true,
      worldInfo: true,
      messageLimit: 24,
    },
    defaults: {
      userAgency: 80,
      consequencePermissions: {},
    },
    theme: {
      enabled: false,
      allowGlobalCss: false,
      variables: {},
      css: '',
    },
  };
}

export function createDirectorState(chatKey = null, fingerprint = null) {
  return {
    schemaVersion: SCHEMA_VERSION,
    chatKey,
    characterFingerprint: fingerprint,
    status: 'idle',
    cast: { mode: 'single', locked: false, members: [], leadId: null },
    activeEvent: null,
    foreshadowing: [],
    historySummary: '',
    preference: {
      userAgency: 80,
      categoryOverrides: {},
      consequencePermissions: {},
    },
    sceneSafety: {
      cncEnabled: false,
      safewords: [],
      hardLimits: [],
      stopped: false,
    },
    ruleLedger: createRuleLedger(),
    pendingTransaction: null,
    cooldowns: {},
    counters: { turns: 0, eventsToday: 0, dayKey: null },
    updatedAt: null,
  };
}
