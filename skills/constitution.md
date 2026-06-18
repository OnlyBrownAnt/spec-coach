---
name: spec-constitution
description: Create or update the project constitution. Use when starting a new project or defining governing principles.
handoffs:
  next: spec.specify
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


**Violating the letter of these laws is violating the spirit of this process.**

## Common Rationalizations — STOP When You Think These

| You might think | Reality |
|----------------|---------|
| "More principles = more thorough" | More principles = none get remembered. 5 is better than 15. |
| "Let me include common best practices in case they apply" | Generic principles dilute the ones that matter. Cut them. |
| "\"Write clean code\" is universally applicable" | It's universally meaningless. Every principle must name a specific standard. |
| "I'll add security/accessibility/testing as catch-all principles" | These are areas, not principles. "All inputs validated before processing" is a principle. |

## Your Role

You are a **project coach** helping the team define what matters. The constitution is the project's **global charter** — a human-owned, agent-agnostic compass on the same tier as `CLAUDE.md`. Treat it as IP: **amend never overwrite, preserve never delete.** It guides every subsequent phase.

## Constitution State: Amend or Author?

Before writing anything, read the constitution's authoring state by running the status advisor (non-blocking — it advises, never gates):

```bash
bash .spec/scripts/bash/verify-constitution-sync.sh
```

Read the `Constitution state:` line, then branch:

- **`AUTHORED`** → take the **amend** path. The charter already exists; evolve it, do not recreate it. Anchor to the existing principle set: **never rewrite a settled principle unless that principle is the explicit target of the amendment.** Rename, add, or remove a principle only when the team asks for that specific change; bump the version and run the propagation checklist (step 4). A full from-scratch rewrite of an AUTHORED charter requires an explicit `--reset` — never do it silently.
- **`TEMPLATE`** or **`ABSENT`** → take the **cold-start (author)** path below. Seed the proposal from concrete repo signals first (step 2), then write.

This branch is what keeps a re-run from drifting settled principles: AUTHORED means the team already decided — respect it.

## The Process

### 1. Read the Template

Read `.spec/templates/constitution-template.md`. Follow its structure.

The template's sections are:
- `## Core Principles` — 5-7 principles, each as `### [PRINCIPLE_NAME]` with a description
- `## [SECTION_2_NAME]` — additional constraints (e.g., Security Requirements, Development Workflow)
- `## [SECTION_3_NAME]` — additional constraints or process rules
- `## Governance` — amendment process, constitutional review
- Footer: Version, Ratified, Last Amended

### 2. Ask What Matters (seeded cold-start)

On the cold-start path, BEFORE asking abstract questions, read concrete repo signals and **propose** candidate principles + the two flexible sections as a starting menu for the team to ratify — do not write the constitution until the human approves:

- `package.json` — project name + dependency list (constraints fall out of deps: zero-dep, a specific framework, etc.).
- The primary source / `skills` directory — structure reveals architecture (CLI? library? single entry point?).
- `README.md` — the project's stated purpose and audience.
- Existing `specs/` — prior decisions already encoded.

Then guide the team through these areas, one at a time, refining the proposal:

1. **Code quality**: Testing standard? Review requirement? Linting rules?
2. **Architecture**: Non-negotiable constraints? ("no framework", "API-first")
3. **User experience**: Bar for shipping? Accessibility target? Performance budget?
4. **Security & data**: Data handling rules? Compliance requirements?
5. **Team workflow**: Branch strategy? CI/CD expectations?

### 3. Write the Constitution

Write `.spec/memory/constitution.md`. **Follow the template structure exactly.** For each principle under `## Core Principles`, use `### Principle Name` as the heading and write a 1-2 sentence description followed by a rationale explaining why it matters for THIS project.

Fill in both flexible sections (`[SECTION_2_NAME]`, `[SECTION_3_NAME]`) — rename them to fit your project. Fill in the Governance section and the version footer.

### 4. Propagate Amendments & Record Sync Impact Report

**Skip on first creation** — this step applies only when *updating* an existing constitution.

When a principle is added, removed, or renamed, the change must flow to the artifacts that depend on it. The constitution's authority rots the moment an amendment stops at the file.

**Version the amendment** — bump the footer `Version` per semantic rules and state the rationale:

- **MAJOR** — a principle removed, redefined, or renamed.
- **MINOR** — a principle or section added, or guidance materially expanded.
- **PATCH** — wording or clarification with no semantic change.

**Amendment Propagation Checklist** — re-align each dependent artifact:

1. `.spec/templates/spec-template.md`, `.spec/templates/plan-template.md`, and `.spec/templates/tasks-template.md` — any section that references the principles (especially `## Constitution Check`); update to match the amended set.
2. Every installed skill that embeds principle wording (e.g., `/spec-plan`'s Constitution Check, `/spec-specify`'s principle-loading step) — re-read and adjust.
3. Existing `specs/*/plan.md` files — their Constitution Check may cite superseded principles; flag them for re-review.

**Record a Sync Impact Report** so the change is auditable and machine-detectable. Append this block to `.spec/memory/constitution.md`:

```
<!-- SYNC IMPACT START -->
Amended: <old principle> → <new principle>   (or Added: / Removed:)
Version: <old> → <new>, Last Amended: <date>
Pending re-alignment: templates/plan-template.md
<!-- SYNC IMPACT END -->
```

**Verify with the tool** (non-blocking — it advises, never gates): run `.spec/scripts/bash/verify-constitution-sync.sh`. It reports the current principle set and the amendment status: `AMENDMENT PENDING` while the block exists, `INCOMPLETE` if the block is malformed, and `CLEAN` once you remove the block after re-alignment.

Once every dependent artifact is re-aligned and the script reports `CLEAN`, delete the SYNC IMPACT block.

### 5. Autopilot Mode

If running without user interaction (from `/spec.autopilot`):

1. Apply sensible defaults for a typical project of this type.
2. Customize principle names and rationales to the project context.
3. Write and report: "Constitution created with 5 principles (autopilot defaults). Review at .spec/memory/constitution.md"

### 6. Load Team Hooks (optional)

Teams can extend the constitution workflow without editing source skills, via a project-local `.spec/hooks.md`. If it exists, read it before finalizing the constitution and surface any declared `constitution`-phase steps. If the file is absent or malformed, skip silently — never fail the workflow on it.

`.spec/hooks.md` format — a markdown list grouped by phase:

```
## constitution
- Run the internal compliance checklist before ratifying.
- Confirm data-handling principles are reviewed.
```

Surface each declared step; the team owns their hooks. You surface, they act.

### 7. Hand Off

```
Constitution created with {{N}} principles.

Next: `/spec.specify` to start your first feature.
```

## Red Flags — STOP and Fix

- More than 7 principles
- A principle that starts with "Write," "Use," or "Follow" but has no measurable standard
- A principle copied verbatim from the template without customization
- No rationale for a principle ("this matters because..." is missing)
