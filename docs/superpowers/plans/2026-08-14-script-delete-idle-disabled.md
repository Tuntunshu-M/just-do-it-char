# 剧本删除与空闲触发禁用 Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** 为当前聊天的剧本记录提供受保护的单选、多选删除和清空操作，并禁用未实现的空闲触发控件。

**Architecture:** 删除保护放在 script repository 事务层，UI 只负责选择和确认；列表复选状态存在当前渲染闭包中，删除成功后由控制台刷新。偏好页只改变可见文案和 disabled 属性，不改变持久化设置。

**Tech Stack:** 原生 JavaScript ES modules、Node `node:test`、现有 SillyTavern adapter/store/confirm dialog。

## Global Constraints

- `running` 与 `paused` 剧本永远不可删除。
- 清空操作只作用于当前聊天。
- 不实现空闲触发逻辑；只显示“启用空闲触发（还没做）”并禁用相关控件。
- 保留工作树中上一轮未提交改动。

### Task 1: Repository deletion boundary

**Files:**
- Modify: `src/scripts/script-repository.js`
- Test: `tests/scripts/script-repository.test.js`

- [ ] Add failing tests for `remove(chatKey, fingerprint, scriptIds)` and `clear(chatKey, fingerprint)` proving running/paused records remain and selection remains valid.
- [ ] Run `node --test tests/scripts/script-repository.test.js`; expect failures because methods do not exist.
- [ ] Implement transaction methods that filter only non-running/non-paused records and repair `selectedScriptId` without touching active state.
- [ ] Rerun the repository tests and confirm pass.

### Task 2: List selection and controls

**Files:**
- Modify: `src/ui/components/script-list.js`, `src/ui/views/scripts.js`, `src/index.js` or `index.js` (actual service wiring is root `index.js`)
- Test: `tests/ui/scripts.test.js`

- [ ] Add failing UI tests for disabled checkboxes on running/paused records, selected deletion, and clear-all controls.
- [ ] Run the focused UI test and confirm failure on missing controls.
- [ ] Add selection state, checkbox controls, delete/clear buttons, confirmation text, and service calls; keep item button selection behavior intact.
- [ ] Wire `deleteScripts` and `clearScripts` services to repository operations and refresh state.
- [ ] Rerun focused UI and integration tests.

### Task 3: Idle trigger disabled label

**Files:**
- Modify: `src/ui/views/preferences.js`
- Test: `tests/ui/render.test.js`

- [ ] Add failing source/UI assertions for the new label and disabled controls.
- [ ] Implement disabled attributes on idle toggle, idle minutes, and allowed windows while leaving stored values unchanged.
- [ ] Run the focused render tests.

### Task 4: Final verification

- [ ] Run `npm.cmd test`.
- [ ] Run `node --check` for `index.js` and all `src/**/*.js`.
- [ ] Run `git diff --check` and inspect status.
- [ ] Append progress and final verification to `D:\.codex\char主动\handoff1.md`.
