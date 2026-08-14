# Random Events, Day/Night Theme, and CSS Template Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow blank manual event ideas, add persistent black/white day and night UI modes, improve muted text contrast, and export a complete editable CSS template.

**Architecture:** Keep event behavior in the event view and pass an empty string through the existing manual pipeline as the random-event signal. Persist the built-in color mode inside `settings.theme.mode`, apply it as a root class, and keep custom CSS handling in the theme manager. Generate the CSS starter template from a pure function so its content can be tested independently from browser downloads.

**Tech Stack:** Browser ES modules, CSS custom properties, Node.js built-in test runner.

## Global Constraints

- No new runtime dependencies.
- Day mode uses white surfaces and black text; night mode uses black surfaces and white text.
- Button foreground/background colors invert against the active surface.
- Exported templates contain no settings, API keys, chat content, or user data.

---

### Task 1: Blank Manual Event Ideas

**Files:**
- Modify: `src/ui/views/event.js`
- Modify: `src/ui/dialogs/manual-event.js`
- Test: `tests/ui/event.test.js`

**Interfaces:**
- Consumes: `services.onManualEvent(text, expand)`
- Produces: blank `text` as the random-event signal

- [x] Write a failing view test that clicks create with an empty textarea and confirms the random-event dialog.
- [x] Run the focused test and verify the click currently produces no dialog.
- [x] Remove the non-empty guard and render explicit random-event preview copy.
- [x] Run the focused test and verify it passes.

### Task 2: Persistent Day/Night Theme

**Files:**
- Modify: `src/state/default-state.js`
- Modify: `src/theme/theme-manager.js`
- Modify: `src/ui/director-console.js`
- Modify: `src/ui/views/appearance.js`
- Modify: `style.css`
- Test: `tests/state/default-state.test.js`
- Test: `tests/theme/theme-manager.test.js`
- Test: `tests/ui/render.test.js`

**Interfaces:**
- Consumes: `settings.theme.mode` with `day` or `night`
- Produces: `stpd-theme-day` or `stpd-theme-night` root class

- [x] Add failing tests for the default mode, root class, and mode control.
- [x] Run focused tests and verify failures are caused by missing mode behavior.
- [x] Add the persisted setting, mode switch, root class, and strict black/white CSS variables.
- [x] Raise muted text contrast in both modes and style form controls and buttons consistently.
- [x] Run focused tests and verify they pass.

### Task 3: CSS Starter Template Export

**Files:**
- Modify: `src/theme/theme-manager.js`
- Modify: `src/ui/views/appearance.js`
- Modify: `index.js`
- Test: `tests/theme/theme-manager.test.js`
- Test: `tests/ui/render.test.js`

**Interfaces:**
- Produces: `createCssTemplate(): string`
- Consumes: `services.exportCssTemplate()`

- [x] Add a failing pure-function test asserting variables, scoped selectors, and absence of secrets.
- [x] Run the focused test and verify the export function is missing.
- [x] Implement the template generator, browser download service, and appearance action.
- [x] Run focused tests and verify they pass.

### Task 4: Documentation and Release Verification

**Files:**
- Modify: `README.md`
- Modify: `manifest.json`
- Modify: `package.json`

- [x] Document random events, day/night switching, and both theme export formats.
- [x] Synchronize runtime files into the SillyTavern extension directory.
- [x] Test the full flow in the user's existing in-app SillyTavern tab. Blank random-event confirmation and persisted day/night switching passed; the CSS-template export action was invoked, but the browser control layer did not expose its blob download as a download event.
- [x] Run `node --test`, syntax checks, and `git diff --check`.
- [x] Commit only public project files and push `HEAD:main` without force.
