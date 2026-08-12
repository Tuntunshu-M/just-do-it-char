import { sanitizeDiagnosticMessage } from './records.js';

function item(id, label, status, message) {
  return { id, label, status, message: sanitizeDiagnosticMessage(message) };
}

export async function runDiagnostics({ adapter, settings, state, now = Date.now }) {
  const capabilities = adapter.capabilities ?? {};
  const checks = [];
  const chatKey = adapter.getCurrentChatKey?.();
  checks.push(item('chat', '当前聊天', chatKey ? 'pass' : 'fail', chatKey ? '已连接当前聊天。' : '未打开可用的角色聊天。'));
  checks.push(item('enabled', '扩展开关', settings.enabled ? 'pass' : 'warning', settings.enabled ? '导演时间已启用。' : '导演时间当前已停用。'));

  const connection = settings.connection ?? {};
  if (connection.mode === 'main') {
    checks.push(item('connection', '连接配置', capabilities.rawGeneration ? 'pass' : 'fail', capabilities.rawGeneration ? '将使用 SillyTavern 当前主连接。' : '当前主连接不提供原始生成能力。'));
  } else {
    const missing = ['endpoint', 'model'].filter((key) => !String(connection[key] ?? '').trim());
    checks.push(item('connection', '连接配置', missing.length ? 'fail' : 'pass', missing.length ? `独立 API 缺少：${missing.join(', ')}` : '独立 API 必要字段已填写。'));
  }

  const generationReady = capabilities.promptInjection && capabilities.rawGeneration && capabilities.normalGeneration;
  checks.push(item('host-generation', '生成能力', generationReady ? 'pass' : 'fail', generationReady ? '导演生成、提示注入和正文生成能力可用。' : '缺少导演生成、提示注入或正文生成能力。'));
  const storageReady = capabilities.settings && capabilities.chatState;
  checks.push(item('storage', '状态保存', storageReady ? 'pass' : 'fail', storageReady ? '全局设置和聊天状态可保存。' : '全局设置或聊天状态保存能力不可用。'));

  let installedWorldBooks = 0;
  if (!settings.context?.worldInfo) {
    checks.push(item('world-books', '世界书', 'warning', '世界书上下文已关闭。'));
  } else {
    try {
      const names = await adapter.getWorldInfoNames?.();
      installedWorldBooks = Array.isArray(names) ? names.length : 0;
      checks.push(item('world-books', '世界书', 'pass', `已发现 ${installedWorldBooks} 本已安装世界书。`));
    } catch (error) {
      checks.push(item('world-books', '世界书', 'fail', error?.message || '无法读取世界书列表。'));
    }
  }

  return {
    checkedAt: new Date(now()).toISOString(),
    summary: {
      chatKey: chatKey ?? '',
      connectionMode: connection.mode ?? 'main',
      generationPhase: state.generation?.phase ?? state.status ?? 'idle',
      installedWorldBooks,
      selectedWorldBooks: Object.keys(settings.context?.worldInfoBooks ?? {}).length,
    },
    checks,
  };
}
