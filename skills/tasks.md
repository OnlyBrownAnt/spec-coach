---
name: spec-tasks
description: Break the technical plan into an actionable, dependency-ordered task list. Use after the plan is complete.
handoffs:
  next: spec.implement
  optional_before: [spec.analyze]
  optional_after: []
---

<HARD-GATE>
Do NOT invoke spec-implement or write any code until every task has a specific file, a verification step, and a dependency annotation. A task saying "build the X system" is not a task — it's a wish.
</HARD-GATE>

## Iron Laws

```
1. EVERY TASK PRODUCES ONE MEANINGFUL COMMIT. If a task touches 5 unrelated files,
   it's multiple tasks. If a task is "write one line," it's too small.

2. DEPENDENCIES BEFORE ORDER. You can't parallelize what you haven't mapped.
   Mark every task that can run concurrently with [P].

3. THE TASK LIST IS THE IMPLEMENTER'S MAP. If a task says "build the auth system,"
   the implementer is lost. Break it down.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "I'll group these 5 small changes into one task" | One commit per concern. Grouping masks what broke. |
| "The plan has all the details, tasks can be high-level" | Tasks must be self-contained. The implementer may not re-read the plan. |
| "Task order doesn't matter much" | Wrong order causes rework. Earlier tasks unblock later ones. |
| "Every task depends on the previous, can't parallelize" | Look harder. Setup tasks are often independent. |
| "I'll mark this task as [P], they can figure out conflicts" | [P] means truly independent. Mark only when it can run simultaneously. |

## Your Role

You are a **technical lead breaking down work**. Turn the plan into a list where each item is one focused commit. Think about what unblocks what.

## The Process

### 1. Load Context

Read:
- `specs/{{FEATURE_ID}}/spec.md` — what we're building
- `specs/{{FEATURE_ID}}/plan.md` — how we're building it, including the file mapping table

### 2. Read the Tasks Template

Read `.spec/templates/tasks-template.md` for the structure.

### 3. Derive Tasks from the Plan

For each component in the plan's file mapping, derive the tasks needed to build it. Use the plan's implementation strategy to determine order.

### 4. Write the Task List

Write `specs/{{FEATURE_ID}}/tasks.md`.

**The template at `.spec/templates/tasks-template.md` IS the authoritative structure. Follow it exactly.** Do not add, remove, or rename sections.

The template's phases are:
- `## Phase 1: Setup (Shared Infrastructure)` — project scaffolding, dependencies, config
- `## Phase 2: Foundational (Blocking Prerequisites)` — must complete before any user story
- `## Phase 3+: User Story N - [Title] (Priority: PN)` — one phase per user story, each with:
  - `**Goal**`, `**Independent Test**`, `**Tests**` (optional), `**Implementation**` subtasks, `**Checkpoint**`
- `## Phase N: Polish & Cross-Cutting Concerns`
- `## Dependencies & Execution Order` — phase dependencies, user story dependencies, parallel opportunities
- `## Implementation Strategy` — MVP first, incremental delivery, parallel team strategy

**Task granularity:** One task = one meaningful commit (2-15 min work). Name specific files, functions, or components. Mark independent tasks `[P]`. Follow the template's `[US1]`/`[US2]` labels to trace each task to its user story.

### 5. Cross-Check Against the Plan

Verify: every user story from the spec has a corresponding phase. Every component from the plan has at least one task. List any gaps.

### 7. Hand Off

```
Tasks ready at specs/{{FEATURE_ID}}/tasks.md ({{N}} tasks, {{P}} parallelizable).

Next: `/spec.analyze` to cross-check consistency, or `/spec.implement` to start building.
```

## Red Flags — STOP and Fix

- A task that touches more than 3 files without a clear reason
- A task that says "Build the X system" without naming specific files
- No tasks marked [P] (look harder — some setup is always parallelizable)
- Every task in a phase marked [P] (if all are parallel, dependencies are wrong)
- A component in the plan's file mapping with zero tasks
