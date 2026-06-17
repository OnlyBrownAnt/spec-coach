# Analysis: Constitution Enforcement Reach

## Summary

The spec→plan→tasks chain is internally consistent on coverage: all 15 functional requirements map to a plan component and at least one task, and every task names a specific file, a verification step, and a dependency (the `/spec-tasks` HARD-GATE is satisfied). No requirement is untasked, so nothing blocks implementation. The review surfaced **5 advisory issues**, the most material being a spec↔plan disagreement on *where* "last phase" comes from (the plan deprecated the SDD STATE `Last phase` field in favor of artifact inference, but the spec's FR-006 and Key Entity still describe the SDD STATE block as the source). The remaining advisories are dependency-annotation gaps, uncovered spec edge cases, and two success criteria without an explicit verification task. None of these block building.

## Issues Found

### Critical

None. Every FR (FR-001 … FR-015) has both a plan component (plan.md:93–109) and at least one task; no requirement will be missed in implementation.

### Advisory

- **DRIFT (spec↔plan) — "last phase" source.** `spec.md` FR-006 says the capability "surfaces the current SDD STATE (current feature, last phase, skipped phases, decisions)" and the Key Entity defines the SDD STATE block as recording "last phase." `plan.md:11`, `:100`, and `:118` decide last phase is **inferred from artifacts** and explicitly **deprecate** the SDD STATE `Last phase` field ("this supersedes the spec's Key Entity description"). The capability surface (all four fields) is unchanged and the plan self-documents the supersession, so implementation is not confused — but the spec wording is now stale. **Recommend** reconciling `spec.md` FR-006 and the SDD STATE Key Entity to state last-phase is artifact-inferred (or mark the field deprecated), so spec and plan agree.

- **ORDERING — T016 dependency under-specified.** `tasks.md:122` (T016) edits `skills/specify.md` and `skills/tasks.md`, which are also edited by T010 (`tasks.md:85`, specify.md) and T013 (`tasks.md:99`, tasks.md). T016's annotation lists only "Depends on: T014." Phase ordering (Phase 8 after Phases 5/6) protects a sequential run, but the explicit dependency is incomplete — parallelizing T016 with T010/T013 across the phase boundary would collide on the same files. **Recommend** T016 → "Depends on: T014, T010, T013."

- **COVERAGE — three spec edge cases have no tasked handling.** `spec.md` Edge Cases list: (a) "Constitution never created → detect missing file, don't crash"; (b) "SDD STATE markers missing/duplicated → handle gracefully"; (c) "intentionally-retained template slots vs unfilled placeholders." None is explicitly covered: T003/T006 don't state missing-`constitution.md` handling; T009 fixtures (`tasks.md:73`) cover phase-inference + missing `feature.json` but not malformed SDD STATE markers; T011 (`tasks.md:86`) scans `[ALL_CAPS]` which would false-positive on legitimate retained slots. **Recommend** adding these cases to the T004/T009 fixtures and a slot-exclusion note in T011.

- **SC VERIFICATION — SC-001 and SC-007 lack an explicit verify task.** SC-001 ("5/5 governance skills load the constitution") is only implicitly covered (T005/T010/T013 + pre-existing plan/constitution behavior; T018 e2e partially). SC-007 ("no new production npm dependencies") is implied by T001 (adds to `files`, not `dependencies`) but no task asserts the `dependencies` array is unchanged. **Recommend** a one-line assertion in T015 or T017 (e.g., `node -e "console.log(require('./package.json').dependencies)"` shows only `tsx`).

- **PRECISION — T007 helper location left ambiguous.** `tasks.md:71` places `buildClaudeManagedSection()` in "src/commands/init.ts (same file or src/utils.ts)." Since T008 (`update.ts`) consumes it, a helper shared across two command files belongs in `src/utils.ts`. Leaving "or" forces an implementer decision. **Recommend** pinning to `src/utils.ts`.

### Positive

- Coverage matrix is complete: all 15 FRs → plan component → task, no orphans either way.
- Every task carries file(s) + verification + dependency — the `/spec-tasks` HARD-GATE is met.
- Task ordering is sound: dependency chains are correct (T002→T003→T004; T006∥T007→T008; T010∥T011→T012) and the two `skills/constitution.md` edits are explicitly serialized (T002→T014).
- FR-011 is deliberately split across T010 (specify.md) and T013 (tasks.md) to avoid same-file task conflicts — good decomposition.
- The plan's Complexity Tracking is candid: it documents the SDD STATE supersession, the Principle I deviation with its justification, and the rejected alternatives — exactly the traceability the feature is meant to encourage.
- Zero-dependency is preserved (no new entries in `dependencies`; scripts reuse `common.sh` utilities).
