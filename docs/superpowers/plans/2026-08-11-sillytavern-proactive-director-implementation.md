# SillyTavern 主动导演扩展 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 构建一个可通过 GitHub URL 安装的 SillyTavern 前端扩展，以结构化副 API 导演状态机让单人卡及多人卡中的角色按自身人设主动推进日常、危机和成人剧情。

**Architecture:** 使用无构建步骤的 ES Modules 扩展，宿主 API 全部封装在 adapter 中，核心状态机、策略、响应校验和副本迁移保持为可用 Node.js 内置测试运行器验证的纯模块。UI 挂载于单一根节点，完整事件保存在聊天元数据中，每轮只通过宿主 adapter 临时注入精简行动并触发当前正文连接。

**Tech Stack:** JavaScript ES2022、SillyTavern extension API、HTML/CSS、OpenAI Chat Completions compatible HTTP、Node.js `node:test`、GitHub repository installation

## Global Constraints

- 不修改角色卡、作者备注或角色人格；关键行动必须引用对应人物的人格证据。
- 首版支持单角色卡及一张卡内的多人物；SillyTavern 原生群聊中暂停导演生成。
- 完整剧本不永久写入正文上下文；正文仍由 SillyTavern 当前主连接生成。
- 日常、危机、色情向独立开关和权重；高风险功能保持用户可停止、可配置安全词和硬禁区。
- 不实现角色年龄扫描和逐角色年龄确认弹窗；内容生成必须遵守平台适用的成人内容限制。
- 独立副 API 缺失并复用主连接时，提醒原文为 `正在在用主api哦！`，确认后 24 小时内不重复提醒。
- 自定义 CSS 默认限制在 `#st-proactive-director`，公开类名使用 `stpd-` 前缀。
- UI 使用紧凑工具型布局，桌面和窄屏均不得出现文字溢出、控件遮挡或不可操作元素。

---

## File Map

```text
manifest.json                         SillyTavern 扩展清单
index.js                              扩展入口和依赖装配
style.css                             默认主题及公开 CSS 变量
src/constants.js                     版本、默认值、事件和权限枚举
src/host/sillytavern-adapter.js       唯一宿主 API 边界
src/state/default-state.js            全局与聊天默认状态工厂
src/state/store.js                    设置及聊天状态持久化
src/state/migrations.js               schemaVersion 迁移
src/director/context-collector.js     角色、人物、聊天及世界观上下文
src/director/prompts.js               导演、校验、修复和多人识别提示词
src/director/schemas.js               结构化响应 schema 和校验器
src/director/client.js                独立 API 与主连接调用
src/director/personality.js           证据优先级和人格冲突检查
src/director/policy.js                用户主导权、危机、停止和边界策略
src/director/event-engine.js          主事件、伏笔、步骤和事务提交
src/director/scheduler.js             三种触发模式和空闲触发
src/director/pipeline.js              收集、调用、校验、注入、生成、提交
src/cast/cast-manager.js              多人识别、人工锁定和人物映射
src/snapshots/snapshot-manager.js     副本导入导出、预览和撤销
src/theme/theme-manager.js            CSS 作用域、预览、回退和主题文件
src/ui/director-console.js            根面板、标签切换和状态渲染
src/ui/views/*.js                     事件、伏笔、人物、偏好、连接、外观页面
src/ui/dialogs/*.js                   手动事件、迁移、授权和确认对话框
tests/**/*.test.js                    与 src 对应的 Node 单元/集成测试
README.md                             安装、配置、隐私、主题和故障排查
docs/css-theming.md                   稳定 CSS API
examples/theme.example.json           可导入主题示例
examples/snapshot.example.json        无敏感信息副本示例
```

### Task 1: 可安装扩展骨架与测试基线

**Files:** Create `manifest.json`, `index.js`, `style.css`, `package.json`, `src/constants.js`, `src/host/sillytavern-adapter.js`, `tests/manifest.test.js`, `tests/host/sillytavern-adapter.test.js`

**Interfaces:** Produces `createSillyTavernAdapter(contextProvider)`, `EXTENSION_KEY`, `SCHEMA_VERSION`, and an importable extension entry.

- [ ] 写失败测试，断言 manifest 具有 `display_name`、`loading_order`、`js`、`css`、版本和 GitHub 安装所需字段，并验证 adapter 在缺少宿主能力时返回明确 capability 状态。
- [ ] 运行 `node --test tests/manifest.test.js tests/host/sillytavern-adapter.test.js`，确认因文件或导出不存在而失败。
- [ ] 创建无构建 ES Module 骨架；adapter 暴露 `getContext()`、`getCurrentChatKey()`、`getCharacterData()`、`getMessages()`、`injectPrompt()`、`generateReply()`、`saveSettings()`、`saveChatState()`、`showConfirm()` 和 `on()`，所有宿主引用只存在于该文件。
- [ ] 再次运行测试并确认通过；运行 `node --check index.js`。
- [ ] 提交 `chore: scaffold SillyTavern director extension`。

### Task 2: 版本化状态与聊天隔离存储

**Files:** Create `src/state/default-state.js`, `src/state/migrations.js`, `src/state/store.js`, `tests/state/default-state.test.js`, `tests/state/store.test.js`, `tests/state/migrations.test.js`

**Interfaces:** Produces `createGlobalSettings()`, `createDirectorState(chatKey, fingerprint)`, `migrateState(raw)`, `createStore(adapter)` with `loadGlobal/saveGlobal/loadChat/saveChat/transaction`.

- [ ] 写失败测试，覆盖独立聊天状态、默认事件权重、API Key 不进入聊天状态、未知字段保留策略、schema 迁移及事务失败不提交。
- [ ] 运行对应 `node --test`，确认失败。
- [ ] 实现纯默认工厂、深拷贝、迁移链及序列化边界；聊天状态含 cast、activeEvent、foreshadowing、historySummary、preference、sceneSafety、pendingTransaction、cooldowns 和 counters。
- [ ] 运行状态测试，确认通过且 `JSON.stringify(createDirectorState(...))` 可执行。
- [ ] 提交 `feat: add versioned director state store`。

### Task 3: 上下文、题材与无限流规则账本

**Files:** Create `src/director/context-collector.js`, `src/director/world-genre.js`, `src/director/rule-ledger.js`, `tests/director/context-collector.test.js`, `tests/director/rule-ledger.test.js`

**Interfaces:** Produces `collectDirectorContext(adapter, state, settings)`, `detectGenreHints(card, messages)`, `mergeRuleLedger(current, update)`.

- [ ] 写失败测试，验证上下文优先级为导演备注、卡设定与禁忌、示例对话、稳定聊天表现、弱推断，并验证用户关闭字段后不发送对应内容。
- [ ] 写规则账本测试，覆盖 `publishedRules`、`hypotheses`、`triggeredTaboos`、`objectives`、`deadline`、`items`、`knowledgeByCharacter`、`anomalies`、`hiddenTruths`、`falseRules`；已公开规则不可被导演更新静默改写。
- [ ] 运行测试确认失败后，实现现实、奇幻、科幻、无限流、鬼怪灵异、末日、自定义及自动识别的题材层；事件方向仍保持日常、危机、色情三类。
- [ ] 运行测试确认通过，并增加世界观危机子类的序列化断言。
- [ ] 提交 `feat: collect genre-aware director context`。

### Task 4: 结构化导演协议与 API 客户端

**Files:** Create `src/director/schemas.js`, `src/director/prompts.js`, `src/director/client.js`, `tests/director/schemas.test.js`, `tests/director/client.test.js`, `tests/director/prompts.test.js`

**Interfaces:** Produces `validateDirectorResult(value)`, `buildDirectorMessages(context, intent)`, `createDirectorClient({adapter, fetchImpl, clock})`, `requestDirector(input, connectionMode)`.

- [ ] 写失败测试，覆盖结构化事件、人物职责、人格依据、反馈分类、风险、分支、规则账本更新及精简注入；拒绝未知反馈类别和缺失人格依据的关键行动。
- [ ] 写客户端测试，模拟独立 OpenAI Chat Completions 请求、超时、HTTP 错误、JSON 修复一次、主连接调用以及绝不自动降级连接。
- [ ] 写提醒测试，确保复用主连接前显示 `正在在用主api哦！`，确认后 `24 * 60 * 60 * 1000` 毫秒内不再提醒。
- [ ] 实现 schema 校验、提示词、脱敏错误和可注入 clock/fetch；提示词不得覆盖角色卡，且多人行动必须逐人给出证据。
- [ ] 运行三组测试并提交 `feat: add structured director API client`。

### Task 5: 人格、多人物与证据隔离

**Files:** Create `src/director/personality.js`, `src/cast/cast-manager.js`, `tests/director/personality.test.js`, `tests/cast/cast-manager.test.js`

**Interfaces:** Produces `evaluatePersonalityConsistency(action, cast, priority)`, `mergeDetectedCast(current, detected)`, `mapImportedCast(source, target)`.

- [ ] 写失败测试，覆盖单人卡不误拆、多人姓名及别名、人工锁定、合并拆分、共享背景、甲证据不可用于乙、弱推断不可覆盖明确设定。
- [ ] 写主导人物切换测试：必须提供符合动机、位置和信息状态的 `leadChangeReason`；不在场人物不得出现在本轮行动建议。
- [ ] 实现证据排序、冲突报告、识别结果合并和跨卡人物映射；低置信度识别回退单人模式。
- [ ] 运行测试确认通过，并提交 `feat: support evidence-isolated multi-character cards`。

### Task 6: 本地策略引擎

**Files:** Create `src/director/policy.js`, `tests/director/policy.test.js`

**Interfaces:** Produces `evaluatePolicy({proposal, state, settings, userText}) -> {allowed, action, reasons}` and `normalizeWeights(categories)`.

- [ ] 写失败测试，覆盖三类独立开关、权重归一化、全关、用户主导权三档、符合人设的表达要求、安全词、场外停止和硬禁区。
- [ ] 写危机测试，覆盖叙事可控、世界观危机，以及死亡、永久伤残、怀孕、生育、重大疾病、长期失踪、永久关系破裂、巨额财产变化的禁止、询问、授权。
- [ ] 写 CNC 停止测试：触发后清除待注入、停止事件、禁止空闲恢复；日志只返回安全词已触发而不含原词。
- [ ] 实现确定性策略，确保模型重试不能绕过本地拒绝；角色内推动强度不直接生成固定语气模板。
- [ ] 运行测试并提交 `feat: enforce director safety and preference policies`。

### Task 7: 主事件、伏笔和提交事务

**Files:** Create `src/director/event-engine.js`, `tests/director/event-engine.test.js`

**Interfaces:** Produces `createEventEngine(store)` with `propose/start/promoteForeshadowing/pause/resume/stop/reroll/changeDirection/stage/commit/rollback/reconcileEditedMessage`.

- [ ] 写失败测试，覆盖仅一条主事件、伏笔成熟度、提升条件、已发生事实不可被改线重写、正文失败回滚、多次重生成只提交最终版本。
- [ ] 写手动创建测试，覆盖完整输入和 AI 扩展构想；用户明确事实必须高于 AI 补全，预览确认前不得启动。
- [ ] 实现事件状态转换和 pending transaction，停止状态不可由空闲触发恢复。
- [ ] 运行测试确认通过，并提交 `feat: add transactional event engine`。

### Task 8: 三种调度与导演流水线

**Files:** Create `src/director/scheduler.js`, `src/director/pipeline.js`, `tests/director/scheduler.test.js`, `tests/director/pipeline.test.js`

**Interfaces:** Produces `createScheduler({clock, random})` and `createDirectorPipeline({adapter, store, client, policy, engine, collector})` with `handleUserMessage/handleIdle/manualCreate/cancel`.

- [ ] 写调度测试，覆盖混合智能本地未命中不调用、固定 N 轮、逐轮、冷却、每日上限、允许时段、页面隐藏和用户输入中取消空闲触发。
- [ ] 写流水线集成测试，严格验证收集、调用、schema、人格重试一次、策略、临时注入、正文生成和提交顺序。
- [ ] 写切换聊天及并发测试，确保旧请求取消、同聊天请求合并、结果不写入新聊天。
- [ ] 实现调度与流水线；普通重生成沿用指令，“重新判断剧情”才调用副 API。
- [ ] 运行测试并提交 `feat: orchestrate proactive director pipeline`。

### Task 9: 副本、迁移和敏感数据隔离

**Files:** Create `src/snapshots/snapshot-manager.js`, `tests/snapshots/snapshot-manager.test.js`, `examples/snapshot.example.json`

**Interfaces:** Produces `exportSnapshot(state, selection)`, `previewImport(snapshot, target, options)`, `applyImport(preview)`, `undoLastImport()`.

- [ ] 写失败测试，覆盖适配新角色、完整克隆、自定义迁移、事件历史、人格模式、进度、安全词合并、人物映射、导入前备份和撤销。
- [ ] 写敏感数据测试，确保 API Key、CNC 开关状态及重大后果授权不进入副本；安全词和硬禁区仅在用户勾选时出现。
- [ ] 实现版本化 JSON 副本及迁移预览，原样保留人格时产生持续冲突警告但不写回角色卡。
- [ ] 运行测试并提交 `feat: add selective director snapshots`。

### Task 10: CSS 主题系统

**Files:** Create `src/theme/theme-manager.js`, `tests/theme/theme-manager.test.js`, `docs/css-theming.md`, `examples/theme.example.json`; Modify `style.css`

**Interfaces:** Produces `createThemeManager(documentRef, settingsStore)` with `preview/save/disable/reset/rollback/importTheme/exportTheme/destroy`.

- [ ] 写失败测试，验证 CSS 变量、`stpd-` 公共类、独立 style 节点、默认根节点作用域、停用和 destroy 清理。
- [ ] 写主题导入导出测试，确保文件只含元数据、变量和 CSS，不含聊天、API 或边界数据。
- [ ] 实现可靠的规则作用域转换；`@media`、`@supports` 和 `@keyframes` 不被错误加前缀，全局 CSS 仅在高级开关启用时原样注入。
- [ ] 完成公开变量文档和示例，运行测试并提交 `feat: add isolated CSS theme customization`。

### Task 11: 简洁导演台 UI

**Files:** Create `src/ui/director-console.js`, `src/ui/views/current-event.js`, `src/ui/views/foreshadowing.js`, `src/ui/views/cast.js`, `src/ui/views/preferences.js`, `src/ui/views/connection.js`, `src/ui/views/appearance.js`, `src/ui/dialogs/manual-event.js`, `src/ui/dialogs/snapshot-import.js`, `src/ui/dialogs/confirm.js`; Modify `style.css`, `index.js`; Create `tests/ui/render.test.js`

**Interfaces:** Produces `createDirectorConsole({root, services})` with `mount/render/destroy` and view-level event callbacks into existing services.

- [ ] 写 DOM 契约测试，验证五个导演标签页加外观页、关键按钮、表单 label、ARIA 状态、危险设置渐进展开和原生群聊暂停提示。
- [ ] 实现根面板和视图，使用紧凑标签、分段模式、开关、滑块、数值输入、风险文本加状态色和带 tooltip 的图标按钮。
- [ ] 实现手动事件预览、改方向、人物校正、连接测试、迁移预览、安全词合并和 CSS 编辑流程。
- [ ] 接入入口生命周期，保证重复加载不重复绑定监听器，destroy 清理计时器、请求、DOM 和样式。
- [ ] 运行 UI 契约测试和全部单元测试，提交 `feat: build director console UI`。

### Task 12: 宿主集成、视觉验收与文档

**Files:** Modify `README.md`, `manifest.json`, `index.js`; Create `tests/integration/extension.test.js`, `docs/manual-test-checklist.md`

**Interfaces:** Completes installable extension and documents GitHub publication/install flow.

- [ ] 写集成测试宿主桩，覆盖初始化、单人卡、多人物卡、原生群聊暂停、消息触发、临时注入、正文成功提交、失败回滚和刷新恢复。
- [ ] 运行 `node --test` 和 `node --check index.js`，修复所有失败并记录测试数量。
- [ ] 启动适合静态扩展预览的本地服务，在桌面与窄屏用 Playwright 检查标签切换、弹窗、长文本、权重控件、CSS 即时预览及无重叠；保存截图到 `artifacts/visual-qa/`。
- [ ] 在 README 写明 GitHub URL 安装、双连接配置、24 小时提醒、触发模式、题材/规则账本、多人卡、副本、CSS 主题、隐私和故障排查。
- [ ] 按 `docs/manual-test-checklist.md` 在真实 SillyTavern 中完成一次主连接和一次独立兼容 API 冒烟测试；若本机无 SillyTavern，明确记录该项未执行而不宣称通过。
- [ ] 运行 `git diff --check`、确认副本和日志无密钥，再提交 `docs: finalize installation and verification guide`。

## Final Verification

- [ ] 运行 `node --test`，所有测试通过。
- [ ] 运行 `node --check index.js` 以及对 `src/**/*.js` 的语法检查。
- [ ] 运行 `git diff --check`，无空白错误。
- [ ] 核对 manifest 可由 GitHub 仓库根目录直接安装。
- [ ] 核对设计规格第 1 至 17 节、CSS 修订、题材层、世界观危机和规则账本均有对应实现或测试。
- [ ] 核对用户手动修改的规格未被实现过程覆盖。
