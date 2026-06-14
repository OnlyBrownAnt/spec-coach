---
name: coachkit-checklist
description: Generate a custom quality checklist for the current feature based on the spec. Use after spec is stable, before or alongside planning.
handoffs:
  next: coachkit.plan
---

## Iron Laws

```
1. 10-15 ITEMS MAXIMUM. A 50-item checklist is a compliance form. It gets ignored.
   Focus on what actually breaks.

2. EVERY ITEM MUST BE ANSWERABLE WITH "YES" OR "NO."
   "Maybe" and "partially" mean the item is too vague. Rewrite it.

3. CONTEXT OVER TEMPLATES. Generic checklist items ("Code compiles") are noise.
   Every item must reference a specific risk from THIS spec.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "More items = more thorough" | More items = less chance any get checked. Quality over quantity. |
| "Generic items are safe, they always apply" | Generic items waste time. If it always applies, it tests nothing specific. |
| "I'll add security items even though this is a UI-only feature" | Checklist items must be context-relevant. Check for what CAN go wrong. |
| "Let me cover every edge case from the spec" | Checklist is a subset of spec risks, not a duplicate of the spec. |

## Your Role

You are a **quality coach**. Generate a short, focused checklist. The team uses this to self-check before calling the feature done.

## The Process

### 1. Understand the Feature

Read `specs/{{FEATURE_ID}}/spec.md`. Identify what could realistically go wrong:
- What are the riskiest requirements?
- What edge cases are most likely to be missed?
- What integration points could break?

### 2. Generate the Checklist

Write `specs/{{FEATURE_ID}}/checklist.md`. 10-15 items, organized by area:

```
# Quality Checklist: {{TITLE}}

## Correctness
- [ ] FR-001: {{specific check tied to a requirement}}
- [ ] FR-002: {{specific check}}

## Edge Cases
- [ ] {{specific edge case}}: {{what to verify}}
- [ ] {{specific boundary condition}}: {{expected behavior}}

## User Experience
- [ ] {{specific interaction}}: {{what the user should see}}
- [ ] {{error state}}: {{error message is shown}}

## Integration
- [ ] {{integration point}}: {{contract is respected}}
```

### 3. Every Item Must Be

- **Verifiable**: answer "yes" or "no"
- **Specific**: names the requirement, component, or edge case being checked
- **Contextual**: if the same item would appear on any project's checklist, it's too generic

### 4. Hand Off

```
Checklist ready at specs/{{FEATURE_ID}}/checklist.md ({{N}} items).

Next: `/coachkit.plan` to continue.
```

## Red Flags — STOP and Fix

- More than 15 items
- An item that can't be answered "yes" or "no"
- "Code compiles" or "Tests pass" (these are already covered by implement's verification gate)
- Items copied verbatim from the spec without translation into a checkable action
