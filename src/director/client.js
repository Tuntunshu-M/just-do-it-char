import { buildDirectorMessages } from './prompts.js';
import { parseDirectorResult } from './schemas.js';

export const MAIN_API_REMINDER = '正在在用主api哦！';
const REMINDER_INTERVAL = 24 * 60 * 60 * 1000;

function chatCompletionsUrl(endpoint) {
  const base = String(endpoint ?? '').replace(/\/$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function extractMainContent(response) {
  return response?.choices?.[0]?.message?.content
    ?? response?.message?.content
    ?? response?.content
    ?? response;
}

export function createDirectorClient({ adapter, fetchImpl = globalThis.fetch, clock = Date.now } = {}) {
  async function remindForMainConnection(connection) {
    const now = clock();
    if ((connection.mainReminderUntil ?? 0) > now) return;
    const confirmed = await adapter.showConfirm?.(MAIN_API_REMINDER);
    if (confirmed) connection.mainReminderUntil = now + REMINDER_INTERVAL;
  }

  async function requestIndependent(messages, connection) {
    if (!connection.endpoint || !connection.model) throw new Error('Independent API endpoint and model are required');
    if (typeof fetchImpl !== 'function') throw new Error('Fetch is unavailable');
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), connection.timeoutMs ?? 45000);
    try {
      const response = await fetchImpl(chatCompletionsUrl(connection.endpoint), {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}),
        },
        body: JSON.stringify({ model: connection.model, messages, temperature: 0.7 }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text?.();
        throw new Error(`Director API HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      const payload = await response.json();
      return payload?.choices?.[0]?.message?.content;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function requestDirector({ context, intent }, connection) {
    const messages = buildDirectorMessages(context, intent);
    let content;
    if (connection.mode === 'independent') {
      content = await requestIndependent(messages, connection);
    } else if (connection.mode === 'main') {
      await remindForMainConnection(connection);
      content = extractMainContent(await adapter.generateReply(messages, { quiet: true, director: true }));
    } else {
      throw new Error(`Unknown director connection mode: ${connection.mode}`);
    }
    return parseDirectorResult(content);
  }

  return { requestDirector };
}
