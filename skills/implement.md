---
name: coachkit-implement
description: Execute the implementation plan by processing all tasks defined in tasks.md. Use when ready to build, after spec, plan, and tasks are complete.
handoffs:
  next: null
  optional_after: [coachkit.taskstoissues]
---

## Iron Laws

These are not advice. They are not "when convenient." They are the foundation of every task below.

```
1. NO PRODUCTION CODE WITHOUT A FAILING TEST FIRST.
   Write code before the test? Delete it. Start over.

2. NO COMPLETION CLAIMS WITHOUT FRESH VERIFICATION EVIDENCE.
   Haven't run the command this turn? You cannot claim it passes.

3. NO FIXES WITHOUT ROOT CAUSE FIRST.
   Reproduce → understand → fix. Never guess-fix.
```

**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "This task is too simple for TDD" | Simple code breaks too. The test takes 30 seconds. |
| "I'll test after, it'll be faster" | Tests written after code pass immediately, proving nothing. You never saw them catch the bug. |
| "Should work now" | Run the command. Then tell me. |
| "I already manually tested it" | Manual isn't repeatable. No record, can't re-run. Write the test. |
| "Just try this fix and see" | Guessing wastes more time than reproducing. Find root cause first. |
| "It's probably X, let me change it" | Seeing symptoms ≠ understanding root cause. Reproduce first. |
| "I'll write the regression test after the fix" | Untested fixes don't stick. Write the test before the fix. |
| "3 fixes failed, let me try one more" | 3+ failures = architectural problem. Escalate, don't thrash. |
| "I'm confident it's correct" | Confidence ≠ evidence. Run the command. Show the output. |
| "Same as last time, I know the pattern" | Every task has unique context. Understand before writing. |

## Your Role

You are the **technical lead implementing the feature**. You have the spec, plan, and task list. Your job is to write production-quality code through disciplined iteration.

## The Process

### 1. Load and Review

Read all three artifacts:
- `specs/{{FEATURE_ID}}/spec.md` — what and why
- `specs/{{FEATURE_ID}}/plan.md` — architecture and design
- `specs/{{FEATURE_ID}}/tasks.md` — work breakdown

**Before writing any code, review the plan critically:**
- Any gaps that would block implementation?
- Does the file mapping make sense against the actual codebase?
- Is the task order correct (earlier tasks unblock later ones)?

Flag critical gaps before starting. Don't discover them mid-task.

Understand the intent, not just the instructions. If you see a smarter way to achieve the spec's goals, use it — note the deviation.

### 2. Locate Starting Point

Scan `tasks.md` for the first unchecked task. Start there. Completed tasks (`[x]`) are done — do not redo them unless you find a bug introduced by that task.

### 3. The Task Cycle

For every task, follow these steps in exact order. Do not skip. Do not reorder. Do not combine.

```
1. UNDERSTAND
   Read what the task asks. Check referenced files. Know what "done" looks like.

2. RED — Write the failing test
   - One behavior per test. Clear name. Real code, not mocks (unless unavoidable).
   - If you don't know how to test it: write the wished-for API first,
     write the assertion first, or ask.

3. RED — Verify the test FAILS
   - Run the test. Confirm it fails.
   - Confirm it fails for the right reason: feature missing, not typo.
   - Test passes immediately? You're testing existing behavior. Fix the test.
   - Test errors (not fails)? Fix the error, re-run until it fails correctly.

4. GREEN — Write minimal code to pass
   - Just enough to pass the test. No "while I'm here" improvements.
   - No future-proofing. No extra parameters "just in case."
   - If the test passes with less code than you wrote, you wrote too much.

5. GREEN — Verify the test PASSES
   - Run the test. Confirm it passes.
   - Confirm all other tests still pass. Fix any regressions now.

6. REFACTOR — Clean up while green
   - Remove duplication. Improve names. Extract helpers.
   - Keep tests green throughout.
   - Do not add behavior during refactor.

7. VERIFY — Run the full verification command
   - Run the project's test/lint/build command.
   - Read the FULL output. Check the exit code. Count failures.
   - Output must be pristine: no errors, no warnings, all tests pass.

8. SELF-REVIEW — Check spec compliance and code quality
   - Spec compliance: Does this code implement exactly what the spec asks?
     Every FR met? Nothing extra built?
   - Code quality: Matches existing patterns? Error handling present?
     No magic numbers? Names clear?

9. ASSESS — Label the outcome
   - **Clean** → mark [x], commit, continue.
   - **Concerns** → mark [x] with note: `[CONCERN: {{specific worry}}]`, commit, continue.
   - **Blocked** → stop. Explain what's blocking. Do NOT continue.

10. COMMIT
    - Commit with the task ID and a clear description.
    - One commit per task — no bundling.
```

### 4. When You Hit a Bug

Do not guess. Do not try "just this one change." Follow this sequence:

1. **Reproduce** — Get the exact steps that trigger it. If you can't reproduce, gather more data before touching code.
2. **Check recent changes** — `git diff`. What changed that could cause this?
3. **Trace the data flow** — Where does the bad value originate? Trace backward through the call stack until you find the source.
4. **Find a working reference** — Locate similar working code in the same codebase. What's different? List every difference, however small.
5. **Form ONE hypothesis** — "I think X is the root cause because Y." One variable at a time.
6. **Test the hypothesis** — Smallest possible change. Verify.
7. **Write a regression test** — Reproduce the bug in a test. Watch it fail. Fix the root cause. Watch the test pass.

**Critical rule:** If 3 consecutive fixes fail → STOP. You are treating symptoms, not causes. Escalate to your human partner. Question whether the architecture itself is wrong. Do NOT attempt Fix #4 without discussion.

### 5. Close the Loop

When all tasks are complete:

- [ ] Run the full test suite — **paste the output.** Not "all pass." The output.
- [ ] Smoke test the feature manually — **describe what you tested**, not "it works."
- [ ] Review any `[CONCERN: ...]` notes — address or escalate.
- [ ] Update spec status to "Implemented."
- [ ] Note any deviations from the plan with reasons.

### 6. Report

```
Implementation complete. {{N}}/{{N}} tasks done.

Tests: {{M}}/{{M}} passing
Deviations from plan: {{list with reasons, or "none"}}
Follow-up: {{list, or "none"}}

Run `/coachkit.taskstoissues` to create GitHub Issues from the task list.
```

## Red Flags — STOP and Return to Step 2

If you catch yourself doing any of these, stop immediately:

- Writing code before writing a test
- Skipping the "watch it fail" step
- A test passing on the first run (you're testing existing behavior)
- Marking a task complete without running verification this turn
- Saying "should work," "probably fine," "looks correct"
- Fixing a bug without reproducing it first
- Multiple fixes in one commit
- "One more fix attempt" after 2 failures
- Bundling unrelated changes into one task
- Trusting that "the agent said it succeeded"
