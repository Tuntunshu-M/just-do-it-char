# Director Cast and Planning Contract Fixes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Fix candidate selection, generated script completeness and formatting, cast editing, source authority, console status, and unrestricted multi-stage cast counts.

**Architecture:** Keep planning requirements in the prompt/schema boundary, cast mutations in `cast-manager`, dialog lifecycle in the cast dialog component, and derive the console status from persisted generation and script runtime state. World-info remains read-only and is passed to profile generation as the authoritative character source.

**Tech Stack:** Browser-native ES modules, Node.js test runner, SillyTavern extension APIs.

## Global Constraints

- Do not replace user messages or pre-plan user actions/results.
- World-info character facts outrank character-card/chat context and world-info remains read-only.
- A multi stage must activate at least one known character; there is no upper bound.
- Every planned script must contain a non-empty outline, conflict, climax, ending, 5-7 titled stages with concrete character actions, and valid foreshadowing linked to stage titles.
- Preserve all unrelated uncommitted work and do not stage `docs/superpowers/plans/2026-08-13-random-event-day-night-css-template.md`.

---

### Task 1: Planning Contract and Validation

**Files:**
- Modify: `tests/director/schemas.test.js`
- Modify: `tests/director/prompts.test.js`
- Modify: `src/director/schemas.js`
- Modify: `src/director/prompts.js`

**Interfaces:**
- Consumes: `validateDirectorResult(value, intent)` and `buildDirectorMessages(context, intent)`.
- Produces: validation for titled/actionable stages and stage-linked foreshadowing; multi stages accept one or more known characters.

- [ ] Add failing tests that accept one and five active multi characters, reject zero active characters, require stage titles/actions, and require foreshadowing status plus valid stage-title links.
- [ ] Run `node --test tests/director/schemas.test.js tests/director/prompts.test.js` and confirm failures name the old `2 to 4` contract and missing stage/foreshadowing checks.
- [ ] Update prompt examples and schema validation with the minimum-one contract, explicit stage title plus named action rules, complete outline fields, and four allowed foreshadowing states.
- [ ] Re-run the focused tests and confirm they pass.

### Task 2: Candidate Extraction and Source Authority

**Files:**
- Modify: `tests/director/profile-service.test.js`
- Modify: `tests/director/prompts.test.js`
- Modify: `src/director/profile-service.js`
- Modify: `src/director/prompts.js`
- Modify: `index.js`

**Interfaces:**
- Consumes: selected world-info entries loaded by `loadSelectedWorldBooks()`.
- Produces: a candidate extraction profile shared by single and multi mode, with explicit `worldInfo > card/context` authority.

- [ ] Add failing tests proving profile requests label world-info as authoritative and single mode preserves/selects all extracted candidates without inventing one.
- [ ] Run the focused profile and prompt tests and confirm the authority/candidate assertions fail.
- [ ] Extend profile result handling so returned members populate reusable candidates in both modes while only projecting the selected member into single-mode `members`.
- [ ] Ensure first single candidate extraction uses selected world-info entries and does not fabricate a fallback candidate.
- [ ] Re-run focused tests.

### Task 3: Cast Modal Add and Edit

**Files:**
- Modify: `tests/ui/cast.test.js`
- Modify: `src/ui/dialogs/cast-member.js`
- Modify: `src/ui/components/cast-members.js`
- Modify: `style.css`

**Interfaces:**
- Consumes: `showCastMemberDialog(container, member, onSubmit)`.
- Produces: a modal dialog with save, cancel, close, and name-only submission; edit updates the selected member through the existing service.

- [ ] Add failing DOM behavior tests for cancel/close removal, name-only submission, and generated-member edit dispatch.
- [ ] Run `node --test tests/ui/cast.test.js` and confirm failures are caused by the missing modal lifecycle.
- [ ] Replace the inline section with an overlay/dialog appended to the page container, add close/cancel controls, and keep optional profile fields empty when only a name is supplied.
- [ ] Re-run the UI tests.

### Task 4: Console Runtime Status

**Files:**
- Modify: `tests/ui/render.test.js`
- Modify: `src/ui/director-console.js`

**Interfaces:**
- Produces: `directorStatus(state)` returning a stable phase/label derived from live requests and active scripts.

- [ ] Add failing behavior tests for stale `streaming` with no live work returning `待机中`, and active running/paused scripts returning `启用中`.
- [ ] Run focused tests and confirm failure under the direct `generation.phase` implementation.
- [ ] Implement the pure status derivation and render its phase/label.
- [ ] Re-run focused tests.

### Task 5: Regression and Real UI Verification

**Files:**
- Modify only production/test files required by failures discovered during verification.
- Update: `D:\.codex\char主动\HANDOFF3.md` with observed evidence.

**Interfaces:**
- Consumes: all behavior produced by Tasks 1-4.
- Produces: deployable extension state and recorded acceptance evidence.

- [ ] Run all focused suites touched above.
- [ ] Run `npm.cmd test`.
- [ ] Run `node --check index.js` and syntax-check every `src/**/*.js` file.
- [ ] Run `git diff --check` and inspect `git diff --stat` plus relevant full diffs.
- [ ] Deploy only affected extension files to the existing SillyTavern installation.
- [ ] Verify candidate selection, modal add/edit, complete stage/foreshadowing display, idle/enabled status, and multi-stage counts in the real UI; record external API blockers exactly.
