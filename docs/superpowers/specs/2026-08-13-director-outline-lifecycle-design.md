# Director Outline Lifecycle Design

## Goal

Make the director plan story events without speaking for the user or generating character prose. The director API plans and evaluates; SillyTavern's normal generation remains the only source of roleplay prose.

## User Flow

1. The user clicks `Create event`.
2. The director API returns a complete outline, ordered steps, and foreshadowing for all relevant characters.
3. The extension stores and displays the outline. It shows the short notification `TA seems to be quietly preparing something.` It does not inject a prompt, send a user message, or call normal reply generation.
4. The event is immediately active and waits for a real user RP message. There is no approval gate. `Regenerate` and `Edit outline` remain available at all times.
5. When a real user message is detected before the host begins the normal character reply, the extension evaluates the previous step's reaction when needed and prepares one temporary background instruction for the current step.
6. SillyTavern performs its normal reply generation. The extension never calls that generation method for this workflow.
7. After the turn, the temporary instruction is cleared and the event remains available for inspection. The next user message drives the next evaluation.

## State Model

`activeEvent` stores the plan independently from transient generation state:

```js
{
  id,
  title,
  category,
  premise,
  steps: [{ id, order, goal, characters, trigger, status }],
  currentStepIndex,
  foreshadowing,
  facts,
  status: 'awaiting-user' | 'completed',
  revisions: [{ id, createdAt, reason, outline, currentStepIndex }],
  lastEvaluatedUserMessageId,
  pendingTurn: null | { messageId, stepId, injection }
}
```

The state engine enforces that occurred facts cannot be changed. Reaction revisions replace only current and future steps. A configurable history limit of 1-3 snapshots is enforced when saving revisions. Restoring a snapshot never rewrites occurred facts and selects the first unfinished step.

The generation phase is extended with planning, evaluating, and preparing states so the console can report what is happening without conflating director work and host reply generation.

## Director API Intents

The existing single request contract is split into explicit intents:

- `plan-event`: produce the complete event plan only. It must not require or return prose.
- `evaluate-reaction`: classify the real user's latest response and return `advance`, `revise`, `neutral`, or `stop`, plus a replacement for current/future steps when needed.
- `prepare-step`: turn the current step into a compact backend instruction for the host character model. The instruction describes intended behavior and constraints, not completed prose.
- `profile-character`: summarize the character description, example dialogue, and selected world-book entries into a compact profile with citations.

Each response has a strict JSON schema and Chinese failure classification at the boundary. Empty output, truncation, malformed JSON, and incomplete outlines are surfaced as short user-facing Chinese messages while sanitized technical details remain in diagnostics.

## Host Timing

The adapter exposes a pre-generation hook when the SillyTavern host provides one. The user-message listener only records the real user message and schedules preparation; it must not call `generateReply()`. The temporary prompt is installed immediately before the host's normal generation and removed after the host generation lifecycle event. If the host cannot provide a reliable pre-generation lifecycle, the extension reports that capability in diagnostics and does not attempt to generate a substitute reply.

## Character Profiles

Profile generation reads the character card's description/personality/scenario/example dialogue plus the user-selected books and entries. The generated profile is cached with a source fingerprint. First use generates automatically. A changed fingerprint marks the profile `stale` without making an API call; the user explicitly requests refresh. Raw world-book content is never rendered as the profile. Citations are stored separately and shown in a collapsed source section.

## World-Book Selection UX

Selection updates preserve the scroll container's `scrollTop` and focus. The list should update the affected selection without resetting the whole view to the document top. All installed books remain available, including globally attached books.

## UI

The event view shows the current outline, ordered steps, current-step marker, foreshadowing, revision history, and controls for regenerate/edit/restore/stop. The creation notification is short only. Character profile content and citations are separate, with citations collapsed by default.

## Verification

Automated tests cover the state transitions, no-reply-generation guarantee, temporary prompt lifecycle, reaction advance/revision, immutable facts, revision retention/restoration, profile fingerprinting, source separation, and world-book scroll preservation. Run syntax checks and `git diff --check`.

Manual verification uses the local SillyTavern instance with a supplied character card and configured secondary API: create an event, confirm the short notice and no automatic assistant message, send a real user RP message, confirm the normal host reply receives the current-step instruction, then test reaction revision/restoration and profile refresh. Do not mark host behavior verified from the QA preview alone.

## Out of Scope

The extension will not send `/user` messages, fabricate roleplay text, directly call the host's normal reply generation for event creation, or expose internal work-process documentation in the public README.
