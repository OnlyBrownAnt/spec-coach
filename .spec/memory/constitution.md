# Spec Coach Constitution

## Core Principles

### I. Markdown Is the Product

The skill files and templates ARE the product. TypeScript code exists solely to distribute them. Every new SDD capability ships as a markdown skill first — code is added only when markdown alone cannot achieve the result.

**Why this matters**: Spec Coach competes on simplicity. The moment we reach for code to solve a coaching problem, we've lost the plot. A 200-line markdown skill that guides AI well is worth more than 2000 lines of orchestration code.

### II. Coach, Not Gatekeeper

Skills guide through suggestion, not enforcement. Use "you should consider X" and "if Y applies" — never "ERROR: X is missing." The AI is a trusted senior engineer; we give it judgment calls, not checklists to tick.

**Why this matters**: The project's philosophy is "Guidance over gates. Craftsmanship over compliance." Skills that bark orders produce compliant but mediocre output. Skills that coach produce craftsmanship.

### III. Zero Dependencies, Zero Friction

The CLI must have zero production dependencies outside of TypeScript + tsx. Install must be a single command. The bar for adding any dependency is: "literally cannot ship this feature without it."

**Why this matters**: The primary competitive advantage over spec-kit is that spec-coach requires no Python, no pip, no package tree. Every dependency we add erodes that advantage.

### IV. Precision in Templates

Every document template uses RFC 2119 language (MUST, SHOULD, MAY) with deliberate intent. Every section has a documented purpose. Vague templates produce vague specs — and vague specs produce wrong implementations.

**Why this matters**: Templates are the output contract. If a template says "Describe the feature," the AI will produce a paragraph. If it says "Describe the feature: what triggers it, what it produces, what it MUST NOT affect," the AI produces a specification.

### V. Verify What Ships

Tests verify that installed skills and templates produce correct AI behavior end-to-end. Template completeness checks, skill install integrity, agent format compliance — these matter more than unit testing the installer. A passing test suite means: "the skills installed correctly and the templates are well-formed."

**Why this matters**: The product isn't the CLI — it's what the CLI installs. If our tests only cover `runInit()` but not the installed output, we're testing the wrong thing.

## Development Constraints

- **Language**: TypeScript. The CLI is a single entry point (`src/cli.ts`) with command modules in `src/commands/`.
- **Node**: No minimum version enforced beyond what tsx requires. Keep syntax boring.
- **File structure**: Skills live in `.claude/skills/<name>/SKILL.md`. Templates in `.spec/templates/<name>-template.md`. Scripts in `.spec/scripts/bash/`. This structure is the contract — changing it breaks `spec-coach update`.
- **CLI surface**: Two isolated surfaces — the **corpus lifecycle** (`init`, `update`, `uninstall`) and the **agent lifecycle** (`agents add`/`update`/`remove`/`list`). The two never mutate each other's owned content: an agent can retire (`agents remove`) while the spec corpus is fully preserved. Document→spec conversion is the on-demand `/spec-absorb` **skill**, not a CLI command (spec 007): it reads a document in place and writes `specs/NNN-slug/spec.md`, never touching the original. Adding a new top-level command requires a compelling reason documented in the spec.
- **Ownership & safety** (spec 007 — iron rule): spec-coach is **read-only on user documents** — no command moves, renames, deletes, or overwrites a file outside the paths spec-coach owns (`.spec/` tooling, agent skill dirs, the managed context section); it only reads sources and appends new `NNN-slug/` dirs under `specs/`. `uninstall` is the inverse of `init`: it removes every `.spec/` artifact `init` creates (scripts, templates, `agents.json`, the constitution — all regenerable tooling) and preserves only `specs/` as user content; `--force` also purges `specs/`.
- **Agent support**: Agents are data-driven via the root `agents.json` manifest. Adding a new agent means adding one manifest entry (`key`, `name`, `dir`, `format`, `separator`, `frontmatter`, `contextFile`, `version`) — no TypeScript change. No agent-specific logic branches in individual skills.

## Release Workflow

- **Branch strategy**: Feature branches from `main`. PR required for all changes.
- **Versioning**: MAJOR.MINOR.PATCH. MAJOR bumps when the installed file structure changes (breaks `update`). MINOR bumps for new skills or template fields. PATCH bumps for fixes that don't change the install contract.
- **Testing gate**: `npm test` must pass before merge. `npm run test:all` must pass before release.
- **Changelog**: Every release documents what changed in the installed output, not just the code.

## Governance

This constitution defines the non-negotiable principles for spec-coach. It supersedes any conflicting practice or habit.

- **Amendments**: Require a documented rationale, a migration plan if the change affects installed output, and review by the project maintainer.
- **Compliance**: Every PR must state which principles it touches (or "none"). PRs that violate a principle require either a revision or a constitution amendment — no silent violations.
- **Complexity must be justified**: If a change adds a file, a dependency, or a new concept, the PR description must explain why simpler alternatives were rejected.
- **Runtime guidance**: Day-to-day development practices (linting rules, commit style, local setup) live in `CLAUDE.md`, not here. The constitution is principles; `CLAUDE.md` is playbook.

**Version**: 1.3.0 | **Ratified**: 2025-06-15 | **Last Amended**: 2026-06-18

<!-- SDD STATE START -->
**Current feature**: 007-resource-ownership
**Last phase**: implement
**Skipped phases**: none
**Decisions**: 2.2.0 resource ownership & document safety (MINOR) — iron rule (read-only on user docs; append-only to specs/); remove the intake subsystem (CLI command + .spec/intake + .spec/absorbed + src/commands/intake.ts), /spec-absorb is the sole doc→spec path; init re-entry safe (no agents.json clobber) + emits document-safety guidance; uninstall removes all .spec tooling incl constitution, preserves specs/ only. Constitution amendment v1.2.0 → v1.3.0.
<!-- SDD STATE END -->
