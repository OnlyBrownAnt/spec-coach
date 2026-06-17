---
name: spec-specify
description: Create or update the feature specification from a natural language feature description. Use when the user describes what they want to build.
handoffs:
  next: spec.plan
  optional_before: [spec.clarify, spec.checklist]
---

<HARD-GATE>
Do NOT invoke spec-plan, spec-implement, or any implementation action until you have written the spec, presented it, and received explicit user approval. This applies to EVERY feature regardless of perceived simplicity.
</HARD-GATE>

## Anti-Pattern: "This Is Too Simple To Need A Spec"

Every feature goes through spec. A config change, a one-line function, a validation rule — all of them. "Simple" features are where unexamined edge cases cause the most production bugs. The spec can be short (5 bullet points for truly simple features), but you MUST write it.

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

**Load the constitution.** Read `.spec/memory/constitution.md` before drafting. The spec MUST honor every stated principle; if a requirement tensions a principle, surface it explicitly rather than silently contradicting one.

**Team hooks:** if `.spec/hooks.md` declares `specify`-phase steps, surface them; skip silently if absent/malformed.

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

Read `.spec/templates/spec-template.md`. Follow the structure exactly.

### 5. Write the Spec

**FEATURE_ID format**: `NNN-slug` — zero-padded 3-digit number (`001`, `002`, …) + kebab-case name.
Scan `specs/` for existing folders, pick the next number. Examples: `001-user-auth`, `002-payment-flow`.

Write `specs/{{FEATURE_ID}}/spec.md`.

**The template at `.spec/templates/spec-template.md` IS the authoritative structure. Follow it exactly.** Do not add, remove, or rename sections.

The template's sections are:
- `## User Scenarios & Testing` — prioritized user stories with Independent Test and Given/When/Then acceptance scenarios
- `### Edge Cases` — within User Scenarios
- `## Requirements` — Functional Requirements (FR-001 format) + Key Entities (if feature involves data)
- `## Success Criteria` — measurable outcomes (SC-001 format)
- `## Assumptions` — scope boundaries, dependencies, defaults chosen

### 6. Iterative Validation (up to 3 rounds)

A spec is not done after one pass. Run up to **3 rounds** of validation. Each round, fix what you find, then re-check. After round 3, anything still unresolved MUST be surfaced explicitly (an `[NEEDS CLARIFICATION]` marker or a stated assumption) — never silently dropped.

**Each round, verify mechanically**: run `.spec/scripts/bash/verify-spec.sh` against the drafted `specs/<FEATURE_ID>/spec.md`. It flags leftover placeholders (`TBD`, `TODO`, unfilled `[ALL_CAPS]`, and generic filler like "add appropriate error handling" without specifics). Resolve every finding before the next round.

**Prioritize unresolved issues in this order** — fix higher tiers first each round:

1. **Scope** — multi-system requests not decomposed; ambiguous purpose
2. **Security & data** — unvalidated inputs, unhandled data rules
3. **UX** — untestable user stories, missing acceptance scenarios
4. **Technical** — untestable FRs, missing edge cases, template deviations

The quality checks still apply — fold them into the rounds:
- Does the output match the template structure exactly? Every section present, no extra sections?
- Can a new team member understand this without asking "what does this mean"?
- Is every functional requirement testable?
- Are user stories prioritized, independently testable, with Given/When/Then scenarios?
- Are edge cases covered for every user story?

### 7. Hand Off

```
Spec ready at specs/{{FEATURE_ID}}/spec.md.

Next: `/spec.clarify` (resolve ambiguities) or `/spec.plan` (technical plan).
```

## Red Flags — STOP and Fix

- Writing a spec without proposing an approach first
- More than 3 [NEEDS CLARIFICATION] markers
- Zero edge cases listed
- Non-goals section is empty or says "none"
- Implementation details leaking into the spec ("use Redis for caching")
- User stories that can't be tested independently
