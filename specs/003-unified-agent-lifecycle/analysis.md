# Analysis: Unified Agent Lifecycle

## Summary

spec ↔ plan ↔ tasks are tightly aligned. All 18 functional requirements trace to a plan component and at least one task (coverage matrix below); every user story has a dedicated phase; task ordering respects dependencies; and the constitution deviations flagged in the plan (CLI-surface and agent-support clauses, MAJOR 2.0.0) have a concrete owner in T019. Shared infrastructure (context injection, state) is correctly hoisted into Foundational, which keeps the six user stories independent — avoiding the template's cross-story-dependency anti-pattern. **0 critical issues.** Six advisory findings, all about test coverage of subtle/edge behaviors rather than missing functionality. Implementation can proceed; the advisories should be folded into the relevant test tasks (T010, T013, T020) during implementation.

## Coverage Matrix

| FR | Plan component | Task(s) | Status |
|----|----------------|---------|--------|
| FR-001 | agents.json + manifest.ts | T001, T002, T004, T006 | Covered |
| FR-002 | agents.json entry fields | T001 | Covered |
| FR-003 | manifest runtime load | T002, T004 | Covered |
| FR-004 | runAgentsList | T007 | Covered |
| FR-005 | runAgentsAdd (skills+context, no scripts/templates) | T008 | Covered |
| FR-006 | runAgentsRemove (inverse) | T009, T011 | Covered |
| FR-007 | state.ts read/write | T003 | Covered |
| FR-008 | remove never touches corpus | T009, T011, T012 | Covered |
| FR-009 | multi-agent add | T008, T012 | Covered |
| FR-010 | upsertManagedSection | T005, T013 | Covered |
| FR-011 | removeManagedSection (shared AGENTS.md) | T005, T013 | Covered (see Advisory #1) |
| FR-012 | runAgentsUpdate | T010 | Covered (see Advisory #4) |
| FR-013 | two surfaces + require-corpus guard + cli router | T008, T018 | Covered (see Advisory #3) |
| FR-014 | confirm + graceful | T009, T016 | Covered |
| FR-015 | validateAgentEntry | T002, T006 | Covered |
| FR-016 | uninstall preserve user content | T016, T017 | Covered |
| FR-017 | init/update corpus-only, no absorb | T014, T015, T017 | Covered |
| FR-018 | reconcileFromFs | T003, T020 | Covered |

## Issues Found

### Critical

None. Every FR has a plan component and a task; no requirement is orphaned.

### Advisory

1. **FR-011 multi-non-Claude shared-section case is under-tested.** T013 asserts "removing the last non-Claude agent clears the section" but does NOT assert the harder case: removing *one of two* non-Claude agents (e.g. cursor + copilot installed, remove cursor) MUST preserve the shared AGENTS.md section while copilot remains. This is the exact subtle behavior FR-011 calls out and the plan lists as an "Open risk." **Recommend**: T013 add a fixture with two non-Claude agents, remove one, assert the section survives.

2. **SC-004 "all six agents install AND inject" is only partially verified end-to-end.** T020 smoke-tests claude; T013 tests non-Claude context for cursor. No single assertion proves all six agents install successfully. Because installation is data-driven they share one code path, but SC-004 is an explicit success criterion. **Recommend**: T020 (or a small loop in test-lifecycle.sh) assert `agents add` succeeds for each of the six manifest agents.

3. **The require-corpus guard (FR-013) is implemented in T008 but not tested.** T011 operates on a fixture that already has a corpus. The "agents add without `.spec/` errors with guidance and installs nothing" path has no assertion. **Recommend**: add a no-corpus assertion (test-lifecycle.sh or test-state.sh) — this is the strict-isolation guarantee and should be locked by a test.

4. **Version-drift upgrade (FR-012 / "Version drift" edge case) is weakly tasked.** T010 says "refresh installed bindings" but does not explicitly compare the installed version against the manifest version to decide an upgrade is needed. The spec's version-drift edge case expects `update` to upgrade when versions differ. **Recommend**: T010 explicitly compare versions and assert an upgrade occurs when the manifest version differs from the recorded one.

5. **Re-update idempotency (SC-006) is untested.** SC-006 covers "add OR update twice yields no duplicates." T012 covers re-`add`; running `agents update` twice is not asserted. **Recommend**: T010 or T012 add a run-`update`-twice assertion (no duplicate skill files, no duplicate managed section).

6. **Minor — warn-skip on missing skill source.** The existing `installSkill` warns and skips a missing source template; `agents add` (T008) inherits this, but there is no explicit test for the edge case "manifest references a skill that doesn't exist." Low risk (behavior already exists), but noting it so it is preserved rather than silently regressed during the rewrite.

### Positive

- **Zero critical gaps** — all 18 FR → plan → task traced.
- **User stories are independent by design.** Context injection and state were placed in Foundational, so US2 (verbs) depends only on Foundational, not on another user story. This sidesteps the template's "cross-story dependencies that break independence" warning.
- **MVP boundary is clean.** Setup + Foundational + US1 deliver SC-001 (adding an agent is a JSON-only edit) as a standalone, deployable increment.
- **Constitution deviations have an owner.** The plan's two Dev-Constraint violations and the MAJOR bump are concretely tasked (T019), including the SYNC IMPACT block and `verify-constitution-sync.sh` — the spec-002 governance machinery is being applied to this feature's own constitution change.
- **Migration is covered twice.** FR-018 reconcile has both its implementation (T003 `reconcileFromFs`) and an end-to-end smoke test (T020 on a fixture old-project), so the dogfood repo's own transition is exercised.
- **TDD and one-commit-per-task are explicit**, matching the spec-implement Iron Laws before implementation even begins.
