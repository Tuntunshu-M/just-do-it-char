# Director Outline Lifecycle Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Separate event planning from roleplay generation, advance/revise plans only after real user input, generate cached AI character profiles, and preserve world-book selection position.

**Architecture:** Introduce strict plan/reaction/profile response contracts and an event state engine that owns outline revisions. The pipeline plans without host generation and prepares a temporary instruction during SillyTavern's awaited user-message event; host lifecycle events clear it. Character profile generation is a separate cached service keyed by source fingerprint.

**Tech Stack:** Browser ES modules, SillyTavern 1.18 event API, Node.js built-in test runner, DOM test fixtures.

## Global Constraints

- Never send a user message or call SillyTavern normal reply generation from event planning or turn preparation.
- Event creation immediately activates the outline without an approval gate and shows only `TA似乎悄悄准备了什么`.
- `重新生成` and `编辑大纲` remain available for active events.
- Revisions retain 1-3 versions and never rewrite occurred facts.
- Character profiles summarize card description and selected world-book entries; raw sources remain separate and collapsed.
- Preserve unrelated changes in `qa/preview.html`, `qa/visual-check.cjs`, and unrelated `docs/superpowers/` files.

---

### Task 1: State and event engine

**Files:**
- Modify: `src/constants.js`
- Modify: `src/state/default-state.js`
- Modify: `src/state/migrations.js`
- Modify: `src/director/event-engine.js`
- Test: `tests/state/migrations.test.js`
- Test: `tests/director/event-engine.test.js`

**Interfaces:**
- Produces: `engine.activatePlan(chatKey, fingerprint, plan)`, `engine.applyReaction(...)`, `engine.restoreRevision(...)`, and normalized `activeEvent` state.

- [ ] Write failing tests for awaiting-user activation, immutable occurred facts, reaction advance/revise, retention limit, and restoration.
- [ ] Run `node --test tests/state/migrations.test.js tests/director/event-engine.test.js` and confirm failures.
- [ ] Increment schema version, add profile/revision settings and migration defaults, then implement normalized event state and revision methods.
- [ ] Re-run focused tests and commit only task files.

### Task 2: Director contracts and prompts

**Files:**
- Modify: `src/director/prompts.js`
- Modify: `src/director/schemas.js`
- Modify: `src/director/client.js`
- Create: `src/director/profile-service.js`
- Test: `tests/director/schemas.test.js`
- Create: `tests/director/profile-service.test.js`

**Interfaces:**
- Produces: validated `plan-event`, `evaluate-reaction`, `prepare-step`, and `profile-character` results; `createProfileService(...)` with `ensureProfile` and `refreshProfile`.

- [ ] Write failing schema tests for complete outlines, reaction decisions, compact step instructions, and profile citations.
- [ ] Run focused tests and confirm contract failures.
- [ ] Split prompt builders by intent and implement strict parsers without requiring an event object for non-plan requests.
- [ ] Write profile fingerprint/cache tests, then implement the profile service using card fields plus selected world entries.
- [ ] Re-run focused tests and commit only task files.

### Task 3: Pipeline and SillyTavern lifecycle

**Files:**
- Modify: `src/director/pipeline.js`
- Modify: `src/host/sillytavern-adapter.js`
- Modify: `index.js`
- Test: `tests/director/pipeline.test.js`
- Test: `tests/host/sillytavern-adapter.test.js`
- Test: `tests/index.test.js`

**Interfaces:**
- Produces: `pipeline.manualCreate`, `pipeline.handleUserMessage(text, messageId)`, `pipeline.clearTurnInjection`, `pipeline.regeneratePlan`; no method invokes `generateReply`.

- [ ] Replace old pipeline tests with failures proving plan creation never injects/generates and real user turns prepare one temporary instruction.
- [ ] Add failures for advance/revise evaluation and injection cleanup on generation end/stop/chat change.
- [ ] Implement separate plan and turn paths, retain diagnostic stages, and remove all normal generation calls.
- [ ] Subscribe to awaited user-message preparation and host generation cleanup events in `index.js`.
- [ ] Re-run focused tests and commit only task files.

### Task 4: Event and character UI

**Files:**
- Modify: `src/ui/views/event.js`
- Modify: `src/ui/views/cast.js`
- Modify: `src/ui/director-console.js`
- Modify: `index.js`
- Modify: `style.css`
- Test: `tests/ui/event.test.js`
- Test: `tests/ui/render.test.js`

**Interfaces:**
- Consumes: active event revisions and cached profile state/services.
- Produces: persistent outline/steps/foreshadowing display, edit/regenerate/restore controls, compact generated profile with folded citations.

- [ ] Write failing UI tests for visible outline sections, always-present edit/regenerate controls, folded citations, stale refresh state, and short success notice.
- [ ] Implement event rendering and service actions without nested cards or oversized controls.
- [ ] Replace synchronous raw profile rendering with cached AI profile states and refresh action.
- [ ] Add responsive styles and run UI tests; commit only task files.

### Task 5: World-book scroll stability

**Files:**
- Modify: `src/ui/views/world-info.js`
- Create: `tests/ui/world-info.test.js`

**Interfaces:**
- Produces: entry selection that updates the affected checkbox without replacing the console DOM or losing scroll/focus.

- [ ] Write a failing DOM test that sets body/list scroll, toggles a lower entry, and asserts scroll and focus remain unchanged.
- [ ] Change synchronous entry selection to persist in place; reserve full rerender for loading/filtering/expansion transitions.
- [ ] Run focused UI tests and commit only task files.

### Task 6: Documentation, full verification, and local host test

**Files:**
- Modify: `README.md`
- Modify: `docs/manual-test-checklist.md`
- Modify: `manifest.json`
- Modify: `package.json`

**Interfaces:**
- Produces: user-only documentation and a versioned release ready for `main`.

- [ ] Update README tutorial for outline lifecycle, profile refresh/citations, revisions, and world-book selection; exclude internal workflow.
- [ ] Bump the extension version consistently and update the manual host checklist.
- [ ] Run `node --test`, syntax checks for `index.js` and all `src/**/*.js`, `git diff --check`, and privacy scan.
- [ ] Install/sync only changed runtime files into the local SillyTavern extension, reload the host, and test with the configured secondary API and character card.
- [ ] Verify no automatic assistant reply after event creation, real-user-triggered instruction behavior, cleanup, revision, profile generation, and world-book scroll position.
- [ ] Commit the release, push `HEAD:main`, fetch, and verify `HEAD` equals `origin/main`.
