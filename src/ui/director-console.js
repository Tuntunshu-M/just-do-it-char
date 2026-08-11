const TABS = [
  ['event', '事件'], ['threads', '伏笔'], ['cast', '人物'],
  ['preferences', '偏好'], ['connection', '连接'], ['appearance', '外观'],
  ['snapshots', '副本'],
];

function el(doc, tag, attrs = {}, text = '') {
  const node = doc.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (key === 'class') node.className = value;
    else if (key === 'checked') node.checked = value;
    else node.setAttribute(key, value);
  }
  node.textContent = text;
  return node;
}

function lines(value) {
  return String(value ?? '').split(/[\n,]/).map((item) => item.trim()).filter(Boolean);
}

export function createDirectorConsole({ root, services }) {
  let active = 'event';
  let settings;
  let state;
  let open = false;
  let escapeHandler;
  let snapshotOptions = { eventFramework: true, history: false, personality: false, rules: false, safety: false };
  const saveSettings = () => services.saveSettings?.(settings);
  const saveState = () => services.saveState?.(state);

  function field(label, input) {
    const wrapper = el(root.ownerDocument, 'label', { class: 'stpd-field' });
    wrapper.append(el(root.ownerDocument, 'span', {}, label), input);
    return wrapper;
  }

  function selectField(label, value, options, onChange) {
    const select = el(root.ownerDocument, 'select', { 'aria-label': label });
    for (const [optionValue, text] of options) {
      const option = el(root.ownerDocument, 'option', { value: optionValue }, text);
      option.selected = value === optionValue;
      select.append(option);
    }
    select.onchange = () => onChange(select.value);
    return field(label, select);
  }

  function renderEvent(body, doc) {
    body.append(
      el(doc, 'h3', {}, state.activeEvent?.title ?? '暂无活动事件'),
      el(doc, 'p', { class: 'stpd-muted' }, state.activeEvent?.premise ?? '导演将在合适时机创建事件。'),
    );
    const idea = el(doc, 'textarea', { 'aria-label': '事件想法', rows: '3', placeholder: '输入事件想法，例如：让 char 策划旅行' });
    const expand = el(doc, 'input', { type: 'checkbox', checked: true });
    const create = el(doc, 'button', { type: 'button' }, '创建事件');
    create.onclick = () => { const value = idea.value.trim(); if (value) services.onManualEvent?.(value, expand.checked); };
    body.append(field('事件想法', idea), field('让 AI 扩展', expand), create);
  }

  function renderPreferences(body, doc) {
    for (const [key, name] of [['daily', '生活日常'], ['crisis', '突发危机'], ['erotic', '色情向']]) {
      const enabled = el(doc, 'input', { type: 'checkbox', checked: settings.categories[key].enabled });
      enabled.onchange = () => { settings.categories[key].enabled = enabled.checked; saveSettings(); };
      const weight = el(doc, 'input', { type: 'range', min: '0', max: '100', value: String(settings.categories[key].weight) });
      weight.onchange = () => { settings.categories[key].weight = Number(weight.value); saveSettings(); };
      body.append(field(name, enabled), field(`${name}占比`, weight));
    }
    const agency = el(doc, 'input', { type: 'range', min: '0', max: '100', value: String(state.preference.userAgency) });
    agency.onchange = () => { state.preference.userAgency = Number(agency.value); saveState(); };
    body.append(field('用户意愿优先', agency));

    body.append(selectField('题材', settings.genre.mode, [
      ['auto', '自动'], ['reality', '现实'], ['fantasy', '奇幻'], ['sci-fi', '科幻'],
      ['infinite-flow', '无限流'], ['supernatural', '鬼怪灵异'], ['apocalypse', '末日'], ['custom', '自定义'],
    ], (value) => { settings.genre.mode = value; saveSettings(); render(); }));
    if (settings.genre.mode === 'custom') {
      const custom = el(doc, 'input', { type: 'text', value: settings.genre.custom ?? '', placeholder: '输入题材' });
      custom.onchange = () => { settings.genre.custom = custom.value.trim(); saveSettings(); };
      body.append(field('自定义题材', custom));
    }
    body.append(selectField('触发方式', settings.trigger.mode, [
      ['hybrid', '智能混合'], ['fixed', '固定回合'], ['every', '每回合'],
    ], (value) => { settings.trigger.mode = value; saveSettings(); render(); }));
    const turns = el(doc, 'input', { type: 'number', min: '1', max: '100', value: String(settings.trigger.fixedTurns ?? 4) });
    turns.onchange = () => { settings.trigger.fixedTurns = Number(turns.value) || 4; saveSettings(); };
    body.append(field('固定回合数', turns));

    body.append(el(doc, 'h4', {}, '重大后果'));
    for (const consequence of ['受伤', '分离', '财产损失', '死亡']) {
      const permission = state.preference.consequencePermissions[consequence] ?? settings.defaults.consequencePermissions[consequence] ?? 'ask';
      body.append(selectField(consequence, permission, [['forbidden', '禁止'], ['ask', '先询问'], ['authorized', '允许']], (value) => {
        state.preference.consequencePermissions[consequence] = value; saveState();
      }));
    }

    const safewords = el(doc, 'textarea', { rows: '2', placeholder: '安全词，用逗号或换行分隔' });
    safewords.value = state.sceneSafety.safewords.join(', ');
    safewords.onchange = () => { state.sceneSafety.safewords = lines(safewords.value); if (!state.sceneSafety.safewords.length) state.sceneSafety.cncEnabled = false; saveState(); render(); };
    const hardLimits = el(doc, 'textarea', { rows: '2', placeholder: '硬禁区，用逗号或换行分隔' });
    hardLimits.value = state.sceneSafety.hardLimits.join(', ');
    hardLimits.onchange = () => { state.sceneSafety.hardLimits = lines(hardLimits.value); saveState(); };
    body.append(field('安全词', safewords), field('硬禁区', hardLimits));

    const cnc = el(doc, 'input', { type: 'checkbox', checked: state.sceneSafety.cncEnabled });
    cnc.onchange = async () => {
      if (!cnc.checked) { state.sceneSafety.cncEnabled = false; saveState(); return; }
      if (!state.sceneSafety.safewords.length) { cnc.checked = false; services.notice?.('请先填写安全词。'); return; }
      const accepted = await services.confirm?.('启用高风险模式后，导演只会在当前聊天授权范围内解释角色内口头反抗；安全词和硬禁区始终有效。');
      if (accepted) { state.sceneSafety.cncEnabled = true; saveState(); } else cnc.checked = false;
    };
    body.append(field('高风险模式（色情向）', cnc));
  }

  function renderConnection(body, doc) {
    body.append(selectField('导演 API 连接', settings.connection.mode, [['main', '当前主连接'], ['independent', '独立兼容 API']], (value) => {
      settings.connection.mode = value; saveSettings(); render();
    }));
    if (settings.connection.mode === 'main') { body.append(el(doc, 'p', { class: 'stpd-muted' }, '正在使用主 API。')); return; }
    for (const [key, label, type, placeholder] of [['endpoint', '接口地址', 'url', 'https://api.example.com/v1'], ['apiKey', 'API Key', 'password', 'sk-...'], ['model', '模型', 'text', '模型名称']]) {
      const input = el(doc, 'input', { type, value: settings.connection[key] ?? '', placeholder });
      input.onchange = () => { settings.connection[key] = input.value.trim(); saveSettings(); };
      body.append(field(label, input));
    }
  }

  function renderSnapshots(body, doc) {
    body.append(el(doc, 'p', { class: 'stpd-muted' }, '选择要迁移的内容；副本不包含 API Key、授权或高风险开关状态。'));
    for (const [key, label] of [['eventFramework', '事件框架'], ['history', '角色专属历史'], ['personality', '原人格推断'], ['rules', '规则账本'], ['safety', '安全词与硬禁区']]) {
      const checkbox = el(doc, 'input', { type: 'checkbox', checked: snapshotOptions[key] });
      checkbox.onchange = () => { snapshotOptions[key] = checkbox.checked; };
      body.append(field(label, checkbox));
    }
    const exportButton = el(doc, 'button', { type: 'button' }, '导出副本');
    exportButton.onclick = () => services.exportSnapshot?.(snapshotOptions);
    const file = el(doc, 'input', { type: 'file', accept: 'application/json', 'aria-label': '选择副本文件' });
    file.onchange = async () => { if (file.files?.[0]) services.importSnapshot?.(file.files[0], snapshotOptions); };
    const undo = el(doc, 'button', { type: 'button' }, '撤销导入');
    undo.onclick = () => services.undoImport?.();
    body.append(exportButton, field('导入副本', file), undo);
  }

  function renderView(body) {
    const doc = root.ownerDocument;
    if (active === 'event') renderEvent(body, doc);
    else if (active === 'threads') body.append(el(doc, 'p', {}, `伏笔 ${state.foreshadowing?.length ?? 0} 条`));
    else if (active === 'cast') body.append(el(doc, 'p', {}, state.cast?.mode === 'multi' ? `多人卡：${state.cast.members.length} 人` : '单角色模式'));
    else if (active === 'preferences') renderPreferences(body, doc);
    else if (active === 'connection') renderConnection(body, doc);
    else if (active === 'snapshots') renderSnapshots(body, doc);
    else {
      const area = el(doc, 'textarea', { 'aria-label': '自定义 CSS', rows: '10', placeholder: '.stpd-status { color: var(--stpd-accent); }' });
      area.value = settings.theme.css ?? '';
      const preview = el(doc, 'button', { type: 'button' }, '预览');
      preview.onclick = () => services.previewTheme?.({ ...settings.theme, enabled: true, css: area.value });
      body.append(field('自定义 CSS', area), preview);
    }
  }

  function render() {
    root.replaceChildren();
    root.id = 'st-proactive-director';
    root.className = `stpd-console${open ? ' stpd-modal-open' : ''}`;
    const doc = root.ownerDocument;
    const overlay = el(doc, 'div', { class: 'stpd-overlay', role: 'presentation' });
    const modal = el(doc, 'section', { class: 'stpd-modal', role: 'dialog', 'aria-modal': 'true', 'aria-label': '主动导演' });
    const header = el(doc, 'header', { class: 'stpd-header stpd-row' });
    header.append(el(doc, 'strong', { class: 'stpd-title' }, '主动导演'), el(doc, 'span', { class: `stpd-status stpd-status-${state.status}` }, state.status === 'active' ? '运行中' : '待机'));
    const stop = el(doc, 'button', { type: 'button', class: 'stpd-stop', 'aria-label': '立即停止导演', title: '立即停止' }, '■');
    stop.onclick = () => services.stop?.();
    const closeButton = el(doc, 'button', { type: 'button', class: 'stpd-close', 'aria-label': '关闭主动导演', title: '关闭' }, '×');
    closeButton.onclick = close;
    header.append(stop, closeButton);
    const nav = el(doc, 'nav', { class: 'stpd-tabs', 'aria-label': '导演控制台' });
    for (const [id, label] of TABS) {
      const button = el(doc, 'button', { type: 'button', role: 'tab', 'aria-selected': String(active === id) }, label);
      button.onclick = () => { active = id; render(); };
      nav.append(button);
    }
    const body = el(doc, 'section', { class: 'stpd-modal-body stpd-view', role: 'tabpanel' });
    renderView(body);
    modal.append(header, nav, body);
    overlay.append(modal);
    root.append(overlay);
  }

  function openModal() {
    open = true;
    render();
    root.querySelector('.stpd-close')?.focus();
  }

  function close() {
    open = false;
    render();
  }

  return {
    mount(data) {
      settings = data.settings;
      state = data.state;
      escapeHandler = (event) => { if (event.key === 'Escape' && open) close(); };
      root.ownerDocument.addEventListener('keydown', escapeHandler);
      render();
    },
    open: openModal,
    close,
    render(data) { settings = data?.settings ?? settings; state = data?.state ?? state; render(); },
    destroy() {
      if (escapeHandler) root.ownerDocument.removeEventListener('keydown', escapeHandler);
      root.replaceChildren();
    },
  };
}
