# 主动导演

SillyTavern 前端扩展。后台导演根据角色卡人格证据规划完整事件，角色在正文中主动带领用户推进；正文仍由 SillyTavern 当前连接生成。

## 功能

- 生活日常、突发危机、色情向可独立开启并设置占比。
- 现实、奇幻、科幻、无限流、鬼怪灵异、末日、自定义和自动题材层。
- 无限流/灵异规则账本，多角色卡识别与逐人物人格证据隔离。
- 混合智能、固定轮数、逐轮触发，以及可选空闲主动触发。
- 当前主连接或独立 OpenAI Chat Completions 兼容 API。
- 事件、伏笔、人物、偏好、连接、外观六页控制台。
- 选择性副本迁移和可作用域化的自定义 CSS。

原生 SillyTavern 群聊在当前版本会暂停导演；一张角色卡内包含多个人物则受支持。

## 建立 GitHub 仓库

1. 登录 GitHub，点击右上角 `+`，选择 `New repository`。
2. 仓库名可用 `sillytavern-proactive-director`，可见性选择 `Public`。
3. 不勾选自动创建 README、许可证或 `.gitignore`，点击 `Create repository`。
4. 在本项目目录执行 GitHub 页面给出的 `git remote add origin ...` 和 `git push -u origin master`。当前开发成果位于 `feature/proactive-director` 分支，合并到 `master` 后再推送。
5. 把 [manifest.json](./manifest.json) 中的 `homePage` 改为真实仓库地址。

## URL 安装

在 SillyTavern 的扩展管理器中选择从 URL 安装，输入：

```text
https://github.com/xiehuaqingxhq/just-do-it-char
```

安装完成后重启 SillyTavern，在扩展设置中打开“主动导演”。

## API 配置

`当前主连接`：不需要额外密钥。首次使用会显示 `正在在用主api哦！`，确认后 24 小时内不再提醒。

`独立兼容 API`：填写服务根地址、API Key 和模型名。扩展调用 `/chat/completions`；失败时不会自动切换到主连接。

API Key 只保存在 SillyTavern 全局扩展设置中，不进入聊天状态、副本或主题文件。

## 剧情与边界

用户意愿滑块控制角色可坚持推进的程度，但不会改变角色人格或套用固定语气。危机重大后果分别设置为禁止、先询问或已授权。本地策略在模型调用之后再次校验，禁止项不能被重试绕过。

高风险模式由独立开关控制。安全词、硬禁区、场外停止、停止按钮或关闭开关都会停止事件并清除待注入提示。

## 自定义 CSS

根节点为 `#st-proactive-director`，公开类名使用 `stpd-` 前缀。默认自动限制作用域；详细变量和主题格式见 [CSS 主题文档](./docs/css-theming.md)。

## 开发验证

```powershell
node --test
node --check index.js
```

真实宿主发布验收见 [手动测试清单](./docs/manual-test-checklist.md)。
