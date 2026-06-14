# Coach Kit — SDD that trusts AI

**Guidance over gates. Craftsmanship over compliance.**

Coach Kit is a lightweight alternative to spec-kit. It strips everything down to the essentials:

- **11 skill templates** that guide AI through SDD (specify → plan → tasks → implement) + bug fixing
- **6 document templates** for structured outputs (spec, plan, tasks, checklist, constitution, fix)
- **1 TypeScript script** that installs everything for your AI tool

**Zero Python. Zero pip. Zero dependencies (at runtime).**

## Quick Start

```bash
# One command — initializes SDD project structure for your AI tool
npx tsx https://raw.githubusercontent.com/brownant/coach-kit/main/src/coach-init.ts --agent claude
```

Or install globally:

```bash
npm i -g coach-kit
coach-init --agent cursor
```

## Supported AI Tools

| Agent | Format | Command Style |
|-------|--------|--------------|
| Claude Code | `spec-name/SKILL.md` | `/spec-specify` |
| Cursor | `spec/name.md` | `/spec.specify` |
| GitHub Copilot | `spec/name.md` | `/spec.specify` |
| OpenAI Codex | `spec-name/SKILL.md` | `/spec-specify` |
| Windsurf | `spec/name.md` | `/spec.specify` |

## What Gets Installed

```
your-project/
├── .claude/skills/              # AI skill files (varies by agent)
│   ├── spec-specify/SKILL.md
│   ├── spec-plan/SKILL.md
│   ├── spec-tasks/SKILL.md
│   ├── spec-implement/SKILL.md
│   ├── spec-fix/SKILL.md
│   ├── spec-analyze/SKILL.md
│   ├── spec-clarify/SKILL.md
│   ├── spec-checklist/SKILL.md
│   └── spec-constitution/SKILL.md
├── .spec/
│   ├── templates/               # Document templates
│   │   ├── spec-template.md
│   │   ├── plan-template.md
│   │   ├── tasks-template.md
│   │   ├── checklist-template.md
│   │   ├── constitution-template.md
│   │   └── fix-template.md
│   ├── memory/
│   │   └── constitution.md      # Project principles (edit this)
│   ├── scripts/bash/            # Shell scripts
│   └── feature.json
└── specs/                       # Your feature specs go here
```

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

Skill templates are **coach posture**: they guide AI like a trusted senior engineer, not a junior coder.

Document templates are **precise**: they define required structure with MUST language because output quality matters.

See [COACH.md](COACH.md) for the full philosophy.

## Comparison

| | Coach Kit | spec-kit |
|---|---|---|
| Core product | 13 markdown files | 13 markdown files |
| Installer | 1 TS file (~200 lines) | 3500-line Python CLI |
| Dependencies | 0 | Python + pip + 5 packages |
| AI integrations | 5 (extensible) | 40+ |
| Workflow engine | AI reads files in order | YAML + engine + gates |
| Extension system | — | — |
| Presets | — | — |
| Total files | ~15 | ~200+ |

## Acknowledgments

Coach Kit is built on ideas from:

- **[spec-kit](https://github.com/anthropics/spec-kit)** — the SDD workflow (specify → plan → tasks → implement) originated here. Coach Kit strips it down to the essentials.
- **[superpowers](https://github.com/anthropics/superpowers)** — behavioral patterns and the test system architecture are adapted from superpowers' skills.

## License

MIT
