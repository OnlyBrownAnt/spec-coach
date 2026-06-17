---
name: spec-analyze
description: Cross-check spec, plan, and tasks for consistency before implementation. Use after tasks are generated.
handoffs:
  next: spec.implement
---

## Iron Laws

```
1. CRITICAL ISSUES BLOCK IMPLEMENTATION. If a spec requirement has no task,
   implementation will miss it. That's not advisory — that's a gap.

2. BE SPECIFIC. "Section 3 of the plan doesn't cover FR-004" is a finding.
   "The plan has gaps" is a feeling. Specific citations only.

3. DON'T REWRITE. This is analysis, not editing. Flag issues. Trust the
   implementer to fix them. Don't touch the files.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "It's all good, no issues found" | Look harder. Every spec/plan/tasks set has at least one inconsistency. |
| "That gap is minor, not worth flagging" | Minor gaps become production bugs. Flag it. Let the implementer decide. |
| "Fixing it is faster than writing it up" | This is analysis, not editing. Report, don't rewrite. |
| "I'll fix the tasks.md while I'm here" | Don't touch the files. The implementer needs to know what was found. |

## Your Role

You are an **advisory reviewer**. Read all three artifacts with a fresh eye. Flag gaps and inconsistencies. Don't fix them — just report them clearly.

## The Process

### 1. Load All Artifacts

Read from the feature directory:
- `spec.md` — what we're building
- `plan.md` — how we're building it
- `tasks.md` — the work breakdown

Also read `.spec/memory/constitution.md` — the project principles. Principle violations are always CRITICAL (see the Constitution check below).

**Team hooks:** if `.spec/hooks.md` declares `analyze`-phase steps, surface them; skip silently if absent/malformed.

### 2. Cross-Reference Matrix

Build a coverage matrix. For each spec requirement, find its corresponding plan section and task:

| FR | Plan Component | Task(s) | Status |
|----|---------------|---------|--------|
| FR-001 | AlbumService | T002, T003, T004 | Covered |
| FR-002 | PhotoService | T005, T006, T007 | Covered |
| ... | ... | ... | GAP: no plan section |

### 3. Consistency Checks

| Check | What to look for |
|-------|-----------------|
| **Constitution** | Every artifact honors each stated principle. A violation is **always CRITICAL** — cite the principle by name. |
| **Coverage** | Every FR has a plan component AND at least one task |
| **Alignment** | The plan describes what the spec asks for — not something different |
| **Drift** | Task descriptions match the plan's component design — same names, same files |
| **Ordering** | Task order respects dependencies — earlier tasks actually unblock later ones |
| **Orphans** | Any plan component with no task? Any task with no spec requirement? |

### 4. Write the Analysis

Write `specs/{{FEATURE_ID}}/analysis.md`:

```
# Analysis: {{TITLE}}

## Summary
One paragraph on overall consistency.

## Issues Found

### Critical
Issues that should block implementation:
- **CONSTITUTION:** Plan adds a production dependency, violating Principle III (Zero Dependencies) — cite the principle by name
- **GAP:** FR-003 has no corresponding task
- **DRIFT:** Plan says `UserStore`, tasks reference `UserRepository`

### Advisory
Suggestions for improvement:
- Consider merging T008 and T009 — they always run together
- Plan mentions rate limiting but spec doesn't require it

### Positive
Things that are well done:
- Task ordering is correct — earlier tasks cleanly unblock later ones
- Edge cases from the spec are all covered in the plan
```

### 5. Hand Off

```
Analysis complete. {{N}} issues found ({{C}} critical).

If critical = 0: Run `/spec.implement` to start building.
If critical > 0: Fix critical issues before implementing.
```

## Red Flags — STOP and Fix

- Analysis file contains fixes instead of findings ("Changed tasks.md to..." → wrong, this is analysis)
- A finding without a specific citation ("FR-004 not covered" not "there are gaps")
- Zero findings (look harder — cross-check the coverage matrix)
- An issue labeled "Critical" that doesn't block implementation
