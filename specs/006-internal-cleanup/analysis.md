# Analysis: Internal Cleanup (Dead Code, Type Dedup, State Cohesion)

## Summary

The spec, plan, and tasks are consistent and implementation-ready. All 10 FR map to a component and at least one task; all 6 SC map to a task; all 3 user stories have a phase + independent test. The refactor-discipline framing (verify = full suite green, not RED-first) is honest and consistent with spec-implement's REFACTOR step. **0 critical issues.** Two advisory findings — the meaningful one is a missed `runInit` caller in T003's enumeration (the suite backstops it, but the task text should be corrected so it isn't caught late); the other is a grep-confirm nicety for the `ensureState` move.

## Issues Found

### Critical

None. Every FR has a component and a task; every component has a task; every task traces to an FR or SC; the constitution check (PATCH 2.1.1, no amendment) is sound. The feature can proceed to implementation.

### Advisory

- **A1 — T003's `runInit` caller list omits `tests/units/corpus-update.test.ts:34`.** FR-002 requires updating **every** `runInit` caller. The `runInit` callers are: corpus-init (×2), corpus-lifecycle (×1), corpus-uninstall (×6), **and corpus-update (×1 — `await runInit(claude, t)`)**. T003's file list and its narrow verify command cover only the first three; corpus-update is listed under T004 (for its `runUpdate` call) but T004 is scoped to `runUpdate`, so the `runInit(claude, t)` site there is orphaned. Consequence if followed literally: after T003 changes `runInit`'s signature, corpus-update's `runInit(claude, t)` would pass `claude` as `projectRoot` (silent wrong-target writes) and T003's narrow verify wouldn't catch it. The full-suite run mandated by the Implementation Strategy **does** catch it — so this is not truly blocking — but catching it at T008 (or mid-T004) is later than necessary and risks a tangled fix. *Fix before implementing*: add `tests/units/corpus-update.test.ts` (`runInit(claude, t)` → `runInit(t)`) to T003's edit list and its verify command. Note also that corpus-update's `const claude` is used by **both** its `runInit` and `runUpdate` calls, so the `claude`-decl + `loadAgentConfig`-import removal in corpus-update can only happen once **both** callers are updated — it belongs to whichever of T003/T004 runs second (T004, per the stated ordering).

- **A2 — T006 should grep-confirm ALL `ensureState`/`corpusExists` importers before repointing.** The plan correctly identifies `uninstall.ts` as an `ensureState` importer and notes `corpusExists` is used only inside `agents.ts`. But the task text's repoint list is `uninstall.ts` for `ensureState` and `agents.ts` (internal) for `corpusExists`. A pre-move `grep -rnE "ensureState|corpusExists" src/ tests/` should be the explicit gate (analogous to T002's `AgentKey` grep and T005's `CmdResult` grep) so no importer is missed. Low risk — current evidence says only `agents.ts` + `uninstall.ts` — but the grep makes it provable.

### Positive

- **Coverage is complete.** FR-001..FR-010 → C1–C4 → T001–T011 all map; SC-001..SC-006 → tasks; no orphan.
- **The refactor-discipline framing is honest.** Spec assumptions + tasks Tests note correctly state this is "keep the suite green, no RED-first" (no new behavior), with the full 18-suite run as the gate and only call-arg edits permitted. This matches spec-implement's REFACTOR step and avoids manufacturing artificial failing tests for a pure subtraction/relocation.
- **`AGENTS` retention is correctly captured.** The spec/plan/tasks all retain `AGENTS` (test-covered) and correct only its stale comment — fixing the earlier mis-analysis that a `grep -v agent` filter had hidden.
- **Cycle safety is addressed explicitly.** The plan + T006 both call out that `state.ts` must not import `agents.ts`, and verify it with a grep.
- **The one new file is justified.** `src/result.ts` is defended against the simpler alternatives (keep duplicating / put in `agents.ts` / put in `utils.ts`) in the plan's Complexity Tracking.
- **Constitution governance is clean.** PATCH 2.1.1, no amendment, no install-contract change — correctly contrasted with spec 005's MINOR + amendment.
