# Coach Kit — SDD that trusts AI

**Guidance over gates. Craftsmanship over compliance.**

Coach Kit is a lightweight alternative to spec-kit. It strips everything down to the essentials:

- **8 skill templates** that guide AI through SDD (specify → plan → tasks → implement)
- **5 document templates** for structured outputs (spec, plan, tasks, checklist, constitution)
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
| Claude Code | `speckit-name/SKILL.md` | `/speckit-specify` |
| Cursor | `speckit/name.md` | `/speckit.specify` |
| GitHub Copilot | `speckit/name.md` | `/speckit.specify` |
| OpenAI Codex | `speckit-name/SKILL.md` | `/speckit-specify` |
| Windsurf | `speckit/name.md` | `/speckit.specify` |

## What Gets Installed

```
your-project/
├── .claude/skills/              # AI skill files (varies by agent)
│   ├── speckit-specify/SKILL.md
│   ├── speckit-plan/SKILL.md
│   ├── speckit-tasks/SKILL.md
│   ├── speckit-implement/SKILL.md
│   ├── speckit-analyze/SKILL.md
│   ├── speckit-clarify/SKILL.md
│   ├── speckit-checklist/SKILL.md
│   └── speckit-constitution/SKILL.md
├── .specify/
│   ├── templates/               # Document templates
│   │   ├── spec-template.md
│   │   ├── plan-template.md
│   │   ├── tasks-template.md
│   │   ├── checklist-template.md
│   │   └── constitution-template.md
│   ├── memory/
│   │   └── constitution.md      # Project principles (edit this)
│   ├── scripts/bash/            # Shell scripts
│   └── feature.json
└── specs/                       # Your feature specs go here
```

## SDD Workflow

```
/speckit-constitution  →  Define project principles
/speckit-specify       →  Create feature specification
/speckit-clarify       →  (optional) Clarify ambiguities
/speckit-plan          →  Create technical plan
/speckit-tasks         →  Generate task breakdown
/speckit-analyze       →  (optional) Cross-artifact review
/speckit-implement     →  Execute implementation
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

## License

MIT
