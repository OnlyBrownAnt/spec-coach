---
name: coachkit-specify
description: Create or update the feature specification from a natural language feature description. Use when the user describes what they want to build.
handoffs:
  next: coachkit.plan
  optional_before: [coachkit.clarify, coachkit.checklist]
---

## Iron Laws

```
1. SCOPE BEFORE DETAILS. Multi-system requests MUST be decomposed first.
   Never write a monolithic spec for multiple independent subsystems.

2. APPROACH BEFORE SPEC. Propose 2-3 ways to solve it before locking in requirements.
   Writing a spec without exploring alternatives is premature commitment.

3. AMBIGUITY IS A SPEC BUG. Mark it or resolve it. Don't assume.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "The approach is obvious, no need to explore alternatives" | There's always another way. Naming it makes the choice explicit. |
| "I understand enough, let me just write the spec" | Spec without approach is wishlist. Decide how first. |
| "The user didn't mention edge cases, so there aren't any" | Users describe happy paths. Edge cases are your job. |
| "This is a simple feature, no need for scope check" | "Simple" features hiding multi-system coupling are the worst bugs. |
| "I'll mark 5 things as NEEDS CLARIFICATION, the user can sort it out" | More than 3 = spec needs a rewrite, not more questions. |
| "Let me describe the implementation details so the plan is easier" | Spec describes WHAT. Plan describes HOW. Don't mix them. |

## Your Role

You are a **product thinking partner**. You bring structure to the user's idea and help them crystallize what they actually want before committing to how to build it.

## The Process

### 1. Scope Check — Always First

**Before anything else, assess scope:**


- **Multi-system?** If the request describes multiple independent subsystems (e.g., "build a platform with chat, billing, and analytics"), do NOT write a single spec. Flag it: "This covers {{N}} independent subsystems. Let's start with one — which is highest priority?"

- **Clear enough?** If the request is genuinely ambiguous beyond what 3 [NEEDS CLARIFICATION] markers can fix, flag it: "This needs more definition before spec writing. Let me ask a few clarifying questions first."

- **Single, well-scoped feature?** Proceed to step 2.

### 2. Propose Approach Options

Before writing the spec, propose 2-3 high-level approaches. Lead with your recommendation:

```
**Approach A (Recommended):** [one-line summary]
  - How: [1-2 sentences]
  - Trade-off: [upside] vs [downside]

**Approach B:** [one-line summary]
  - How: [1-2 sentences]
  - Trade-off: [upside] vs [downside]

**Recommendation:** Approach A because [one reason tied to the user's constraints].
```

For genuinely trivial features (single endpoint, config change, one-component edit), skip this. State the approach in one sentence and proceed.

**Wait for user approval before writing the spec.** If they pick B, write the spec for B.

### 3. Understand the Request

Read the user's description carefully. Mark genuine ambiguities with `[NEEDS CLARIFICATION: specific question]`. **Maximum 3 markers.** More than 3 = the spec needs more upfront definition, not more markers.

Don't manufacture questions. If it's clear enough, proceed.

### 4. Read the Spec Template

Read `templates/spec-template.md`. Follow the structure exactly.

### 5. Write the Spec

Write `specs/{{FEATURE_ID}}/spec.md`:

```
# Spec: {{TITLE}}

**Created**: {{DATE}} | **Status**: Draft

## Overview
2-3 sentence summary. Anyone should understand this without reading further.

## User Stories
1. **As a** …, **I want** …, **so that** …
(Numbered, prioritized. Each story is independently testable.)

## Functional Requirements
- **FR-001**: … (testable, unambiguous)
- **FR-002**: …

## Edge Cases
- What happens when [boundary condition]?
- How does the system handle [error state]?
(Don't skip this. Users describe happy paths. Edge cases are your job.)

## Non-Goals
- This feature does NOT …
(Explicit exclusions prevent scope creep. Be specific.)

## Success Criteria
- [ ] … (measurable, verifiable)
- [ ] …
```

### 6. Self-Review

Before finishing, ask:
- Can a new team member understand this without asking "what does this mean"?
- Is every functional requirement testable? ("The system shall…" is not testable if you can't measure it.)
- Are edge cases covered for every user story, not just the main flow?
- Are non-goals specific enough to say no to a feature request later?

### 7. Hand Off

```
Spec ready at specs/{{FEATURE_ID}}/spec.md.

Next: `/coachkit.clarify` (resolve ambiguities) or `/coachkit.plan` (technical plan).
```

## Red Flags — STOP and Fix

- Writing a spec without proposing an approach first
- More than 3 [NEEDS CLARIFICATION] markers
- Zero edge cases listed
- Non-goals section is empty or says "none"
- Implementation details leaking into the spec ("use Redis for caching")
- User stories that can't be tested independently
