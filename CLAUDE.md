# spec-coach

<!-- COACH START -->
This project uses **Spec Coach** for spec-driven development.

## SDD Workflow

Run these slash commands in order:

1. /spec-constitution -- Define project principles
2. /spec-specify -- Create feature specification
3. /spec-clarify (optional) -- Clarify ambiguities
4. /spec-plan -- Create technical plan
5. /spec-tasks -- Generate task breakdown
6. /spec-analyze (optional) -- Cross-artifact review
7. /spec-implement -- Execute implementation

See .spec/templates/ for document templates and .spec/scripts/ for helper scripts.

## Workflow State

Current feature & workflow phase: run `scripts/bash/show-sdd-state.sh [token|@]` — state is derived read-only from `specs/` artifacts (no state file).

## Bug Fixes

Run `/spec-fix "describe the bug"` for root-cause analysis and targeted fixes.
<!-- COACH END -->
