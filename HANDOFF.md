# 导演时间项目交接

更新时间：2026-08-14

## 项目目标

SillyTavern 1.18 扩展“导演时间”（仓库 `just-do-it-char`），为当前聊天提供可编辑的角色侧写、事件策划、剧本草案、阶段运行、伏笔注入和诊断工具。导演只策划并注入当前阶段，不代替 user 发言，也不把未来剧本全文注入主模型。

## 当前状态

- 已发布版本：`0.8.2`。
- `main` 与 `origin/main`：`4e44f585495de1150b01719f166951cc24d63e4d`。
- 功能工作树：`D:\.codex\char主动\.worktrees\proactive-director`，分支 `codex/debug-inspector`。
- 集成工作树：`D:\.codex\char主动\.worktrees\main-integration`，分支 `main`。
- 生产扩展：`D:\SillyTavern\SillyTavern\public\scripts\extensions\third-party\just-do-it-char`。
- 酒馆：`http://127.0.0.1:8000/`。
- 本轮已修复设置导航：返回按钮加“连接、侧写、检查、外观”四个等宽页签同排；文字 `nowrap`，窄屏不改为纵排。
- 本轮源文件、生产 CSS SHA-256：`F444E3B4FBC18D15A2FC657B4E5F70A322B711D199172896AD6411A798692713`。
- 自动化：`npm.cmd test` 208/208；语法检查 55 个 JS 通过；`git diff --check` 通过。
- 真实酒馆已确认生产扩展资源加载，但宿主扩展面板中的 `#stpd-menu-entry` 尺寸为 0，无法打开控制台进行本轮视觉页签复验；不得宣称实时视觉验收通过。已有 0.8.2 侧写、状态、剧本和边界验收证据仍有效，主 API 未连接仍是生成链路外部阻断。

## 架构地图

```text
index.js                         宿主适配、事件、服务组装
src/state/                       默认状态、迁移、持久化
src/cast/                        人物模式与成员纯状态转换
src/director/prompts.js          侧写/事件/阶段提示词
src/director/profile-service.js  侧写请求、指纹、去重、迟到保护
src/director/schemas.js           AI JSON 结构校验
src/director/pipeline.js          规划与阶段注入流水线
src/director/event-engine.js      当前阶段、事实、伏笔、修订
src/scripts/                     剧本仓储与运行控制
src/ui/director-console.js        控制台生命周期与设置导航
src/ui/views/                     事件、人物、侧写设置、剧本等页面
src/ui/components/                剧本列表/详情/工具栏等组件
src/theme/                        主题与 CSS 模板
style.css                         实际插件样式
tests/                            Node 内置测试与 UI/集成回归
```

## 核心契约

- 资料权威顺序：世界书 > 角色卡 > 当前上下文；世界书只读，禁止写入侧写、剧本、阶段、伏笔或运行进度。
- 多人卡切单人时列出所有有证据的候选人物，让 user 选择；不得捏造或自动选人。多人生成成员必须可编辑，稳定 ID 更新。
- 规划结果必须有非空大纲、关键冲突、高潮、结局；阶段为 5-7 个，格式为“小标题 + 具体 char 行为”，多人阶段使用对应角色姓名且不预设 user 未表达的行动。
- 伏笔格式为 `[已回收]`、`[未注入]`、`[使用中]`、`[待使用]` + 内容 + `[真实阶段标题]`。
- 多人阶段活跃角色集合允许 1 人以上，不要恢复为固定 2-4 限制。
- 事件提示词只能依据当前角色卡、所选世界书、当前聊天上下文和本次事件想法；不得放入旧题材示例或刑侦/水箱锚点。
- Gemini/Claude 侧写补充提示词是设置中默认关闭、独立可选的全局项，只进入 `profile-character`；双开时 Gemini 的边界和 user 自主性优先。
- 标题状态必须来自真实状态：无请求且无启用剧本为“待机中”，启用/暂停剧本为“启用中”，仅未完成请求显示对应生成阶段。
- 生成新剧本先保存为 draft，不自动开演；开演、暂停、继续、改向、停止需遵循运行状态权限并保留历史。

## 易错点

- 不要把历史剧本全文或示例剧情混入新事件提示词。
- 不要把 profile guidance 传入事件、阶段或反应提示词。
- 不要在没有当前聊天/角色证据时测试或声称生成成功；主 API 未连接时记录为外部阻断。
- 不要把自动化测试当成酒馆端到端证据；浏览器入口尺寸为 0 时如实记录阻断。
- 不要提交聊天、角色卡、世界书原文、密钥、token、截图或 `.worktrees` 元数据。
- 禁止 `git reset --hard`、`git checkout --`、`git add .`；逐文件暂存，保留用户改动。

## 工作流程

1. 先读本文件，检查功能工作树状态和相关测试。
2. 行为/布局修改先写失败回归测试，确认红灯，再做最小实现。
3. 运行聚焦测试、全量 `npm.cmd test`、`node --check index.js`、逐个 `src/**/*.js` 语法检查和 `git diff --check`。
4. 定向复制改动运行时文件到生产扩展，逐文件核对 SHA-256。
5. 在酒馆测试可行的真实路径；外部阻断必须写清，不能猜测通过。
6. 更新 `HANDOFF3.md` 流水记录，再审阅 diff，显式 `git add -- path...`、提交功能分支。
7. 在隔离 `main-integration` 合并，重新跑全量验证，非强制 push，核对本地/远端指针。

## 下一步

本轮代码与自动化验收已完成，功能分支的 CSS 回归提交待合并到隔离 `main` 并推送。合并后需再次部署最终 `style.css`，并保留“宿主入口尺寸为 0”的真实浏览器阻断记录。后续改动从本文件开始，不再读取旧版长交接；每次完成仍追加更新 `HANDOFF3.md`。
