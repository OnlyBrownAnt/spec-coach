# Analysis: Derived Workflow State (Eliminate the Stored-State Subsystem)

## Summary

The spec→plan→tasks set is internally coherent and thorough: all 15 FRs map to plan components and to tasks (no orphans either direction), task ordering respects real dependencies (notably the T009 dead-function-removal gate on T005+T006+T008), and the minimal-blast-radius design (reform `get_feature_paths` so its 4 callers are unchanged) is well-reasoned. One **critical** issue sits in the plan's central design: the resolver's soft mtime-default is applied uniformly to `get_feature_paths`, but that function feeds the **writing** skills (`setup-plan`/`setup-tasks`), where a wrong guess writes artifacts into the wrong feature dir — contradicting the spec's own "driving behavior must be exact" principle. Several smaller advisories around precedence/env-naming/resume-surface/test-coverage follow.

## Coverage Matrix (FR → Component → Task)

| FR | Plan Component | Task(s) | Status |
|----|---------------|---------|--------|
| FR-001 (single resolver, precedence, no state-file read) | C1 | T002 | Covered |
| FR-002 (`@` opt-in branch parse) | C1 | T002 | Covered |
| FR-003 (no-token mtime default) | C1 | T002 | Covered |
| FR-004 (phase from artifacts) | C2 | T003 | Covered |
| FR-005 (show = read-only reporter) | C4 | T006 | Covered |
| FR-006 (none/ambiguity → list) | C4 | T006 | Covered |
| FR-007 (resume breakpoint = first unchecked) | C5 | T004, T007 | Covered |
| FR-008 (resume feature via resolver) | C5+C1 | T007 | Covered |
| FR-009 (remove feature.json + `_persist_feature_json`) | C6+C7 | T008, T009 | Covered |
| FR-010 (remove SDD STATE block + skill step) | C9+C10 | T011, T012 | Covered |
| FR-011 (SPECIFY_FEATURE = override only) | C7+C1 | T009, T002 | Covered |
| FR-012 (retarget verify-spec + create-new-feature) | C3+C8 | T005, T010 | Covered |
| FR-013 (legacy tolerance) | C1 | T002 | Covered (see Advisory 6) |
| FR-014 (constitution v1.4.0) | C10+C12 | T012, T001, T013 | Covered |
| FR-015 (no new dependency) | cross-cutting | — (constraint) | Covered (no task needed) |

No orphan components; no orphan tasks.

## Issues Found

### Critical

- **C1 — Writing-path safety gap (Alignment + correctness).** `get_feature_paths()` (reformed in T005) is shared by **read-only** (`verify-spec.sh`) **and writing** (`setup-plan.sh`, `setup-tasks.sh`) callers. The plan applies the resolver's soft *mtime-newest* default to **all** of them (plan C3: "env override + @ + mtime"; "keep error-when-empty"). But the spec's own **two-coupling principle** (Key Entities) states *"driving behavior must be exact … anything that drives behavior is made explicit."* The writing callers **drive** artifact creation: if multiple features exist and no explicit token/`SPECIFY_FEATURE` is set, an mtime guess makes `setup-plan`/`setup-tasks` emit `FEATURE_DIR`/`TASKS` paths into the **wrong feature** — a real mis-write (scenario: touch an old feature to review it, then run `/spec-tasks` without `SPECIFY_FEATURE` → `tasks.md` written into the old feature). Spec **FR-012** only guarantees no-arg resolution *"when one feature is unambiguous"* — implying the writing path must require explicit/unambiguous, not guess. **The plan as written does not distinguish read-only resolution (soft mtime ok) from writing resolution (must be exact).** Remediation (for the implementer, in T005): `get_feature_paths` must accept the mtime default **only when exactly one feature exists**; with multiple features and no explicit token/env, it must error (as it does today) rather than mtime-pick. The read-only `show-sdd-state.sh` may keep the soft mtime default. *(This is an alignment gap, not a Constitution I–V violation — but it is a correctness bug class, so flagged Critical to ensure it is resolved before/during T005, not discovered in use.)*

### Advisory

- **A1 — Precedence between an explicit token arg and `SPECIFY_FEATURE` is plan-added.** Spec FR-011 frames `SPECIFY_FEATURE` as *"an explicit override token fed into the resolver"*; plan C1 / T002 make it a **separate tier** below an explicit token arg (`token > SPECIFY_FEATURE env > mtime`). Reasonable, but the spec never defines which wins when **both** a token arg and the env are set. Confirm intent (the plan's "token arg > env" is the sensible choice).

- **A2 — Two env vars; the spec names one.** Plan/tasks handle **both** `SPECIFY_FEATURE` and `SPECIFY_FEATURE_DIRECTORY` (create-new-feature prints both; `get_feature_paths` historically used the latter). Spec FR-011 mentions only `SPECIFY_FEATURE`. Minor under-specification — implementer should treat both as override tokens (the plan already does).

- **A3 — "Resume" is concretized as a `show-sdd-state.sh` output line, not a separate command.** Spec US2 / FR-007 / FR-008 refer to "resume" without defining its surface; plan C5 / T007 decide it is a breakpoint line emitted by `show-sdd-state.sh`. This is almost certainly correct (the Constitution bars adding a CLI command, and resume is fundamentally a "where am I" read), but it is a plan-level decision the spec left open — worth confirming it matches intent.

- **A4 — Some spec edge cases lack an explicit test.** T002/T006 cover ambiguity, `@`, legacy feature.json, never-mutate, and the resume cases. **Not** explicitly tested: `@` degradation on non-git / detached HEAD; `@` on a no-`NNN` branch (e.g. `main`); fix-branch name mapping (`007-fix-spec-prune` → `specs/007-*/`); git-checkout mtime churn. Several are inert-by-construction; consider adding cases so the contract is pinned.

- **A5 — Legacy SDD STATE block tolerance (FR-013) is inert-by-construction, not asserted.** T002 asserts legacy `feature.json` is ignored; the block is simply never read after the T006 rewrite. Consider one case asserting `show-sdd-state.sh` works with a stale constitution block present (proves FR-013's second half).

- **A6 — `get_current_branch` removal timing.** T009 lists deps T005+T006+T008 (correct for `read_feature_json_feature_directory` / `_persist_feature_json`). But `get_current_branch` is orphaned after **T005 alone** (its only caller, `get_feature_paths`, stops calling it once reformed, and `@` parsing lives inside `resolve_feature`). Harmless (brief dead code), but T009 could note the `get_current_branch` removal is gated on T005 specifically.

### Positive

- **Dependencies are real and correctly gated.** T009 (delete `read_feature_json_feature_directory` + `_persist_feature_json`) correctly waits on T005 (reform `get_feature_paths`, which internally called `_persist_feature_json`), T006 (show stops calling `read_feature_json_feature_directory`), and T008 (create-new-feature stops calling `_persist_feature_json`) — no dangling callers.
- **Minimal-blast design is sound.** Reforming `get_feature_paths` so the 4 skill-wrapper callers are signature-unchanged is the lowest-risk way to retarget resolution.
- **Same-file sequencing is encoded.** `common.sh` (T002→T003→T004→T005) and `show-sdd-state.sh` (T006→T007) are explicitly sequential despite logical independence — avoids the "[P] on same file" anti-pattern.
- **RED-first is correctly scoped** to new behavior (T002/T003/T004/T006/T007); reforms/removals (T005/T008/T009/T010/T011/T012) use suite-green + smoke, matching the spec's TDD assumption.
- **Full FR coverage; no orphans.** Every FR → component → task; every component → task; every task → FR/component.
