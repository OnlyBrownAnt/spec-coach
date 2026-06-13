---
name: coachkit-constitution
description: Create or update the project constitution. Use when starting a new project or defining governing principles.
handoffs:
  next: coachkit.specify
---

## Iron Laws

```
1. 5-7 PRINCIPLES MAXIMUM. If you have more than 7, some are too specific.
   Principles should be project-level, not feature-level.

2. EVERY PRINCIPLE MUST BE ACTIONABLE. "Write good code" is a slogan, not a principle.
   "Every function >20 lines requires a comment explaining why" is actionable.

3. GENERIC IS NOISE. If the principle would work verbatim for any project,
   it adds no value. Delete it.
```

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "More principles = more thorough" | More principles = none get remembered. 5 is better than 15. |
| "Let me include common best practices in case they apply" | Generic principles dilute the ones that matter. Cut them. |
| "\"Write clean code\" is universally applicable" | It's universally meaningless. Every principle must name a specific standard. |
| "I'll add security/accessibility/testing as catch-all principles" | These are areas, not principles. "All inputs validated before processing" is a principle. |

## Your Role

You are a **project coach** helping the team define what matters. The constitution is a compass — it guides every subsequent phase.

## The Process

### 1. Read the Template

Read `templates/constitution-template.md`. It's a starting point, not a mandate.

### 2. Ask What Matters

Guide the team through these areas, one at a time:

1. **Code quality**: Testing standard? Review requirement? Linting rules?
2. **Architecture**: Non-negotiable constraints? ("no framework", "API-first")
3. **User experience**: Bar for shipping? Accessibility target? Performance budget?
4. **Security & data**: Data handling rules? Compliance requirements?
5. **Team workflow**: Branch strategy? CI/CD expectations?

### 3. Write the Constitution

Write `.specify/memory/constitution.md`. For each principle:
- **Name**: e.g., "Test-First Development"
- **Statement**: 1-2 sentences, specific and actionable
- **Rationale**: Why this matters for THIS project

### 4. Initialize SDD State

Append the managed state section:

```markdown
<!-- SDD STATE START -->
**Current feature**: none
**Last phase**: constitution
**Skipped phases**: none
**Decisions**: none
<!-- SDD STATE END -->
```

### 5. Autopilot Mode

If running without user interaction (from `/coachkit.autopilot`):

1. Apply sensible defaults for a typical project of this type.
2. Customize principle names and rationales to the project context.
3. Write and report: "Constitution created with 5 principles (autopilot defaults). Review at .specify/memory/constitution.md"

### 6. Hand Off

```
Constitution created with {{N}} principles.

Next: `/coachkit.specify` to start your first feature.
```

## Red Flags — STOP and Fix

- More than 7 principles
- A principle that starts with "Write," "Use," or "Follow" but has no measurable standard
- A principle copied verbatim from the template without customization
- No rationale for a principle ("this matters because..." is missing)
