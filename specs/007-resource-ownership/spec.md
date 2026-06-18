# Feature Specification: Resource Ownership & Document Safety

**Feature Branch**: `007-resource-ownership`

**Created**: 2026-06-18 (revised — consolidated design)

**Status**: Implemented

**Input**: User-driven redesign of spec-coach's project footprint around one iron rule — **spec-coach is read-only on user documents; it only ever appends to `specs/`.** This removes the over-built, user-exposed `intake` subsystem (its CLI command, manifest, ignore list, `.spec/absorbed/`, `.spec/intake/`); `/spec-absorb` (function unchanged) becomes the sole document→spec path, reading originals in place and leaving them untouched. It hardens `init` (re-run no longer clobbers `agents.json`; recognizes and guides on existing `specs/`) and sets the `uninstall` ownership boundary (constitution = regenerable tooling, removed on plain uninstall; only `specs/` preserved as user content). The model is codified in a constitution amendment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Re-running `init` never silently loses installed-agent state (Priority: P1)

A user (or an `update`/recovery flow) who re-runs `spec-coach init` on a project that already has agent bindings expects a no-op-safe refresh. Today `runInit` calls `writeState(projectRoot, {})` unconditionally (`init.ts:73`), overwriting `.spec/agents.json` with `{ agents: {} }`. The skill files remain on disk (`.claude/skills/spec-*`), but the state record is wiped. Because `ensureState` reconciles from the filesystem ONLY when `agents.json` is absent (`state.ts:137-145`), the emptied-but-present file never triggers reconcile — so `agents list` reports nothing installed while the bindings still exist. Silent state corruption, reachable by any re-init.

**Why this priority**: The only outright correctness bug in scope (state/disk divergence), reachable by a routine supported action (re-running `init`). The other stories are deliberate behavior changes; this is a defect fix.

**Independent Test**: Install an agent (`agents add`), then call `runInit` a second time. After: `.spec/agents.json` still records the agent (not `{}`); `readState`/`ensureState` matches disk. On a fresh dir the empty state is still created.

**Acceptance Scenarios**:

1. **Given** `.spec/agents.json` records `claude` installed (with `createdFiles`), **When** `runInit` runs again, **Then** `agents.json` is unchanged — still records `claude` (NOT reset to `{}`).
2. **Given** a fresh directory with no `.spec/agents.json`, **When** `runInit` runs, **Then** `.spec/agents.json` is created as `{ agents: {} }` (first-run behavior preserved).
3. **Given** a corpus re-init'd after an agent was added, **When** `agents list` runs, **Then** it accurately reflects the on-disk binding.

---

### User Story 2 - Plain `uninstall` removes tooling (incl. constitution), preserves only true user content (Priority: P1)

The constitution is scaffolding: `init` seeds it from `constitution-template.md` (`utils.ts:272`) and can re-seed it any time; its role is bound to the infrastructure. Treating it as permanent user content (today — preserved on plain uninstall, `uninstall.ts:26` `USER_PATHS`) leaves a stale half-cleaned project and blurs the tooling/content line. The clean model: **the user's intellectual property is `specs/`; everything else under `.spec/` is regenerable tooling.** Plain `uninstall` removes the constitution along with scripts/templates/state; only `specs/` survives. `--force`/purge additionally removes `specs/`.

**Why this priority**: The ownership-boundary crux the user asked about ("why doesn't uninstall handle constitution.md"), and a deliberate observable behavior change that flips existing tests. P1 alongside US1 because together they define the model.

**Independent Test**: Confirmed plain `uninstall` on a corpus with a customized constitution + `specs/001-x` + a user doc at `docs/keep.md`: `.spec/memory/constitution.md` and all `.spec/` tooling are gone; `specs/001-x` and `docs/keep.md` are intact. A `--force` run additionally removes `specs/`.

**Acceptance Scenarios**:

1. **Given** an installed corpus with a customized `.spec/memory/constitution.md`, `specs/001-x/spec.md`, and `docs/keep.md`, **When** a confirmed plain `uninstall` runs, **Then** `.spec/memory/constitution.md` is REMOVED, while `specs/001-x/spec.md` and `docs/keep.md` are PRESERVED.
2. **Given** the same state, **When** a confirmed `--force`/purge `uninstall` runs, **Then** `specs/` is ALSO removed (note: `docs/keep.md`, being outside spec-coach's scope, is never touched by any command).
3. **Given** a confirmed plain `uninstall`, **When** it completes, **Then** no spec-coach tooling remains under `.spec/`; `.spec/scripts`, `.spec/templates`, `.spec/agents.json`, and `.spec/memory` are all gone, and only `specs/` remains as preserved user content.

---

### User Story 3 - The `intake` subsystem is gone; documents become specs without ever being touched (Priority: P1)

`intake` is over-built and wrongly user-exposed: a standalone CLI (`intake scan`/`process`/`ignore`), a manifest state machine, an ignore list, a `.spec/absorbed/` pile of duplicated/mangled copies, and an `ai`-staging layer that does no real work (it only marks state and prints "run spec-absorb"). It imposes cognitive load (a whole subsystem vocabulary) for a job that collapses to one action: turn a document into a spec. `/spec-absorb` already does that — and it reads the source in place, never moving/deleting/overwriting it. So `intake` is removed entirely; `/spec-absorb` (function unchanged) is the sole document→spec path; spec-coach never scans outside `specs/`.

**Why this priority**: This is the iron rule in action and the largest simplification. It removes a whole subsystem, which is the user's primary ask ("是否多余"). P1 because it defines how documents are handled.

**Independent Test**: The `intake` CLI command, `.spec/intake/`, and `.spec/absorbed/` do not exist after `init`. Running `/spec-absorb <path>` on a user doc reads it in place and writes `specs/NNN-slug/spec.md`; the original doc is byte-for-byte unchanged. `spec-coach intake ...` is no longer a recognized command.

**Acceptance Scenarios**:

1. **Given** the package, **When** `spec-coach intake scan` (or any `intake` subcommand) is invoked, **Then** it is not a recognized command (dispatch + help's Document-lifecycle section removed).
2. **Given** a fresh `init`, **When** it completes, **Then** neither `.spec/intake/` nor `.spec/absorbed/` is ever created.
3. **Given** a user document at `docs/old-spec.md`, **When** `/spec-absorb docs/old-spec.md` runs, **Then** `specs/NNN-slug/spec.md` is created AND `docs/old-spec.md` is unchanged (the iron rule: spec-coach is read-only on user documents).
4. **Given** the iron rule, **When** any spec-coach command runs, **Then** no user document outside `specs/` is moved, renamed, deleted, or overwritten.

---

### User Story 4 - `init` recognizes existing `specs/` and guides the user (Priority: P2)

Running `init` in a project that already has `specs/` (prior spec-coach use, spec-kit migration — same `NNN-slug/` structure, or hand-created) must adopt it as the corpus: preserve everything, acknowledge what's there, and continue numbering — plus educate the user on the document-safety model and how to bring documents in. Today `init` is oblivious (its `intakeNudge` even scanned external dirs; `ensureDir(specs)` is a silent no-op on an existing dir). This story makes `init` recognize existing specs and emit a dedicated, non-blocking guidance block.

**Why this priority**: No correctness impact (existing specs are already safe) — pure UX/education. It depends on nothing from US1–US3 and is the lowest-risk story, so P2. Non-blocking by Constitution Principle II.

**Independent Test**: `init` in a dir with `specs/003-thing/spec.md` emits guidance acknowledging ≥1 existing spec and the document-safety rule; `specs/003-thing/spec.md` is byte-unchanged; numbering continues from 004. In a fresh dir, a (shorter) guidance block is emitted and no existing-specs message appears.

**Acceptance Scenarios**:

1. **Given** a directory with `specs/003-thing/spec.md`, **When** `runInit` runs, **Then** its output acknowledges existing spec(s) (count ≥ 1, highest number), states the document-safety rule and how to absorb (`/spec-absorb <path>`), and does NOT modify `specs/003-thing/`.
2. **Given** a directory with no `specs/` (or empty), **When** `runInit` runs, **Then** `specs/` is created and a guidance block is emitted (no existing-specs line).
3. **Given** existing `specs/NNN-slug/` dirs, **When** a new spec is later created via `/spec-specify`, **Then** its number continues after the highest existing (existing spec-specify behavior, asserted not to regress).

---

### Edge Cases

- **Existing `specs/` with non-conforming content** (loose files, odd names): preserved untouched (iron rule); doesn't break numbering (init/spec-specify count `NNN-slug` dirs only); user may `/spec-absorb` such a file if they want it as a proper spec.
- **Constitution customizations lost on plain uninstall**: plain `uninstall` now deletes the constitution, including custom principles/amendments/the SDD STATE block. Intended — `specs/` (the deliverables) survive, and re-init re-seeds the template. Documented so it is not a surprise.
- **`corpus-uninstall.test.ts` asserts the OLD behavior** (lines ~61/80: "constitution PRESERVED"): MUST flip to "constitution REMOVED." Behavior-reflecting change → RED-first.
- **`corpus-init.test.ts` re-init ignores state**: currently only asserts re-init keeps a single constitution; needs a new assertion that `agents.json` is preserved (US1) and that guidance is emitted (US4).
- **Removing `intake` breaks existing tests**: `tests/units/intake.test.ts` (the 80-assertion suite) is DELETED; `owned-paths.test.ts`, `precise-deletion.test.ts`, `agents-update.test.ts` reference `.spec/intake` and must be updated to drop it. The full suite is the regression net.
- **Re-init after a manual `agents.json` deletion**: re-init creates fresh empty state; `ensureState` will NOT reconcile (file now exists). Accepted — supported reset is `uninstall` → `init`.
- **`/spec-absorb` pointed at a doc inside `specs/`**: it still reads the source in place and writes `specs/NNN-slug/spec.md`; the source is untouched regardless of location.
- **`absorb.md` references the removed intake staging**: its invocation guidance is updated to "point at any document path" (the staging it described no longer exists); its transform FUNCTION is unchanged.
- **spec-kit migration**: spec-kit uses the same `specs/NNN-slug/` structure, so a migrant's existing `specs/` is adopted as-is with no conversion.

## Requirements *(mandatory)*

### Functional Requirements

**Init re-entry safety (US1)**

- **FR-001**: `runInit` MUST NOT overwrite an existing `.spec/agents.json`. When present, installed-agent state is preserved verbatim; the empty managed state is created only when the file is absent. (Replaces the unconditional `writeState(projectRoot, {})` at `init.ts:73`.)
- **FR-002**: On a fresh project (no `.spec/agents.json`), `runInit` MUST create `{ agents: {} }` — first-run behavior preserved.

**Uninstall ownership boundary (US2)**

- **FR-003**: A confirmed plain (non-purge) `uninstall` MUST remove all spec-coach tooling under `.spec/` — `.spec/scripts`, `.spec/templates`, `.spec/agents.json`, AND `.spec/memory` (constitution) — while PRESERVING `specs/`. (No `.spec/intake`/`.spec/absorbed` to account for — removed by US3.)
- **FR-004**: A confirmed `--force`/purge `uninstall` MUST additionally remove `specs/`.
- **FR-005**: The preservation boundary MUST be defined once and consumed by `uninstall`: `specs/` is the sole preserved user-content path; every other `.spec/` artifact is regenerable tooling removed on plain uninstall.

**intake removal (US3 / iron rule)**

- **FR-006**: The `spec-coach intake` command group MUST be removed — no `scan`/`process`/`ignore` dispatch in `cli.ts`, no Document-lifecycle section in `--help`. `/spec-absorb` (unchanged function) is the sole document→spec path.
- **FR-007**: `.spec/intake/` (manifest + ignore) and `.spec/absorbed/` MUST NOT exist — never created by any command. The `src/commands/intake.ts` machinery (manifest/ignore stores, `runIntakeScan`/`runIntakeProcess`/`runIntakeIgnore`, `discoverCandidates`, `safeAbsorbedName`, `sanitizeSlug`) is removed.
- **FR-008** (iron rule): spec-coach MUST be read-only on user documents — no command moves, renames, deletes, or overwrites any file outside the paths spec-coach owns (`.spec/` tooling, agent skill dirs, the managed context section). Document→spec conversion reads the source in place and writes a new `specs/NNN-slug/spec.md`.
- **FR-009**: `init` MUST NOT scan outside `specs/`. Its only filesystem read for discovery is `specs/` itself (to count existing specs). (Replaces the `intakeNudge` external-dir scan; `init.ts` no longer imports from `intake.ts`.)

**Init awareness & guidance (US4)**

- **FR-010**: `runInit` MUST detect existing `NNN-slug` spec directories under `specs/` and, when present, emit a non-blocking guidance block that (a) acknowledges them (count + highest number) and states they are adopted unchanged, (b) states the document-safety rule (user documents are never moved/deleted/overwritten), and (c) tells the user how to turn a document into a spec (`/spec-absorb <path>`). It MUST NOT modify existing specs.
- **FR-011**: When `specs/` is absent or empty, `runInit` MUST emit a (shorter) guidance block stating the document-safety rule and the `/spec-absorb` path, with no existing-specs line.

**Cross-cutting**

- **FR-012**: No production dependency is added (Constitution III); all changes use existing `node:fs`/`node:path`.
- **FR-013**: `skills/absorb.md` invocation guidance is updated to reflect direct-path invocation (point at any document path); its transform function is unchanged. (`SKILL_NAMES` retains `"absorb"`.)
- **FR-014**: Amend spec-coach's constitution (`.spec/memory/constitution.md`) to codify: the iron rule (spec-coach is read-only on user documents; only appends to `specs/`), the ownership model (tooling vs `specs/` user content), the `uninstall` preservation set (`specs/` only), and the CLI surfaces (corpus + agent; the `intake` surface removed, document→spec via the on-demand `/spec-absorb` skill). Bumps the constitution v1.2.0 → v1.3.0 with rationale.

### Key Entities *(include if feature involves data)*

- **Iron rule**: spec-coach is read-only on user documents — it never moves, renames, deletes, or overwrites a user file; it only reads sources and appends new `NNN-slug/` dirs under `specs/`. This is the single guarantee that user files are safe and recoverable under any operation (they were never touched).
- **Ownership classification**: **Tooling** (regenerable from the package: scripts, templates, agent skills/context-section, `agents.json`, the constitution) is removed on plain uninstall. **User content** (`specs/`) is preserved unless `--force`. **Read-only sources** (the user's own documents anywhere outside spec-coach's owned paths) are never mutated by any command.
- **`specs/`**: the shared corpus. Existing content is adopted read-only; new specs are appended via the SDD skills. spec-coach never modifies or deletes an existing spec.
- **`/spec-absorb`**: the sole document→spec converter; reads a source in place, writes `specs/NNN-slug/spec.md`. Function unchanged from spec 005.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After `agents add claude` + a second `runInit`, `.spec/agents.json` still records `claude` (not `{}`); `ensureState` reflects disk. Fresh dir still creates `{ agents: {} }`.
- **SC-002**: Confirmed plain `uninstall` removes `.spec/memory/constitution.md` + all `.spec/` tooling and PRESERVES `specs/` + user docs outside `.spec/`; `--force` also removes `specs/`.
- **SC-003**: `spec-coach intake ...` is not a recognized command; `init` never creates `.spec/intake/` or `.spec/absorbed/`.
- **SC-004**: `/spec-absorb <doc>` creates `specs/NNN-slug/spec.md` and leaves the source doc byte-for-byte unchanged (iron rule).
- **SC-005**: `init` with existing `specs/` emits guidance acknowledging them + the safety rule + the absorb path, and leaves existing specs unchanged; fresh `init` emits the shorter guidance block.
- **SC-006**: The preservation boundary is stated once and consumed by `uninstall`; `intake.ts` is deleted; `init.ts` no longer imports `intake.ts`.
- **SC-007**: The full mechanical suite passes headlessly with intake tests removed and uninstall/init tests updated to NEW behavior (RED-first — behavior change, not a pure refactor).
- **SC-008**: No new dependency; constitution amended v1.2.0 → v1.3.0; `package.json` version `2.1.1 → 2.2.0`.

## Assumptions

- **Versioning — MINOR 2.1.1 → 2.2.0**: removes a CLI command (`intake`), changes observable `init`/`uninstall` behavior, and includes a constitution amendment. NOT MAJOR (the installed file structure `init` creates is unchanged — the `absorb` skill stays in `SKILL_NAMES`; `.spec/intake`/`.spec/absorbed` were runtime-created, never installed), NOT PATCH.
- **Constitution amendment v1.2.0 → v1.3.0 is clarifying**: codifies the iron rule, ownership model, uninstall preservation set, and CLI surfaces (3 → 2 + on-demand absorb skill). Adds no principle, removes none. Amendment propagation (re-reading `.spec/templates/plan-template.md`'s Constitution Check and any skill embedding principle wording, per the spec-constitution amendment checklist) is handled at implement time.
- **This is a behavior change, so RED-first TDD applies**: new failing tests MUST precede code for US1/US2/US3/US4. Existing tests asserting OLD behavior (constitution PRESERVED on plain uninstall; the `intake.test.ts` suite) are updated/removed to reflect NEW behavior — these are behavior-reflecting edits, not the spec-006 call-arg-only exception.
- **`/spec-absorb` function is unchanged**: only its invocation guidance (and the removal of the intake-staging framing) changes; what it does — read a source, write `specs/NNN-slug/spec.md` — is identical.
- **Verification is headless**: per project memory, `npm test` is AI-driven/non-headless; evidence comes from `tests/units/*.test.ts` (`node:assert`) + `npx tsx src/cli.ts` smokes.
- **`docs/` etc. are never scanned or touched**: init's only discovery read is `specs/`; the guidance text names `docs/`/`*.md` purely as illustrative examples of the user's own documents, not as scan targets.
- **Non-goals**: externalizing `<!-- SDD STATE -->` out of `constitution.md` (separate spec); changing `/spec-absorb`'s transform logic; mirroring the ownership model into `constitution-template.md` for all projects (plan-level open question — codified in spec-coach's own constitution this round); re-validating/migrating the content of adopted existing specs.
