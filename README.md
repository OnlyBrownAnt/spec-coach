# Spec Coach — SDD that trusts AI

**Guidance over gates. Craftsmanship over compliance.**

**v2.5.0** · [Changelog](CHANGELOG.md) · [License](#license)

Spec Coach is a lightweight alternative to [spec-kit](https://github.com/anthropics/spec-kit). It strips everything down to the essentials:

- **12 skill templates** that guide AI through SDD (specify → plan → tasks → implement) + bug fixing
- **7 document templates** for structured outputs (spec, plan, tasks, checklist, constitution, convention, fix)
- **1 TypeScript CLI** that installs everything for your AI tool

**Zero Python. Zero pip. Zero dependencies (at runtime).**

## Quick Start

spec-coach is not yet published to npm. For now, run it directly with `tsx`:

```bash
# 1. Initialize the spec corpus (templates, scripts, constitution)
npx tsx https://raw.githubusercontent.com/OnlyBrownAnt/spec-coach/main/src/cli.ts init

# 2. Bind your AI tool (installs its skills + context)
npx tsx https://raw.githubusercontent.com/OnlyBrownAnt/spec-coach/main/src/cli.ts agents add claude
```

> A global `npm i -g spec-coach` is coming once the package is published. Until then, use the one-command install above.

## Supported AI Tools

| Agent | Install dir | Format | Command style |
|-------|-------------|--------|---------------|
| Claude Code | `.claude/skills/` | `spec-name/SKILL.md` | `/spec-specify` |
| OpenAI Codex | `.codex/skills/` | `spec-name/SKILL.md` | `/spec-specify` |
| Kiro | `.kiro/skills/` | `spec-name/SKILL.md` | `/spec-specify` |
| Cursor | `.cursor/commands/` | `spec/name.md` | `/spec.specify` |
| GitHub Copilot | `.github/copilot/commands/` | `spec/name.md` | `/spec.specify` |
| Windsurf | `.windsurf/commands/` | `spec/name.md` | `/spec.specify` |

Agents are **data-driven** via the root `agents.json` manifest — adding a new agent is one manifest entry, no TypeScript change.

## What Gets Installed

```text
your-project/
├── .claude/skills/              # 12 AI skills (path varies by agent)
│   ├── spec-specify/SKILL.md
│   ├── spec-plan/SKILL.md
│   ├── spec-tasks/SKILL.md
│   ├── spec-implement/SKILL.md
│   ├── spec-absorb/SKILL.md
│   ├── spec-analyze/SKILL.md
│   ├── spec-clarify/SKILL.md
│   ├── spec-checklist/SKILL.md
│   ├── spec-autopilot/SKILL.md
│   ├── spec-taskstoissues/SKILL.md
│   ├── spec-constitution/SKILL.md
│   └── spec-fix/SKILL.md
├── .spec/
│   ├── templates/               # 7 document templates
│   │   ├── spec-template.md
│   │   ├── plan-template.md
│   │   ├── tasks-template.md
│   │   ├── checklist-template.md
│   │   ├── constitution-template.md
│   │   ├── convention-template.md
│   │   └── fix-template.md
│   ├── memory/
│   │   └── constitution.md      # Project principles (edit this)
│   ├── convention.md            # Commit convention (edit this)
│   ├── agents.json              # Installed-agent state
│   └── scripts/bash/            # 9 helper scripts
└── specs/                       # Your feature specs go here
```

spec-coach is **read-only on your documents** — it never moves, renames, deletes, or overwrites a file you already have. To turn an existing document into a spec, run `/spec-absorb <path>`; it reads the doc in place and writes `specs/NNN-slug/spec.md`, leaving the original untouched.

## CLI

```bash
spec-coach init                   # Scaffold the spec corpus (templates, scripts, constitution)
spec-coach agents add claude      # Bind an AI tool (installs its skills + context)
spec-coach agents list            # Show available + installed agents
spec-coach agents update --all    # Refresh installed agent bindings
spec-coach update                 # Refresh corpus templates + scripts
spec-coach uninstall --yes        # Remove spec-coach infrastructure (preserves specs/)
spec-coach --version              # Show version
```

Install is **two steps**: `init` builds the corpus, then `agents add <key>` binds an AI tool. Supported keys: `claude`, `cursor`, `copilot`, `codex`, `windsurf`, `kiro`.

## Skills

The 12 skills below cover the full SDD lifecycle. Commands are shown in Claude Code / Codex style (`/spec-name`); Cursor, Copilot, and Windsurf use `/spec.name`.

| Skill | Purpose |
|-------|---------|
| `/spec-constitution` | Define or amend the project's governing principles |
| `/spec-specify` | Create or update the feature specification from a description |
| `/spec-clarify` | Resolve ambiguities with up to 5 targeted questions |
| `/spec-plan` | Create a technical implementation plan from the spec |
| `/spec-tasks` | Break the plan into a dependency-ordered task list |
| `/spec-checklist` | Generate a custom quality checklist for the feature |
| `/spec-analyze` | Cross-check spec / plan / tasks before implementing |
| `/spec-implement` | Execute the plan by processing all tasks in `tasks.md` |
| `/spec-autopilot` | Run the full SDD cycle autonomously — idea to working code |
| `/spec-absorb` | Turn an existing document into a spec without rewriting it |
| `/spec-fix` | Diagnose and fix bugs with root-cause analysis |
| `/spec-taskstoissues` | Convert the task list into GitHub Issues |

## SDD Workflow

```
/spec-constitution  →  Define project principles
/spec-specify       →  Create feature specification
/spec-clarify       →  (optional) Clarify ambiguities
/spec-plan          →  Create technical plan
/spec-tasks         →  Generate task breakdown
/spec-analyze       →  (optional) Cross-artifact review
/spec-implement     →  Execute implementation
/spec-fix "bug"     →  Diagnose and fix a bug (root cause + optional horizontal scan)
```

## Philosophy

- **Coach posture** — skill templates guide AI like a trusted senior engineer, not a junior coder. They suggest ("you should consider X"), they don't bark ("ERROR: X missing").
- **Precision in templates** — document templates define required structure with MUST/SHOULD/MAY language, because output quality is the contract: the wording in a template is the wording the AI mirrors back.
- **Trust the AI** — the workflow engine is the AI reading files in order. No YAML, no gate engine, no compliance theater.

## Comparison

spec-coach's own numbers are measured from this repo (installer = TypeScript in `src/`); spec-kit's are approximate (third-party).

| | Spec Coach | spec-kit *(approx.)* |
|---|---|---|
| Core product | 19 markdown files (12 skills + 7 templates) | ~13 markdown files |
| Installer | ~1,460 lines of TypeScript (`src/`) | ~3,500-line Python CLI |
| Runtime dependencies | 0 | Python + pip + packages |
| AI integrations | 6 (data-driven, extensible) | 40+ |
| Workflow engine | AI reads files in order | YAML + engine + gates |
| Installed footprint | ~30 files per agent | heavier |

## Acknowledgments

Spec Coach is built on ideas from:

- **[spec-kit](https://github.com/anthropics/spec-kit)** — the SDD workflow (specify → plan → tasks → implement) originated here. Spec Coach strips it down to the essentials.
- **[superpowers](https://github.com/anthropics/superpowers)** — behavioral patterns and the test system architecture are adapted from superpowers' skills.

## License

MIT
