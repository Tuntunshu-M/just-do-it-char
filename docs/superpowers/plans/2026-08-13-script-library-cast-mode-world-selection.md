# Script Library, Cast Mode, and World Selection Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate event planning from performance, add a per-chat multi-script library, make single/multi cast mode user-selectable with automatic first multi-profile generation, and keep world books strictly read-only with configurable selection clearing on chat changes.

**Architecture:** A script repository becomes the sole authority for planned and running scripts; a runtime service performs state transitions without touching UI. The pipeline creates draft scripts and only the runtime exposes them as `activeEvent` compatibility data during performance. UI composition is split into script list, toolbar, detail, cast controls, event creation, and world-book selection modules.

**Tech Stack:** SillyTavern extension JavaScript (ES modules), DOM APIs, Node.js 20 built-in test runner, CSS.

## Global Constraints

- Side profiles, scripts, outlines, stages, steps, foreshadowing, revisions, and runtime progress must never be written to a world book.
- Script history is isolated by SillyTavern chat state and must return when the user returns to that chat.
- New scripts remain drafts until the user selects one and clicks `开演`.
- Multi-cast total size is unrestricted; event stages activate only 2-4 relevant characters.
- Future stages and unrevealed foreshadowing remain outside the host generation prompt.
- Runtime CSS and the exported CSS template must be updated together.
- Preserve unrelated untracked files and existing user changes.

---

## File Structure

- Create `src/scripts/script-repository.js`: normalize, migrate, create, select, query, and update scripts.
- Create `src/scripts/script-runtime.js`: perform, pause, resume, redirect, stop, and resolve performance conflicts.
- Create `src/ui/views/scripts.js`: compose script toolbar, list, and detail.
- Create `src/ui/components/script-list.js`: render and select historical scripts.
- Create `src/ui/components/script-toolbar.js`: render one-line performance controls.
- Create `src/ui/components/script-detail.js`: render outline, stages, foreshadowing, and revisions.
- Create `src/ui/components/cast-mode.js`: render single/multi segmented control.
- Create `src/ui/components/cast-members.js`: render add/edit/remove/lead controls.
- Create `src/ui/dialogs/cast-member.js`: collect manual member edits.
- Modify `src/state/default-state.js`, `src/state/migrations.js`: add script library, dual cast state, and world selection policy defaults/migrations.
- Modify `src/director/event-engine.js`, `src/director/pipeline.js`, `src/director/context-collector.js`: run only selected scripts and keep compatibility context synchronized.
- Modify `src/director/profile-service.js`, `src/director/prompts.js`, `src/director/schemas.js`: support multi-member profile output and complete outline validation.
- Modify `src/cast/cast-manager.js`: preserve explicit mode and dual-mode data.
- Modify `src/ui/views/event.js`, `src/ui/views/cast.js`, `src/ui/views/world-info.js`, `src/ui/director-console.js`: adopt the new page responsibilities.
- Modify `index.js`: wire repository/runtime/profile services, navigation, chat-change selection clearing, and stale handling.
- Modify `style.css`, `src/theme/theme-manager.js`: add responsive script and cast UI selectors to runtime and export template.
- Modify/add focused tests under `tests/scripts`, `tests/state`, `tests/director`, `tests/cast`, `tests/ui`, `tests/integration`, and `tests/theme`.

---

### Task 1: Script Repository and State Migration

**Files:**
- Create: `src/scripts/script-repository.js`
- Modify: `src/state/default-state.js`
- Modify: `src/state/migrations.js`
- Test: `tests/scripts/script-repository.test.js`
- Test: `tests/state/default-state.test.js`
- Test: `tests/state/migrations.test.js`

**Interfaces:**
- Produces: `normalizeScript(plan, options)`, `createScriptRepository(store)`, repository methods `createDraft`, `select`, `getSelected`, `getActive`, `update`, `migrateLegacyEvent`.
- State fields: `scripts`, `selectedScriptId`, `activeScriptId`.

- [ ] **Step 1: Write failing repository and migration tests**

Test that a plan becomes a `draft` with a unique ID and timestamps, multiple drafts are retained, selection is independent from activation, per-chat stores remain isolated, and a legacy `activeEvent` migrates exactly once without losing premise, steps, foreshadowing, facts, or revisions.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/scripts/script-repository.test.js tests/state/default-state.test.js tests/state/migrations.test.js`

Expected: FAIL because repository APIs and state fields do not exist.

- [ ] **Step 3: Implement repository and idempotent migration**

Normalize all scripts to:

```js
{
  id, title, category, premise, conflict, climax, ending,
  steps, foreshadowing, facts, revisions,
  status: 'draft' | 'running' | 'paused' | 'stopped' | 'completed' | 'failed',
  currentStepIndex, pendingTurn, createdAt, updatedAt
}
```

Keep `activeEvent` only as a compatibility projection while migration consumers are updated; do not maintain a second independent copy.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/scripts/script-repository.test.js tests/state/default-state.test.js tests/state/migrations.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/scripts/script-repository.js src/state/default-state.js src/state/migrations.js tests/scripts/script-repository.test.js tests/state/default-state.test.js tests/state/migrations.test.js
git commit -m "feat: add per-chat script repository"
```

### Task 2: Script Runtime and Director Engine Integration

**Files:**
- Create: `src/scripts/script-runtime.js`
- Modify: `src/director/event-engine.js`
- Modify: `src/director/context-collector.js`
- Test: `tests/scripts/script-runtime.test.js`
- Test: `tests/director/event-engine.test.js`
- Test: `tests/director/context-collector.test.js`

**Interfaces:**
- Consumes: repository methods from Task 1.
- Produces: runtime methods `perform(scriptId, { confirmConflict })`, `pause(scriptId)`, `resume(scriptId)`, `changeDirection(scriptId, direction)`, `stop(scriptId)`.

- [ ] **Step 1: Write failing runtime transition tests**

Cover first-stage performance, conflict cancellation, conflict confirmation preserving old progress, selected/non-active control rejection, pause/resume/stop without deletion, revision updates, and current-stage-only context projection.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/scripts/script-runtime.test.js tests/director/event-engine.test.js tests/director/context-collector.test.js`

- [ ] **Step 3: Implement runtime and adapt event engine**

Use repository updates for every transition. `stop` sets script status to `stopped`, clears `activeScriptId` and transient injection, but leaves the script record intact. Reaction evaluation and eligible foreshadowing operate on the active repository script.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/scripts/script-runtime.test.js tests/director/event-engine.test.js tests/director/context-collector.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/scripts/script-runtime.js src/director/event-engine.js src/director/context-collector.js tests/scripts/script-runtime.test.js tests/director/event-engine.test.js tests/director/context-collector.test.js
git commit -m "feat: add script performance runtime"
```

### Task 3: Draft-Only Planning Pipeline and Complete Script Contract

**Files:**
- Modify: `src/director/pipeline.js`
- Modify: `src/director/schemas.js`
- Modify: `src/director/prompts.js`
- Test: `tests/director/pipeline.test.js`
- Test: `tests/director/schemas.test.js`
- Test: `tests/director/prompts.test.js`

**Interfaces:**
- Consumes: repository `createDraft` and runtime active-script projection.
- Produces: planning result `{ status: 'planned', scriptId }`; callback `onScriptCreated(scriptId)` for navigation.

- [ ] **Step 1: Write failing planning and validation tests**

Assert planning creates a draft without `activeScriptId`, does not prepare an injection, requires non-empty `premise`, conflict/climax/ending fields or normalized equivalents, requires 5-7 stages and correct foreshadowing counts, and emits the created script ID.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/director/pipeline.test.js tests/director/schemas.test.js tests/director/prompts.test.js`

- [ ] **Step 3: Implement draft planning and stricter contract**

Replace `engine.activatePlan` in `planEvent` with repository draft creation. Keep main category selection stable across repair requests. Update the JSON example to include `premise`, `conflict`, `climax`, and `ending`; validate them before persistence.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/director/pipeline.test.js tests/director/schemas.test.js tests/director/prompts.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/director/pipeline.js src/director/schemas.js src/director/prompts.js tests/director/pipeline.test.js tests/director/schemas.test.js tests/director/prompts.test.js
git commit -m "feat: save generated events as draft scripts"
```

### Task 4: Script Page and Event Page Separation

**Files:**
- Create: `src/ui/views/scripts.js`
- Create: `src/ui/components/script-list.js`
- Create: `src/ui/components/script-toolbar.js`
- Create: `src/ui/components/script-detail.js`
- Modify: `src/ui/views/event.js`
- Modify: `src/ui/director-console.js`
- Modify: `index.js`
- Test: `tests/ui/scripts.test.js`
- Test: `tests/ui/event.test.js`
- Test: `tests/ui/render.test.js`
- Test: `tests/integration/extension.test.js`

**Interfaces:**
- UI services: `selectScript`, `performScript`, `pauseScript`, `resumeScript`, `changeScriptDirection`, `stopScript`, `restoreScriptRevision`, `openTab`.

- [ ] **Step 1: Write failing UI composition tests**

Verify the navigation label is `剧本`, the script page has a left list, one-line toolbar, and complete detail sections; event view contains generation options but no outline/runtime controls; generation callback selects and opens the new script.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/ui/scripts.test.js tests/ui/event.test.js tests/ui/render.test.js tests/integration/extension.test.js`

- [ ] **Step 3: Implement modular script UI and service wiring**

Keep view modules DOM-only. Route all state transitions through repository/runtime services. Remove the header emergency event stop button if it duplicates the script toolbar; retain only controls that have a distinct extension-wide meaning.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/ui/scripts.test.js tests/ui/event.test.js tests/ui/render.test.js tests/integration/extension.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/ui/views/scripts.js src/ui/components/script-list.js src/ui/components/script-toolbar.js src/ui/components/script-detail.js src/ui/views/event.js src/ui/director-console.js index.js tests/ui/scripts.test.js tests/ui/event.test.js tests/ui/render.test.js tests/integration/extension.test.js
git commit -m "feat: add script library interface"
```

### Task 5: Explicit Single/Multi Cast State and Member Editing

**Files:**
- Modify: `src/cast/cast-manager.js`
- Modify: `src/state/default-state.js`
- Modify: `src/state/migrations.js`
- Create: `src/ui/components/cast-mode.js`
- Create: `src/ui/components/cast-members.js`
- Create: `src/ui/dialogs/cast-member.js`
- Modify: `src/ui/views/cast.js`
- Modify: `index.js`
- Test: `tests/cast/cast-manager.test.js`
- Test: `tests/ui/cast.test.js`
- Test: `tests/state/migrations.test.js`

**Interfaces:**
- Produces: `setCastMode(cast, mode)`, `setSingleSelection(cast, id)`, `addCastMember`, `updateCastMember`, `removeCastMember`, `setLeadMember`.
- UI services: `setCastMode`, `addCastMember`, `updateCastMember`, `removeCastMember`, `setLeadMember`, `setSingleCharacter`.

- [ ] **Step 1: Write failing cast state and UI tests**

Assert explicit `multi` mode survives one member, mode switching preserves both single selection and multi members, manual CRUD works, lead selection persists, and UI exposes the segmented control and member actions.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/cast/cast-manager.test.js tests/ui/cast.test.js tests/state/migrations.test.js`

- [ ] **Step 3: Implement dual-mode cast state and modular controls**

Remove every member-count assignment that silently changes mode. Mark profile stale after manual member or mode changes, except the first multi switch handled by Task 6.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/cast/cast-manager.test.js tests/ui/cast.test.js tests/state/migrations.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/cast/cast-manager.js src/state/default-state.js src/state/migrations.js src/ui/components/cast-mode.js src/ui/components/cast-members.js src/ui/dialogs/cast-member.js src/ui/views/cast.js index.js tests/cast/cast-manager.test.js tests/ui/cast.test.js tests/state/migrations.test.js
git commit -m "feat: add explicit cast modes and member editing"
```

### Task 6: Automatic First Multi-Profile Generation

**Files:**
- Modify: `src/director/profile-service.js`
- Modify: `src/director/prompts.js`
- Modify: `src/director/schemas.js`
- Modify: `index.js`
- Test: `tests/director/profile-service.test.js`
- Test: `tests/director/prompts.test.js`
- Test: `tests/director/schemas.test.js`
- Test: `tests/integration/extension.test.js`

**Interfaces:**
- Multi profile response: `{ content, members: [...], relations: [...], citations: [...] }`.
- Produces profile service method `switchModeAndEnsureProfile(options)` or equivalent atomic orchestration used by `index.js`.

- [ ] **Step 1: Write failing multi-profile tests**

Cover first switch calling the independent API once with card plus selected world entries, accepting B/C/D members, keeping mode when API is unavailable, refusing main API fallback, protecting against stale chat results, and marking later source changes stale without automatic calls.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/director/profile-service.test.js tests/director/prompts.test.js tests/director/schemas.test.js tests/integration/extension.test.js`

- [ ] **Step 3: Implement multi-profile contract and orchestration**

Include member evidence, goals, user dependency, relations, active approach, and knowledge boundaries. Merge generated members into `multiMembers` without destroying explicit user edits from a newer fingerprint. Preserve current data on failures.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/director/profile-service.test.js tests/director/prompts.test.js tests/director/schemas.test.js tests/integration/extension.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/director/profile-service.js src/director/prompts.js src/director/schemas.js index.js tests/director/profile-service.test.js tests/director/prompts.test.js tests/director/schemas.test.js tests/integration/extension.test.js
git commit -m "feat: generate multi-cast profiles on first switch"
```

### Task 7: World Selection Policy and Read-Only Guarantee

**Files:**
- Modify: `src/state/default-state.js`
- Modify: `src/state/migrations.js`
- Modify: `src/ui/views/world-info.js`
- Modify: `index.js`
- Test: `tests/ui/world-info.test.js`
- Test: `tests/state/default-state.test.js`
- Test: `tests/state/migrations.test.js`
- Test: `tests/integration/extension.test.js`

**Interfaces:**
- Setting: `settings.context.worldInfoSelectionPolicy = 'preserve' | 'clear-on-chat-change'`.
- Produces helper `applyWorldSelectionPolicy(settings, previousChatKey, nextChatKey)` in a focused module if logic exceeds a few lines.

- [ ] **Step 1: Write failing policy and read-only tests**

Assert actual chat key changes clear only `worldInfoBooks`, same-chat reload does not clear, initialization without a previous key does not clear, preserve mode retains selection, and no world-book update/delete host method is called.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/ui/world-info.test.js tests/state/default-state.test.js tests/state/migrations.test.js tests/integration/extension.test.js`

- [ ] **Step 3: Implement policy selector and chat-change clearing**

Show a read-only explanation in the world-book page. Clear and save global selection before loading profile sources for the new chat. Do not clear scripts or the target chat's profile state.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/ui/world-info.test.js tests/state/default-state.test.js tests/state/migrations.test.js tests/integration/extension.test.js`

- [ ] **Step 5: Commit**

```powershell
git add src/state/default-state.js src/state/migrations.js src/ui/views/world-info.js index.js tests/ui/world-info.test.js tests/state/default-state.test.js tests/state/migrations.test.js tests/integration/extension.test.js
git commit -m "feat: add world selection chat policy"
```

### Task 8: Responsive Styling and CSS Template

**Files:**
- Modify: `style.css`
- Modify: `src/theme/theme-manager.js`
- Test: `tests/theme/theme-manager.test.js`
- Test: `tests/ui/render.test.js`

**Interfaces:**
- Adds selectors `.stpd-script-layout`, `.stpd-script-list`, `.stpd-script-detail`, `.stpd-script-toolbar`, `.stpd-cast-mode`, `.stpd-cast-members` and their child states.

- [ ] **Step 1: Write failing template selector tests**

Assert the exported CSS template contains all script and cast customization hooks and remains scoped by default.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/theme/theme-manager.test.js tests/ui/render.test.js`

- [ ] **Step 3: Implement desktop and mobile styles**

Use a stable left column on desktop, stacked layout on narrow screens, one-line horizontally scrollable toolbar on mobile, bounded detail scrolling, and non-overlapping member controls. Keep cards at 8px radius or less.

- [ ] **Step 4: Run focused tests and verify pass**

Run: `node --test tests/theme/theme-manager.test.js tests/ui/render.test.js`

- [ ] **Step 5: Commit**

```powershell
git add style.css src/theme/theme-manager.js tests/theme/theme-manager.test.js tests/ui/render.test.js
git commit -m "style: add responsive script library layout"
```

### Task 9: Full Regression, Real SillyTavern QA, and Main Integration

**Files:**
- Modify only files required by discovered regressions.
- Sync verified extension files to `D:\SillyTavern\SillyTavern\public\scripts\extensions\third-party\just-do-it-char`.

- [ ] **Step 1: Run full automated verification**

Run:

```powershell
npm test
git diff --check
```

Expected: all tests pass and no whitespace errors.

- [ ] **Step 2: Sync the extension to the real SillyTavern directory**

Copy only tracked extension runtime files, preserving any unrelated files in the target. Verify the target matches the worktree for those files.

- [ ] **Step 3: Start or confirm SillyTavern and perform desktop QA**

At `http://127.0.0.1:8000/`, verify multi-profile extraction from card A plus world-book B/C/D, manual member CRUD, stale controls, single/multi script prompt switching, multiple drafts, complete detail display, performance controls, conflict confirmation, chat isolation, and world-selection policy.

- [ ] **Step 4: Perform mobile QA**

Verify script layout, one-line toolbar, world-book expansion/scroll retention, no top jump, no overlap, and no text overflow at a mobile viewport.

- [ ] **Step 5: Run final regression after QA fixes**

Run:

```powershell
npm test
git diff --check
git status --short
```

- [ ] **Step 6: Commit QA fixes if any**

```powershell
git add <only changed implementation and test files>
git commit -m "fix: resolve script library qa regressions"
```

- [ ] **Step 7: Merge into and push GitHub main**

Confirm the feature branch contains only intended commits, update local `main` without discarding unrelated work, merge the feature branch non-interactively, push `main`, and verify `HEAD == origin/main`.

