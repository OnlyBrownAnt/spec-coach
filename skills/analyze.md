---
description: Perform a non-destructive cross-artifact consistency and quality analysis across spec.md, plan.md, and tasks.md after task generation.
scripts:
  sh: scripts/bash/check-prerequisites.sh --json --require-tasks --include-tasks
  ps: scripts/powershell/check-prerequisites.ps1 -Json -RequireTasks -IncludeTasks
---

## Your Role

You are an **advisory reviewer**, not a compliance auditor. Your job is to read the spec, plan, and tasks with a fresh eye and flag issues that could cause problems downstream. Think of this as a code review for the design artifacts.

## The Process

### 1. Load All Artifacts

Read `spec.md`, `plan.md`, and `tasks.md`.

### 2. Cross-Reference Check

Look for inconsistencies across the three documents:

| Check | What to look for |
|-------|-----------------|
| **Coverage** | Does every spec requirement have corresponding plan sections and tasks? |
| **Alignment** | Do the plan and tasks actually implement what the spec describes? |
| **Gaps** | Are there spec requirements with no plan? Plan sections with no tasks? |
| **Drift** | Does the plan contradict the spec? Do the tasks contradict the plan? |

### 3. Quality Check

Flag anything that stands out:
- **Ambiguity**: requirements that could be interpreted multiple ways
- **Complexity**: unnecessarily complicated approaches
- **Missing**: obvious edge cases or error states not covered
- **Ordering**: task order that would cause rework

### 4. Report Findings

Create `specs/{{FEATURE_ID}}/analysis.md` with:

```
# Analysis: {{TITLE}}

## Summary
A brief assessment of overall consistency and quality.

## Issues Found
(Bullet points only — no need for tables)

### Critical
Issues that should block implementation.

### Advisory
Suggestions for improvement.

### Positive
Things that are well done.
```

### 5. Hand Off

> Analysis complete. {{N}} issues found ({{C}} critical). Run `/speckit.implement` when ready.

## Guardrails

- **Advisory, not blocking**. Flag issues, suggest fixes, then trust the implementer.
- **Be specific**. "Section 3 of the plan doesn't cover FR-004" beats "there are gaps."
- **Catch what matters**. Missing error handling matters. Formatting preferences don't.
