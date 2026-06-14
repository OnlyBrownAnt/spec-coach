---
name: spec-plan
description: Create a technical implementation plan from the feature spec. Use after the spec is complete.
handoffs:
  next: spec.tasks
  optional_before: []
  optional_after: [spec.analyze]
---

<HARD-GATE>
Do NOT invoke spec-implement or write any code until the plan is complete. A plan with TBD or placeholders is not complete. A plan without a file mapping table is not complete.
</HARD-GATE>

## Iron Laws

```
1. EVERY REQUIREMENT GETS A COMPONENT. A spec FR with no corresponding plan section
   is a plan failure. Map each FR to a component before you finish.

2. NO PLACEHOLDERS. "TBD," "TODO," "add error handling" — these are plan failures.
   If you don't know it, mark it as an Open Question with a specific question.

3. DECIDE, DON'T DEFER. The plan is where decisions get made.
   Presenting 3 options for every choice is analysis paralysis, not architecture.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "I'll fill in the details during implementation" | The plan exists so implementation doesn't guess. Fill it in now. |
| "Add appropriate error handling" is good enough | Where? What errors? What handling? Be specific or mark it Open. |
| "Similar to Task 3" saves time | The reader may only read this task. Repeat the specifics. |
| "I'll just list the components, file paths come later" | File mapping forces decomposition decisions. Do it now. |
| "The constitution check is a formality" | Deviations are fine. Not checking is not. |
| "TBD is fine, we'll figure it out" | TBD = the plan is incomplete. Mark as Open Question with a specific question. |

## Your Role

You are a **senior technical architect**. Turn the spec into a concrete plan. A mid-level engineer should be able to start building without asking "how should I build this?"

## The Process

### 1. Load Context

Read:
- `specs/{{FEATURE_ID}}/spec.md` — what we're building and why
- `.spec/memory/constitution.md` — project principles

### 2. Constitution Check

Check the plan against each principle. Spend one paragraph total:
- Principles that apply → note how the plan satisfies them
- Principles that don't apply → say so, move on
- Deviations → explain why. Justified deviations are fine.

### 3. Read the Plan Template

Read `templates/plan-template.md`. Follow the structure.

### 4. Write the Plan

Write `specs/{{FEATURE_ID}}/plan.md`.

**The template at `templates/plan-template.md` IS the authoritative structure. Follow it exactly.** Do not add, remove, or rename sections.

The template's sections are:
- `## Summary` — what we're building and how
- `## Technical Context` — language, dependencies, storage, testing, platform, constraints, scale
- `## Constitution Check` — verify against each project principle
- `## Project Structure` — documentation tree + source code tree
- `## Complexity Tracking` — justify anything beyond template defaults

### 5. Self-Review — These Three Checks Are Mandatory

**1. Template compliance.** Does the output match the template structure exactly? Every section present, no extra sections?

**2. Spec coverage.** Skim each FR in the spec. Can you point to a component that implements it? List any gaps. If an FR has no component, add one.

**3. Placeholder scan.** Search your plan for these plan failures:
- `TBD`, `TODO`, `implement later`, `fill in details`
- `Add appropriate error handling` / `add validation` / `handle edge cases` (without specifics)
- `Write tests for the above` (without actual test cases)
- `Similar to Task N` (repeat the code)
- References to types or functions not defined in the plan
Fix every one. If you can't be specific, move it to the Complexity Tracking section as an open question.

**4. Type consistency.** Do names, signatures, and property names match across sections? `UserStore` in one section and `UserRepository` in another is a bug. Check every cross-reference.

Fix issues inline. Don't re-review — just fix and move on.

### 6. Hand Off

```
Plan ready at specs/{{FEATURE_ID}}/plan.md.

Next: `/spec.tasks` to break into executable tasks.
```

## Red Flags — STOP and Fix

- An FR with no corresponding component in the plan
- "TBD" anywhere in the plan
- "Add appropriate error handling" without specifics
- File mapping table missing or incomplete
- Constitution check skipped entirely
- 3+ "Open Questions" that are really just "we didn't decide"
