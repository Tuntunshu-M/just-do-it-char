import { el, field, runAction, selectField } from '../dom.js';

export function renderConnectionView({ body, settings, services, saveSettings, rerender }) {
  const doc = body.ownerDocument;
  body.append(selectField(doc, '导演 API 连接', settings.connection.mode, [['main', '当前主连接'], ['independent', '独立兼容 API']], (value) => { settings.connection.mode = value; saveSettings(); rerender(); }));
  if (settings.connection.mode === 'main') {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '正在使用主 API。'));
    const test = el(doc, 'button', { type: 'button' }, '测试主连接');
    test.onclick = async () => { test.disabled = true; await runAction(async () => { await services.testConnection?.(settings.connection); services.notice?.('主连接能力可用。'); }, (message) => services.notice?.(`主连接不可用：${message}`)); test.disabled = false; };
    body.append(test); return;
  }
  for (const [key, label, type, placeholder] of [['endpoint', '接口地址', 'url', 'https://api.example.com/v1'], ['apiKey', 'API Key', 'password', 'sk-...'], ['model', '模型', 'text', '模型名称']]) {
    const input = el(doc, 'input', { type, value: settings.connection[key] ?? '', placeholder });
    input.onchange = () => { settings.connection[key] = input.value.trim(); saveSettings(); }; body.append(field(doc, label, input));
  }
  const models = el(doc, 'select', { 'aria-label': '模型列表' }); models.append(el(doc, 'option', { value: '' }, settings.connection.model || '先拉取模型'));
  models.onchange = () => { if (models.value) { settings.connection.model = models.value; saveSettings(); } };
  const fetchModels = el(doc, 'button', { type: 'button' }, '拉取模型');
  fetchModels.onclick = async () => { fetchModels.disabled = true; await runAction(async () => { const values = await services.listModels?.(settings.connection); models.replaceChildren(...values.map((value) => el(doc, 'option', { value }, value))); models.value = settings.connection.model; services.notice?.(`已拉取 ${values.length} 个模型。`); }, (message) => services.notice?.(`拉取模型失败：${message}`)); fetchModels.disabled = false; };
  body.append(field(doc, '模型选择', models), fetchModels);
  const temperature = el(doc, 'input', { type: 'number', min: '0', max: '2', step: '0.1', value: String(settings.connection.temperature ?? 0.7) });
  temperature.onchange = () => { settings.connection.temperature = Math.max(0, Math.min(2, Number(temperature.value) || 0.7)); saveSettings(); };
  const maxTokens = el(doc, 'input', { type: 'number', min: '1', max: '100000', value: String(settings.connection.maxTokens ?? 2000) });
  maxTokens.onchange = () => { settings.connection.maxTokens = Math.max(1, Number(maxTokens.value) || 2000); saveSettings(); };
  const stream = el(doc, 'input', { type: 'checkbox', checked: settings.connection.stream }); stream.onchange = () => { settings.connection.stream = stream.checked; saveSettings(); };
  body.append(field(doc, '温度', temperature), field(doc, '最大输出', maxTokens), field(doc, '流式生成', stream));
  const test = el(doc, 'button', { type: 'button' }, '测试连接');
  test.onclick = async () => { test.disabled = true; await runAction(async () => { await services.testConnection?.(settings.connection); services.notice?.('连接测试成功。'); }, (message) => services.notice?.(`连接测试失败：${message}`)); test.disabled = false; };
  body.append(test);
}
