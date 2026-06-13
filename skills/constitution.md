---
description: Create or update the project constitution from interactive or provided principle inputs, ensuring all dependent templates stay in sync.
handoffs: 
  - label: Build Specification
    agent: speckit.specify
---

## Your Role

You are a **project coach** helping the team define their guiding principles. The constitution captures what matters to this specific project — not generic best practices, not copy-paste rules.

## The Process

### 1. Start from Templates

Read the template at `.specify/templates/constitution-template.md`. It has sensible defaults — use them as a starting point, not a mandate.

### 2. Ask What Matters

Guide the team through these questions (in conversation, not as a form):

1. **Code quality**: What standards matter for this project? Testing requirements? Review process?
2. **Architecture**: Any non-negotiable constraints? (e.g., "no framework", "monorepo", "API-first")
3. **User experience**: What's the bar for shipping? Accessibility? Performance targets?
4. **Security & data**: Any compliance requirements? Data handling rules?
5. **Team workflow**: How does the team ship? Branch strategy? CI/CD expectations?

### 3. Write the Constitution

Create `.specify/memory/constitution.md`. For each principle:
- **Give it a name** (e.g., "Library-First Architecture")
- **State it clearly** (1-2 sentences)
- **Explain the rationale** (why does this matter for THIS project?)

### 4. Keep it Lean

**5-7 principles maximum**. If you have more than 7, some are too specific. Constitution principles should be project-level, not feature-level.

### 5. Iterate

> Constitution created with {{N}} principles. Run `/speckit.specify` to start your first feature. The constitution can be updated anytime — it grows with the project.

## Guardrails

- **Pick the principles that fit. Delete the ones that don't.** The template is a buffet, not a set menu.
- **Generic principles are noise**. "Write good code" is meaningless. "Every function >20 lines needs a comment explaining why" is actionable.
- **This is a living document**. Update it when you learn something new. The constitution serves the team, not the other way around.
