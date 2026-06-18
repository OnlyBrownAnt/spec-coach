# Feature Specification: Resource-Ownership Model (init/uninstall hardening)

**Feature Branch**: `007-resource-ownership`

**Created**: 2026-06-18

**Status**: Draft

**Input**: User-flagged unclear/buggy user-resource handling: (1) why `uninstall` "doesn't handle" `.spec/memory/constitution.md`; (2) whether user documents survive uninstall; (3) `init` seemingly ignoring the user's pre-existing specs. Code analysis confirmed: user documents are already preserved (non-issue); `constitution.md` IS handled today (preserved as user-content, removed on `--force`) but its classification is an under-specified "seeded-but-customizable" hybrid; and `init` has one real bug — `runInit` unconditionally writes `writeState({})`, so re-running `init` clobbers `.spec/agents.json` and orphans installed agent bindings from state (`ensureState` only reconciles when the file is *absent*, so it never self-heals). Scope: one spec that hardens the tooling-vs-content ownership line end-to-end — init re-entry safety, init awareness of existing specs, an explicit/consistent uninstall preservation boundary, and a codifying constitution amendment.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Re-running `init` never silently loses installed-agent state (Priority: P1)

A user (or an `update`/recovery flow) who re-runs `spec-coach init` on a project that already has agent bindings installed expects a no-op-safe refresh. Today `runInit` calls `writeState(projectRoot, {})` unconditionally (`init.ts:73`), overwriting `.spec/agents.json` with `{ agents: {} }`. The skill files remain on disk (`.claude/skills/spec-*`), but the state record is wiped. Because `ensureState` reconciles from the filesystem ONLY when `agents.json` is absent (`state.ts:137-145`), the emptied-but-present file never triggers reconcile — so `agents list` reports nothing installed while the bindings still exist. This is silent state corruption, reachable by any re-init.

**Why this priority**: It is the only item here that is an outright correctness bug (state/disk divergence), and it is reachable by a routine, supported action (re-running `init`). The other two stories are a deliberate behavior change and a UX gap; this one is a defect fix.

**Independent Test**: Install an agent (`agents add`), then call `runInit` a second time. After: `.spec/agents.json` still records the installed agent (not reset to `{}`), and the installed-agent state read back via `readState`/`ensureState` matches what is on disk. On a fresh directory (no `agents.json`) the empty state is still created.

**Acceptance Scenarios**:

1. **Given** a corpus whose `.spec/agents.json` records `claude` installed (with `createdFiles`), **When** `runInit` runs again, **Then** `agents.json` is unchanged — it still records `claude` (re-init did NOT reset it to `{}`).
2. **Given** a fresh directory with no `.spec/agents.json`, **When** `runInit` runs, **Then** `.spec/agents.json` is created as the empty managed state `{ agents: {} }` (current first-run behavior preserved).
3. **Given** a corpus that was re-init'd after an agent was added, **When** `agents list` (or `ensureState`) runs, **Then** it accurately reflects the on-disk binding (no false "nothing installed").

---

### User Story 2 - Plain `uninstall` removes tooling (incl. constitution), preserves only true user content (Priority: P1)

The constitution is scaffolding: `init` seeds it from `constitution-template.md` (`utils.ts:272`) and can re-seed it at any time. Treating it as permanent user content (today's behavior — preserved on plain uninstall, `uninstall.ts:26` `USER_PATHS`) leaves a stale half-cleaned project and blurs the tooling/content line. The clean model: **the user's intellectual property is `specs/` and `.spec/absorbed/`; everything else under `.spec/` is regenerable tooling.** Plain `uninstall` therefore removes the constitution along with scripts/templates/state/intake; only `specs/` and `.spec/absorbed/` survive. `--force`/purge additionally removes those.

**Why this priority**: This is the ownership-model crux the user asked about ("why doesn't uninstall handle constitution.md"), and it is a deliberate, observable behavior change that flips existing tests. It shares P1 with US1 because together they define the model; US1 is the bug, this is the policy.

**Independent Test**: Run a confirmed plain `uninstall` on a corpus that has a customized constitution, `specs/001-x`, and `.spec/absorbed/old.md`. After: `.spec/memory/constitution.md` and all `.spec/` tooling are gone; `specs/001-x` and `.spec/absorbed/old.md` are intact. A `--force` run additionally removes `specs/` and `.spec/absorbed/`.

**Acceptance Scenarios**:

1. **Given** an installed corpus with a customized `.spec/memory/constitution.md`, `specs/001-x/spec.md`, and `.spec/absorbed/old.md`, **When** a confirmed plain `uninstall` runs, **Then** `.spec/memory/constitution.md` is REMOVED, while `specs/001-x/spec.md` and `.spec/absorbed/old.md` are PRESERVED.
2. **Given** the same starting state, **When** a confirmed `--force`/purge `uninstall` runs, **Then** `specs/` and `.spec/absorbed/` are ALSO removed.
3. **Given** a confirmed plain `uninstall`, **When** it completes, **Then** no spec-coach tooling remains under `.spec/` except the preserved user-content paths (`specs/`, `.spec/absorbed/`); `.spec/scripts`, `.spec/templates`, `.spec/agents.json`, `.spec/intake`, and `.spec/memory` are all gone.

---

### User Story 3 - `init` recognizes pre-existing specs (Priority: P2)

Running `init` in a project that already has `specs/` (e.g. specs from a prior spec-coach version, or migrated from another tool) currently pretends the corpus is empty: `ensureDir(specs)` is a no-op on an existing dir (`init.ts:26`), and `intake` excludes `specs/` as corpus-internal (`intake.ts:126`), so existing specs are invisible to every signal `init` emits. A user with six existing specs gets "Project structure created" with no acknowledgment that their prior work was seen and will be preserved.

**Why this priority**: Pure UX gap with no correctness impact — existing specs are already safe (never destroyed). It is the lowest-risk story and depends on nothing from US1/US2, so it sits at P2. Non-blocking by Constitution Principle II (coach, not gatekeeper): a one-line acknowledgment, never a prompt.

**Independent Test**: Run `init` in a directory containing `specs/003-thing/spec.md`. After: the output acknowledges ≥1 existing spec; `specs/003-thing/spec.md` is byte-for-byte unchanged. In a directory with no `specs/`, the output is unchanged (no spurious message).

**Acceptance Scenarios**:

1. **Given** a directory containing `specs/003-thing/spec.md`, **When** `runInit` runs, **Then** its output acknowledges the existing spec(s) (count ≥ 1) and does NOT modify, move, or delete `specs/003-thing/`.
2. **Given** a directory with no `specs/` directory (or an empty one), **When** `runInit` runs, **Then** no "existing specs" acknowledgment is emitted (current behavior preserved).

---

### Edge Cases

- **Constitution carries amendments / SDD STATE**: plain uninstall now deletes the constitution, so any custom principles, amendments, and the `<!-- SDD STATE -->` block are lost. Mitigation/decision: this is intended (uninstall removes the tool and its workflow state); the actual deliverables in `specs/` are preserved, and re-init re-seeds the template. Documented explicitly so it is not a surprise.
- **`corpus-uninstall.test.ts` asserts the OLD behavior**: lines ~61 and ~80 currently assert "constitution PRESERVED" on plain uninstall. These MUST flip to "constitution REMOVED." This is a legitimate behavior-reflecting test change (new behavior), NOT the call-argument-only exception from spec 006 — RED-first TDD applies.
- **`corpus-init.test.ts` re-init ignores state**: it currently only asserts re-init keeps a single constitution; it does NOT assert `agents.json` is preserved. A new assertion is required for US1 (the fix is otherwise untested).
- **Re-init after a manual `agents.json` deletion**: if a user deletes `.spec/agents.json` but leaves skill dirs on disk, re-init creates a fresh empty state and `ensureState` will NOT reconcile (file now exists). Accepted: manual deletion is outside the supported path; the supported reset is `uninstall` → `init`.
- **`.spec/absorbed/` is derivative of sources**: it holds verbatim copies of source docs the user chose to absorb. It stays user-content (preserved on plain uninstall) because the absorb is a deliberate user action and the originals are untouched anyway.
- **intake ignore-list (`.spec/intake/ignore.json`) is user curation**: it is nonetheless regenerable tooling (a re-scan re-surfaces the docs; the user re-ignores). It stays classified as tooling — removed on plain uninstall — consistent with the constitution-as-tooling decision. Losing the curation on uninstall is accepted.
- **Legacy/foreign spec dirs** (not `NNN-slug`): US3's "existing spec" count counts directories under `specs/` regardless of naming, so foreign or legacy specs are acknowledged too.
- **Empty `.spec/` after plain uninstall**: with `.spec/memory` now removed on plain uninstall but `.spec/absorbed/` preserved, `.spec/` may retain near-empty structure. Out of scope to prune aggressively; preserved user content legitimately keeps `.spec/` alive.

## Requirements *(mandatory)*

### Functional Requirements

**Init re-entry safety (US1)**

- **FR-001**: `runInit` MUST NOT overwrite an existing `.spec/agents.json`. When the file already exists, the installed-agent state is preserved verbatim; `runInit` only creates the empty managed state when the file is absent. (Replaces the unconditional `writeState(projectRoot, {})` at `init.ts:73`.)
- **FR-002**: On a fresh project (no `.spec/agents.json`), `runInit` MUST create the empty managed state `{ agents: {} }` — current first-run behavior is preserved exactly.

**Uninstall ownership boundary (US2)**

- **FR-003**: A confirmed plain (non-purge) `uninstall` MUST remove all spec-coach tooling under `.spec/` — `.spec/scripts`, `.spec/templates`, `.spec/agents.json`, `.spec/intake`, AND `.spec/memory` (the constitution) — while PRESERVING the user-content paths `specs/` and `.spec/absorbed/`.
- **FR-004**: A confirmed `--force`/purge `uninstall` MUST additionally remove `specs/` and `.spec/absorbed/`.
- **FR-005**: The preservation boundary MUST be defined once (a single user-content set: `specs/`, `.spec/absorbed/`) and consumed by `uninstall`; the tooling-to-remove set MUST NOT be maintained as a divergent duplicate that can drift from the preservation set. (The constitution moves from the preserved set into the removed tooling set.)

**Init awareness (US3)**

- **FR-006**: `runInit` MUST detect pre-existing spec directories under `specs/` and, when one or more exist, emit a non-blocking acknowledgment (a count) in its output. It MUST NOT modify, move, or delete any existing spec.
- **FR-007**: When `specs/` is absent or empty, `runInit` MUST emit no "existing specs" acknowledgment — current output is unchanged.

**Cross-cutting**

- **FR-008**: No production dependency is added (Constitution III); all changes use existing `node:fs`/`node:path`.
- **FR-009**: Amend spec-coach's constitution (`.spec/memory/constitution.md`, the dogfood source of truth) to codify the resource-ownership model — state explicitly the **preserved user-content set** for uninstall (`specs/`, `.spec/absorbed/`) and that all other `.spec/` artifacts (including the constitution) are regenerable tooling removed on plain uninstall. Bumps the constitution v1.2.0 → v1.3.0 with rationale.

### Key Entities *(include if feature involves data)*

- **Ownership classification**: the three-way model governing every lifecycle. **Tooling** (regenerable from the package: scripts, templates, agent skills/context-sections, `agents.json`, intake manifest/ignore, the constitution) is removed on plain uninstall. **User content** (the user's intellectual property: `specs/`, `.spec/absorbed/`) is preserved unless `--force`. **Read-only sources** (the user's original documents under `docs/`, root `*.md`, etc.) are never moved/renamed/deleted by any command.
- **Preserved user-content set**: `{ specs/, .spec/absorbed/ }` — the only paths that survive a plain uninstall; defined once and consumed by `uninstall` (FR-005).
- **Installed-agent state (`.spec/agents.json`)**: tooling-state recording which agents are installed and their provenance. `init` must not clobber an existing instance (FR-001); it is regenerable via `reconcileFromFs` only when absent.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: After `agents add claude` followed by a second `runInit`, `.spec/agents.json` still records `claude` (not `{}`); `ensureState` reflects the on-disk binding. On a fresh dir, `agents.json` is created as `{ agents: {} }`.
- **SC-002**: A confirmed plain `uninstall` removes `.spec/memory/constitution.md` plus all `.spec/` tooling and PRESERVES `specs/` + `.spec/absorbed/`; a confirmed `--force` uninstall also removes `specs/` + `.spec/absorbed/`.
- **SC-003**: `runInit` in a project with existing `specs/` emits an acknowledgment of ≥1 existing spec and leaves existing specs byte-unchanged; with no `specs/`, output is unchanged.
- **SC-004**: The preservation boundary is stated exactly once and consumed by `uninstall` (no divergent duplicate infra/user lists); `.spec/memory` is in the removed-tooling set, not the preserved set.
- **SC-005**: The full mechanical suite passes headlessly with tests updated to the NEW behavior (RED-first for US1/US2/US3 — this is a behavior change, not a pure refactor; the "call-argument-only" exception from spec 006 does NOT apply).
- **SC-006**: No new dependency; constitution amended v1.2.0 → v1.3.0; `package.json` version `2.1.1 → 2.2.0`.

## Assumptions

- **Versioning — MINOR 2.1.1 → 2.2.0**: this spec changes observable `init`/`uninstall` behavior and includes a constitution amendment (installed-content change). It is NOT MAJOR (the installed file structure `init` creates is unchanged — no path added/removed/moved under `init`), and NOT PATCH (behavior + amendment change, not a no-contract fix).
- **Constitution amendment v1.2.0 → v1.3.0 is clarifying and non-breaking**: it codifies an ownership model and an uninstall preservation set; it adds no new principle and removes none. Amendment propagation (re-reading `.spec/templates/plan-template.md`'s Constitution Check and any skill embedding principle wording, per the spec-constitution amendment checklist) is handled at implement time.
- **This is a behavior change, so RED-first TDD applies** (unlike spec 006's refactor): new failing tests MUST be written first for (a) re-init preserving `agents.json`, (b) plain uninstall removing the constitution while preserving `specs/`+`.spec/absorbed/`, and (c) `init` acknowledging existing specs. Existing tests asserting the OLD constitution-preserved behavior (`corpus-uninstall.test.ts`) are updated to assert the NEW behavior — these are behavior-reflecting edits, not mechanical call-arg updates.
- **Verification is headless**: per project memory, `npm test` is AI-driven/non-headless; evidence comes from `tests/units/*.test.ts` (`node:assert`) + `npx tsx src/cli.ts` smokes.
- **intake ignore-list stays tooling**: `.spec/intake/ignore.json` remains in the removed-on-plain-uninstall set (current behavior, now deliberately confirmed as consistent with the constitution-as-tooling decision). Losing ignore curation on uninstall is accepted.
- **`.spec/absorbed/` stays user-content**: preserved on plain uninstall (deliberate absorb action; sources untouched).
- **Non-goals**: externalizing `<!-- SDD STATE -->` out of `constitution.md` into a dedicated infra file (a real behavior change deserving its own spec); changing `intake` discovery scope; revisiting agent-binding precise deletion (settled in spec 004); changing what `update` touches; mirroring the ownership model into `constitution-template.md` for all projects (a plan-level open question — the model is codified in spec-coach's own constitution as the source of truth this round).
