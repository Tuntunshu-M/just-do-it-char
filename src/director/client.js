import { buildDirectorMessages } from './prompts.js';
import { parseDirectorResult } from './schemas.js';

export const MAIN_API_REMINDER = '正在在用主api哦！';
const REMINDER_INTERVAL = 24 * 60 * 60 * 1000;

function chatCompletionsUrl(endpoint) {
  const base = String(endpoint ?? '').replace(/\/$/, '');
  return base.endsWith('/chat/completions') ? base : `${base}/chat/completions`;
}

function modelsUrl(endpoint) {
  const base = String(endpoint ?? '').replace(/\/$/, '');
  return base.endsWith('/models') ? base : `${base}/models`;
}

function normalizeContent(value) {
  if (typeof value === 'string') return value;
  if (Array.isArray(value)) return value.map((part) => normalizeContent(part)).join('');
  if (!value || typeof value !== 'object') return value;
  if (typeof value.text === 'string') return value.text;
  if (typeof value.value === 'string') return value.value;
  return undefined;
}

function extractResponseContent(response) {
  if (typeof response === 'string' || Array.isArray(response)) return normalizeContent(response);
  if (!response || typeof response !== 'object') return response;
  if (Object.hasOwn(response, 'event')) return response;

  const candidates = [
    response.choices?.[0]?.delta?.content,
    response.choices?.[0]?.message?.content,
    response.choices?.[0]?.text,
    response.output_text,
    response.message?.content,
    response.content,
  ];
  for (const candidate of candidates) {
    const content = normalizeContent(candidate);
    if (content !== undefined) return content;
  }
  for (const wrapper of [response.response, response.result, response.output]) {
    if (wrapper !== undefined) {
      const content = extractResponseContent(wrapper);
      if (content !== undefined) return content;
    }
  }
  return undefined;
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
        body: JSON.stringify({ model: connection.model, messages, temperature: Number(connection.temperature ?? 0.7), max_tokens: Number(connection.maxTokens ?? 2000), stream: Boolean(connection.stream) }),
        signal: controller.signal,
      });
      if (!response.ok) {
        const detail = await response.text?.();
        throw new Error(`Director API HTTP ${response.status}${detail ? `: ${detail}` : ''}`);
      }
      if (connection.stream) return readStream(response.body, connection.onUpdate);
      const payload = await response.json();
      return extractResponseContent(payload);
    } catch (error) {
      if (controller.signal.aborted || error?.name === 'AbortError') {
        const timeoutError = new Error('导演 API 请求超时，请检查连接或增加超时时间。');
        timeoutError.name = 'TimeoutError';
        throw timeoutError;
      }
      let message = String(error?.message ?? '导演 API 请求失败');
      if (connection.apiKey) message = message.replaceAll(String(connection.apiKey), '[REDACTED]');
      if (connection.endpoint) message = message.replaceAll(String(connection.endpoint), '[ENDPOINT]');
      const safeError = new Error(message);
      safeError.name = error?.name ?? 'Error';
      throw safeError;
    } finally {
      clearTimeout(timeout);
    }
  }

  async function readStream(body, onUpdate) {
    if (!body?.getReader) throw new Error('Streaming response body is unavailable');
    const reader = body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';
    let content = '';
    while (true) {
      const { value, done } = await reader.read();
      if (done) break;
      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split(/\r?\n/);
      buffer = lines.pop() ?? '';
      for (const line of lines) {
        if (!line.startsWith('data:')) continue;
        const data = line.slice(5).trim();
        if (data === '[DONE]') continue;
        try {
          const chunk = extractResponseContent(JSON.parse(data)) ?? '';
          content += chunk;
          onUpdate?.({ phase: 'streaming', text: content });
        } catch { /* ignore incomplete provider events */ }
      }
    }
    if (buffer.startsWith('data:')) {
      const data = buffer.slice(5).trim();
      if (data && data !== '[DONE]') {
        try {
          const chunk = extractResponseContent(JSON.parse(data)) ?? '';
          content += chunk;
          onUpdate?.({ phase: 'streaming', text: content });
        } catch { /* ignore incomplete provider events */ }
      }
    }
    return content;
  }

  async function listModels(connection) {
    if (!connection?.endpoint) throw new Error('Independent API endpoint is required');
    const response = await fetchImpl(modelsUrl(connection.endpoint), { headers: { ...(connection.apiKey ? { Authorization: `Bearer ${connection.apiKey}` } : {}) } });
    if (!response.ok) throw new Error(`Director models HTTP ${response.status}`);
    const payload = await response.json();
    return (payload?.data ?? []).map((model) => typeof model === 'string' ? model : model.id).filter(Boolean);
  }

  async function requestDirector({ context, intent }, connection, onUpdate) {
    const messages = buildDirectorMessages(context, intent);
    let content;
    if (connection.mode === 'independent') {
      content = await requestIndependent(messages, { ...connection, onUpdate });
    } else if (connection.mode === 'main') {
      await remindForMainConnection(connection);
      content = extractResponseContent(await adapter.generateDirector(messages));
    } else {
      throw new Error(`Unknown director connection mode: ${connection.mode}`);
    }
    return parseDirectorResult(content);
  }

  async function testConnection(connection) {
    if (connection.mode === 'independent') {
      const models = await listModels(connection);
      return { ok: true, mode: 'independent', models };
    }
    if (connection.mode === 'main') {
      if (!adapter.capabilities?.generation) throw new Error('当前主连接不支持导演原始生成。');
      return { ok: true, mode: 'main' };
    }
    throw new Error(`Unknown director connection mode: ${connection.mode}`);
  }

  return { requestDirector, listModels, testConnection };
}
