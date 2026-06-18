# Feature Specification: Derived Workflow State (Eliminate the Stored-State Subsystem)

**Feature Branch**: `008-derived-workflow-state`

**Created**: 2026-06-18

**Status**: Implemented

**Input**: spec-coach maintains a parallel, drift-prone "workflow state" subsystem that re-expresses what the artifacts (`specs/NNN/`) and git already say — and is internally broken: "current feature" has **three competing sources** (`SPECIFY_FEATURE` env, `.spec/feature.json`, the constitution's `<!-- SDD STATE -->` block); the block's `Last phase` field is dead (the reader already ignores it and infers phase from artifacts); `Decisions` is written by no skill; `feature.json` does not even exist in this repo. Root cause: every explicit state store carries a "someone must remember to write it" obligation that demonstrably goes unmet.

The fix is **Φ**: eliminate the *writable, behavior-driving* state. Workflow state becomes **derived read-only from artifacts**. A single resolver resolves the current feature (explicit token → opt-in `@` branch shorthand → most-recently-modified `specs/` dir); phase is inferred from which artifacts exist; the resume breakpoint is the first unchecked task in `tasks.md`; `show-sdd-state.sh` becomes a pure read-only reporter that never mutates a file, always exits 0, and never drives behavior — so its best-effort defaults are safe to be wrong (a wrong pick costs a glance, not corruption). The guiding distinction: coupling to `specs/NNN/` artifacts is **legitimate** (they ARE the state); coupling to git branch/commit plumbing is **illegitimate** (it changes for non-SDD reasons) and is therefore allowed only as an *explicit, opt-in* `@`, never a silent default.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - "Where am I?" is reported drift-free, derived from artifacts (Priority: P1)

A user resuming SDD work runs `scripts/bash/show-sdd-state.sh` to see the current feature, its phase, and where the decisions live. Today that report is fed by a writable state store that rots (dead `Last phase`, unwritten `Decisions`, an absent `feature.json`, three disagreeing sources). Under Φ the report is **derived** every time from `specs/NNN/` artifacts and an explicit/mtime/`@` feature token — so it can never be stale, because there is no stored copy to fall out of sync with reality.

**Why this priority**: This is the headline value and the reliability thesis ("no independent store = no drift = no forgot-to-update failure"). It is independently testable: a feature dir + its artifacts yield a correct report with no `feature.json` or SDD STATE block present at all.

**Independent Test**: In a tmp repo with `specs/007-x/{spec,plan,tasks}.md` and NO `.spec/feature.json` and NO SDD STATE block, `show-sdd-state.sh 007` (or no-arg, relying on mtime) prints feature `007-x`, phase `tasks` (inferred from the three artifacts), and points at `spec.md`/CHANGELOG for decisions. No file is mutated; exit code 0.

**Acceptance Scenarios**:

1. **Given** a feature dir `specs/007-x/` containing `spec.md`, `plan.md`, `tasks.md`, `analysis.md` and NO state file, **When** `show-sdd-state.sh 007` runs, **Then** it prints feature `007-x` and phase `analyze` (inferred — analysis.md present) without reading any stored state, mutates nothing, and exits 0.
2. **Given** the same dir, **When** `show-sdd-state.sh` runs with no argument, **Then** it defaults to the most-recently-modified feature dir (`007-x`) and reports it.
3. **Given** a dir with `specs/007-x/` only through `spec.md` (early), **When** `show-sdd-state.sh 007` runs, **Then** phase is `specify` (no plan/tasks/analysis yet).
4. **Given** a project with NO `specs/` at all, **When** `show-sdd-state.sh` runs, **Then** it prints "no current feature" and exits 0 (graceful, non-blocking).

---

### User Story 2 - Resume continues exactly where you left off, from artifacts (Priority: P1)

After an interruption (lost context, new session), the user resumes a feature. "Where I was" is recoverable from artifacts alone: which feature (the one I name, or the last I touched, or the one on my branch), and the breakpoint (the first task still unchecked in `tasks.md`). No stored "last position" is needed because `tasks.md`'s checkboxes ARE the resumable state — an artifact, not a drift-prone mirror.

**Why this priority**: Resume is the scenario that seemed to require stored state, and proving it works without a store is the proof that the teardown loses nothing. P1 because it is the continuity guarantee.

**Independent Test**: Create `specs/008-y/tasks.md` with T001–T003 where T001/T002 are `[x]` and T003 is `[ ]`. After "resume" (resolver picks `008-y` via explicit/mtime/`@`), the reported breakpoint is T003 (first unchecked). No state file exists.

**Acceptance Scenarios**:

1. **Given** `specs/008-y/tasks.md` with the first unchecked task at T003, **When** resume resolves feature `008-y` (explicit `008`), **Then** the reported next task is T003 (first `- [ ]`), read from the artifact.
2. **Given** the same tasks.md with all tasks `[x]`, **When** resume runs, **Then** it reports "no pending task" (does not silently restart).
3. **Given** a feature dir with no `tasks.md` yet, **When** resume runs, **Then** it reports phase `specify`/`plan` and "no tasks.md yet" rather than failing.
4. **Given** the user runs resume with `@` while on branch `008-y`, **Then** the feature is resolved to `specs/008-*/` via explicit opt-in branch parse.

---

### User Story 3 - The stored-state subsystem is removed; nothing that depended on it regresses (Priority: P2)

The redundant apparatus is deleted: `.spec/feature.json` + `_persist_feature_json`, the `<!-- SDD STATE -->` block + the `spec-constitution` step that appends it, and `get_current_branch`'s role as a *source* of the current feature (`SPECIFY_FEATURE` survives only as an explicit override token). The remaining consumers (`verify-spec.sh` no-arg resolution, `create-new-feature.sh`) are retargeted onto the new resolver, and legacy `feature.json`/block instances are tolerated (read-ignored, never written/migrated). This is the surgery that makes US1/US2 coherent — there is no longer a competing stored source — and it must not regress any command.

**Why this priority**: Enabling/cleanup that realizes US1/US2 cleanly. Independently testable (no state file is written by any command; consumers still resolve correctly; legacy tolerated). P2 because the *value* lives in US1/US2; US3 is the necessary teardown behind them.

**Independent Test**: After `create-new-feature.sh` creates a feature, NO `.spec/feature.json` is written. `verify-spec.sh` (no args) still resolves the spec when one feature is unambiguous. A pre-existing legacy `.spec/feature.json` + SDD STATE block are ignored by the resolver without error, and derivation wins.

**Acceptance Scenarios**:

1. **Given** `create-new-feature.sh` runs to create feature 009, **When** it completes, **Then** NO `.spec/feature.json` is written (the `_persist_feature_json` path is gone), and the feature dir + (optionally) branch exist.
2. **Given** a single feature `specs/009-z/spec.md`, **When** `verify-spec.sh` runs with no args, **Then** it resolves to `specs/009-z/spec.md` via the resolver (no feature.json read) and scans it.
3. **Given** a legacy project that still has a `.spec/feature.json` and a SDD STATE block, **When** the resolver / `show-sdd-state.sh` runs, **Then** they do NOT crash, they IGNORE the legacy store, and derivation from artifacts/branch/mtime wins (read-tolerant; nothing is written or migrated).
4. **Given** `SPECIFY_FEATURE=009-z` is exported, **When** the resolver runs with no explicit token, **Then** the env var is honored as an explicit override (its only remaining role), not as a parallel silent source.

---

### Edge Cases

- **Multiple features, no token (ambiguous)**: resolver does not guess silently; `show-sdd-state.sh` says "multiple candidates" and lists each with its inferred phase + mtime so the user passes an explicit token. (Read-only, so a wrong default would be cheap — but listing is friendlier.)
- **`git checkout` churns artifact mtimes**: the no-token mtime default may then point at the freshly-checked-out feature. Acceptable: it usually points at the feature the user just switched to in order to work on; if wrong, it only affects an implicit, read-only pick (explicit token always overrides). Documented, not engineered around.
- **Non-git directory / detached HEAD**: `@` is unavailable. The resolver falls back to explicit token or mtime; `show-sdd-state.sh` degrades gracefully and still exits 0.
- **`@` on a branch with no leading `NNN`** (`main`, `fix-typo`): `@` returns "no feature on this branch" (no crash); user falls back to explicit token or no-arg mtime.
- **Fix-branch names** (`007-fix-spec-prune`): `@` parses the leading `\d{3}` (`007`) and maps to `specs/007-*/`, so a fix branch resolves to its parent feature.
- **`tasks.md` checkboxes out of sync** (checked-but-reverted, or done-but-unchecked): resume may re-do or skip a task. This is inherent to ANY task tracker (including the current `tasks.md`) and is mitigated by the `spec-implement` discipline of ticking `[x]` only after VERIFY — not introduced or worsened by Φ.
- **Legacy `feature.json` / SDD STATE block present**: read-tolerant (ignored, derivation wins); never written, never actively stripped from other projects. This repo's own constitution (the dogfood instance) has its block removed as part of the amendment.
- **A feature dir with only `spec.md`**: phase `specify`; resume reports "no tasks.md yet." Not an error.
- **`show-sdd-state.sh` must never mutate**: any invocation leaves every file's contents and mtimes unchanged; it is a reporter, not a state writer.
- **Existing tests asserting the old state machinery**: any test that writes/asserts `.spec/feature.json` or the SDD STATE block is updated/removed to reflect the new derived model (behavior change → RED-first).

## Requirements *(mandatory)*

### Functional Requirements

**The feature resolver (US1/US2)**

- **FR-001**: A single resolver MUST be the only mechanism that resolves "the current feature," exposing two policies — **soft** and **strict**. Given a token, both resolve it (a number/slug maps to the matching `specs/NNN-*/` dir; `@` maps via FR-002). Given NO token, **soft** policy defaults to the most-recently-modified `specs/NNN-*/` dir (FR-003) — used only by the read-only reporter; **strict** policy resolves only when exactly one candidate exists, returning none otherwise — used by the writing/skill path (FR-012). It MUST NOT read `.spec/feature.json` or the SDD STATE block.
- **FR-002**: `@` MUST be an explicit, opt-in token meaning "the feature on the current git branch" — parse the leading `\d{3}` from `git branch --show-current` and map to `specs/<NNN>-*/`. Branch parsing is triggered ONLY by an explicit `@`, never as a silent default (no illegitimate coupling).
- **FR-003**: Under **soft** policy with no token, the resolver MUST default to the most-recently-modified `specs/NNN-*/` directory (legitimate artifact coupling; the read-only reporter may guess — a wrong pick costs a glance). If none exists, it returns "none." **Strict** policy (FR-012) never guesses among multiple candidates.
- **FR-004**: Phase MUST be inferred from artifacts in the feature dir (`spec.md`→specify, `plan.md`→plan, `tasks.md`→tasks, `analysis.md`→analyze; else `constitution`), never read from a stored field.

**Read-only reporting (US1)**

- **FR-005**: `show-sdd-state.sh` MUST be a pure read-only reporter: feature via FR-001–003, phase via FR-004, decisions as a pointer to `spec.md`/`CHANGELOG` (and an optional `specs/NNN/decisions.md` if the user keeps one). It MUST NOT mutate any file, MUST always exit 0, and MUST NOT drive any behavior (no command acts destructively on its output).
- **FR-006**: When the resolver returns "none" or is ambiguous (multiple candidates, no token), `show-sdd-state.sh` MUST say so, and — for ambiguity — list each candidate feature with its inferred phase + mtime so the user can pass an explicit token.

**Resume (US2)**

- **FR-007**: Resume MUST identify the breakpoint from artifacts: the first unchecked task (`- [ ]`, not `- [x]`) in `specs/NNN/tasks.md`. If all tasks are checked or `tasks.md` is absent, it reports "no pending task" / "no tasks.md yet" rather than failing.
- **FR-008**: Resume's feature resolution MUST use the resolver (FR-001–003), supporting explicit ("continue 007"), implicit (no-token mtime default), and `@`. No stored pointer is read.

**Teardown & retarget (US3)**

- **FR-009**: `.spec/feature.json` and the `feature_directory` write path (`_persist_feature_json`) MUST be removed. `create-new-feature.sh` MUST NOT persist a state file (it MAY create/switch the git branch, which remains an opt-in `@` hint, not a store).
- **FR-010**: The `<!-- SDD STATE -->` block MUST be removed from `.spec/memory/constitution.md`, and the `spec-constitution` step that appends it MUST be removed. Nothing writes per-feature phase/decisions into the constitution.
- **FR-011**: `SPECIFY_FEATURE` / `get_current_branch` MUST cease to be a *source* of the current feature. The env var MAY survive solely as an explicit override token fed into the resolver (FR-001), not as a parallel silent source.
- **FR-012**: Consumers of the removed state — `verify-spec.sh`, the writing skill-wrappers (`setup-plan.sh`, `setup-tasks.sh`, `check-prerequisites.sh`) via `get_feature_paths`, and `create-new-feature.sh` — MUST be retargeted onto the resolver. `get_feature_paths` MUST use **strict** policy: it resolves when a token or `SPECIFY_FEATURE`/`SPECIFY_FEATURE_DIRECTORY` env is given OR exactly one feature exists; with multiple features and no explicit input it MUST error (never silently mtime-pick — that would write artifacts into the wrong feature). `verify-spec.sh` (no args) still resolves a spec when one feature is unambiguous; `create-new-feature.sh` still creates the feature dir (+ optional branch).
- **FR-013** (migration/tolerance): The resolver MUST tolerate a legacy `.spec/feature.json` or legacy SDD STATE block if present (e.g. on a project that had them) without crashing — it ignores them and derivation wins. It MUST NOT write or migrate them.

**Constitution & cross-cutting**

- **FR-014**: Amend the constitution v1.3.0 → v1.4.0 to codify: workflow state is NOT stored — it is derived read-only from `specs/NNN/` artifacts; `show-sdd-state.sh` is a non-driving reporter; the current feature is resolved by explicit token / no-token mtime default / opt-in `@`; no command maintains a writable workflow-state file. Remove the SDD STATE block from the constitution (and the step/template that create it).
- **FR-015**: No production dependency is added (Constitution III); all work is bash + existing tooling (the jq/python3/grep fallback ladder already in `common.sh`).

### Key Entities *(include if feature involves data)*

- **Two-coupling principle (load-bearing)**: coupling to `specs/NNN/` artifacts is **legitimate** (those files ARE the state — changing them IS a state change); coupling to git branch/commit plumbing is **illegitimate** (it changes for non-SDD reasons). Φ derives state using ONLY legitimate coupling; because the reporter is read-only and never drives behavior, its best-effort defaults are safe to be wrong (cost = a glance), while anything that drives behavior is made explicit (hence the `@` opt-in and explicit-token resolution).
- **The resolver**: the single feature-id resolver (precedence: explicit token → `@` → no-token mtime default → none); reads no state file; the one place that knows how to turn a token into a feature dir.
- **Read-only reporter** (`show-sdd-state.sh`): derives feature/phase/decision-pointers; never mutates; never drives behavior; always exit 0.
- **Resume breakpoint**: the first unchecked task in `tasks.md` — the recoverable state, which is itself an artifact (not a mirror).
- **`@` shorthand**: explicit opt-in branch→feature derivation; never a silent default (this is what removes the illegitimate-coupling risk Ω had).

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: `show-sdd-state.sh` reports the correct feature + phase given ONLY a `specs/NNN/` dir + its artifacts, with NO `feature.json` and NO SDD STATE block present (drift-free by construction).
- **SC-002**: After an interrupt + resume, the correct feature and the first unchecked task are identified from artifacts alone (no stored pointer).
- **SC-003**: No command writes `.spec/feature.json` or appends the SDD STATE block; `grep` finds no `_persist_feature_json` callers and no block-append in the `spec-constitution` skill.
- **SC-004**: `verify-spec.sh` (no args) and `create-new-feature.sh` still resolve/create correctly after retarget; `@` resolves a branch to its feature; `SPECIFY_FEATURE` works as an override only.
- **SC-005**: A legacy `feature.json` / legacy SDD STATE block is tolerated — the resolver does not crash and derivation wins (read-tolerant, never-write).
- **SC-006**: `show-sdd-state.sh` always exits 0 and never mutates a file (contents + mtimes unchanged across an invocation).
- **SC-007**: The full mechanical suite passes headlessly with old-state tests updated/removed (RED-first — this is a behavior change, not a pure refactor).
- **SC-008**: No new dependency; constitution amended v1.3.0 → v1.4.0; `package.json` version bumped (MINOR per Assumptions).

## Assumptions

- **Versioning — MINOR 2.2.1 → 2.3.0**: changes observable behavior (`show-sdd-state.sh` now derives; `create-new-feature.sh` writes no state file; `verify-spec.sh` no-arg resolves via the resolver), removes content from an installed template (the SDD STATE block from `constitution-template.md`) and an installed skill step (the `spec-constitution` append), and includes a constitution amendment. It is NOT MAJOR: the installed *file structure* is unchanged — every script/template/skill stays at the same path, so `update` is not broken; no skill is added/removed from `SKILL_NAMES`. NOT PATCH (observable behavior + template/skill content change).
- **Constitution amendment v1.3.0 → v1.4.0 is a structural clarification**: codifies the "state is derived, not stored" model and the read-only-reporter contract; adds no principle, removes none. Removes the SDD STATE block from this repo's own constitution (the dogfood instance). Amendment propagation (re-reading `.spec/templates/plan-template.md`'s Constitution Check and any skill embedding the old state wording, per the spec-constitution amendment checklist) is handled at implement time.
- **Φ supersedes the earlier `(b) each-skill-writes-decisions + common primitive` idea**: under Φ, skills write NO state — they write artifacts (their primary job), and everything else is derived. There is therefore no per-skill write obligation (the root cause of the current rot). `decisions` is not a stored field; an optional hand-kept `specs/NNN/decisions.md` is user content, never required.
- **This is a behavior change, so RED-first TDD applies**: new failing tests precede code for US1/US2; US3's removals keep the suite green plus CLI smokes (no new behavior to drive RED). Existing tests asserting OLD behavior (any that write/assert `feature.json` or the SDD STATE block) are updated/removed to reflect the derived model — behavior-reflecting edits, not the spec-006 call-arg-only exception.
- **Resume is inherently explicit**: "continue" is a deliberate act, so the natural form is an explicit feature token; the no-token mtime default is a best-effort convenience made safe by read-only-ness (a wrong pick costs a glance, never a destructive action). This is why soft defaults are acceptable for the reporter but explicitness is required for anything that drives behavior.
- **No destructive migration of other projects**: a pre-existing `feature.json`/SDD STATE block in another project is read-ignored (FR-013); Φ never strips it. Only this repo's own constitution loses its block (dogfood + the v1.4.0 amendment).
- **Verification is headless**: per project memory, `npm test` is AI-driven/non-headless; evidence comes from `tests/units/*.test.ts` (`node:assert`) + `npx tsx src/cli.ts` and direct bash script smokes.
- **Non-goals**: changing any skill's *phase* behavior (specify/plan/tasks/analyze/implement still produce the same artifacts the same way); changing `/spec-absorb`; redesigning the broader skills' interaction with git beyond the `@` opt-in; auto-stripping legacy state from other projects; introducing a new top-level CLI command (Constitution constraint — `@`/resolver are internal script mechanics, not a new command surface).
