# Feature Specification: Internal Cleanup (Dead Code, Type Dedup, State Cohesion)

**Feature Branch**: `006-internal-cleanup`

**Created**: 2026-06-18

**Status**: Implemented

**Input**: Maintainer-driven refactor — remove vestigial dead code from the spec-003 `--agent` decoupling, dedupe a shared command-result type that has drifted into two definitions, and move state-read logic to its conceptual home. **Zero behavior change.** No user-facing CLI/contract change; the install output (skills/templates/scripts) is untouched. Scope A from the refactor analysis.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Readers aren't misled by vestigial dead code (Priority: P1)

A contributor reading `utils.ts`/`init.ts`/`update.ts` should not be tripped up by remnants of spec 003's removed `--agent` coupling: the `AgentKey` type alias (exported, zero callers), the `_agent`/`_skipAbsorb` parameters on `runInit`/`runUpdate` (always passed `null`/unused), and JSDoc comments that promise "T018 removes them" or claim `AGENTS` is "retained until cli.ts is rewritten" — all stale, all misleading. Today these make a reader believe `init`/`update` still take an agent, or that `cli.ts` still imports a name it doesn't.

**Why this priority**: Misleading code/comments actively waste maintainer time and seed wrong mental models. This is the highest-value, lowest-risk cleanup: pure subtraction of confirmed-dead symbols plus comment corrections. (`AGENTS` itself is RETAINED — `agent-config.test.ts` exercises it; only its stale comment changes.)

**Independent Test**: After the change, `grep -rn "AgentKey" src/` returns nothing; `runInit`/`runUpdate` have single-arg `(projectRoot)` signatures; no caller passes a leading `null`/agent arg; the full mechanical suite stays green with only call-argument updates (no assertion-logic changes).

**Acceptance Scenarios**:

1. **Given** the codebase, **When** the cleanup lands, **Then** `AgentKey` is gone from `src/` (zero definitions, zero imports).
2. **Given** `init.ts`/`update.ts`, **When** a contributor reads `runInit`/`runUpdate`, **Then** each takes exactly `(projectRoot)` and its JSDoc no longer references a removed `agent`/`skipAbsorb` parameter or a stale "T018 removes them" promise.
3. **Given** every caller (cli.ts + the four corpus test files), **When** compiled/run, **Then** none passes a leading agent/`null` argument to `runInit`/`runUpdate`, and the build + suite are green.
4. **Given** `utils.ts`, **When** read, **Then** the `AGENTS` export remains (test-covered) but its comment accurately describes it as a manifest-derived convenience map — no false "cli.ts/init.ts/update.ts still use it" claim.

---

### User Story 2 - No duplicated command-result type can drift (Priority: P1)

The `CmdResult` discriminated union is defined **twice** — once in `agents.ts:48` (the original) and again, identically, in `intake.ts:38` (added in spec 005) — while `uninstall.ts` imports it from `agents.ts`. Three stances for one type is a drift hazard: if one definition changes, the other silently diverges and return-type compatibility breaks at runtime, not compile time.

**Why this priority**: Type duplication is a latent correctness risk (not just aesthetics) — the two definitions can diverge and the CLI's `report()` consumer would only notice when a mismatched shape flows through. A single source of truth removes that risk at near-zero cost.

**Independent Test**: After the change, `grep -rn "type CmdResult" src/` returns exactly one line (in the new `src/result.ts`); `agents.ts`, `intake.ts`, and `uninstall.ts` all import it from there; the suite is green.

**Acceptance Scenarios**:

1. **Given** `agents.ts` and `intake.ts` each define `CmdResult`, **When** the cleanup lands, **Then** both local definitions are removed and all three command modules import `CmdResult` from `src/result.ts`.
2. **Given** the relocated type, **When** a command returns `{ ok: true, message }` / `{ ok: false, reason }`, **Then** the shape is byte-for-byte unchanged (pure relocation — `report()` and every test behave identically).

---

### User Story 3 - State-read logic lives with state (Priority: P2)

`ensureState` (read installed state, reconciling from the filesystem on first use) and `corpusExists` (does `.spec/` exist) live in `agents.ts` for historical reasons — but they are state-read/reconcile concerns, consumed by both `agents.ts` and `uninstall.ts`. Their conceptual home is `state.ts`, which already owns `readState`/`reconcileFromFs` and already imports `loadManifest`. Cohesion improves; readers find all state logic in one place.

**Why this priority**: Pure-cohesion improvement with no behavior change. Strictly secondary to US1/US2 (which remove active misinformation / a drift risk); this just tidies location. Included because it's mechanical and low-risk.

**Independent Test**: After the move, `ensureState`/`corpusExists` are defined in `state.ts` and imported from there by `agents.ts`/`uninstall.ts`; `state.ts` still does not import `agents.ts` (no cycle); the suite is green.

**Acceptance Scenarios**:

1. **Given** `ensureState`/`corpusExists` defined in `agents.ts`, **When** the cleanup lands, **Then** both are defined in `state.ts` and `agents.ts`/`uninstall.ts` import them from `state.ts`.
2. **Given** the import graph, **When** checked, **Then** there is no cycle — `agents.ts → state.ts` is one-way and `state.ts` does not import `agents.ts`.

---

### Edge Cases

- **Hidden `AgentKey` importer**: if grep misses an importer (e.g., a test), removing the type breaks it. Mitigation: grep `src/` AND `tests/` for `AgentKey` before removal; the full suite is the backstop.
- **Signature-change ripple**: dropping `_agent`/`_skipAbsorb` requires updating EVERY caller (cli.ts + corpus-init/corpus-update/corpus-lifecycle/corpus-uninstall tests) in the same change — a missed caller passes `null`/an agent as `projectRoot` and silently writes to the wrong place. Mitigation: the suite's init/update tests exercise every call site.
- **`AGENTS` must NOT be removed**: `agent-config.test.ts:36-45` asserts on `AGENTS`. Removing it breaks the test. Only its comment changes.
- **Unused import after param drop**: removing `_agent: AgentConfig` from `update.ts` makes `import type { AgentConfig }` unused — must be removed too (else dead import).
- **`CmdResult` relocation**: `uninstall.ts` imports `CmdResult` from `agents.ts`; must be repointed to `result.ts`. Any other importer found during implementation must be repointed too.
- **`ensureState` move cycle check**: `state.ts` must not gain an import of `agents.ts`; verify `state.ts`'s import list before/after.
- **No behavior change**: the ONLY test-text changes permitted are call-argument updates (FR-002/003). Any assertion-logic change signals an accidental behavior change and must be rejected.

## Requirements *(mandatory)*

### Functional Requirements

**Dead-code sweep (US1)**

- **FR-001**: Remove the `AgentKey` type alias from `src/utils.ts`. It MUST have zero importers in `src/` and `tests/` (verified by grep before removal).
- **FR-002**: `runInit` signature MUST become `runInit(projectRoot: string): Promise<void>` — the unused `_agent` and `_skipAbsorb` parameters are removed. Every caller (cli.ts + corpus-init/corpus-lifecycle/corpus-uninstall tests) MUST be updated to drop the leading argument.
- **FR-003**: `runUpdate` signature MUST become `runUpdate(projectRoot: string): Promise<void>` — the unused `_agent` parameter is removed and the now-unused `import type { AgentConfig }` in `update.ts` is removed. Every caller (cli.ts + corpus-update/corpus-lifecycle tests) MUST be updated.
- **FR-004**: Stale/misleading comments MUST be corrected to match reality: the `AGENTS` comment (drop the false "retained until cli.ts is rewritten (T018)" / "Legacy callers: cli.ts/init.ts/update.ts") and the `runInit`/`runUpdate` JSDoc (drop "T018 removes them" / "accepted for backward compatibility"). `AGENTS` itself is RETAINED (FR: do not remove — `agent-config.test.ts` depends on it).

**Type dedup (US2)**

- **FR-005**: Create `src/result.ts` exporting `type CmdResult = { ok: true; message: string } | { ok: false; reason: string }`. `agents.ts` and `intake.ts` MUST remove their local definitions and import from `src/result.ts`; `uninstall.ts` MUST import `CmdResult` from `src/result.ts` instead of `agents.ts`.
- **FR-006**: The `CmdResult` shape MUST be unchanged (pure relocation). No caller or consumer (`report()`) is modified for behavior.

**State cohesion (US3)**

- **FR-007**: Move `ensureState` and `corpusExists` from `src/commands/agents.ts` to `src/state.ts`. `agents.ts` and `uninstall.ts` MUST import them from `state.ts`. `state.ts` MUST NOT import `agents.ts` (no cycle — `state.ts` already imports only `manifest.ts` and `utils.ts`).
- **FR-008**: `ensureState`/`corpusExists` signatures and behavior MUST be unchanged (pure relocation).

**Cross-cutting**

- **FR-009**: No production dependency is added (Constitution III); all changes use existing `node:fs`/`node:path`.
- **FR-010**: Zero behavior change — the full mechanical suite (18 suites) MUST remain green. The only permitted test-text changes are call-argument updates required by FR-002/003; no assertion logic changes.

### Key Entities *(include if feature involves data)*

- **`CmdResult`** (`src/result.ts`): the single source of truth for command return shape `{ ok: true; message } | { ok: false; reason }`. Shared by all command modules.
- **`ensureState` / `corpusExists`** (`state.ts` after move): the state-read entry points — read installed state, reconciling from the filesystem on first use in a corpus.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `grep -rn "AgentKey" src/` returns no matches (type fully removed; no importer left).
- **SC-002**: `runInit` and `runUpdate` each have a single-parameter `(projectRoot)` signature; `grep -rnE "runInit\((null|claude|.*agent)" src/ tests/` returns no caller passing a leading agent/null arg.
- **SC-003**: `grep -rn "type CmdResult" src/` returns exactly one match, in `src/result.ts`; `agents.ts`/`intake.ts`/`uninstall.ts` all import it from there.
- **SC-004**: `ensureState` and `corpusExists` are defined in `src/state.ts`; `agents.ts` imports them from `state.ts`; `state.ts` does not import `agents.ts` (no cycle).
- **SC-005**: The full mechanical suite passes headlessly (18 suites) with no regression; the only test-file edits are call-argument updates (FR-002/003) — zero assertion-logic changes.
- **SC-006**: No new dependency; `package.json` version `2.1.0 → 2.1.1`.

## Assumptions

- **Versioning — PATCH 2.1.1**: internal cleanup only. No install-contract change (skills/templates/scripts unchanged), no new skill or template field, no CLI-surface or agent-support change. Per the constitution versioning rule this is PATCH (a fix/cleanup that does not change the install contract), not MINOR/MAJOR.
- **No constitution amendment**: the change is purely internal `src/` + test hygiene. The constitution's principles and constraints are untouched; the SDD STATE block advances to `006` as the current feature (the SDD STATE externalization itself is a separate, out-of-scope spec).
- **`AGENTS` is RETAINED, not removed**: `agent-config.test.ts` depends on it. Only its stale comment is corrected. (This corrects the prior refactor analysis that mislabeled `AGENTS` as dead — a `grep -v agent` filter had hidden the test importer.)
- **Verification is "tests stay green", not RED-first**: this is a pure refactor with no new behavior, so there is no new behavior to write a failing test for. The existing 18-suite mechanical suite is the regression net; each change MUST keep it green (spec-implement REFACTOR discipline). A small relocation-confirmation assertion (e.g., import `CmdResult` from `result.ts`, `ensureState` from `state.ts`) MAY be added to pin the new locations, but the primary gate is the unchanged suite.
- **Verification is headless**: per project memory, `npm test` is AI-driven/non-headless; evidence comes from `tests/units/*.test.ts` (`node:assert`) + `npx tsx src/cli.ts` smokes.
- **Non-goals**: test-harness boilerplate dedup (`tests/units/_harness.ts`); `intake.ts`/`utils.ts` module splits; SDD STATE externalization (moving `<!-- SDD STATE -->` out of `constitution.md` into an infra file — a real behavior change deserving its own spec); and any user-facing behavior change.
