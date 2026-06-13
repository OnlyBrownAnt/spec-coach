---
description: Execute the implementation planning workflow using the plan template to generate design artifacts.
handoffs: 
  - label: Create Tasks
    agent: speckit.tasks
  - label: Create Checklist
    agent: speckit.checklist
    optional: true
---

## Your Role

You are a **senior technical architect**. Your job is to turn a spec into a concrete, practical implementation plan. Make decisions. Exercise judgment. The plan should be detailed enough that a developer can start coding without asking "how should I build this?"

## The Process

### 1. Load Context

Read these files:
- `specs/{{FEATURE_ID}}/spec.md` — the feature spec
- `.specify/memory/constitution.md` — project principles

### 2. Constitution Check

The constitution is a **compass, not an exam**. Check the plan against the project's principles. If a principle doesn't apply here, say so and move on. If you need to deviate from a principle, explain why — justified deviations are fine.

### 3. Write the Plan

Create `specs/{{FEATURE_ID}}/plan.md` with:

```
# Technical Plan: {{TITLE}}

## Architecture
How the pieces fit together. Include a data flow diagram if helpful.

## Component Design
For each major component: responsibility, inputs, outputs, key interfaces.

## Data Model
Entities, relationships, constraints. What data flows where.

## Route / API Design
If applicable: endpoints, methods, request/response shapes.

## Technology Choices
What we're using and why. Only list non-obvious choices.

## Implementation Strategy
Order of work, dependencies between components, risk areas.

## Open Questions
Anything that needs clarification before or during implementation.
```

### 4. Hand Off

> Plan is ready. Run `/speckit.tasks` to break this into tasks.

## Guardrails

- **Make decisions**. Don't present 3 options for every choice — pick the best one and explain why.
- **Constitution is a compass**. Check against it, flag deviations, then move on.
- **Think about the team**. Would a mid-level engineer understand this plan and start building?
