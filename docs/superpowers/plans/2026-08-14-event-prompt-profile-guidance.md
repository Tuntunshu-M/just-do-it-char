# Generic Event Prompt and Optional Profile Guidance Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Remove topic leakage from event planning, add two optional global profile-guidance templates, and release the verified August 13 features with version 0.8.2.

**Architecture:** Keep event and profile contracts isolated in `src/director/prompts.js`. Persist profile-guidance booleans in global settings, normalize them into a request intent in the profile service, and expose them through a dedicated settings view. Treat the enabled guidance set as profile input so changing it invalidates the existing profile fingerprint.

**Tech Stack:** Browser ES modules, DOM views, Node.js built-in test runner, SillyTavern extension runtime.

## Global Constraints

- No new runtime dependencies.
- Both profile-guidance settings default to disabled and never auto-enable from the model name.
- Guidance supplements the base profile contract and never enters event, step, or reaction prompts.
- With both templates enabled, user autonomy and Gemini boundary rules take precedence.
- Do not commit `HANDOFF.md` or `HANDOFF3.md`.
- Automated tests must not be represented as real SillyTavern end-to-end evidence.

---

### Task 1: Genre-Neutral Event Contract

**Files:**
- Modify: `src/director/prompts.js`
- Test: `tests/director/prompts.test.js`

**Interfaces:**
- Consumes: `buildDirectorMessages(context, intent)`
- Produces: event system prompts constrained to current sources and free of concrete crime-investigation examples

- [ ] Add a prompt regression test that builds a manual event request, rejects `警局|刑侦|水箱|法医|凶手|死者`, and requires current-source and no-example-copying instructions.
- [ ] Run `node --test tests/director/prompts.test.js` and confirm the new test fails on the police-station example.
- [ ] Replace concrete step and foreshadowing examples with matching genre-neutral structural titles and add explicit current-source isolation rules.
- [ ] Run `node --test tests/director/prompts.test.js` and confirm all prompt tests pass.
- [ ] Update Task 1 status and evidence in `HANDOFF3.md` without staging it.

### Task 2: Profile Guidance Settings and Request Isolation

**Files:**
- Modify: `src/state/default-state.js`
- Modify: `src/director/profile-service.js`
- Modify: `src/director/prompts.js`
- Modify: `index.js`
- Test: `tests/state/default-state.test.js`
- Test: `tests/state/migrations.test.js`
- Test: `tests/director/profile-service.test.js`
- Test: `tests/director/prompts.test.js`

**Interfaces:**
- Consumes: `settings.profileGuidance: { gemini: boolean, claude: boolean }`
- Produces: `intent.profileGuidance: ('gemini'|'claude')[]`
- Produces: profile source fingerprint that changes with the normalized guidance list

- [ ] Add failing tests for disabled defaults, legacy migration, normalized request intent, fingerprint invalidation, all four prompt combinations, and non-profile prompt isolation.
- [ ] Run the four focused test files and verify failures are limited to missing profile-guidance behavior.
- [ ] Add global defaults and pass booleans from `profileOptions()` into the profile service.
- [ ] Normalize enabled guidance names, include them in the profile fingerprint input, and pass them in `profile-character` intent.
- [ ] Add exact Gemini and Claude source constants from the user-provided text; append only selected templates and append the conflict rule only when both are active.
- [ ] Run the four focused test files and confirm all tests pass.
- [ ] Update Task 2 status and evidence in `HANDOFF3.md` without staging it.

### Task 3: Dedicated Profile Settings View

**Files:**
- Create: `src/ui/views/profile-guidance.js`
- Modify: `src/ui/director-console.js`
- Test: `tests/ui/profile-guidance.test.js`
- Test: `tests/ui/render.test.js`

**Interfaces:**
- Consumes: `settings.profileGuidance`
- Produces: independently persisted checkboxes labelled `Gemini 角色塑造特化` and `Claude 主动表达特化`

- [ ] Add a DOM test rendering the new view, toggling each checkbox independently, and asserting `saveSettings()` is called while the other value remains unchanged.
- [ ] Add a structural console test requiring the `侧写` settings tab and delegated view module.
- [ ] Run `node --test tests/ui/profile-guidance.test.js tests/ui/render.test.js` and confirm both additions fail.
- [ ] Implement the focused view with two checkbox fields and register a `profile` settings tab in the console.
- [ ] Run both focused UI test files and confirm they pass.
- [ ] Update Task 3 status and evidence in `HANDOFF3.md` without staging it.

### Task 4: Documentation, Version, and August 13 Plan Closure

**Files:**
- Modify: `README.md`
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `tests/manifest.test.js`
- Modify: `docs/superpowers/plans/2026-08-13-random-event-day-night-css-template.md`

**Interfaces:**
- Produces: documented 0.8.2 behavior and an evidence-backed completed August 13 plan

- [ ] Update README with the dedicated profile settings, default-off behavior, combinations, scope, and dual-template priority.
- [ ] Change both package versions and the manifest assertion from `0.8.1` to `0.8.2`.
- [ ] Mark August 13 Tasks 1-3 complete based on existing implementation plus the recorded `32/32` focused result; mark Task 4 items only after their actual verification succeeds.
- [ ] Run the full test suite and all JavaScript syntax checks, then run `git diff --check`.
- [ ] Synchronize the changed runtime files to the production SillyTavern extension and verify source/production hashes.
- [ ] Test the settings toggles and generated profile/event behavior in the existing SillyTavern page; record browser-policy blockers instead of claiming success.
- [ ] Update README or plan evidence if real smoke reveals a mismatch, then rerun affected checks.
- [ ] Update final release evidence in `HANDOFF3.md` without staging it.

### Task 5: Commit, Merge, and Push

**Files:**
- Stage only the public project files changed by Tasks 1-4 and this plan
- Exclude: `HANDOFF.md`, `HANDOFF3.md`

**Interfaces:**
- Produces: feature commit on `codex/debug-inspector`, merge commit on isolated `main`, and updated `origin/main`

- [ ] Review `git status`, `git diff`, and `git diff --check`; preserve unrelated user changes.
- [ ] Stage explicit implementation, tests, docs, and plan paths without `git add .`.
- [ ] Commit the 0.8.2 implementation on `codex/debug-inspector`.
- [ ] Merge the feature branch into `D:\.codex\char主动\.worktrees\main-integration` without touching the dirty default workspace.
- [ ] Run full tests, syntax checks, and `git diff --check` from merged `main`.
- [ ] Push `main` without force and verify local/remote commit pointers match.
- [ ] Record commit hashes, production version, and final evidence in `HANDOFF3.md`.
