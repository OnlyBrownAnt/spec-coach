# Analysis: Test Harness Reliability

## Summary

The spec→plan→tasks set for `012-test-harness-reliability` is largely consistent: all 9 FRs and 5 SCs map to plan components (C1–C4) and to specific tasks (traceability table in `tasks.md` Notes), task ordering respects dependencies, and Constitution Principle III (zero dependencies) is honored (system perl, no `coreutils`). I found **one Critical issue** — a test↔implementation contradiction about whether a timed-out run's partial output lands on stdout or stderr — which should be resolved before `/spec-implement` because it makes a plan-correct implementation fail its own US3 test. Several Advisory items are worth the implementer's attention but do not block.

## Issues Found

### Critical

- **DRIFT/CONTRADICTION — partial-output stream (stdout vs stderr) is specified two ways.** *(RESOLVED 2026-06-19: option (a) applied — `plan.md` §C2 and `tasks.md` T010 now emit captured/partial output to **stdout** and only the `[TIMEOUT` marker to stderr; T009(g)/(i) already asserted stdout, so all three artifacts are now consistent.)* `tasks.md` T009(g) asserts the killed run's partial output appears in **captured stdout** ("…yields captured stdout containing `partial`"), and T009(i) says a partial run "returns the partial + 124." But `tasks.md` T010 and `plan.md` §C2 both specify the timeout path **emits captured output + `[TIMEOUT]` marker to stderr**. T009's own Verify note even identifies stderr-on-timeout as the *current bug* ("current `run_claude` cats to stderr on timeout → 0 bytes under `$(…)`"). Unresolved, T009(g)/(i) fail against a plan-correct T010. **Resolve before implementing** (pick one): either (a) emit captured (partial) output to **stdout** and only the `[TIMEOUT` marker to stderr — which best satisfies FR-007/SC-005 ("never zero bytes") and makes `$output`/`tee` capture it; or (b) change T009(g)/(i) to assert stderr. Recommendation: (a). Affects: `tasks.md` T009, T010; `plan.md` §C2.

### Advisory

- **Two-step wrapper evolution not flagged in plan.** `plan.md` §C2 presents `_invoke_claude` as the single wrapper design, but the tasks deliver it incrementally: T005 (US2) puts budget-resolution directly in `run_claude`/`run_claude_l2`, then T010 (US3) refactors into `_invoke_claude`. Ensure T005's stepping-stone wrapper is shaped so T010's refactor is mechanical (no logic rewrite), or note the intermediate shape explicitly so the implementer doesn't treat T005's wrapper as final.
- **`allowed_tools` (3rd) param may be silently dropped.** The current `run_claude` accepts `allowed_tools="${3:-}"` and forwards `--allowed-tools=`. Neither T005 nor T010 mentions preserving it during the rewrites. No current test uses it, but silently dropping it is an undocumented behavior change — preserve it (or explicitly remove with a note).
- **"Near-empty" is undefined (FR-008).** Spec FR-008 retries on "empty (or near-empty)" output; tasks T009/T010 key strictly on "empty." Define the threshold (strictly empty, or < N bytes) so the implementer doesn't guess.
- **Two spec Edge Cases have no regression test.** (a) "`--timeout` smaller than a test needs → fails fast at budget (no hang)"; (b) "claude exits 0 with genuinely empty output is NOT treated as a timeout." Both are correct-by-construction but have no T002/T009 case locking them.
- **`perl` presence on minimal Linux CI.** `plan.md` Tech Context / spec Assumptions state perl "ships with macOS and Linux." Minimal containers (alpine/distroless) may lack perl. This is *not* a new dependency (the current `_timeout` fallback already uses perl), but the CI image should be confirmed to ship perl.
- **Retry doubles cost for true hangs.** Retry-on-empty cannot distinguish a transient cold-start from a genuine hang, so a true hang now costs ~2×(budget+grace) instead of 1×. It is bounded (FR-003's attempts-multiplier accounts for it; accepted in clarify Q1) — informational, not a defect.
- **T009 dependency is over-specified.** T009 lists "Depends: T008," but its failing tests only require T005's wrapper to exist; depending on T005 would let US3 tests be written earlier. Minor.

### Positive

- **Dependency ordering is correct.** US1 (`_timeout`, T002→T003) is foundational and cleanly unblocks US2/US3; T007/T008 are correctly blocked by T005 (default must be 300 before the budget arg is dropped); US3 depends on US1+US2 as the plan intends.
- **Priority order coincides with dependency order** (P1→P2→P3), giving a clean single-implementer top-to-bottom path with only two genuine parallel pairs (T007∥T008, T011∥T010).
- **Full requirements traceability.** Every FR and SC maps to specific task IDs (the Notes traceability table); no orphan components or tasks.
- **Constitution honored.** Principle III holds (perl is a platform prerequisite, not an added package; `gtimeout`/coreutils explicitly not required). Principle V is reflected in C4's behavioral mechanical tests (process death, output survival), not just "didn't throw."
- **Test-first per story** (TDD): each story's failing tests precede its implementation task, and each story is independently shippable (US1 alone already eliminates the 19-min hangs).
