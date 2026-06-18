# Tasks: Derived Workflow State (Eliminate the Stored-State Subsystem)

**Input**: Design documents from `/specs/008-derived-workflow-state/` (spec.md approved, plan.md ready — 13 components C1–C13, 15 FRs).

**Prerequisites**: plan.md (required), spec.md (required).

**Tests**: Included — this is a behavior change, so **RED-first TDD applies** (spec Assumptions). New behavior tasks write a failing test in `tests/units/workflow-state.test.ts`, then implement. Removal/reform tasks verify via suite-green + bash script smokes.

**Organization**: Foundational resolver/helpers first (shared by all stories), then each user story, then teardown (US3), then polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story (US1/US2/US3); foundational tasks are untagged (shared)
- Exact file paths + verification + dependencies in each task

## Test Harness (applies to every task)

- New file `tests/units/workflow-state.test.ts` uses `node:assert/strict` + `node:child_process` `execSync`. It drives Bash in a `mkdtemp` repo: either `bash scripts/bash/show-sdd-state.sh [token]` end-to-end, or `bash -c 'source scripts/bash/common.sh; <fn> …'` to unit-test a function. Asserts `stdout` substrings + exit code.
- Run a single test: `npx tsx tests/units/workflow-state.test.ts`.
- Run the full headless suite: `for f in tests/units/*.test.ts; do npx tsx "$f" || echo "FAIL $f"; done`.
- `npm test` is AI-driven/non-headless — NOT the gate (project memory).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Version skeleton + branch.

- [x] T001 [P] Bump `package.json` version `2.2.1 → 2.3.0` (version skeleton; CHANGELOG finalized in T013). Create the feature branch `008-derived-workflow-state` from `main` if not already on it.
  - **Files**: `package.json`.
  - **Verify**: `node -e "console.log(require('./package.json').version)"` → `2.3.0`.
  - **Deps**: none.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The single feature resolver + helpers in `scripts/bash/common.sh`. Every user story consumes these.

**⚠️ CRITICAL**: US1/US2/US3 cannot begin until `resolve_feature` (T002) exists; the reporter (US1) needs `infer_phase` (T003); resume (US2) needs `first_pending_task` (T004); the 4 skill-wrapper callers are fixed by `get_feature_paths` reform (T005).

- [x] T002 Create `resolve_feature()` in `scripts/bash/common.sh`. **RED-first**: create `tests/units/workflow-state.test.ts` with failing cases — (a) explicit token `007` → `specs/007-*/`; (b) `@` → parses leading `\d{3}` from `git branch --show-current` → `specs/<NNN>-*/`; (c) no token **soft** → most-recently-modified `specs/NNN-*/`; (d) no `specs/` → empty; (e) a legacy `.spec/feature.json` present is **ignored** (derivation wins); (f) **strict** (`--strict`) with multiple features + no token → empty (NO guess); (g) **strict** with exactly one feature → resolves it. Signature: `resolve_feature [--strict] [token]` echoes the absolute feature dir or empty; never errors. Soft precedence: explicit token (incl. `@`) > `SPECIFY_FEATURE`/`SPECIFY_FEATURE_DIRECTORY` env > mtime-newest > none; **strict** replaces the mtime tier with single-candidate-only (analysis C1).
  - **Files**: `scripts/bash/common.sh` (add), `tests/units/workflow-state.test.ts` (create).
  - **Verify**: `npx tsx tests/units/workflow-state.test.ts` → cases pass; confirm they FAILED before the function existed.
  - **Deps**: none.

- [x] T003 Create `infer_phase()` in `scripts/bash/common.sh`. **RED-first**: add failing cases — `analysis.md`→`analyze`, `tasks.md`→`tasks`, `plan.md`→`plan`, `spec.md`→`specify`, none→`constitution`. Signature: `infer_phase <feature_dir>` echoes the phase. (Extracted from `show-sdd-state.sh`'s existing if/elif.)
  - **Files**: `scripts/bash/common.sh` (add), `tests/units/workflow-state.test.ts` (add cases).
  - **Verify**: `npx tsx tests/units/workflow-state.test.ts` → pass.
  - **Deps**: T002 (same file; sequential).

- [x] T004 Create `first_pending_task()` in `scripts/bash/common.sh`. **RED-first**: add failing cases — (a) first `- [ ]` (not `- [x]`) in `tasks.md` → its line/id; (b) all `[x]` → `no pending task`; (c) no `tasks.md` → `no tasks.md yet`. Signature: `first_pending_task <feature_dir>` echoes the task or a status string.
  - **Files**: `scripts/bash/common.sh` (add), `tests/units/workflow-state.test.ts` (add cases).
  - **Verify**: `npx tsx tests/units/workflow-state.test.ts` → pass.
  - **Deps**: T003 (same file; sequential).

- [ ] T005 Reform `get_feature_paths()` in `scripts/bash/common.sh` to resolve via `resolve_feature --strict` (drop the `SPECIFY_FEATURE_DIRECTORY`/`feature.json` tier; keep emitting `REPO_ROOT`/`FEATURE_DIR`/`FEATURE_SPEC`/`IMPL_PLAN`/`TASKS`/`RESEARCH`/`DATA_MODEL`/`QUICKSTART`/`CONTRACTS_DIR`; keep error-when-unresolvable). Accept an optional token forwarded to `resolve_feature`. **Strict** = resolves on explicit token/env OR single feature; errors (non-zero) on multiple features with no explicit input — never silently mtime-picks (prevents wrong-feature writes; analysis C1).
  - **Files**: `scripts/bash/common.sh` (edit `get_feature_paths`).
  - **Verify**: smoke the 4 callers in a tmp repo — with ONE feature, `setup-plan.sh`/`setup-tasks.sh`/`check-prerequisites.sh`/`verify-spec.sh` resolve it and `exit 0`; with MULTIPLE features and no `SPECIFY_FEATURE`/token, the writing wrappers (`setup-plan`/`setup-tasks`) ERROR non-zero (no guess); with `SPECIFY_FEATURE` set, they resolve the named feature. Full headless suite green.
  - **Deps**: T002.

**Checkpoint**: Resolver + helpers ready. The 4 skill-wrapper callers resolve via derived state. US1/US2/US3 can proceed.

---

## Phase 3: User Story 1 - Drift-free "where am I?" report (Priority: P1) 🎯 MVP

**Goal**: `show-sdd-state.sh` reports the current feature + phase + decision pointers, derived purely from artifacts — no `feature.json`, no SDD STATE block — so it can never be stale.

**Independent Test**: In a tmp repo with `specs/007-x/{spec,plan,tasks}.md` and NO `.spec/feature.json` and NO SDD STATE block, `bash scripts/bash/show-sdd-state.sh 007` prints feature `007-x`, phase `tasks`, and a decisions pointer; mutates nothing; exits 0.

### Implementation for User Story 1

- [ ] T006 [US1] Rewrite `scripts/bash/show-sdd-state.sh` as a pure read-only reporter: feature via `resolve_feature "$@"`, phase via `infer_phase`, decisions as a pointer to `spec.md`/`CHANGELOG.md` (+ optional `specs/NNN/decisions.md` if present). On "none" → print "no current feature"; on ambiguity (multiple candidates, no token) → list each with phase + mtime. Remove ALL `feature.json`/SDD STATE block reads. **Never mutate** (assert contents + mtimes unchanged across an invocation); always `exit 0`. **RED-first**: add failing cases — (a) correct feature+phase with NO state file; (b) no-arg mtime default; (c) `@` resolves branch→feature; (d) ambiguity lists candidates; (e) read-only (no mutation, exit 0).
  - **Files**: `scripts/bash/show-sdd-state.sh` (rewrite), `tests/units/workflow-state.test.ts` (add cases).
  - **Verify**: `npx tsx tests/units/workflow-state.test.ts` → pass; `bash scripts/bash/show-sdd-state.sh` on this repo reports `008-derived-workflow-state` + phase `tasks` without reading any state file.
  - **Deps**: T002, T003.

**Checkpoint**: US1 functional — a correct, drift-free "where am I" report, independently testable.

---

## Phase 4: User Story 2 - Resume continues from artifacts (Priority: P1)

**Goal**: After an interruption, the report identifies the resume breakpoint (first unchecked task) from artifacts — no stored "last position."

**Independent Test**: `specs/008-y/tasks.md` with T001/T002 `[x]` and T003 `[ ]` → resume reports T003 (first unchecked); all-checked → "no pending task"; no tasks.md → "no tasks.md yet."

### Implementation for User Story 2

- [ ] T007 [US2] Wire `first_pending_task()` into `show-sdd-state.sh`'s output as a resume/breakpoint line (e.g. "Resume at: <task>" / "no pending task" / "no tasks.md yet"). Feature resolution reuses `resolve_feature` (FR-008) — no stored pointer. **RED-first**: add failing cases — (a) first unchecked reported; (b) all-checked → no pending; (c) no tasks.md → status; (d) `@`/explicit token selects the feature.
  - **Files**: `scripts/bash/show-sdd-state.sh` (edit), `tests/units/workflow-state.test.ts` (add cases).
  - **Verify**: `npx tsx tests/units/workflow-state.test.ts` → pass.
  - **Deps**: T004, T006.

**Checkpoint**: US2 functional — resume works from artifacts alone. US1 + US2 both independently testable.

---

## Phase 5: User Story 3 - Teardown without regression (Priority: P2)

**Goal**: Remove the stored-state subsystem; retarget remaining consumers; tolerate legacy instances. No command regresses.

**Independent Test**: `create-new-feature.sh` writes NO `.spec/feature.json`; `verify-spec.sh` (no args) still resolves a spec when one feature is unambiguous; a legacy `feature.json` + SDD STATE block are ignored (no crash, derivation wins).

### Implementation for User Story 3

- [ ] T008 [P] [US3] Remove the `_persist_feature_json "$REPO_ROOT" "$FEATURE_DIR"` call (~line 262) from `scripts/bash/create-new-feature.sh`. Keep branch creation + the `# To persist: export SPECIFY_FEATURE=…` hint (env remains the override channel).
  - **Files**: `scripts/bash/create-new-feature.sh` (edit).
  - **Verify**: run `create-new-feature.sh` (dry-run if available) in a tmp repo → no `.spec/feature.json` written; feature dir + export hint still produced.
  - **Deps**: none (independent file).

- [ ] T009 [US3] Delete dead functions from `scripts/bash/common.sh`: `read_feature_json_feature_directory` and `_persist_feature_json` (zero callers after T005 + T006 + T008). Reduce `get_current_branch()` to honoring `SPECIFY_FEATURE` only, or remove it if `resolve_feature` subsumes it (verify no remaining caller).
  - **Files**: `scripts/bash/common.sh` (edit).
  - **Verify**: `grep -rn 'read_feature_json_feature_directory\|_persist_feature_json' scripts/ src/ skills/` → no references; full headless suite green; `bash scripts/bash/show-sdd-state.sh` still works.
  - **Deps**: T005, T006, T008 (all callers gone first).

- [ ] T010 [P] [US3] Retarget doc/help text that references the old state model: `scripts/bash/verify-spec.sh` (no-arg resolution already fixed by T005 — update the `# no args → … via .spec/feature.json` comment + `--help` text) and `src/utils.ts:333` (Workflow State line → "state is derived from artifacts; run `show-sdd-state.sh [feature|@]`; no state file").
  - **Files**: `scripts/bash/verify-spec.sh` (edit text), `src/utils.ts` (edit line ~333).
  - **Verify**: `bash scripts/bash/verify-spec.sh --help` shows derived wording; `grep -n 'feature.json' scripts/bash/verify-spec.sh src/utils.ts` → none.
  - **Deps**: T005 (verify-spec behavior already correct).

- [ ] T011 [P] [US3] Remove step 5 "Initialize SDD State" (the `<!-- SDD STATE START -->…END -->` append) from `skills/constitution.md`; renumber subsequent steps.
  - **Files**: `skills/constitution.md` (edit).
  - **Verify**: `grep -n 'SDD STATE' skills/constitution.md` → none; step numbering contiguous.
  - **Deps**: none (independent file).

- [ ] T012 [P] [US3] Amend `.spec/memory/constitution.md`: remove the `<!-- SDD STATE START -->…END -->` block; under Development Constraints add a clause — "Workflow state is derived read-only from `specs/NNN/` artifacts; no command writes a workflow-state file; `show-sdd-state.sh` is a non-driving reporter; the current feature resolves by explicit token / `SPECIFY_FEATURE` override / opt-in `@` / mtime default." Bump footer `v1.3.0 → v1.4.0`, Last Amended `2026-06-18`. (`constitution-template.md` unchanged — it has no block.)
  - **Files**: `.spec/memory/constitution.md` (edit).
  - **Verify**: `grep -n 'SDD STATE' .spec/memory/constitution.md` → none; footer reads `Version: 1.4.0`.
  - **Deps**: none (independent file).

**Checkpoint**: US3 complete — the stored-state subsystem is gone; consumers retargeted; legacy tolerated. All three stories independently functional.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Finalize version, full-suite verification, straggler cleanup.

- [ ] T013 [P] Write the `## 2.3.0` entry in `CHANGELOG.md` (derived workflow state; removed `feature.json`/SDD STATE subsystem; added opt-in `@`; `show-sdd-state.sh` is now a read-only reporter; constitution v1.4.0). Confirm `package.json` is `2.3.0` (from T001).
  - **Files**: `CHANGELOG.md` (edit).
  - **Verify**: `CHANGELOG.md` has a `## 2.3.0 — 2026-06-18` section.
  - **Deps**: T001.

- [ ] T014 Run the full headless suite (`for f in tests/units/*.test.ts; do npx tsx "$f"; done`) — all green. Add bash/CLI smokes: `show-sdd-state.sh` on this repo (reports `008` + phase `tasks`, no mutation, exit 0); `show-sdd-state.sh @` (resolves via branch); `create-new-feature.sh` (no feature.json). Remove/fix any straggler test that still writes/asserts `.spec/feature.json` or the SDD STATE block.
  - **Files**: any straggler `tests/units/*.test.ts`; smokes are run, not committed (or noted in the commit body).
  - **Verify**: full suite green; smokes pass; `grep -rn 'feature.json\|SDD STATE' tests/ src/ scripts/ skills/` shows only intentional references.
  - **Deps**: all prior tasks.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: no dependencies — start immediately (T001 [P]).
- **Foundational (Phase 2)**: T002 first; T003→T004 sequential (same file `common.sh`); T005 after T002. **BLOCKS all user stories** (the resolver is consumed everywhere).
- **User Stories (Phase 3–5)**: US1 (T006) after T002+T003; US2 (T007) after T004+T006; US3 (T008–T012) — T008 [P] anytime, T009 after T005+T006+T008, T010/T011/T012 [P] anytime after their noted deps.
- **Polish (Phase 6)**: after all implementation.

### User Story Dependencies

- **US1 (P1)**: after Foundational (T002, T003). No cross-story deps.
- **US2 (P1)**: after US1's reporter (T006) + T004. Independently testable.
- **US3 (P2)**: T009 depends on T005+T006+T008 (dead-fn callers gone); T010/T011/T012 independent. Independently testable.

### Parallel Opportunities ([P])

- T001 (version), T008 (create-new-feature teardown), T010 (doc text), T011 (skill step), T012 (constitution) — all different files, no mutual deps.
- Within US3: T010/T011/T012 can run together; T008 parallel with them; only T009 is sequenced (waits on caller removal).
- NOTE: T002/T003/T004/T005 all edit `scripts/bash/common.sh` → **sequential despite logical independence** (same-file conflict). T006/T007 both edit `show-sdd-state.sh` → sequential.

---

## Implementation Strategy

### MVP First (Foundational + US1)

1. T001 → T002 → T003 → T004 → T005 (resolver闭环).
2. T006 (US1: drift-free report).
3. **STOP and VALIDATE**: `show-sdd-state.sh` reports correct feature+phase with no state file — the headline value and reliability thesis are demonstrable here.

### Incremental Delivery

1. Foundational (T002–T005) → resolver works, 4 callers fixed.
2. + US1 (T006) → drift-free report (MVP).
3. + US2 (T007) → resume from artifacts.
4. + US3 (T008–T012) → subsystem torn down, consumers retargeted, amendment.
5. + Polish (T013–T014) → versioned, full suite green.

### Single-implementer note

This is dogfooded on spec-coach itself by one implementer; treat [P] as "logically independent / safe to reorder," not as literal concurrency. Honor the same-file sequencing (common.sh: T002→T003→T004→T005; show-sdd-state.sh: T006→T007) and the caller-removal gate (T009 after T005+T006+T008).

---

## Notes

- RED-first for: T002, T003, T004, T006, T007 (new behavior). Suite-green + smoke for: T005, T008, T009, T010, T011, T012 (reforms/removals).
- One commit per task. Commit message ends with `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Verification is headless (`tests/units/*.test.ts` via `npx tsx` + bash smokes); `npm test` is not the gate.
- File-safety order is encoded above: `common.sh` resolver → reform `get_feature_paths` → rewrite `show` → teardown importers → delete dead fns → skill/constitution → version → full-suite.
