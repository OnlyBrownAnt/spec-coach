# Tasks: Configurable Commit Convention

**Input**: Design documents from `/specs/010-commit-convention/` (spec.md `2e25ef4`, plan.md `6e3a487`).

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: REQUIRED for this feature (spec-coach Constitution V — verify what ships; spec SC-001…SC-005). Behavioral tasks are RED-first (write the failing test, watch it fail, then implement). The skill/template-prose tasks use content-assertion tests (read the shipped source, assert guidance substrings); the constitution/dogfood task is a content (judgment) task verified by content assertion. `npm test` is AI-driven/non-headless and is NOT the gate; the gate is `npx tsx tests/units/commit-convention.test.ts` + the existing `tests/units/*.test.ts` suite (no regressions) + bash/CLI smokes.

**Organization**: Tasks grouped by user story. US1's source-of-truth core (template + installer + init wiring) is **foundational** — it BLOCKS US2/US3/US4, which all read/reference `.spec/convention.md`; US1's IP-preservation (preserve on uninstall) is its user-story completion in Phase 3.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 / infra
- Each task: exact file(s) + verification + dependency → one commit.

## Path Conventions

Single project: `templates/` (package source), `scripts/bash/` (package source for the advisor), `src/`, `skills/`, `.spec/` (installed artifacts), `.claude/skills/` (installed agent copy), `tests/units/`.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Release-version skeleton (matches the spec 008/009 T001 convention — bump early, finalize CHANGELOG last).

- [x] **T001** `[P]` `[infra]` Bump `package.json` version `2.4.0` → `2.5.0` (MINOR; new `convention-template` + new `verify-commit.sh` = install-contract expansion, additive; `update` not broken).
  - **File**: `package.json`.
  - **Verify**: `node -e "console.log(require('./package.json').version)"` → `2.5.0`.
  - **Depends on**: nothing.

**Checkpoint**: Dev version set; behavioral work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The convention source-of-truth subsystem (US1's core) — a seeded, never-clobbered `.spec/convention.md`. BOTH the advisor (US3) and the skills (US2) and the dogfood authoring (US4) read/reference it.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete — US2/US3/US4 all need `.spec/convention.md` to exist and be seedable.

- [x] **T002** `[foundational]` Create the convention source + installer. (a) New `templates/convention-template.md` — Conventional Commits default (`type(scope): subject` + optional `Task: Txxx` footer that folds spec-coach's task ID in), a human-readable explanation + customization guide, a machine-readable rules block `<!-- CONVENTION RULES START … allowed_types: feat fix docs refactor test chore / scope_required: false / task_id_footer: optional … CONVENTION RULES END -->`, and signature tokens `[PROJECT_NAME]` / `[ALLOWED_TYPES]` / `[SCOPE_FORMAT]` marking the TEMPLATE state. (b) `src/utils.ts`: add `"convention-template"` to `TEMPLATE_NAMES` (so `installDocumentTemplates` ships `.spec/templates/convention-template.md`); add `installConventionToMemory(projectRoot): boolean` mirroring `installConstitutionToMemory` exactly (`templateSource("convention-template")` → ensureDir `.spec` → dest `.spec/convention.md` → `if (fs.existsSync(dest)) return false` never-clobber → copy). (c) `src/commands/init.ts`: call `installConventionToMemory(projectRoot)` in `runInit` after the constitution (step 3b); add a convention line to `printNextSteps`. (d) **RED-first** tests in `tests/units/commit-convention.test.ts` (new file): `runInit` seeds `.spec/convention.md` (exists after init); `runInit` over an AUTHORED `.spec/convention.md` preserves it byte-for-byte (never-clobber lock).
  - **Files**: `templates/convention-template.md` (create); `src/utils.ts` (edit); `src/commands/init.ts` (edit); `tests/units/commit-convention.test.ts` (create).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` (RED before edit → GREEN after); `node -e "console.log(require('./package.json').version)"` unaffected.
  - **Depends on**: nothing (base layer).

**Checkpoint**: `.spec/convention.md` is seeded by `init` and never clobbered; US2/US3/US4 can build on it.

---

## Phase 3: User Story 1 - Single source of truth, owned & preserved (Priority: P1) 🎯 MVP

**Goal**: An AUTHORED `.spec/convention.md` is project IP — `uninstall` preserves it (like the authored constitution); only `--force`/purge or a never-authored TEMPLATE removes it. Completes US1 (Phase 2 gave "source exists + owned + seeded"; this gives "preserved as IP").

**Independent Test**: TS in `mkdtemp` — after plain `uninstall --yes` on a repo with an AUTHORED `.spec/convention.md`, the file survives; with a TEMPLATE convention, it is removed; `--force` removes everything.

### Implementation for User Story 1

- [x] **T003** `[US1]` Make `uninstall` status-aware for the convention in `src/commands/uninstall.ts` (FR-001 charter-as-IP extension): add `isAuthoredConvention(p)` mirroring `isAuthoredConstitution` (signature-token test for `[PROJECT_NAME]`/`[ALLOWED_TYPES]`/`[SCOPE_FORMAT]`); add a step 2c after the memory handling — preserve an AUTHORED `.spec/convention.md` on plain uninstall; remove it on purge or when still TEMPLATE. **RED-first** tests in `tests/units/commit-convention.test.ts`: AUTHORED preserved on plain uninstall; TEMPLATE removed on plain uninstall; both removed on `--force`.
  - **Files**: `src/commands/uninstall.ts` (edit); `tests/units/commit-convention.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` GREEN (RED before edit); existing `tests/units/constitution-charter.test.ts` + `corpus-uninstall.test.ts` still GREEN (no regression in constitution/memory handling).
  - **Depends on**: T002 (init must seed `.spec/convention.md` for the test fixtures). **[P]** with T004/T005 (different file: `uninstall.ts`).

**Checkpoint**: The authored convention survives uninstall; US1 delivered (source + owned + preserved).

---

## Phase 4: User Story 2 - The workflow coaches conforming commits (Priority: P2)

**Goal**: The commit-producing skills coach Conventional Commits with the task ID folded in — no more bare `Txxx:`-first commits produced by the tool itself.

**Independent Test**: Content-assertion that `skills/implement.md` coaches `type(scope): subject` + `Task:` footer + references `.spec/convention.md`, and no longer coaches "Commit with the task ID" as the format.

### Implementation for User Story 2

- [x] **T004** `[US2]` Rewrite the commit coaching. (a) `skills/implement.md` COMMIT step (currently *"Commit with the task ID and a clear description. One commit per task — no bundling."*, line ~136-138): replace with convention-aware coaching — the canonical form `type(scope): subject` with an optional `Task: Txxx` footer, the allowed types (`feat fix docs refactor test chore`), a pointer to `.spec/convention.md` as the source of truth, and "coach the shipped default when convention.md is ABSENT/TEMPLATE"; keep "one commit per task — no bundling". (b) `.spec/templates/tasks-template.md` line ~250 ("Commit after each task or logical group"): make it convention-aware ("Commit each task as `type(scope): subject` with a `Task: Txxx` footer per `.spec/convention.md`"). (c) Regenerate the installed `.claude/skills/spec-implement/SKILL.md` via `npx tsx src/cli.ts agents update` (re-installs all skills from source). (d) **Content-assertion** tests in `tests/units/commit-convention.test.ts`: read `skills/implement.md`, assert the conventional form + `Task:` footer + `convention.md` reference are present AND the bare "Commit with the task ID" line is gone; read `tasks-template.md`, assert the convention-aware commit line.
  - **Files**: `skills/implement.md` (edit); `.spec/templates/tasks-template.md` (edit); `.claude/skills/spec-implement/SKILL.md` (regenerate); `tests/units/commit-convention.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` GREEN; `diff` confirms the installed `SKILL.md` body matches the edited source.
  - **Depends on**: T002 (the coaching references `.spec/convention.md`, which the seed makes real). **[P]** with T003/T005 (different files: the skill + tasks-template).

**Checkpoint**: `/spec-implement` coaches conforming commits; US2 delivered.

---

## Phase 5: User Story 3 - A non-blocking compliance advisor (Priority: P3)

**Goal**: `verify-commit.sh` reports whether HEAD conforms to the declared convention — always exits 0 (Coach-Not-Gatekeeper), skips merges, honors a custom type set.

**Independent Test**: `execSync` `verify-commit.sh` in a `mkdtemp` git repo against crafted commits — conforming `feat(x): y` → reported conforming; `T001: foo` → flagged; a merge commit → skipped; no convention → reports ABSENT + coaches the default; always exit 0.

### Implementation for User Story 3

- [x] **T005** `[US3]` Create `.spec/scripts/bash/verify-commit.sh`'s source at `scripts/bash/verify-commit.sh` (installed by `installScripts`). Mirror `verify-constitution-sync.sh` / `verify-spec.sh`: `#!/usr/bin/env bash`, resolve `SCRIPT_DIR`, `source common.sh`, `get_repo_root`, `--help`, **always `exit 0`**. Behavior: (1) report convention status `ABSENT` (no `.spec/convention.md`) / `TEMPLATE` (signature tokens present) / `AUTHORED`; (2) read the subject of HEAD (or a rev-range arg) via `git log -1 --format=%s` — **skip merge commits only** (parents > 1 via `git rev-list --merges`); (3) parse the convention's `allowed_types` line (default `feat fix docs refactor test chore` when TEMPLATE/absent); (4) check the subject matches `^(type)(\(.+\))?(!)?: .+` with type ∈ allowed set; (5) report CONFORMING or flag the violation with the rule. It recognizes (does not mandate) the optional `Task:` footer. **RED-first** tests in `tests/units/commit-convention.test.ts` via `execSync` in `mkdtemp` git repos: `feat(x): y` → conforming; `T001: foo` → flagged; merge commit (`git merge --no-ff`) → skipped; ABSENT convention → reports ABSENT + coaches default; TEMPLATE convention → reports TEMPLATE; every case exit 0.
  - **Files**: `scripts/bash/verify-commit.sh` (create; installed copy `.spec/scripts/bash/verify-commit.sh` via `installScripts`); `tests/units/commit-convention.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` GREEN (RED before the script exists); `bash scripts/bash/verify-commit.sh --help` prints usage, exit 0.
  - **Depends on**: T002 (the advisor reads `.spec/convention.md`'s rules block + status). **[P]** with T003/T004 (different file: the advisor script).

**Checkpoint**: Commit-convention compliance is machine-checkable and non-blocking; US3 delivered.

---

## Phase 6: User Story 4 - Dogfood: ship spec-coach's own convention + fix the constitution hole (Priority: P4)

**Goal**: spec-coach ships its OWN authored `.spec/convention.md`, and the constitution's Runtime-guidance clause delegates commit style to it (filling the empty-`CLAUDE.md` hole).

**Independent Test**: `verify-constitution-sync.sh` reports CLEAN on the amended constitution; content-assertion that `.spec/convention.md` is AUTHORED and the constitution's Runtime-guidance clause references `.spec/convention.md`.

### Implementation for User Story 4

- [ ] **T006** `[US4]` (a) Author `.spec/convention.md` for spec-coach (cold-start from the T002 template, then ratify): allowed types `feat fix docs refactor test chore`, scope `spec-NNN` (feature slug) or component, `Task: Txxx` footer, NO signature tokens (= AUTHORED). (b) Amend `.spec/memory/constitution.md`'s Runtime-guidance clause (currently: all runtime guidance → `CLAUDE.md`) to: runtime guidance (linting, local setup) lives in `CLAUDE.md`; **commit convention lives in `.spec/convention.md`**. Bump the footer **v1.5.0 → v1.6.0** (the clause materially expands to reference a new governance artifact = MINOR per the constitution-doc semver). (c) **Content-assertion** tests in `tests/units/commit-convention.test.ts`: `.spec/convention.md` has no signature tokens (AUTHORED); the constitution body references `.spec/convention.md` for commit style; the constitution footer is `v1.6.0`; `bash .spec/scripts/bash/verify-constitution-sync.sh` reports CLEAN (no pending amendment block). This is a **content (judgment) task, not TDD** — verified by content assertion + the advisor.
  - **Files**: `.spec/convention.md` (create); `.spec/memory/constitution.md` (edit); `tests/units/commit-convention.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` GREEN; `bash .spec/scripts/bash/verify-constitution-sync.sh` → CLEAN; `bash .spec/scripts/bash/verify-spec.sh specs/010-commit-convention/spec.md` CLEAN.
  - **Depends on**: T002 (the template to author from) + T004 (the skills now point at `.spec/convention.md` — the dogfood closes the loop).

**Checkpoint**: spec-coach's own convention is authored and the constitution is accurate; US4 delivered.

---

## Phase 7: Polish & Cross-Cutting Concerns

**Purpose**: The FR-005 state-boundary guardrail (cross-cutting) + release finalization.

- [x] **T007** `[P]` `[infra]` Add the **FR-005 state-boundary guardrail** test to `tests/units/commit-convention.test.ts`: grep `scripts/bash/common.sh` and assert the four state functions — `resolve_feature`, `infer_phase`, `first_pending_task`, `get_feature_paths` — do NOT parse `git log` commit subjects to derive feature/phase/progress (the spec 008 boundary). Scope the assertion to those four functions so it does NOT false-positive on `verify-commit.sh`'s legitimate `git log` (which checks FORMAT, never feeds a state function). Baseline confirmed: no such inference exists today — this locks it as the invariant. No logic change.
  - **Files**: `tests/units/commit-convention.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/commit-convention.test.ts` GREEN.
  - **Depends on**: nothing (test-only, fully independent — `[P]`, can run anytime after T002 creates the test file).

- [ ] **T008** `[infra]` Finalize release: add the **CHANGELOG.md** `2.5.0` entry (configurable commit convention: convention source + installer + never-clobber + status-aware uninstall preserve, conforming skill coaching, `verify-commit.sh` advisor, dogfood convention + constitution amendment v1.6.0, FR-005 guardrail). Run the **full headless suite** (`npx tsx tests/units/*.test.ts`) + smokes (`bash .spec/scripts/bash/verify-commit.sh`; `bash .spec/scripts/bash/verify-constitution-sync.sh`; `npx tsx src/cli.ts --help`). Confirm 0 failures.
  - **Files**: `CHANGELOG.md` (edit).
  - **Verify**: full `tests/units/*.test.ts` suite GREEN (paste the `=== Results: N passed, 0 failed ===` lines); CLI/help/advisor smokes clean.
  - **Depends on**: all prior tasks.

**Checkpoint**: Release-ready; all FRs and SCs met.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: no deps — start immediately.
- **Foundational (T002)**: no deps — BLOCKS all user-story work (US2/US3/US4 read/reference `.spec/convention.md`).
- **US1 (T003)**: blocked by T002 (init must seed the convention for fixtures); **[P]** with T004/T005.
- **US2 (T004)**: blocked by T002; **[P]** with T003/T005.
- **US3 (T005)**: blocked by T002; **[P]** with T003/T004.
- **US4 (T006)**: blocked by T002 (template) + T004 (skills reference convention.md).
- **Polish (T007, T008)**: T007 independent `[P]` (test-only); T008 last (depends on all).

### Parallel Opportunities

- **T001** `[P]` (version skeleton — different file from everything).
- **T003 / T004 / T005** are mutually **[P]** after T002 (different files: `uninstall.ts` / `skills/implement.md`+`tasks-template.md` / `verify-commit.sh`).
- **T007** `[P]` (guardrail test — independent of all behavioral tasks).

### Critical (Serial) Path

`T001 → T002 → T004 → T006 → T008` (with T003, T005, T007 riding in parallel off T002).

---

## Implementation Strategy

### MVP First (US1 source + US2 skills)

1. T001 (version) + T002 (convention source + installer) — foundation.
2. T004 (skill coaching rewrite) — the tool stops producing `Txxx:`-first commits.
3. **STOP and VALIDATE**: content-assertion tests GREEN; `init` seeds + never-clobbers `.spec/convention.md`. The core value (single source of truth + conforming coaching) is delivered here.

### Incremental Delivery

1. Foundation (T001, T002) → convention source ready.
2. US2 (T004) → conforming skill coaching. **Validate.**
3. US1 (T003, parallel) → preserve-on-uninstall. **Validate.**
4. US3 (T005, parallel) → `verify-commit.sh` advisor. **Validate.**
5. US4 (T006) → dogfood convention + constitution amendment. **Validate.**
6. Polish (T007 parallel, T008 final) → FR-005 guardrail + release finalized.

### Notes

- Behavioral tasks (T002, T003, T005) are **RED-first**; the skill/template-prose task (T004) and the content task (T006) use **content-assertion** verification; T007 is a **grep guardrail**; T008 is **suite-green + smoke**. (Principle V — verify what ships.)
- `npm test` is non-headless and is NOT the gate; verify via `npx tsx tests/units/*.test.ts` + bash/CLI smokes.
- One commit per task, message ending `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>` — and each commit itself follows the new convention (`docs(spec-010): …` / `feat(spec-010): …`), dogfooding from the first task.
- Watch for regressions: T003 must not change constitution/`memory` handling (only adds convention handling); T004's `agents update` regenerates ALL skills — confirm only `spec-implement` changed materially.
- Dogfood: this feature changes spec-coach's own template, utils, init, uninstall, advisor set, skills, constitution, and ships its own `.spec/convention.md`.
