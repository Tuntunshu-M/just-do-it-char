# Profile-First Prompt Pipeline Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make Director Time generate a profile through the secondary API before event planning, plan weighted 5-7-stage events, and inject only the current stage and conditionally mature foreshadowing into each host turn.

**Architecture:** Split prompt assembly by director intent and compose common, cast-mode, category-tone, genre, context, and JSON-contract modules. Select and freeze one weighted main category in the event pipeline, while the profile service owns source fingerprints and explicit stale decisions. Preserve the existing event engine as the source of truth so turn preparation receives only the current step and eligible foreshadowing.

**Tech Stack:** SillyTavern 1.18 browser extension, JavaScript ES modules, Node.js built-in test runner, OpenAI-compatible secondary API.

## Global Constraints

- All director requests use the independently configured compatible API; there is no fallback to the main API.
- Native group chats remain paused; a single multi-character card remains supported.
- The extension plans and injects backstage guidance but never sends user or character prose.
- Event planning creates 5-7 stages. Single-character events create 3-5 foreshadowing items; multi-character events create 4-6.
- Multi-character cards retain every detected member, while each stage activates 2-4 relevant members and rotates participation.
- Characters only act on confirmed knowledge, perceived facts, or reasonable inference; backstage, future, and private knowledge remain isolated.
- Ordinary user behavior and coincidences are not evidence of conspiracy.
- Category selection is one weighted main category plus enabled auxiliary tones; `genre` is independent.
- The full outline and all foreshadowing are never injected at once. Only the current stage and foreshadowing whose conditions are met may enter a temporary host prompt.
- Preserve `docs/superpowers/plans/2026-08-13-random-event-day-night-css-template.md` and do not add it to commits.

---

### Task 1: Intent-Specific Prompts And Strict Schemas

**Files:**
- Modify: `src/director/prompts.js`
- Modify: `src/director/schemas.js`
- Modify: `src/director/client.js`
- Test: `tests/director/prompts.test.js`
- Test: `tests/director/schemas.test.js`
- Test: `tests/director/client.test.js`

**Interfaces:**
- Consumes: `buildDirectorMessages(context, intent)` and `parseDirectorResponse(content, intentType)`.
- Produces: intent-specific prompt composition and strict profile/event/step/reaction validation.

- [ ] **Step 1: Write failing prompt tests**

Add assertions proving `profile-character` has a profile-only JSON contract, `plan-event` requires 5-7 stages and the correct single/multi foreshadowing count, multi-card prompts retain the full cast but activate 2-4 per stage, and all prompts include knowledge fog and anti-conspiracy rules. Assert `prepare-step` explicitly forbids injecting future stages or unrevealed clues.

- [ ] **Step 2: Run prompt tests and verify failure**

Run: `node --test tests/director/prompts.test.js`

Expected: FAIL because one shared 900-character event prompt is still used for every intent.

- [ ] **Step 3: Implement composable prompt modules**

Replace the single system string with focused builders for common rules, profile/event roles, single/multi cast rules, category tone, genre, and intent JSON contracts. Keep the user message structured as `{ intent, context }`, raise event output guidance to fit 5-7 compact stages, and show array examples with multiple stage and foreshadowing objects.

- [ ] **Step 4: Write failing schema tests**

Add cases rejecting event plans with fewer than 5 or more than 7 stages, duplicate step IDs, the wrong foreshadowing count, a category different from `intent.mainCategory`, or malformed multi-stage activity fields. Preserve existing reaction and step-result compatibility.

- [ ] **Step 5: Implement intent-aware validation**

Pass the request intent into response parsing and validate plan shape against `castMode` and `mainCategory`. Keep response normalization for provider wrappers and the legacy `actions[].text` alias.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/director/prompts.test.js tests/director/schemas.test.js tests/director/client.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/director/prompts.js src/director/schemas.js src/director/client.js tests/director/prompts.test.js tests/director/schemas.test.js tests/director/client.test.js
git commit -m "feat: split director prompts by intent"
```

### Task 2: Weighted Main Category And Auxiliary Tones

**Files:**
- Modify: `src/director/policy.js`
- Modify: `src/director/pipeline.js`
- Test: `tests/director/policy.test.js`
- Test: `tests/director/pipeline.test.js`

**Interfaces:**
- Produces: `selectEventCategory(categories, { random, requestedCategory }) -> { mainCategory, auxiliaryTones }`.
- Consumes: normalized enabled category weights and a request-scoped selection reused by repair retries.

- [ ] **Step 1: Write failing category-selection tests**

Cover deterministic weighted boundaries with injected RNG, exclusion of disabled and zero-weight categories, explicit enabled requests, rejection of explicit disabled requests, and auxiliary tone ratios derived only from other enabled categories.

- [ ] **Step 2: Run policy tests and verify failure**

Run: `node --test tests/director/policy.test.js`

Expected: FAIL because only `normalizeWeights()` exists.

- [ ] **Step 3: Implement category selection**

Add a pure selector that returns one main category and normalized auxiliary tones. Return a clear failure when no category is enabled. Never infer `genre` as an event category.

- [ ] **Step 4: Write failing pipeline tests**

Assert `plan-event` receives `mainCategory`, `auxiliaryTones`, and `castMode`; personality repair receives the same values; regeneration makes a fresh selection; policy checks the fixed main category rather than accepting a model-selected substitute.

- [ ] **Step 5: Integrate request-scoped selection**

Inject `random = Math.random` into `createDirectorPipeline`, select before the first event API call, close over the resulting intent for repair retries, and verify the returned event category matches the selected main category.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/director/policy.test.js tests/director/pipeline.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/director/policy.js src/director/pipeline.js tests/director/policy.test.js tests/director/pipeline.test.js
git commit -m "feat: apply event category weights"
```

### Task 3: Profile-First Lifecycle And Stale Decisions

**Files:**
- Modify: `src/state/default-state.js`
- Modify: `src/state/migrations.js`
- Modify: `src/director/profile-service.js`
- Modify: `index.js`
- Modify: `src/ui/views/cast.js`
- Modify: `src/ui/director-console.js`
- Test: `tests/state/default-state.test.js`
- Test: `tests/state/migrations.test.js`
- Test: `tests/director/profile-service.test.js`
- Test: `tests/ui/render.test.js`
- Test: integration test file selected from existing `tests/integration/` coverage.

**Interfaces:**
- Produces: profile states `empty`, `generating`, `ready`, `stale-pending`, `ready-ignored`, and `failed`, with `activeFingerprint` and `ignoredFingerprint`.
- Produces: `inspectProfile(options)`, `ensureProfile(options)`, `refreshProfile(options)`, and `ignoreStaleProfile(options)` behavior.

- [ ] **Step 1: Write failing state and profile tests**

Cover migration of an old ready profile, first-entry generation deduplication, changed sources becoming `stale-pending` without an API call, ignore storing the current fingerprint and suppressing repeat prompts, a second source change prompting again, and refresh preserving the old profile on failure.

- [ ] **Step 2: Run profile/state tests and verify failure**

Run: `node --test tests/director/profile-service.test.js tests/state/default-state.test.js tests/state/migrations.test.js`

Expected: FAIL because the current service only has `ready/stale/failed` and overwrites state on failure.

- [ ] **Step 3: Implement profile state transitions**

Separate fingerprint inspection from API generation, deduplicate in-flight generation per chat/source fingerprint, preserve old content during refresh, and store active/ignored fingerprints according to the approved transition table.

- [ ] **Step 4: Write failing UI and chat-entry tests**

Assert entering a supported chat automatically requests a missing profile once, missing endpoint/model shows `还没连接副 API`, event creation while generating shows `导演还在看人设`, stale UI shows `角色资料有改动，要重新生成侧写吗？`, and both `重新生成侧写` and `暂时不用` actions call the correct service methods.

- [ ] **Step 5: Wire chat entry, event gate, progress, and actions**

Start profile inspection/generation when a non-group role chat is entered or switched, not when the cast tab happens to render. Gate `manualCreate` before event collection/API work unless profile status is `ready` or `ready-ignored`. Expose progress labels for reading profile, profile generation, collection, event planning, rule check, and commit.

- [ ] **Step 6: Run focused tests**

Run: `node --test tests/director/profile-service.test.js tests/state/default-state.test.js tests/state/migrations.test.js tests/ui/render.test.js tests/integration/*.test.js`

Expected: PASS.

- [ ] **Step 7: Commit**

```powershell
git add -- src/state/default-state.js src/state/migrations.js src/director/profile-service.js index.js src/ui/views/cast.js src/ui/director-console.js tests/state/default-state.test.js tests/state/migrations.test.js tests/director/profile-service.test.js tests/ui/render.test.js tests/integration
git commit -m "feat: generate profiles before event planning"
```

### Task 4: Conditional Stage And Foreshadowing Injection

**Files:**
- Modify: `src/director/event-engine.js`
- Modify: `src/director/context-collector.js`
- Modify: `src/director/pipeline.js`
- Test: `tests/director/event-engine.test.js`
- Test: `tests/director/context-collector.test.js`
- Test: `tests/director/pipeline.test.js`

**Interfaces:**
- Produces: current-turn context containing one `currentStep` plus only `eligibleForeshadowing`.
- Consumes: reaction decisions and stored clue maturity/conditions without exposing future outline data to the host model.

- [ ] **Step 1: Write failing injection-boundary tests**

Assert the first user turn sends only the current step to `prepare-step`; later turns evaluate reaction before advancing; future steps, full outline, and immature/unrevealed foreshadowing are absent; mature clues whose stage/condition matches are included; temporary injection is cleared after host generation while pending reaction metadata remains.

- [ ] **Step 2: Run focused tests and verify failure**

Run: `node --test tests/director/event-engine.test.js tests/director/context-collector.test.js tests/director/pipeline.test.js`

Expected: at least the foreshadowing eligibility and context-minimization assertions FAIL.

- [ ] **Step 3: Implement eligibility and minimal context**

Add a pure engine helper that selects clues by maturity, reveal stage, and explicit condition. Build `prepare-step` context from the current stage, current participants, known facts, knowledge boundaries, latest user message, and eligible clues only. Do not include `activeEvent.steps` wholesale in the step request.

- [ ] **Step 4: Run focused tests**

Run: `node --test tests/director/event-engine.test.js tests/director/context-collector.test.js tests/director/pipeline.test.js`

Expected: PASS.

- [ ] **Step 5: Commit**

```powershell
git add -- src/director/event-engine.js src/director/context-collector.js src/director/pipeline.js tests/director/event-engine.test.js tests/director/context-collector.test.js tests/director/pipeline.test.js
git commit -m "feat: condition director turn injections"
```

### Task 5: Regression, Real-Host Acceptance, Version, And Publication

**Files:**
- Modify: `manifest.json`
- Modify: `package.json`
- Modify: `docs/manual-test-checklist.md`
- Test: all `tests/**/*.test.js`

**Interfaces:**
- Produces: a released compatible minor version with documented real-host checks.

- [ ] **Step 1: Run complete automated verification**

Run:

```powershell
node --test
node --check index.js
Get-ChildItem src -Recurse -Filter *.js | ForEach-Object { node --check $_.FullName }
git diff --check
```

Expected: all tests and syntax checks PASS.

- [ ] **Step 2: Update version and manual acceptance checklist**

Bump `manifest.json` and `package.json` together from `0.6.0` to `0.7.0`. Add checks for secondary-API profile-first ordering, stale buttons, weighted categories, 5-7 stages, multi-card rotation, anti-conspiracy behavior, and conditional stage/clue injection.

- [ ] **Step 3: Run the real SillyTavern workflow**

Using the in-app browser against the installed extension, verify: missing secondary API notice; one automatic profile request; stale regenerate/ignore paths; event blocked during profile generation; weighted category request; at least five displayed stages; a multi-character stage with 2-4 active members; first user message injects only current-stage guidance; next message evaluates before advancing; no future stage or unrevealed clue is present in the host prompt; generation cleanup clears the temporary prompt.

- [ ] **Step 4: Re-run verification after host fixes**

Run the full commands from Step 1 and confirm `git status --short` contains only intended files plus the preserved unrelated untracked plan.

- [ ] **Step 5: Commit release changes**

```powershell
git add -- manifest.json package.json docs/manual-test-checklist.md
git commit -m "chore: release director prompt pipeline 0.7.0"
```

- [ ] **Step 6: Push branch and GitHub main**

```powershell
git push origin HEAD
git push origin HEAD:main
git fetch origin
git rev-parse HEAD
git rev-parse origin/main
```

Expected: both hashes are identical and the unrelated untracked plan remains uncommitted.
