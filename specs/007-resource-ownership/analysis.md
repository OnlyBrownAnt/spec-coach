# Analysis: Resource Ownership & Document Safety

## Summary

The spec→plan→tasks chain is internally consistent and implementable as written. All 14 FRs map to a plan component (C1–C9) and at least one task (T001–T014); all 9 components have tasks; all 4 user stories have phases; task ordering correctly serializes the shared-file edits (`init.ts`: T003→T007→T011; `cli.ts`: T005→T006) and deletes `intake.ts` only after its last importer is removed (T006 before T007). A repo-wide grep confirms the plan's corrected test-impact claim (owned-paths / precise-deletion / agents-update are genuinely untouched). **0 critical issues.** The findings below are advisory — the most useful is a testability refinement for the init guidance (A1), plus a handful of stale-reference and placement notes the implementer should absorb.

## Issues Found

### Critical

None. No FR is without a component or task; no plan component is orphaned; no constitution principle is violated (Principle III zero-deps holds — all `node:` builtins; Principle II holds — guidance is non-blocking; the amendment is a documented CLI-surface reduction, not a principle change).

### Advisory

- **A1 — Guidance testability (DRIFT/DESIGN): plan locks `printDocumentGuidance(projectRoot)` as a printer; T010 then needs a `console.log` spy.** `tasks.md` T010 (US4 RED) asserts on the guidance text, but `printDocumentGuidance` (plan C6 / FR-010) reads `specs/`, formats, and prints in one call — so the test must spy `console.log`, a pattern `corpus-init.test.ts` does not currently use. Consider splitting into a **pure** `guidanceText(specs: { count: number; highest: number }): string` (directly assertable, no spy) plus a thin `existingSpecs(projectRoot)` reader; `init` then does `console.log(guidanceText(existingSpecs(projectRoot)))`. `existingSpecs` is already pure-testable. This keeps T010 a clean unit assertion and matches the "test the return value" style used elsewhere. The implementer may keep the single-function form and accept the console spy — both work — but the split is cleaner. *Absorb in implementation.*

- **A2 — `absorb.md` frontmatter is an intake reference T009 doesn't name explicitly.** `skills/absorb.md:3` frontmatter `description` says "Use after `intake process --ai` stages a candidate from `.spec/intake/manifest.json`." T009 describes rewriting "When to use" + "The process" (the body) but does not explicitly call out the **frontmatter `description`**. T009's grep verify (`grep -in "intake\|manifest\|staged\|absorb-ai" skills/absorb.md`) is whole-file and WILL fail until the frontmatter is fixed, so it is self-enforcing — but name the frontmatter in the task so the implementer doesn't rely on the grep to discover it. *Absorb in implementation.*

- **A3 — Spec edge-case over-states test impact (cross-artifact drift, already corrected downstream).** `spec.md` Edge Cases lists `owned-paths.test.ts`, `precise-deletion.test.ts`, `agents-update.test.ts` as "reference `.spec/intake` and must be updated to drop it." The repo-wide grep proves they do **not** reference `.spec/intake` (they assert the 12-skill set incl. `absorb`); `precise-deletion.test.ts` only mentions `.spec/memory` as a fixture `mkdirSync`, never as an assertion, and its one `runUninstall` call (SC-001, line ~153) asserts only on `.claude/`/`.cursor/` user content — unaffected by the INFRA/USER change. `plan.md` Complexity Tracking already corrected this; `tasks.md` reflects the correction (those three are unchanged). No action needed for implementation — flagged only so the spec's stale edge-case note is not mistaken for a requirement. Optionally amend `spec.md` for cleanliness.

- **A4 — CHANGELOG 2.1.0 section still documents `intake` extensively (lines 24-45).** This is correct as **history** (CHANGELOGs are append-only) and is NOT to be rewritten. But T013's 2.2.0 entry must explicitly state `intake` is **removed** and `/spec-absorb` is now invoked directly, so a reader scanning current docs is not misled by the 2.1.0 entries. T001/T013 already list "intake removal" as a bullet — just ensure the 2.2.0 wording is unambiguous about removal (not just "changed").

- **A5 — FR-009 ("init must not scan outside `specs/`") has no dedicated assertion.** It is satisfied structurally by T007 (removing `intakeNudge` — the only external scanner, via deleting `intake.ts`). T008's iron-rule pin ("no `.spec/intake` created" + "`docs/keep.md` untouched after init") implicitly covers it. Consider adding one explicit FR-009 assertion (e.g., seed `docs/cand.md` matching discovery signals, run `init`, assert no manifest/intake artifact and the candidate untouched) to make the invariant directly testable rather than implied. Minor.

- **A6 — FR-008 (iron rule) is pinned under US3 (T008), but it is a global invariant.** The plan maps C5→US3, which is defensible (intake's verbatim-copy was the main potential violator; US3 is where the rule becomes fully clean). It could equally live in the Polish phase as a cross-cutting invariant. Either placement is fine; flagged only for implementer awareness — do not treat T008 as US3-exclusive in spirit.

- **A7 — T002 uses `runAgentsAdd` in `corpus-init.test.ts` without noting the import.** Trivial: `corpus-init.test.ts` currently imports only `runInit` + `readState`; T002's new block needs `import { runAgentsAdd } from "../../src/commands/agents.ts"`. The implementer will add it; called out only for completeness.

### Positive

- **Coverage is airtight:** every FR-001…FR-014 → component → task; every C1…C9 has a task; every US1…US4 has a phase. No orphans in either direction.
- **Ordering is correct and file-safe:** the priority order (US1→US2→US3→US4) coincides with the file-conflict order (`init.ts` and `cli.ts` each touched in sequence); T006 (remove `cli.ts` importer) correctly precedes T007 (delete `intake.ts` + its test).
- **The plan's test-impact correction is verified against the real tree** — the three "unchanged" test files are genuinely safe, and `precise-deletion`'s `runUninstall` use is unaffected (it asserts on agent-dir user content, not `.spec/` paths).
- **No constitution principle is violated**; the v1.2.0→v1.3.0 amendment is a clarifying CLI-surface reduction + iron-rule codification, with no Core Principle added/removed (so no SYNC IMPACT propagation beyond the constitution file itself).
- **The iron rule is the spine** and is explicitly pinned (T008) rather than left implicit — a good regression guard for a "never destroy user data" guarantee.
- **RED-first is correctly applied where there is new behavior (US1/US2/US4) and honestly set aside for the pure removal (US3)** with suite-stays-green + CLI smoke as the gate — the right call, not a shortcut.

## Hand Off

Analysis complete. 0 critical, 7 advisory.

Critical = 0 → run `/spec.implement` to start building (absorb A1–A7 during implementation; A1 and A2 are the ones most likely to bite if skipped).
