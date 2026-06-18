---

description: "Task list: README + GitHub repo description refresh (spec 011)"
---

# Tasks: README & GitHub Repo Description Refresh

**Input**: Design documents from `/specs/011-readme-repo-update/` (spec.md, plan.md)

**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: No automated tests — this is a documentation change. Verification is manual (grep for stale tokens, render links, dry-run Quick Start). See the Verify phase.

**Organization**: All edits target the single file `README.md` (repo root). Tasks are therefore largely **sequential** (same file) unless marked `[P]`. Grouped by user story; commit one task per the convention (`type(scope): subject` + `Task: Txxx` trailer).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (here: rarely, single-file edit)
- **[Story]**: US1 = accuracy, US2 = install path, US3 = repo card

---

## Phase 1: Accuracy — Supported agents & counts (US1, P1) 🎯 MVP

**Goal**: README's capability claims match the repo exactly.

**Independent Test**: grep README counts + cross-check against `agents.json`, `skills/`, `.spec/templates/`, `package.json`.

- [x] T001 [US1] Fix "Supported AI Tools" table — add **kiro** row (`.kiro/skills`, `/spec-specify`); confirm all 6 agents match `agents.json` (claude, cursor, copilot, codex, windsurf, kiro).
- [x] T002 [US1] Fix header counts — "**12 skill templates**", "**7 document templates**" (add `convention-template.md`); keep "1 TypeScript script".
- [x] T003 [US1] Rewrite "What Gets Installed" tree — list all **12 skills**, **7 templates** (incl. `convention-template.md`), `.spec/memory/constitution.md`, `.spec/convention.md`, `.spec/scripts/bash/`, `agents.json`.
- [x] T004 [US1] Add a **version** line/badge — `2.5.0` (from `package.json`) near the top.

**Checkpoint**: every count/agent claim in README is verifiable against the repo.

---

## Phase 2: Install path (US2, P2)

**Goal**: Quick Start + CLI section are accurate and copy-pasteable to a working install.

**Independent Test**: run the Quick Start in a clean temp dir → corpus + an agent install succeed.

- [x] T005 [US2] Rewrite **Quick Start** — lead with the working raw-URL command: `npx tsx https://raw.githubusercontent.com/OnlyBrownAnt/spec-coach/main/src/cli.ts init`, then `… agents add claude`. Remove `npm i -g spec-coach` (not published) or clearly mark it "not yet on npm."
- [x] T006 [US2] Rewrite **CLI section** to match `src/cli.ts` — `init` (no `--agent`), `agents {list, add <key>, update <key|--all>, remove <key> --force}`, `update`, `uninstall --yes [--force]`, `--version/-v`. Show the two-step install (corpus → agent).

**Checkpoint**: Quick Start copy-paste runs clean in an empty directory.

---

## Phase 3: Skills overview & comparison accuracy (US1/US2)

**Goal**: Give readers an accurate, enriched picture of the product and the spec-kit contrast.

- [x] T007 [US1] Add a **Skills table** (12 rows) with one-line purposes: absorb, analyze, autopilot, checklist, clarify, constitution, fix, implement, plan, specify, tasks, taskstoissues (purposes from `skills/*.md`).
- [x] T008 [US1] Fix the **Comparison table** — spec-coach column: installer ≈ **1,460 TS lines** (`src/`), total ≈ **154 git-tracked files** (note "shipped vs repo"), **0 deps**, **6 agents**. Mark the spec-kit column **approximate** (third-party). State the LOC counting scope.

**Checkpoint**: comparison numbers are defensible; scope stated.

---

## Phase 4: Repo card (US3, P3)

**Goal**: Define a current, on-brand GitHub description + topics, applicable via one command.

- [x] T009 [US3] Finalize the **repo description** + **topics** proposal (from plan.md §9) and present the exact `gh repo edit OnlyBrownAnt/spec-coach --description "…" --add-topic …` command. Do **not** auto-apply — `gh` is not installed here and the change is outward-facing; surface for user confirmation/manual application.

**Checkpoint**: a single documented command reproduces the desired repo card.

---

## Phase 5: Polish & Verify

- [x] T010 [US1] Remove the **dead `COACH.md` link**; fold the philosophy points inline into a short Philosophy section (or drop).
- [x] T011 [Polish] **Verify** — `grep -nE 'COACH.md|npm i -g|--agent|~200|~15|11 skill|6 document' README.md` returns nothing; render/preview README and click every link (spec-kit link fixed/removed); confirm zero broken links.
- [x] T012 [Polish] **Dry-run Quick Start** in a clean temp dir → confirm corpus + `agents add claude` succeed.

**Checkpoint**: README is accurate, link-clean, and the install path works end-to-end.

---

## Dependencies & Execution Order

- **Phase 1 (US1)** first — it is the MVP (accurate capabilities); no deps.
- **Phase 2 (US2)** after Phase 1 — both edit README; do Quick Start + CLI together.
- **Phase 3** after Phase 2 — skills table + comparison build on corrected counts.
- **Phase 4 (US3)** independent of README edits (metadata only) — can be done anytime; surfaced last.
- **Phase 5 (Verify)** last — validates everything.

### Within the run
- Sequential edits to `README.md`; commit each task per `.spec/convention.md`.
- The repo-description task (T009) is documentation/confirmation only — no file change.

## Notes

- Single-file edit (`README.md`) → tasks are mostly sequential; `[P]` rarely applies.
- No code, no template, no dependency added (Constitution III/IV honored).
- Commit each task with a `Task: Txxx` trailer (Conventional Commits default).
