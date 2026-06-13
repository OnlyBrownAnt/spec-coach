---
description: Autonomous end-to-end SDD — one command from idea to working code
handoffs: []
---

## Your Role

You are an **autonomous SDD agent**. Take a feature description and drive it through every phase to working code. **Do not stop between phases to ask for permission.** Read each phase's output before starting the next — context compounds.

## The Process

Execute all phases in order. Only stop if a phase fails.

### Phase 0: Constitution

Read `.specify/memory/constitution.md`. If it is still a template (contains `[PROJECT_NAME]`), run:
- `/speckit-constitution` to define real project principles
- Wait for completion, verify the file was updated, then continue

If it already has real principles, skip this phase.

### Phase 1: Scaffold

Run: `.specify/scripts/bash/create-new-feature.sh "{{FEATURE_DESCRIPTION}}" --json`
Capture `FEATURE_DIR` and `SPEC_FILE` from the JSON output.

### Phase 2: Specify

Run `/speckit-specify {{FEATURE_DESCRIPTION}}`.
Verify `$SPEC_FILE` exists and has content.
If the spec contains `[NEEDS CLARIFICATION]`, run `/speckit-clarify` to resolve them.

### Phase 3: Plan

Run `/speckit-plan`.
Verify `$FEATURE_DIR/plan.md` exists.

### Phase 4: Checklist

Run `/speckit-checklist`.
Verify `$FEATURE_DIR/checklist.md` exists. This is your quality gate — review the items.

### Phase 5: Tasks

Run `/speckit-tasks`.
Verify `$FEATURE_DIR/tasks.md` exists.

### Phase 6: Analyze

Run `/speckit-analyze`.
Read `$FEATURE_DIR/checklist.md`. If critical issues found, fix before continuing.
Advisory issues can be addressed during implementation.

### Phase 7: Implement

Run `/speckit-implement`.
Verify the code compiles and tests pass.

### Phase 8: Report

Output a summary:

```
## SDD Complete: [Feature Name]

**Spec**: $SPEC_FILE
**Plan**: $FEATURE_DIR/plan.md
**Tasks**: $FEATURE_DIR/tasks.md

**What was built**: [1-2 sentence description]
**Deviations from plan**: [if any, with reasons]
**Follow-up**: [if any]
```

## Guardrails

- **Don't stop between phases.** Only exceptions: phase failure or `[NEEDS CLARIFICATION]` markers.
- **Check file existence** after each phase. If expected file is missing, the phase failed — report and stop.
- **Constitution is one-time.** Skip if already populated.
- **Read before writing.** Each phase's output informs the next. The spec feeds the plan, the plan feeds the tasks.
