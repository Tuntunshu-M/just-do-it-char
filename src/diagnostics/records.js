const RECORD_LIMIT = 20;
const MESSAGE_LIMIT = 500;
let sequence = 0;

function diagnosticsFor(state) {
  state.diagnostics ??= { records: [], lastCheck: null };
  state.diagnostics.records ??= [];
  return state.diagnostics;
}

function redactLiteral(value, secret) {
  if (!secret) return value;
  return value.split(String(secret)).join('[REDACTED]');
}

export function sanitizeDiagnosticMessage(value, secrets = {}) {
  let message = String(value ?? '');
  message = message.replace(/Authorization\s*:\s*Bearer\s+[^\s,;]+/gi, 'Authorization: Bearer [REDACTED]');
  message = message.replace(/Bearer\s+[^\s,;]+/gi, 'Bearer [REDACTED]');
  message = message.replace(/\bsk-[A-Za-z0-9_-]{12,}\b/g, '[REDACTED]');
  message = message.replace(/(https?:\/\/[^\s?]+)\?[^\s]*/gi, '$1?[REDACTED]');
  message = redactLiteral(message, secrets.apiKey);
  message = redactLiteral(message, secrets.endpoint);
  return message.replace(/\s+/g, ' ').trim().slice(0, MESSAGE_LIMIT);
}

export function startDiagnostic(state, input, { now = Date.now, secrets = {} } = {}) {
  const timestamp = now();
  const record = {
    id: `${timestamp}-${sequence += 1}`,
    trigger: input.trigger,
    status: 'running',
    stage: input.stage,
    startedAt: new Date(timestamp).toISOString(),
    finishedAt: null,
    durationMs: null,
    message: sanitizeDiagnosticMessage(input.message, secrets),
  };
  const diagnostics = diagnosticsFor(state);
  diagnostics.records.push(record);
  if (diagnostics.records.length > RECORD_LIMIT) diagnostics.records.splice(0, diagnostics.records.length - RECORD_LIMIT);
  return record;
}

export function updateDiagnostic(state, id, patch, { now = Date.now, secrets = {} } = {}) {
  const record = diagnosticsFor(state).records.find((item) => item.id === id);
  if (!record) return null;
  if (patch.trigger !== undefined) record.trigger = patch.trigger;
  if (patch.status !== undefined) record.status = patch.status;
  if (patch.stage !== undefined) record.stage = patch.stage;
  if (patch.message !== undefined) record.message = sanitizeDiagnosticMessage(patch.message, secrets);
  if (patch.status && patch.status !== 'running') {
    const finishedAt = now();
    record.finishedAt = new Date(finishedAt).toISOString();
    record.durationMs = Math.max(0, finishedAt - Date.parse(record.startedAt));
  }
  return record;
}

export function formatDiagnosticReport(snapshot = {}) {
  const lines = ['导演时间诊断报告'];
  if (snapshot.checkedAt) lines.push(`检查时间: ${snapshot.checkedAt}`);
  for (const [key, value] of Object.entries(snapshot.summary ?? {})) {
    lines.push(`${key}: ${sanitizeDiagnosticMessage(value)}`);
  }
  if (snapshot.checks?.length) lines.push('', '检查结果:');
  for (const check of snapshot.checks ?? []) {
    lines.push(`- [${check.status}] ${sanitizeDiagnosticMessage(check.label)}: ${sanitizeDiagnosticMessage(check.message)}`);
  }
  if (snapshot.records?.length) lines.push('', '最近记录:');
  for (const record of snapshot.records ?? []) {
    lines.push(`- ${record.startedAt ?? ''} ${record.trigger ?? ''} ${record.status ?? ''} ${record.stage ?? ''} ${record.durationMs ?? '-'}ms ${sanitizeDiagnosticMessage(record.message)}`.trim());
  }
  return lines.join('\n');
}
