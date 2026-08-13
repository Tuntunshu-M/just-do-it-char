import assert from 'node:assert/strict';
import test from 'node:test';
import { createDirectorClient, MAIN_API_REMINDER } from '../../src/director/client.js';

const result = { event: null, feedback: { classification: 'neutral', confidence: 1 }, actions: [], branches: [], risks: [], foreshadowing: [], ruleLedgerUpdate: {}, injection: 'Continue.' };

test('independent client sends OpenAI compatible request', async () => {
  let request;
  const client = createDirectorClient({ adapter: {}, fetchImpl: async (url, options) => {
    request = { url, options };
    return { ok: true, json: async () => ({ choices: [{ message: { content: JSON.stringify(result) } }] }) };
  }});
  const output = await client.requestDirector({ context: {}, intent: {} }, { mode: 'independent', endpoint: 'https://api.test/v1', apiKey: 'key', model: 'model', temperature: 0.2, maxTokens: 1200, stream: false });
  assert.deepEqual(output, result);
  assert.equal(request.url, 'https://api.test/v1/chat/completions');
  assert.equal(request.options.headers.Authorization, 'Bearer key');
  const body = JSON.parse(request.options.body);
  assert.equal(body.model, 'model');
  assert.equal(body.messages.length, 2);
  assert.equal(body.temperature, 0.2);
  assert.equal(body.max_tokens, 1200);
  assert.equal(body.stream, false);
});

test('independent non-streaming client accepts choices text responses', async () => {
  const client = createDirectorClient({ adapter: {}, fetchImpl: async () => ({
    ok: true,
    json: async () => ({ choices: [{ text: JSON.stringify(result) }] }),
  }) });
  const output = await client.requestDirector(
    { context: {}, intent: {} },
    { mode: 'independent', endpoint: 'https://api.test/v1', model: 'model', stream: false },
  );
  assert.deepEqual(output, result);
});

test('independent non-streaming client joins structured content arrays', async () => {
  const serialized = JSON.stringify(result);
  const midpoint = Math.floor(serialized.length / 2);
  const client = createDirectorClient({ adapter: {}, fetchImpl: async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: [
      { type: 'text', text: serialized.slice(0, midpoint) },
      { type: 'text', text: serialized.slice(midpoint) },
    ] } }] }),
  }) });
  const output = await client.requestDirector(
    { context: {}, intent: {} },
    { mode: 'independent', endpoint: 'https://api.test/v1', model: 'model', stream: false },
  );
  assert.deepEqual(output, result);
});

test('independent non-streaming client reports token-limit truncation', async () => {
  const client = createDirectorClient({ adapter: {}, fetchImpl: async () => ({
    ok: true,
    json: async () => ({ choices: [{ finish_reason: 'length', message: { content: '{"event":' } }] }),
  }) });
  await assert.rejects(
    client.requestDirector(
      { context: {}, intent: {} },
      { mode: 'independent', endpoint: 'https://api.test/v1', model: 'model', stream: false },
    ),
    (error) => error.name === 'DirectorTruncationError' && /finish_reason: length/.test(error.message),
  );
});

test('independent client lists models from the compatible API', async () => {
  const client = createDirectorClient({ adapter: {}, fetchImpl: async (url, options) => {
    assert.equal(url, 'https://api.test/v1/models');
    assert.equal(options.headers.Authorization, 'Bearer key');
    return { ok: true, json: async () => ({ data: [{ id: 'alpha' }, { id: 'beta' }] }) };
  }});
  assert.deepEqual(await client.listModels({ endpoint: 'https://api.test/v1', apiKey: 'key' }), ['alpha', 'beta']);
});

test('independent client reports streaming chunks and parses the final response', async () => {
  const updates = [];
  const encoder = new TextEncoder();
  const serialized = JSON.stringify(result);
  const stream = new ReadableStream({
    start(controller) {
      const midpoint = Math.floor(serialized.length / 2);
      for (const part of [serialized.slice(0, midpoint), serialized.slice(midpoint)]) {
        controller.enqueue(encoder.encode(`data: ${JSON.stringify({ choices: [{ delta: { content: part } }] })}\n\n`));
      }
      controller.enqueue(encoder.encode('data: [DONE]\n\n'));
      controller.close();
    },
  });
  const client = createDirectorClient({ adapter: {}, fetchImpl: async (_url, options) => {
    assert.equal(JSON.parse(options.body).stream, true);
    return { ok: true, body: stream };
  }});
  const output = await client.requestDirector({ context: {}, intent: {} }, { mode: 'independent', endpoint: 'https://api.test/v1', apiKey: '', model: 'model', stream: true }, (update) => updates.push(update));
  assert.equal(output.injection, result.injection);
  assert.ok(updates.some((item) => item.phase === 'streaming'));
});

test('main connection reminder is suppressed for 24 hours', async () => {
  let confirms = 0;
  let now = 1000;
  const adapter = { showConfirm: async (text) => { confirms += 1; assert.equal(text, MAIN_API_REMINDER); return true; }, generateDirector: async () => JSON.stringify(result) };
  const client = createDirectorClient({ adapter, clock: () => now });
  const connection = { mode: 'main', mainReminderUntil: 0 };
  await client.requestDirector({ context: {}, intent: {} }, connection);
  await client.requestDirector({ context: {}, intent: {} }, connection);
  assert.equal(confirms, 1);
  assert.equal(connection.mainReminderUntil, 1000 + 24 * 60 * 60 * 1000);
});

test('main connection extracts a wrapped output_text response', async () => {
  const adapter = {
    showConfirm: async () => false,
    generateDirector: async () => ({ response: { output_text: JSON.stringify(result) } }),
  };
  const client = createDirectorClient({ adapter });
  assert.deepEqual(
    await client.requestDirector({ context: {}, intent: {} }, { mode: 'main' }),
    result,
  );
});

test('client reports an explicit error when the API returns empty content', async () => {
  const client = createDirectorClient({ adapter: {}, fetchImpl: async () => ({
    ok: true,
    json: async () => ({ choices: [{ message: { content: '' } }] }),
  }) });
  await assert.rejects(
    client.requestDirector(
      { context: {}, intent: {} },
      { mode: 'independent', endpoint: 'https://api.test/v1', model: 'model', stream: false },
    ),
    /empty content/i,
  );
});

test('independent connection failure does not fall back to main', async () => {
  let mainCalls = 0;
  const client = createDirectorClient({ adapter: { generateReply: async () => { mainCalls += 1; } }, fetchImpl: async () => ({ ok: false, status: 500, text: async () => 'bad' }) });
  await assert.rejects(client.requestDirector({ context: {}, intent: {} }, { mode: 'independent', endpoint: 'https://api.test', model: 'm' }), /500/);
  assert.equal(mainCalls, 0);
});

test('client reports timeout without leaking endpoint or API key', async () => {
  const client = createDirectorClient({ adapter: {}, fetchImpl: (_url, options) => new Promise((_resolve, reject) => {
    options.signal.addEventListener('abort', () => reject(Object.assign(new Error('aborted'), { name: 'AbortError' })));
  }) });
  await assert.rejects(
    client.requestDirector({ context: {}, intent: {} }, { mode: 'independent', endpoint: 'https://private.test/v1', apiKey: 'secret', model: 'm', timeoutMs: 1 }),
    (error) => error.name === 'TimeoutError' && !error.message.includes('secret') && !error.message.includes('private.test'),
  );
});

test('connection test validates main capability without generating content', async () => {
  const client = createDirectorClient({ adapter: { capabilities: { generation: true } } });
  assert.deepEqual(await client.testConnection({ mode: 'main' }), { ok: true, mode: 'main' });
});
