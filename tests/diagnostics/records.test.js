import assert from 'node:assert/strict';
import test from 'node:test';

import {
  formatDiagnosticReport,
  sanitizeDiagnosticMessage,
  startDiagnostic,
  updateDiagnostic,
} from '../../src/diagnostics/records.js';

test('diagnostic records finish with duration and retain only the newest twenty attempts', () => {
  const state = { diagnostics: { records: [], lastCheck: null } };
  let current = Date.parse('2026-08-13T10:00:00.000Z');
  const now = () => current;

  const first = startDiagnostic(state, { trigger: 'manual', stage: 'collecting' }, { now });
  current += 1250;
  updateDiagnostic(state, first.id, { status: 'failed', stage: 'generating', message: 'bad response' }, { now });

  assert.deepEqual(state.diagnostics.records[0], {
    id: first.id,
    trigger: 'manual',
    status: 'failed',
    stage: 'generating',
    startedAt: '2026-08-13T10:00:00.000Z',
    finishedAt: '2026-08-13T10:00:01.250Z',
    durationMs: 1250,
    message: 'bad response',
  });

  for (let index = 0; index < 21; index += 1) {
    current += 1;
    startDiagnostic(state, { trigger: 'advance', stage: 'collecting' }, { now });
  }

  assert.equal(state.diagnostics.records.length, 20);
  assert.notEqual(state.diagnostics.records.at(-1).id, first.id);
});

test('diagnostic messages redact credentials, endpoint details, query strings, and excess text', () => {
  const apiKey = 'private-key-value';
  const endpoint = 'https://private.example/v1';
  const raw = `Authorization: Bearer token-secret sk-abcdefghijklmnop ${apiKey} ${endpoint}/chat?trace=secret\n${'x'.repeat(600)}`;

  const result = sanitizeDiagnosticMessage(raw, { apiKey, endpoint });

  assert.equal(result.includes('token-secret'), false);
  assert.equal(result.includes('sk-abcdefghijklmnop'), false);
  assert.equal(result.includes(apiKey), false);
  assert.equal(result.includes(endpoint), false);
  assert.equal(result.includes('trace=secret'), false);
  assert.equal(result.includes('\n'), false);
  assert.ok(result.length <= 500);
  assert.match(result, /\[REDACTED\]/);
});

test('diagnostic report contains sanitized checks and records without connection secrets', () => {
  const report = formatDiagnosticReport({
    checkedAt: '2026-08-13T10:00:00.000Z',
    summary: { connectionMode: 'main', generationPhase: 'failed' },
    checks: [{ label: '连接', status: 'fail', message: 'Bearer hidden-token' }],
    records: [{ trigger: 'manual', status: 'failed', stage: 'generating', startedAt: '2026-08-13T09:59:00.000Z', durationMs: 42, message: 'sk-abcdefghijklmnop' }],
  });

  assert.match(report, /导演时间诊断报告/);
  assert.match(report, /manual/);
  assert.equal(report.includes('hidden-token'), false);
  assert.equal(report.includes('sk-abcdefghijklmnop'), false);
});
