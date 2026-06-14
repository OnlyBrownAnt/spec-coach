---
name: coachkit-tasks
description: Break the technical plan into an actionable, dependency-ordered task list. Use after the plan is complete.
handoffs:
  next: coachkit.implement
  optional_before: [coachkit.analyze]
  optional_after: []
---

<HARD-GATE>
Do NOT invoke coachkit-implement or write any code until every task has a specific file, a verification step, and a dependency annotation. A task saying "build the X system" is not a task — it's a wish.
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

Read `templates/tasks-template.md` for the structure.

### 3. Derive Tasks from the Plan

For each component in the plan's file mapping, derive the tasks needed to build it. Use the plan's implementation strategy to determine order.

### 4. Write the Task List

Write `specs/{{FEATURE_ID}}/tasks.md`:

```
# Tasks: {{TITLE}}

**Feature**: {{FEATURE_ID}} | **Plan**: plan.md | **Spec**: spec.md

## Phase 1: Setup
- [ ] T001 [P] Setup project scaffolding and dependencies
- [ ] T002 [P] Configure linting and test framework

## Phase 2: Core
- [ ] T003 Implement UserStore with create and read operations
- [ ] T004 [P] Implement AuthService with session validation
- [ ] T005 Implement PhotoAlbum model with CRUD endpoints

## Phase 3: Integration
- [ ] T006 Wire UserStore into AuthService
- [ ] T007 Connect PhotoAlbum to frontend components

## Phase 4: Polish
- [ ] T008 [P] Add input validation error messages
- [ ] T009 [P] Write API documentation
- [ ] T010 End-to-end smoke test of full feature
```

**Task format:**

- Each task starts with a verb: Create, Add, Implement, Wire, Connect, Write, Remove, Refactor
- Each task names the specific file, function, or component
- Tasks marked `[P]` are truly independent — they can run in parallel without conflicts

**Granularity:**

- One task = one meaningful commit. Typically 2-15 minutes of focused work.
- If a task would take >30 minutes, split it.
- If a task is "add a semicolon," merge it with the task it belongs to.

### 5. Add Dependency Section

```
## Dependencies

Setup → Core → Integration → Polish

Within Core:
  T004 depends on T003 (AuthService needs UserStore)
  T005 is independent of T003 and T004 [P]

Tasks marked [P] in the same phase can run in parallel.
```

### 6. Cross-Check Against the Plan

Verify: every component in the plan's file mapping table has at least one task. List any gaps.

### 7. Hand Off

```
Tasks ready at specs/{{FEATURE_ID}}/tasks.md ({{N}} tasks, {{P}} parallelizable).

Next: `/coachkit.analyze` to cross-check consistency, or `/coachkit.implement` to start building.
```

## Red Flags — STOP and Fix

- A task that touches more than 3 files without a clear reason
- A task that says "Build the X system" without naming specific files
- No tasks marked [P] (look harder — some setup is always parallelizable)
- Every task in a phase marked [P] (if all are parallel, dependencies are wrong)
- A component in the plan's file mapping with zero tasks
