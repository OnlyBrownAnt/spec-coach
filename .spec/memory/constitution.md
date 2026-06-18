# Spec Coach Constitution

## Core Principles

### I. Markdown Is the Product

The skill files and templates ARE the product; the TypeScript code exists solely to distribute them. Every new SDD capability ships as a markdown skill first — code is written only when markdown genuinely cannot achieve the result.

**Why this matters**: Spec Coach competes on simplicity. The moment we reach for code to solve a coaching problem, we have lost the plot. A 200-line markdown skill that guides the AI well is worth more than 2000 lines of orchestration code.

### II. Coach, Not Gatekeeper

Skills guide through suggestion, not enforcement. Use "you should consider X" and "if Y applies" — never "ERROR: X is missing." The only place a hard requirement may live is inside a document template's MUST/SHOULD/MAY language, never inside an imperative skill command.

**Why this matters**: The project's philosophy is "Guidance over gates. Craftsmanship over compliance." Skills that bark orders produce compliant but mediocre output. Skills that coach produce craftsmanship.

### III. Zero Dependencies, Zero Friction

The CLI has zero production dependencies outside of TypeScript + tsx. Install must be a single command. The bar for adding any dependency is: "literally cannot ship this feature without it," and the justification must be recorded in the spec.

**Why this matters**: The primary competitive advantage over spec-kit is that spec-coach requires no Python, no pip, no package tree. Every dependency we add erodes that advantage.

### IV. Templates Are the Contract

Every document template uses RFC 2119 language (MUST, SHOULD, MAY) with deliberate intent, and every section states its documented purpose. The wording that appears in a template is the wording the AI will mirror in its output.

**Why this matters**: Templates are the output contract. If a template says "Describe the feature," the AI produces a paragraph. If it says "Describe the feature: what triggers it, what it produces, what it MUST NOT affect," the AI produces a specification.

### V. Verify What Ships

Tests must assert on the installed skill and template output (template completeness, install integrity, agent-format compliance) — not only on installer code paths. A passing suite means "the skills installed correctly and the templates are well-formed," not merely "runInit() did not throw."

**Why this matters**: The product is not the CLI; it is what the CLI installs. A suite that covers `runInit()` but never inspects the installed output is testing the wrong thing.

### VI. Read-Only on User Documents

No command moves, renames, deletes, or overwrites a file outside the paths spec-coach owns. The only permitted write into user space is reading a source in place and appending a new `specs/NNN-slug/` directory. spec-coach is a guest in the user's repository.

**Why this matters**: The user trusts spec-coach enough to run it inside their repository. Touching, renaming, or deleting a file they already had is an unrecoverable trust incident. Append-only is the floor of that trust.

## Development Constraints

- **Language**: TypeScript. The CLI is a single entry point (`src/cli.ts`) with command modules in `src/commands/`. Keep syntax boring; no minimum Node version is enforced beyond what tsx requires.
- **File structure is the contract**: Skills live in `.claude/skills/<name>/SKILL.md`, templates in `.spec/templates/<name>-template.md`, scripts in `.spec/scripts/bash/`. This layout IS the install contract — changing it breaks `spec-coach update`.
- **CLI surface — two isolated lifecycles**: the **corpus lifecycle** (`init`, `update`, `uninstall`) and the **agent lifecycle** (`agents add`/`update`/`remove`/`list`). The two never mutate each other's owned content: an agent can retire (`agents remove`) while the spec corpus is fully preserved. Document→spec conversion is the on-demand `/spec-absorb` skill, not a CLI command — it reads a document in place and writes `specs/NNN-slug/spec.md`, never touching the original. Adding a new top-level command requires a compelling reason documented in the spec.
- **Agent support is data-driven**: agents are defined by the root `agents.json` manifest. Adding an agent means adding one manifest entry (`key`, `name`, `dir`, `format`, `separator`, `frontmatter`, `contextFile`, `version`) — no TypeScript change, and no agent-specific branches inside individual skills.
- **Workflow state is derived, never stored**: state is computed read-only from `specs/NNN/` artifacts. No command writes a workflow-state file; `show-sdd-state.sh` is a non-driving reporter (always exits 0, never mutates). The writing path resolves the current feature strictly — single candidate or explicit input only — it never guesses among multiple features.

## Release & Verification Workflow

- **Branch strategy**: feature branches from `main`; a PR is required for all changes.
- **Versioning (package)**: MAJOR.MINOR.PATCH. MAJOR bumps when the installed file structure changes (breaks `update`); MINOR for new skills or template fields; PATCH for fixes that leave the install contract unchanged.
- **Versioning (this constitution)**: tracked separately from the package. MAJOR = a principle removed, redefined, or renamed; MINOR = a principle or section added or materially expanded; PATCH = wording or clarification with no semantic change.
- **Testing gates**: `npm test` must pass before merge; `npm run test:all` must pass before release.
- **Changelog**: every release documents what changed in the installed output, not only in the code.

## Governance

This constitution defines the non-negotiable principles for spec-coach. It supersedes any conflicting practice or habit.

- **Amendments**: require a documented rationale, a migration plan if the change affects installed output, and maintainer review. An amendment MUST be propagated to every dependent artifact (the spec/plan/tasks templates and any skill that embeds principle wording) via the `/spec-constitution` propagation checklist — the constitution's authority rots the moment an amendment stops at the file.
- **Compliance**: every PR states which principles it touches (or "none"). A PR that violates a principle requires either a revision or a constitution amendment — no silent violations.
- **Complexity must be justified**: if a change adds a file, a dependency, or a new concept, the PR description must explain why simpler alternatives were rejected.
- **Runtime guidance**: day-to-day practices (linting, local setup) live in `CLAUDE.md`, not here. **Commit convention** lives in `.spec/convention.md` — a human-owned, project-configurable standard that the SDD skills coach and `verify-commit.sh` advise. This constitution is principles; `CLAUDE.md` and `.spec/convention.md` are playbooks.

**Version**: 2.0.0 | **Ratified**: 2026-06-18 | **Last Amended**: 2026-06-18
