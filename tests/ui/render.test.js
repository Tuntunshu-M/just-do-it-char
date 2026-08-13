import assert from 'node:assert/strict';
import test from 'node:test';

async function source() {
  const fs = await import('node:fs/promises');
  const root = new URL('../../src/ui/', import.meta.url);
  const files = ['director-console.js', 'dom.js', 'views/event.js', 'views/cast.js', 'views/preferences.js', 'views/connection.js', 'views/world-info.js', 'views/snapshots.js', 'views/appearance.js', 'views/diagnostics.js', 'dialogs/confirm.js'];
  return (await Promise.all(files.map((file) => fs.readFile(new URL(file, root), 'utf8')))).join('\n');
}

async function uiSource(path) {
  return (await import('node:fs/promises')).readFile(new URL(`../../src/ui/${path}`, import.meta.url), 'utf8');
}

test('console module exports lifecycle contract', async () => {
  const module = await import('../../src/ui/director-console.js');
  assert.equal(typeof module.createDirectorConsole, 'function');
  const text = await source();
  for (const tab of ['事件', '伏笔', '人物', '世界书', '偏好', '副本']) assert.match(text, new RegExp(tab));
  const consoleText = await uiSource('director-console.js');
  assert.match(consoleText, /class: 'stpd-settings'/);
  assert.match(consoleText, /aria-label': '打开设置'/);
  assert.doesNotMatch(consoleText, /fa-gear[^\n]*⚙/);
  assert.match(consoleText, /SETTINGS_TABS/);
  assert.match(consoleText, /\['diagnostics', '检查'\]/);
  assert.doesNotMatch(consoleText, /\['connection', '连接'\].*TABS/);
  for (const contract of ['aria-selected', 'stpd-overlay', 'stpd-modal', 'stpd-modal-body', 'openModal', 'Escape']) assert.match(text, new RegExp(contract));
  assert.doesNotMatch(text, /event\.target === overlay/);
});

test('console supports prompted manual events and persists editable settings', async () => {
  const text = await source();
  for (const label of ['事件想法', '让 AI 扩展', '让 char 策划旅行', 'select.onchange', 'agency.onchange', 'weight.onchange']) assert.match(text, new RegExp(label));
  assert.match(text, /onManualEvent\?\.\(idea\.value/);
});

test('console exposes independent API connection fields', async () => {
  const text = await source();
  for (const label of ['接口地址', 'API Key', '模型', '拉取模型', '温度', '最大输出', '流式生成', 'password']) assert.match(text, new RegExp(label));
  assert.match(text, /connection\[key\]/);
});

test('console exposes director notes and selectable world-book controls', async () => {
  const text = await source();
  for (const label of ['导演指令', '世界书', '全选', '全不选', '搜索世界书或条目', '人物侧写', '生成中']) assert.match(text, new RegExp(label));
  assert.match(text, /loadWorldInfoBook/);
  assert.match(text, /indeterminate/);
});

test('console gates the explicit erotic high-risk mode with a safeword', async () => {
  const text = await source();
  for (const label of ['题材', '无限流', '鬼怪灵异', '触发方式', '重大后果', '高风险模式（色情向）', '安全词', '硬禁区']) assert.match(text, new RegExp(label));
  assert.match(text, /请先填写安全词。/);
  assert.match(text, /services\.confirm/);
  assert.match(text, /cncEnabled/);
  assert.match(text, /safewords/);
  assert.match(text, /支持中文逗号、英文逗号或换行分隔/);
});

test('console exposes selective snapshot migration', async () => {
  const text = await source();
  for (const label of ['事件框架', '角色专属历史', '原人格推断', '规则账本', '安全词与硬禁区', '导出副本', '导入副本', '撤销导入']) assert.match(text, new RegExp(label));
  assert.match(text, /exportSnapshot/);
  assert.match(text, /importSnapshot/);
  assert.match(text, /applySnapshotMode/);
  assert.match(text, /customizeSnapshotOption/);
});

test('console delegates views and dialogs to modular UI files', async () => {
  const text = await source();
  for (const moduleName of ['event', 'cast', 'preferences', 'connection', 'world-info', 'snapshots', 'appearance', 'diagnostics']) {
    assert.match(text, new RegExp(`views/${moduleName}\\.js`));
  }
  for (const moduleName of ['manual-event', 'snapshot-import', 'cast-correction', 'confirm']) {
    assert.match(text, new RegExp(`dialogs/${moduleName}\\.js`));
  }
});

test('settings diagnostics page exposes checks, reports, and retained event outcomes', async () => {
  const text = await uiSource('views/diagnostics.js');
  for (const label of ['运行检查', '复制诊断报告', '清空记录', '当前状态', '检查结果', '最近记录']) {
    assert.match(text, new RegExp(label));
  }
  assert.match(text, /state\.diagnostics/);
  assert.match(text, /services\.runDiagnostics/);
  assert.match(text, /services\.copyDiagnosticReport/);
});

test('appearance page exposes CSS customization and a CSS template export', async () => {
  const text = await uiSource('views/appearance.js');
  assert.match(text, /导出 CSS 模板/);
  assert.doesNotMatch(text, /stpd-theme-mode/);
  assert.match(text, /exportCssTemplate/);
});

test('cast view exposes replace, merge, and split correction workflows', async () => {
  const text = `${await uiSource('views/cast.js')}\n${await uiSource('dialogs/cast-correction.js')}`;
  for (const label of ['校正人物', '合并人物', '拆分人物', '人物名称', '别名']) assert.match(text, new RegExp(label));
  assert.match(text, /correctCast/);
});

test('cast view keeps full profiles and evidence sources folded by default', async () => {
  const text = await uiSource('views/cast.js');
  assert.match(text, /profile\.content/);
  assert.match(text, /'details'/);
  assert.match(text, /全部侧写/);
  assert.match(text, /引用资料/);
  assert.match(text, /profile\.citations/);
  assert.match(text, /stpd-collapsible/);
  assert.doesNotMatch(text, /open:\s*true/);
});

test('snapshot import dialog renders summary and warnings before apply', async () => {
  const text = await uiSource('dialogs/snapshot-import.js');
  for (const label of ['导入预览', '活动事件', '伏笔', '人物', '安全设置', '确认导入']) assert.match(text, new RegExp(label));
  assert.match(text, /preview\.warnings/);
});

test('async UI actions surface rejected operations instead of becoming silent no-ops', async () => {
  const { runAction } = await import('../../src/ui/dom.js');
  const notices = [];
  await runAction(async () => { throw new Error('network unavailable'); }, (message) => notices.push(message));
  assert.deepEqual(notices, ['network unavailable']);
});
