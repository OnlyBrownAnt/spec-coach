# Tasks: Test Harness Reliability

**Input**: Design documents from `/specs/012-test-harness-reliability/` (spec.md, plan.md)

**Prerequisites**: plan.md ✅, spec.md ✅ (user stories US1/US2/US3)

**Tests**: Included test-first (TDD) per Constitution Principle V — each story writes failing mechanical tests in `tests/units/harness-timeout.test.ts` before its implementation task.

**Organization**: Tasks grouped by user story. Each task = one commit, names a specific file, a **Verify** step, and a **Depends** annotation.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Parallelizable with siblings (different files, no mutual dependency)
- **[Story]**: US1 (P1, kill-the-tree), US2 (P2, functional `--timeout`), US3 (P3, preserve+retry)
- Every task lists **File**, **Verify**, **Depends**

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Branch + zero-dependency baseline. No package install (Constitution Principle III — perl/bash are platform prerequisites).

- [ ] **T001** Create feature branch `012-test-harness-reliability` off `main`.
  - **File**: — (git)
  - **Verify**: `git branch --show-current` prints `012-test-harness-reliability`.
  - **Depends**: none.

---

## Phase 2: Foundational / User Story 1 — Kill the whole process tree (Priority: P1) 🎯 MVP

**Goal**: A `_timeout` that terminates the **entire** `claude` process tree (wrapper + claude + all descendants) at the budget, with 10s TERM→KILL grace, returning `124` on timeout. Used uniformly (no `gtimeout`). This is the blocking prerequisite — every call path runs through it — and it delivers US1.

**Independent Test**: Source `test-helpers.sh`, call `_timeout 5 bash -c 'sleep 600 & wait'`; assert it returns within ~20s and no `sleep 600` process survives.

### Tests for User Story 1 (write FIRST, must FAIL)

- [ ] **T002** [US1] Create `tests/units/harness-timeout.test.ts` scaffold (resolve `REPO`, an `execBash()` helper over `child_process.execSync`, `ok()` pass/fail counter) + 4 cases: (a) group-kill — `_timeout 5 bash -c 'sleep 600 & wait'` returns in ≤20s AND `pgrep -f 'sleep 600'` is empty; (b) no-orphan — same invocation leaves zero descendants; (c) TERM→KILL escalation — `_timeout 3 bash -c 'trap "" TERM; sleep 600'` still dies within grace+margin and returns 124; (d) no-new-dependency (FR-009/SC-004) — assert the `_timeout` body in `test-helpers.sh` uses `setpgrp` and does NOT invoke `gtimeout`/`timeout`.
  - **File**: `tests/units/harness-timeout.test.ts` (new)
  - **Verify**: `npx tsx tests/units/harness-timeout.test.ts` exits nonzero — cases FAIL against the current `alarm;exec` `_timeout` (orphan survives; (d) fails because the current body prefers `timeout`/`gtimeout`).
  - **Depends**: T001.

### Implementation for User Story 1

- [ ] **T003** [US1] Rewrite `_timeout()` in `tests/test-helpers.sh` to the perl `fork` + `setpgrp(0,0)` + negative-PID group-kill from plan.md (SIGTERM → `sleep $grace` → SIGKILL; `$grace = ${SPEC_GRACE:-10}`; return `124` on timeout). Use it uniformly — do NOT prefer `timeout`/`gtimeout`.
  - **File**: `tests/test-helpers.sh` (the `_timeout` function, lines ~9–15)
  - **Verify**: `npx tsx tests/units/harness-timeout.test.ts` → US1 cases (a)(b)(c) PASS; the spawned `sleep 600` is gone; a plain `_timeout 2 echo hi` still prints `hi` and exits 0.
  - **Depends**: T002.

**Checkpoint**: US1 done — a hung command is killed at budget with zero orphans. `_timeout` is now safe for US2/US3 to build on.

---

## Phase 3: User Story 2 — Functional `--timeout`/`--retry`/`--grace` (Priority: P2)

**Goal**: `run.sh --timeout N` actually controls every test's budget; per-test defaults become L1=300s / L2=600s (replacing 60/120/180s hardcodes); `--retry` and `--grace` are wired through. The 8 test files stop passing a budget so defaults/override apply.

**Independent Test**: Run a stub test path with `SPEC_TIMEOUT_OVERRIDE=7` and a command that sleeps 5s then exits 0 — it passes (budget 7 used, not the default); without the override the budget equals the L1/L2 default.

### Tests for User Story 2 (write FIRST, must FAIL)

- [ ] **T004** [US2] Add cases to `tests/units/harness-timeout.test.ts`: (d) default budget — `run_claude` resolves to `SPEC_TIMEOUT_L1=300`, `run_claude_l2` to `SPEC_TIMEOUT_L2=600` (stub `claude` via `PATH`, inspect the budget passed to `_timeout`); (e) override — `SPEC_TIMEOUT_OVERRIDE=7` is used by both; (f) propagation — `run.sh --timeout 9` exports `SPEC_TIMEOUT_OVERRIDE=9` (run `run.sh list`-equivalent or assert the export line).
  - **File**: `tests/units/harness-timeout.test.ts`
  - **Verify**: `npx tsx tests/units/harness-timeout.test.ts` exits nonzero — cases FAIL today (dead `--timeout`, 60s hardcode).
  - **Depends**: T003.

### Implementation for User Story 2

- [ ] **T005** [US2] Rewrite `run_claude()` and `run_claude_l2()` in `tests/test-helpers.sh` to resolve budget as **per-test arg → `SPEC_TIMEOUT_OVERRIDE` → category default** (`SPEC_TIMEOUT_L1` default 300 for `run_claude`, `SPEC_TIMEOUT_L2` default 600 for `run_claude_l2`). Keep the body simple for now: run under `_timeout "$budget"`, `cat` the captured file, return its code. (Stream+retry come in US3.)
  - **File**: `tests/test-helpers.sh` (`run_claude`, `run_claude_l2`)
  - **Verify**: US2 cases (d)(e) PASS; `run_claude "x"` (no budget arg) uses 300s, not 60s.
  - **Depends**: T004 (test) and T003 (`_timeout`).

- [ ] **T006** [US2] In `tests/run.sh`: set+`export SPEC_TIMEOUT_L1=300` and `SPEC_TIMEOUT_L2=600` defaults; add `--timeout N` → `export SPEC_TIMEOUT_OVERRIDE=$N`, `--retry N` → `export SPEC_RETRIES=$N`, `--grace N` → `export SPEC_GRACE=$N` (extend the existing arg-parse `case` block). Child test scripts inherit these via the `bash "$test_path"` invocation.
  - **File**: `tests/run.sh` (arg-parse `case`, ~lines 16–69; the `TIMEOUT=300`/`--timeout` handling at lines 9/21)
  - **Verify**: US2 case (f) PASS — `run.sh --timeout 9` makes `SPEC_TIMEOUT_OVERRIDE=9` visible to a test; the header line still prints the effective timeout.
  - **Depends**: T005 (wrappers read the env).

- [ ] **T007** [P] [US2] Drop the hardcoded budget arg in the 5 behavioral tests: `run_claude "…" 60` → `run_claude "…"` in `test-analyze.sh`, `test-implement.sh`, `test-plan.sh`, `test-specify.sh`, `test-tasks.sh` (line 8 of each).
  - **File**: `tests/behavioral/test-{analyze,implement,plan,specify,tasks}.sh`
  - **Verify**: `bash tests/run.sh test-plan` runs with the 300s default (no `60` in the call); behavior unchanged.
  - **Depends**: T005 (default must be 300 before the arg is dropped).

- [ ] **T008** [P] [US2] Drop the hardcoded budget arg in the 3 integration tests: `run_claude_l2 "…" 120|180` → `run_claude_l2 "…"` in `test-analyze-catches-bugs.sh`, `test-full-sdd-workflow.sh`, `test-implement-adversarial.sh`.
  - **File**: `tests/integration/test-{analyze-catches-bugs,full-sdd-workflow,implement-adversarial}.sh`
  - **Verify**: each file's `run_claude_l2` call has no numeric budget arg; L2 default 600s applies.
  - **Depends**: T005. **Parallel with**: T007 (different files).

**Checkpoint**: US2 done — `--timeout`/`--retry`/`--grace` work, defaults are 300/600s, the 8 test files rely on them. US1 + US2 independently functional.

---

## Phase 4: User Story 3 — Preserve output + bounded retry (Priority: P3)

**Goal**: A slow-but-correct run is not a spurious failure. The invoker streams output (kill never yields 0 bytes), retries empty-output timeouts up to 2 total attempts, and emits a `[TIMEOUT]` marker so the run log is diagnosable.

**Independent Test**: Drive the invoker against a stub that produces empty output past budget on attempt 1 and prints `ok` on attempt 2 (counter file) — it returns `ok`; a stub producing partial output on attempt 1 does NOT retry (returns partial + 124).

### Tests for User Story 3 (write FIRST, must FAIL)

- [ ] **T009** [US3] Add cases to `tests/units/harness-timeout.test.ts`: (g) output preserved on kill — `_timeout 2 bash -c 'echo partial; sleep 600'` via the invoker yields captured stdout containing `partial`; (h) retry empty-only — stub empty-on-attempt-1 then `ok`-on-attempt-2 returns `ok` (2 attempts); (i) no-retry-on-partial — stub printing partial on attempt 1 returns the partial + 124 without a second attempt; (j) marker — a terminal timeout emits `[TIMEOUT` to stderr.
  - **File**: `tests/units/harness-timeout.test.ts`
  - **Verify**: `npx tsx tests/units/harness-timeout.test.ts` exits nonzero — cases FAIL today (current `run_claude` cats to stderr on timeout → 0 bytes under `$(…)`, no retry).
  - **Depends**: T008 (US2 wrapper exists).

### Implementation for User Story 3

- [ ] **T010** [US3] Refactor the wrapper bodies into a single `_invoke_claude <perm_mode> <prompt> <budget> [allowed_tools]` in `tests/test-helpers.sh`: loop up to `SPEC_RETRIES+1` attempts (default 2); each attempt runs `claude -p …` under `_timeout "$budget"` streaming to a temp file; on non-`124` return, emit+return (output to stdout); on `124`, retry ONLY if the captured file is empty and attempts remain, else emit the captured (partial) output to **stdout** and a `[TIMEOUT after ${budget}s]` marker to **stderr**, and return `124`. `run_claude`/`run_claude_l2` become thin wrappers calling `_invoke_claude`.
  - **File**: `tests/test-helpers.sh` (new `_invoke_claude`; slim `run_claude`/`run_claude_l2`)
  - **Verify**: US3 cases (g)(h)(i)(j) PASS; the full `tests/units/harness-timeout.test.ts` is GREEN.
  - **Depends**: T009 (test) and T003 (`_timeout` returns 124).

**Checkpoint**: All three user stories independently functional; the mechanical suite is green.

---

## Phase 5: Polish & Cross-Cutting Concerns

- [ ] **T011** [P] Update `tests/README.md` to reflect reality: `--timeout`/`--retry`/`--grace` now work; defaults are L1=300s / L2=600s; note the perl group-kill (no `gtimeout`/coreutils needed).
  - **File**: `tests/README.md` (the "Timeout" and "Quick Start" sections)
  - **Verify**: README's stated defaults/flags match the implementation; no stale "L2 may need --timeout 600" as if it were aspirational.
  - **Depends**: T006. **Parallel with**: T010 (different file).

- [ ] **T012** Final verification: run the full mechanical suite `npx tsx tests/units/*.test.ts` (expect all GREEN incl. existing 21 + new harness-timeout cases); then a bounded smoke of `bash tests/run.sh` (L1 only) confirming no test hangs past its budget (no 19-min waits) and `.test-output/*/output.log` show no 0-byte timeout failures.
  - **File**: — (verification)
  - **Verify**: units all pass; an L1 run completes in bounded time with no orphan `claude` processes (`pgrep -fl 'claude -p'` empty after).
  - **Depends**: T010, T011.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: no deps — start immediately.
- **US1 / Foundational (Phase 2, T002→T003)**: depends on T001; **BLOCKS US2 and US3** (`_timeout` is the shared primitive).
- **US2 (Phase 3, T004→T008)**: depends on US1 (`_timeout`); delivers functional `--timeout`/defaults.
- **US3 (Phase 4, T009→T010)**: depends on US1 (`_timeout`'s `124`) and US2 (the wrapper to enhance).
- **Polish (Phase 5, T011→T012)**: depends on US2 (T011) and US3 (T012).

### User Story Dependencies

- **US1 (P1)**: foundational — no deps on other stories.
- **US2 (P2)**: depends on US1 only.
- **US3 (P3)**: depends on US1 and US2 (layers stream+retry onto US2's wrapper).

### Within Each User Story

- Tests (TDD) written and FAILING before the implementation task.
- Implementation task makes that story's tests GREEN.

### Parallel Opportunities

- **T007 ∥ T008**: both drop the budget arg, different file sets, both blocked only by T005 — run together.
- **T011**: README edit, independent file — parallel with T010.
- (Test-then-implement pairs are strictly ordered within a story — not parallel.)

---

## Implementation Strategy

### MVP First (User Story 1 only)

1. T001 (branch) → T002 (failing US1 tests) → T003 (`_timeout` group-kill).
2. **STOP and VALIDATE**: a hung command is killed at budget with zero orphans — US1 independently delivers value (the suite stops hanging 19 min).

### Incremental Delivery

1. US1 → `_timeout` kills the tree (MVP — bounds runtime).
2. US2 → `--timeout`/defaults functional → operator control restored.
3. US3 → output preserved + retry → spurious rotating failures gone.
4. Each story adds value without breaking the prior.

### Sequential (single implementer)

Priority order P1→P2→P3 is also dependency order here, so a single implementer works T001→T012 top-to-bottom, parallelizing only T007∥T008 and T011∥T010.

---

## Notes

**Requirements & Success-Criteria Traceability** (every FR/SC → task):

| FR / SC | Task(s) |
|---|---|
| FR-001 kill whole tree | T002, T003 |
| FR-002 TERM→KILL 10s grace | T002, T003 |
| FR-003 bounded wall-clock | T002, T003 |
| FR-004 zero orphans | T002, T003 |
| FR-005 `--timeout` propagates | T004, T006 |
| FR-006 L1=300 / L2=600 defaults | T004, T005, T007, T008 |
| FR-007 preserve output on kill | T009, T010 |
| FR-008 retry 2, empty-only | T009, T010 |
| FR-009 dependency-free (perl) | T002, T003 |
| SC-001 bounded per attempt | T002 |
| SC-002 no orphans after | T002 |
| SC-003 `--timeout N` used | T004, T006 |
| SC-004 clean macOS, no dep | T002, T012 |
| SC-005 no 0-byte failures | T009, T010 |

- [P] tasks = different files, no mutual dependency (T007∥T008; T011∥T010).
- [Story] label maps each task to US1/US2/US3 for traceability.
- Verify tests FAIL before implementing (TDD); each task is one commit.
- Commit each task per `.spec/convention.md` (Conventional Commits default): `type(scope): subject` with a `Task: Txxx` trailer.
- Constitution Principle III honored throughout: zero new dependencies (system perl only); Principle V: mechanical tests assert real behavior (process death, output survival), not just "didn't throw".
