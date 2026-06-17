# Analysis: Precise Deletion (Only Remove What Spec Coach Owns)

## Summary

The three artifacts are tightly consistent: all 18 functional requirements map to a plan component (C1–C8) and at least one task; all five success criteria have covering tasks; signatures are locked identically across plan and tasks; task ordering respects dependencies with valid parallelism. **No critical gaps** — no FR or SC is left without a plan component or task, and there is no name/file drift that would mislead the implementer. The findings below are all advisory: they concern *test-traceability rigor* (behaviors that ARE implemented by a task but whose critical branch lacks a pinned RED assertion in that introducing task). They do not block implementation, but addressing them upfront keeps the TDD cycle honest.

## Issues Found

### Critical

None.

### Advisory

- **A1 — FR-007 directory-integrity guard lacks a pinned RED assertion in its introducing task.** T007 implements `dirContainsOnlyManaged` (the guard whose entire purpose is "preserve a coach skill dir that has accumulated unexpected user files"), but T007's described RED test only covers the collision-survival case (a *different* `spec-user-own/` dir) and the whitelist fallback — not the guard's own preserve-and-warn branch. *Specifically missing*: a RED assertion that a coach-owned skill dir (e.g. `.claude/skills/spec-specify/`) containing an unexpected extra file is **preserved and warned**, not deleted. Risk: the guard's critical branch ships untested and a regression there passes silently. *Suggestion*: add that assertion to T007's RED phase (or T011), testing the guard directly, not just as a side effect of the collision test.

- **A2 — Markdown-format precise deletion first exercised only in the T011 capstone, not as a unit.** T007's RED test is described in terms of the claude/skills path. The markdown path (delete individual `spec/{name}.md` files, prune the shared `spec/` dir only when empty) — spec edge case #2 — is first asserted in the T011 *combination* test, not in T007 where the code lands. *Suggestion*: add a cursor-format RED assertion to T007 (seed `.cursor/commands/spec/notes.md`; remove cursor; `notes.md` survives, the 11 coach `.md` files gone, `spec/` pruned only because empty) so the unit is verified where it is introduced.

- **A3 — FR-018 idempotency (missing recorded path) has no explicit assertion.** T007 notes "missing paths skipped (`try/catch`)" but describes no RED case where a `createdFiles` entry is already absent on disk (user manually deleted a skill file) and `remove` completes without throwing. *Suggestion*: add a RED case to T007 asserting removal is a no-op-without-error when a recorded path is gone.

- **A4 — FR-012 second half (non-installed manifest agents untouched) not pinned in T010.** T010 verifies user-content survival on uninstall but does not explicitly assert that a manifest agent that is *not installed* (absent from state) has its directory left completely untouched. *Suggestion*: add a RED case to T010 with, e.g., a `codex` dir present but codex not in state, and assert `uninstall` does not touch it.

- **A5 — SC-002 is not explicitly traced to a task tag.** SC-001→T011, SC-003→T012, SC-004→T014, SC-005→T015 are tagged; SC-002 ("a user-authored context file is never deleted, even if empty") is behaviorally covered by T008 but carries no SC tag. *Suggestion*: tag T008 with SC-002 (or add an explicit SC-002 assertion) for traceability parity.

- **A6 — Cross-version orphan (spec edge case #9) has no dedicated assertion.** The conservative "a skill removed from the manifest but still on disk is never deleted" behavior is an Assumption and is *implicitly* covered by T007's general "non-attributed dir survives" test, but the specific orphan scenario isn't called out. Low risk; *suggestion*: optionally add an orphan assertion to T009/T011 to lock the conservative contract.

- **A7 — `removeAgentSkills` is an exported symbol also consumed by `uninstall.ts`; confirm the mid-implementation build stays green.** T007 makes `createdFiles` *optional*, so `uninstall.ts`'s existing 2-arg call remains valid until T010 rewires it — no build break. This is consistent, not a defect; flagged only so the implementer does not assume T007 must also touch `uninstall.ts` (it must not — that is T010's concern, and the optional param is what keeps the two tasks cleanly separable).

### Positive

- **Coverage is complete.** Every FR-001..FR-018 maps to a plan component and a task (see matrix); every SC has a covering task; no plan component (C1–C8) is orphaned; no task lacks a traceable FR/SC/US/release purpose.
- **No drift.** The locked signatures (`ownedSkillUnits`, `createdFiles`, `createdContextFiles`, `removeAgentSkills(agent,root,createdFiles?)`, `removeAgentContext(agent,root,{isOwner})`, `upsertManagedSection→{created}`, `dirContainsOnlyManaged`) match exactly across `plan.md`'s Type/signature block and `tasks.md`.
- **Ordering is sound.** Foundational state/utils (T002–T005) correctly block the command work; the `createdFiles`-optional parameter cleanly separates T007 (agents remove) from T010 (uninstall); US2 (T012) correctly builds on T008's preservation half; US3 (T013) is correctly sequenced after T004 (state.ts free) and is genuinely parallel with the US1 agents.ts work.
- **Incremental design is honest.** Between US1 (T008, preservation only) and US2 (T012, owned-shell deletion), the intermediate state is *more* conservative than the target — it never over-deletes — so the US1 checkpoint ("no user content deleted") holds even before US2 lands.
- **Version is consistent and constitution-correct.** spec, plan, and T001 all agree on PATCH 2.0.1 (the MINOR→PATCH correction from the plan's constitution check propagated cleanly).
- **Edge cases are largely covered**, with the gaps noted in A1–A6 being test-pinning refinements rather than missing behavior.

## Coverage Matrix

| FR | Plan Component | Task(s) | Status |
|----|----------------|---------|--------|
| FR-001 | C2 / C5 | T006 | Covered |
| FR-002 | C1 / C5 | T006 | Covered |
| FR-003 | C2 | T005 | Covered |
| FR-004 | C3 | T007 | Covered |
| FR-005 | C2 / C3 | T007 | Covered |
| FR-006 | C3 / C4 | T007, T008 | Covered |
| FR-007 | C3 | T007 | Covered (test-pin: A1) |
| FR-008 | C4 | T008 | Covered |
| FR-009 | C4 | T012 | Covered |
| FR-010 | C4 | T008 | Covered |
| FR-011 | C4 | T008, T012 | Covered |
| FR-012 | C6 | T010 | Covered (test-pin: A4) |
| FR-013 | C1 | T002, T004 | Covered |
| FR-014 | C1 | T002 | Covered |
| FR-015 | C7 | T013 | Covered |
| FR-016 | C7 | T013 | Covered |
| FR-017 | C5 | T009 | Covered |
| FR-018 | C3 | T007 | Covered (test-pin: A3) |

| SC | Task(s) | Status |
|----|---------|--------|
| SC-001 | T011 | Covered |
| SC-002 | T008 (implicit) | Covered — traceability: A5 |
| SC-003 | T012 | Covered |
| SC-004 | T014 | Covered |
| SC-005 | T015 | Covered |
