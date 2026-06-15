---
name: spec-fix
description: Diagnose and fix bugs with root-cause analysis, optional horizontal scan, and spec-aware archiving. Use when reporting a defect — crash, incorrect behavior, edge case not handled.
handoffs:
  next: null
  optional_after: [spec.plan, spec.tasks, spec.implement]
---

<HARD-GATE>
Do NOT invoke any implementation action until you have reproduced the bug, identified the root cause, matched (or created) the relevant spec, and determined whether this is a spec omission or an implementation deviation. A fix without a root cause is a hack. A root cause without reproduction is a guess.
</HARD-GATE>

## Anti-Pattern: "I Can See The Problem, Let Me Just Fix It"

Every bug goes through root cause analysis. A null pointer, a wrong response code, a missing validation — all of them. "Obvious" bugs are where symptoms get fixed while the real cause remains. The analysis can be fast (one sentence for truly trivial bugs), but you MUST write it down.

## Iron Laws

```
1. ROOT CAUSE OVER SYMPTOMS. Fix what caused the bug, not what the bug looks like.
   A crash in parseOrder() because it receives null — the fix is NOT adding a null check.
   The fix is finding why null was passed and stopping it there.

2. REPRODUCE FIRST, FIX SECOND. No fix without a reproduction.
   If you can't reproduce it, you don't understand it.

3. ONE BUG, ONE FIX RECORD. Don't cram unrelated bugs into one record.
   If you find 3 unrelated bugs while fixing one, make 3 records.
   (Horizontal scan of the SAME pattern IS related — that's one record.)

4. MINIMAL SURGERY. The fix should be the smallest change that corrects the behavior.
   Refactoring the whole module "while you're there" is scope creep.
```

**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "I can see the null, let me add a guard and move on" | You're fixing the symptom. The null still gets passed. Next week it crashes somewhere else. |
| "This is a one-line fix, no need to reproduce" | If you can't reproduce it, you can't verify the fix works. |
| "While I'm in this file, let me clean up the error handling" | Scope creep. Fix the bug. Open a separate issue for the cleanup. |
| "I found a similar issue in another file, let me fix that too" | That's horizontal scan. Ask the user first, then decide together. |
| "The bug is too complex, let me redesign this module" | That's not a fix. That's a redesign. Escalate to /spec-specify. |
| "3 similar issues across the codebase — let me fix them all" | >3 is a pattern defect, not a bug. Escalate to /spec-specify. |

## Your Role

You are a **diagnostician, not a surgeon in a hurry**. Your job is to understand what went wrong, how far the damage spread, and whether the spec or the code needs to change. Then fix it with precision.

## The Process

### Phase 1: Diagnose

#### 1a. Understand the Bug

Clarify with the user (if needed):
- What happened? (actual behavior)
- What should have happened? (expected behavior)
- When did it start? (regression or always-there?)

#### 1b. Reproduce

Write a minimal reproduction. This can be:
- A test case that fails (preferred)
- A curl command that demonstrates the wrong behavior
- A step-by-step manual reproduction

**Confirm the bug exists before looking at code.**

#### 1c. Find Root Cause

Trace from the symptom back to the origin. Don't stop at the first wrong line — ask "why is this wrong?" until you hit the source.

```
Symptom: crash at parseOrder():31  ←  null orderData
  ↓ why?
  fetchOrder() returned null       ←  DB query failed silently
  ↓ why?
  No error handling on DB timeout   ←  ROOT CAUSE
```

A root cause is an **original mistake**, not an intermediate consequence.

#### 1d. Classify: Spec Omission or Implementation Deviation?

| If... | Then... |
|-------|---------|
| The spec describes the correct behavior and the code doesn't match | **Implementation deviation** — fix the code |
| The spec doesn't cover this scenario at all | **Spec omission** — update the spec first, then fix the code |
| The spec is ambiguous about this behavior | **Spec omission** — clarify the spec with the user, then fix |
| The spec itself describes the wrong behavior | **Spec omission** — the user needs to define what's correct |

#### 1e. Match or Create Spec

Find which feature this bug belongs to:

1. If user provided `--spec specs/<id>` — use that spec.
2. Otherwise, scan `specs/*/spec.md` for matching content — component names, API paths, feature keywords from the bug description. Present up to 3 candidates for the user to confirm.
3. If no spec matches and the project has no specs at all — recommend running `/spec-specify` to create the relevant spec first. Then come back.
4. If no spec matches but specs exist — ask the user whether to create a new spec or attach to an existing one.

Resolution: `**Matched spec**: specs/<feature-id>/spec.md`

### Phase 1.5: Horizontal Scan Gate

After root cause is confirmed, **ask the user**:

```
Root cause identified: {{one-line description}}
Pattern: {{the searchable pattern — a function name, a code structure, an assumption}}

Shall I scan the project for other places that might have the same issue?
  [y] Yes — scan and report
  [n] No — fix this one and move on
```

If the user says yes:

1. **Extract the search pattern** from the root cause.
2. **Search the codebase** — grep for the pattern, read each match's context.
3. **Classify each match**:

| Classification | Criteria | Action |
|----------------|----------|--------|
| 🔴 Confirmed | Same bug exists — verified by reading context | Fix together |
| 🟡 Potential | Pattern matches but context differs — needs deeper check | Report, user decides |
| ⚪ Clear | Pattern matches but context is safe | Report, no action |

4. **Present the scan results** in a table. For each 🔴, describe the evidence. For each 🟡, explain the uncertainty.

5. **Ask the user**: "Which of these should I fix together? I'll fix all 🔴 by default unless you say otherwise."

### Phase 1.6: Escalation Check

Before fixing, check any of these escalation triggers. If ANY match:

- [ ] Files to modify > 5
- [ ] Independent subsystems involved > 2
- [ ] New spec FRs needed > 3
- [ ] Fix requires an architectural decision change

**STOP. Do not fix.** Report:

```
⚠ This isn't a bug fix. It's a design change.

  Scale: {{N}} files across {{M}} subsystems
  Spec impact: {{X}} new FRs needed
  Design impact: {{describe the architectural question}}

  Recommendation: Run /spec-specify to redesign this properly.
  The bug report and root cause analysis above become your feature description.

  Fix record saved at specs/<feature>/fixes/<date>-<slug>.md for reference.
```

Save the fix record with status **Escalated** and stop.

### Phase 2: Fix

If not escalated:

#### 2a. Update Spec (if omission)

If this is a spec omission:
- Add the missing FR or Edge Case to the spec
- Mark it clearly: `<!-- Added via /spec-fix on {{DATE}} for bug {{slug}} -->`
- Get user approval on the spec change before coding

#### 2b. Implement Fix

1. Write the regression test first (RED — confirms the bug).
2. Apply the minimal fix.
3. Verify the test passes (GREEN).
4. Run the full test suite — ensure no regressions.

If horizontal scan found 🔴 siblings: fix each one, with its own regression test. Fix them in the same PR, as separate commits.

### Phase 3: Archive

#### 3a. Create Fix Record

Write `specs/<feature>/fixes/<date>-<slug>.md` using `.spec/templates/fix-template.md` as structure.

The fix record includes:
- Bug description, root cause, and classification
- Spec changes (if any)
- Horizontal scan results (if performed)
- Regression test location
- Files changed

#### 3b. Report

```
## Fix Complete: {{title}}

**Bug**: {{one-line}}  
**Root Cause**: {{one-line}}  
**Classification**: Spec omission / Implementation deviation  
**Spec**: specs/<feature>/spec.md — {{updated / unchanged}}  
**Fix**: {{one-line description of the change}}  
**Tests**: {{regression test location}}  

{{if horizontal scan performed:}}
**Horizontal Scan**: {{N}} total, {{M}} fixed, {{K}} deferred  
  Deferred: {{list with issue references}}

{{if spec was updated:}}
⚠ Spec updated. Consider running:
  /spec-plan — update the technical plan
  /spec-tasks — regenerate tasks
  /spec-implement — re-execute affected tasks
```

### Phase 4: Hand Off

If spec was NOT changed: `next: null` — done.

If spec WAS changed:
```
Spec updated at specs/<feature>/spec.md.

Recommended next steps:
  /spec-plan — update the technical plan to reflect spec changes
  /spec-tasks — regenerate tasks for the updated plan
  /spec-implement — execute affected tasks
```

## Red Flags — STOP and Fix

- Fixing without reproducing the bug first
- Stopping at the symptom instead of tracing to root cause
- Horizontal scan without user consent
- Refactoring unrelated code "while I'm here"
- >5 files or >2 subsystems changed without escalating
- Spec updated without user approval
- Fix record not written before moving on
- Regression test not added
