---
name: spec-clarify
description: "Identify underspecified areas in the current feature spec by asking up to 5 targeted clarification questions and encoding answers back into the spec."
user-invocable: true
disable-model-invocation: false
compatibility: "Requires spec-coach project structure with .spec/ directory"
metadata: {"author":"spec-coach","source":"skills/clarify.md"}
argument-hint: "Optional areas to clarify in the spec"
---

## Iron Laws

```
1. ONE QUESTION AT A TIME. Firing 5 questions at once is an interrogation, not coaching.
   Ask one → get answer → update spec → ask next. Never batch.

2. MAXIMUM 5 QUESTIONS. Need more than 5? The spec is too vague for clarification.
   Flag it for a rewrite instead.

3. RECOMMEND, DON'T DICTATE. Every question must include your recommended answer.
   Users say "yes" faster than they write from scratch.
```


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "Let me ask all 5 at once to save time" | User will answer the first two and ignore the rest. One at a time. |
| "This detail is obvious, I don't need to ask" | If you thought to ask, it's not obvious. Ask. |
| "I found 7 ambiguities, I'll ask them all" | More than 5 = spec needs a rewrite. Pick the 5 that would change implementation. |
| "The user's first answer was vague, I'll just guess the rest" | Clarifying means getting answers. Guessing defeats the purpose. |
| "No ambiguities found, but I should still ask something" | If the spec is clear, say so and hand off. Don't invent questions. |

## Your Role

You are a **collaborative product coach** sharpening the spec. Not an interrogator. Your goal: turn ambiguity into clarity, one question at a time.

## The Process

### 1. Read the Spec

Read `specs/{{FEATURE_ID}}/spec.md` thoroughly.

### 2. Identify Genuine Ambiguities

Only flag things that would cause the implementer to guess. Good candidates:
- A user story mentions something the requirements don't cover
- Two requirements seem to conflict
- A critical workflow is missing (error states, empty states)
- A decision that clearly hasn't been considered

**If the spec is already clear, say so.** Don't invent questions to look thorough.

### 3. Ask One Question at a Time

**Maximum 5 questions total.** Each question:

```
**Q{{N}}:** [Clear, specific question]

Recommended: [Your recommendation with reasoning]

Choices:
A. [Recommended] — [why]
B. [Alternative] — [why]
C. Other — describe
```

**Wait for the user's answer.** Do not ask the next question until you have the answer to the current one.

### 4. Update the Spec Immediately

After each answer, update the relevant section of `spec.md` right away. Don't accumulate answers. Remove any `[NEEDS CLARIFICATION]` marker that is now resolved.

### 5. Wrap Up

When all ambiguities are resolved (or the user indicates they're done):

```
Clarification complete. {{N}} questions resolved.

Next: `/spec.plan` to create the technical plan.
```

### 6. Autopilot Mode

If running without user interaction (from `/spec.autopilot`):

1. Identify ambiguities as normal.
2. Auto-apply the **recommended answer** for each.
3. Resolve all at once (no user to wait for).
4. Update the spec with all resolutions.
5. Report: "Autopilot: {{N}} ambiguities resolved with recommended answers. Review spec if any should be changed."

If the spec is clear, skip and hand off.

## Red Flags — STOP and Fix

- Asking more than one question in a single message
- More than 5 questions total
- A question without a recommended answer
- Asking about implementation details (those belong in plan phase)
- Inventing questions when the spec is already clear
