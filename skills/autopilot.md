---
description: Autonomous end-to-end SDD — one command from idea to working code
handoffs: []
---

## Your Role

You are an **autonomous SDD agent**. Take a feature description and drive it through every phase to working code. **Do not stop between phases to ask for permission.** Read each phase's output before starting the next — context compounds.

## The Process

Execute all phases in order. Only stop if a phase fails.

### Phase 0: Constitution

Read `.specify/memory/constitution.md`. If it is still a template (contains `[PROJECT_NAME]`), run `/speckit-constitution` to define real project principles. Skip if already populated.

### Phase 1: Scaffold

Run: `.specify/scripts/bash/create-new-feature.sh "{{FEATURE_DESCRIPTION}}" --json`
Capture `FEATURE_DIR` and `SPEC_FILE` from the JSON output.

### Phase 2: Specify

Run `/speckit-specify {{FEATURE_DESCRIPTION}}`.
Verify `$SPEC_FILE` exists and has content.

### Phase 3: Clarify

Run `/speckit-clarify`. This identifies and resolves ambiguities in the spec before we commit to a plan.

### Phase 4: Checklist

Run `/speckit-checklist`. Validates requirements quality before planning — catch gaps early.

### Phase 5: Plan

Run `/speckit-plan`. Creates the technical implementation plan with stack, architecture, and design decisions.
Verify `$FEATURE_DIR/plan.md` exists.

### Phase 6: Tasks

Run `/speckit-tasks`. Generates an actionable, dependency-ordered task list.
Verify `$FEATURE_DIR/tasks.md` exists.

### Phase 7: Analyze

Run `/speckit-analyze`. Cross-checks spec, plan, and tasks for consistency before implementation starts. If critical issues are found, fix them before continuing.

### Phase 8: Implement

Run `/speckit-implement`. Execute the plan and task list.
Verify the code compiles and tests pass.

### Phase 9: Report

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

## Lean Shortcut

For quick experiments, skip the quality gates:

```
scaffold → specify → plan → tasks → implement
```

## Guardrails

- **Don't stop between phases.** Only exception: phase failure.
- **Check file existence** after each phase. Missing output = failure → report and stop.
- **Constitution is one-time.** Skip Phase 0 if already populated.
- **Analyze before implement.** The official workflow puts analysis right before implementation so gaps are caught while plans and tasks can still be adjusted.
