# Implementation Plan: README & GitHub Repo Description Refresh

**Branch**: `011-readme-repo-update` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/011-readme-repo-update/spec.md`

## Summary

Rewrite `README.md` so every factual claim is verifiable against the repo, and define a GitHub repository description + topic set. The current README is wrong in ~10 places (agent/skill/template counts, a non-existent `--agent` flag, dead `COACH.md` and spec-kit links, an `npm i -g` path to an unpublished package, and understated installer/file counts). Approach: edit `README.md` in place — correct counts, fix the Quick Start to the only working path (raw-URL `tsx`), align the CLI section to `src/cli.ts`, add a 12-skill table, fix the comparison table with a stated counting scope, remove dead links, and surface the version. The repo description/topics are delivered as a documented `gh repo edit` proposal (auto-application gated on `gh` + user confirmation — outward-facing).

## Technical Context

**Language/Version**: Markdown (README.md) + shell (`gh` CLI, optional, for repo metadata).

**Primary Dependencies**: None for README. `gh` CLI only if the user wants the repo description auto-applied (currently not installed in this env).

**Storage**: `README.md` at repo root (in-place edit). Repo metadata lives on GitHub, not in a file.

**Testing**: Manual verification — every number/claim cross-checked against the repo (`agents.json`, `skills/`, `.spec/templates/`, `package.json`, `git ls-files | wc -l`); every link resolves; Quick Start copy-pasted into a clean dir. Plus `verify-spec.sh` (already CLEAN).

**Target Platform**: GitHub-rendered Markdown (GFM).

**Project Type**: documentation update (no source code changes).

**Performance Goals**: N/A.

**Constraints**: README is the public face — claims must be exact and defensible (Constitution IV spirit). Repo description ≤ GitHub limit; topics lowercase/hyphenated.

**Scale/Scope**: 1 file (`README.md`) + 1 documented metadata proposal.

## Constitution Check

*Constitution: `.spec/memory/constitution.md` v2.0.0.*

| Principle | Status | Note |
|-----------|--------|------|
| I. Markdown Is the Product | ✓ honored | README is the project's own markdown face — high care applies. |
| II. Coach, Not Gatekeeper | n/a | No skill content changed. |
| III. Zero Dependencies | ✓ honored | No dependency added; README only. |
| IV. Templates Are the Contract | n/a | No template changed; README is not a template. |
| V. Verify What Ships | ✓ honored | The whole point: README must accurately describe what ships. |
| VI. Read-Only on User Documents | n/a | We edit spec-coach's OWN README, not a user's document. |

**Result**: PASS — no violations. No complexity justification needed.

## Project Structure

### Documentation (this feature)

```text
specs/011-readme-repo-update/
├── spec.md      # specification
├── plan.md      # this file
└── tasks.md     # task breakdown
```

### Source Code (repository root)

No source code changes. The single edited file is:

- **`README.md`** (repo root) — the entire implementation surface.

Repo metadata (GitHub "About" + topics) is applied via `gh repo edit` or the GitHub UI, not committed as a file.

## README Rewrite — Concrete Decisions

1. **Quick Start**: lead with the only working path — `npx tsx https://raw.githubusercontent.com/OnlyBrownAnt/spec-coach/main/src/cli.ts init`, then `… agents add claude`. Remove `npm i -g spec-coach` (package not published) or mark it "not yet on npm."
2. **CLI section**: match `src/cli.ts` exactly — `init` (no `--agent`), `agents {list, add <key>, update, remove}`, `update`, `uninstall --yes [--force]`, `--version`. Two-step install (corpus, then agent).
3. **Supported AI Tools table**: 6 agents — add **kiro** (`.kiro/skills`, `/spec-specify`), per `agents.json`.
4. **Skill table (new)**: all 12 skills with one-line purposes (absorb, analyze, autopilot, checklist, clarify, constitution, fix, implement, plan, specify, tasks, taskstoissues).
5. **"What Gets Installed" tree**: 12 skills, 7 templates (add `convention-template.md`), `.spec/convention.md`, `agents.json` state, scripts.
6. **Counts**: 12 skills, 7 templates, version **2.5.0** (add a version line/badge).
7. **Comparison table**: correct spec-coach column — installer ≈ **1,460 TS lines** (`src/`), total ≈ **154 git-tracked files** (distinguish "shipped" vs "repo"), **0 deps**, **6 agents**. Mark the spec-kit column **approximate** (third-party).
8. **Dead links**: remove the `COACH.md` reference (file absent); fold philosophy inline into a short Philosophy section. Fix/remove the dead spec-kit link.
9. **Repo description + topics** (proposal, applied via `gh`/UI on confirmation):
   - **Description**: `Spec-driven development that trusts AI. A lightweight spec-kit alternative — guidance over gates, craftsmanship over compliance. Zero runtime deps.`
   - **Topics**: `sdd`, `spec-driven-development`, `ai-coding`, `claude-code`, `cursor`, `github-copilot`, `codex`, `windsurf`, `kiro`, `spec-kit`, `developer-tools`, `typescript`

## Verification

- Every numeric/claim cross-checked against the repo (FR-001/002/003/007; SC-001).
- `grep -n` README for `COACH.md`, `npm i -g`, `--agent`, `~200`, `~15`, `11 skill`, `6 document` → none remain (FR-004/005/006).
- Render README locally / on GitHub preview; click every link (SC-002).
- Copy-paste Quick Start into a clean temp dir → corpus + agent install succeed (FR-004, SC-003).
- `verify-spec.sh` already CLEAN; re-run if spec touched.
- Repo description/topics: provide the exact `gh repo edit …` command; apply only on user confirmation (FR-008, SC-004).
