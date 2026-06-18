# Implementation Plan: Configurable Commit Convention

**Branch**: `010-commit-convention` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/010-commit-convention/spec.md` (approved, committed `2e25ef4`). 4 user stories, 6 FRs, 5 SCs.

**Note**: This plan turns the spec into a concrete build. spec-coach amends its own constitution + ships its own convention (dogfood). All changes go through the full SDD workflow (this plan → tasks → analyze → implement).

## Summary

spec-coach's SDD workflow is commit-coupled (`spec-tasks` / `spec-implement` make "one commit per task" a first-class doctrine) but has **no source of truth for commit format**: the constitution delegates commit style to an empty `CLAUDE.md`, and `skills/implement.md:137` actively coaches a bare `Txxx:`-first form that violates Conventional Commits — so the history is full of non-conforming commits the tool itself produced.

This plan adds a **user-owned, `.spec`-configurable commit convention** on the same tier as the constitution (charter-as-IP: seeded, never clobbered, preserved on uninstall), retargets the commit-producing skills to coach **Conventional Commits with spec-coach's task ID folded in** (`type(scope): subject` + optional `Task: Txxx` footer — preserving tasks.md↔commit traceability), ships a **non-blocking `verify-commit.sh` advisor** (always exits 0, Coach-Not-Gatekeeper), and **amends the constitution's Runtime-guidance clause** to delegate commit style to `.spec/convention.md` (filling the empty-`CLAUDE.md` hole). No commit-msg hook, no commitlint/husky (Principle II + III).

**How**: one new template + one new bash advisor + targeted skill/template prose edits + an installer helper mirroring the existing constitution installer + a constitution amendment + version bump. MINOR 2.4.0 → 2.5.0; constitution v1.5.0 → v1.6.0.

## Technical Context

**Language/Version**: TypeScript CLI (`src/`, run via `tsx`) + POSIX Bash (`scripts/bash/`, the advisor + existing scripts). Node via `tsx` runtime.

**Primary Dependencies**: **Zero** production dependencies (Principle III). The advisor is pure bash (`grep`/`sed`/`git` only) — **commitlint / husky / commit-msg hooks are explicitly rejected** (they would be a gatekeeper violating Principle II and would add install/uninstall lifecycle surface). No new TS packages.

**Storage**: file-based, all under the project —
- `templates/convention-template.md` — package SOURCE template (read by `templateSource()`); the shipped default convention.
- `.spec/templates/convention-template.md` — installed copy (refreshed by `update`, like other templates).
- `.spec/convention.md` — the AUTHORED convention (project IP; seeded by `init` only when absent; never overwritten by init/update; preserved on plain uninstall like the authored constitution).

**Testing**: `tests/units/commit-convention.test.ts` (node:assert, headless) — three shapes: (a) content-assertion on `skills/implement.md` + `tasks-template.md` + the template; (b) `execSync`-in-`mkdtemp` driving `verify-commit.sh` against crafted git commits (mirrors `constitution-charter.test.ts` T002 + `workflow-state.test.ts`); (c) TS `mkdtemp` lock tests for `init`/`uninstall` convention handling (mirrors `constitution-charter.test.ts` T005/T007). `npm test` is non-headless and is NOT the gate; the gate is `npx tsx tests/units/*.test.ts` + bash/CLI smokes.

**Target Platform**: macOS / Linux (bash), identical to the existing `.spec/scripts/bash/` scripts.

**Project Type**: CLI — spec-coach itself (dogfood: this plan edits spec-coach's own skills, installer, advisor set, constitution, and ships its own convention).

**Performance Goals**: N/A — the advisor scans HEAD (or a short rev-range); trivial.

**Constraints**: coach-only (no hook); zero deps; never clobber an authored convention; commit format must NOT become a derived-state source (spec 008 boundary — FR-005).

**Scale/Scope**: single concern (commit convention); ~7 components, ~10 files touched (mostly small edits + 2 new files).

## Constitution Check

All five principles honored, no deviations. **I Markdown-Is-the-Product**: the convention is a markdown doc and the coaching is skill prose; the only new TS is an installer helper (`installConventionToMemory`) that mirrors the existing `installConstitutionToMemory` — no orchestration code for coaching. **II Coach-Not-Gatekeeper**: `verify-commit.sh` always exits 0 and no commit-msg hook is installed — the central design choice. **III Zero-Dependencies**: pure bash advisor, no commitlint/husky — explicitly rejecting the dependency path that would erode spec-coach's advantage. **IV Precision in Templates**: `convention-template.md` uses RFC 2119 language, documents every section's purpose, and carries a machine-readable rules block. **V Verify What Ships**: content-assertion tests on the shipped skill/template + `execSync` advisor tests + installer lock tests verify the installed output, not just the code.

## Project Structure

### Documentation (this feature)

```text
specs/010-commit-convention/
├── spec.md              # approved (2e25ef4)
├── plan.md              # this file
├── tasks.md             # /spec-tasks output (next)
└── analysis.md          # /spec-analyze output (optional, after tasks)
```

### Source Code (repository root) — files this feature touches

```text
templates/
└── convention-template.md   # NEW — package source: Conventional Commits default +
                             #   Task-footer fold + machine-readable rules block +
                             #   signature tokens for TEMPLATE detection

scripts/bash/
└── verify-commit.sh         # NEW — non-blocking advisor (exit 0): checks HEAD subject
                             #   against the declared convention; skips merges/bots;
                             #   reports ABSENT/TEMPLATE/AUTHORED

src/
├── utils.ts                 # EDIT — TEMPLATE_NAMES += "convention-template";
│                            #   new installConventionToMemory() (mirrors
│                            #   installConstitutionToMemory, never-clobber guard)
├── commands/init.ts         # EDIT — call installConventionToMemory in runInit;
│                            #   printNextSteps gains a convention line
└── commands/uninstall.ts    # EDIT — status-aware .spec/convention.md handling
                             #   (preserve AUTHORED, remove TEMPLATE/purge) via
                             #   new isAuthoredConvention() mirroring isAuthoredConstitution

skills/
└── implement.md             # EDIT — COMMIT step: drop bare "Commit with the task ID";
                             #   coach Conventional + Task footer + point at convention.md

.spec/templates/
├── tasks-template.md        # EDIT — line ~250 "Commit after each task" → convention-aware
└── constitution-template.md # (no change — Runtime-guidance is authored content, not in template)

.claude/skills/spec-implement/SKILL.md  # REGEN — via `agents update` after editing the source

.spec/memory/constitution.md # EDIT (dogfood/FR-006) — Runtime-guidance clause carves
                             #   commit style out to .spec/convention.md; v1.5.0 → v1.6.0

.spec/convention.md          # NEW (dogfood/FR-006) — spec-coach's OWN authored convention

package.json                 # EDIT — 2.4.0 → 2.5.0
CHANGELOG.md                 # EDIT — 2.5.0 entry

tests/units/
└── commit-convention.test.ts # NEW — content-assertion + execSync advisor + init/uninstall locks
```

### File Mapping (FR → Component → File)

| FR | Component | File(s) | Verifies SC |
|---|---|---|---|
| FR-001 | **C1** Convention template + installer | `templates/convention-template.md` (new); `src/utils.ts` (`TEMPLATE_NAMES` + `installConventionToMemory`); `src/commands/init.ts` (wire into `runInit` + `printNextSteps`); `src/commands/uninstall.ts` (`isAuthoredConvention` + status-aware preserve) | SC-001 |
| FR-002 | **C1** (template content declares the default) | `templates/convention-template.md` | SC-001, SC-002 |
| FR-003 | **C2** Skill coaching rewrite | `skills/implement.md` (COMMIT step, line ~136-138); `.spec/templates/tasks-template.md` (line ~250); regenerate `.claude/skills/spec-implement/SKILL.md` | SC-002 |
| FR-004 | **C3** `verify-commit.sh` advisor | `scripts/bash/verify-commit.sh` (new; installed copy via `installScripts`) | SC-003 |
| FR-005 | **C4** State-boundary guardrail (test-only, no logic change) | `tests/units/commit-convention.test.ts` (grep guardrail over `scripts/bash/common.sh` state functions) | SC-004 |
| FR-006 | **C5** Dogfood convention + constitution amendment | `.spec/convention.md` (new, authored); `.spec/memory/constitution.md` (Runtime-guidance clause; v1.6.0) | SC-005 |
| (all) | **C6** Tests | `tests/units/commit-convention.test.ts` (new) | SC-001…005 |
| (all) | **C7** Version + CHANGELOG | `package.json` (2.5.0); `CHANGELOG.md` (2.5.0 entry) | — |

### Component Decisions (decided, not deferred)

**C1 — Convention template structure.** `templates/convention-template.md` has three parts: (1) a human-readable explanation of Conventional Commits + the canonical form `type(scope): subject` + the optional `Task: Txxx` footer that folds spec-coach's task ID in (preserving tasks.md↔commit traceability) + how to customize; (2) a **machine-readable rules block** the advisor parses:
```
<!-- CONVENTION RULES START
allowed_types: feat fix docs refactor test chore
scope_required: false
task_id_footer: optional
CONVENTION RULES END -->
```
(3) **signature tokens** `[PROJECT_NAME]` / `[ALLOWED_TYPES]` / `[SCOPE_FORMAT]` that mark the TEMPLATE state — once authored (filled/removed), the file is AUTHORED. `installConventionToMemory(projectRoot): boolean` mirrors `installConstitutionToMemory` exactly: `templateSource("convention-template")` → ensureDir `.spec` → dest `.spec/convention.md` → `if (fs.existsSync(dest)) return false` (never-clobber) → copy. `init` calls it after the constitution (step 3b).

**C1 — Uninstall extension (charter-as-IP).** FR-001 says the convention is "charter-as-IP tier, like the constitution"; the constitution's full IP treatment (spec 009) includes preserve-on-uninstall. `.spec/convention.md` is not in `INFRA_PATHS` nor under `.spec/memory`, so today it would be orphaned. C1 adds `isAuthoredConvention(p)` (signature-token test, mirroring `isAuthoredConstitution`) and a step 2c in `runUninstall`: preserve an AUTHORED `.spec/convention.md` on plain uninstall; remove it on purge or when still TEMPLATE. This is an explicit extension of FR-001's "like the constitution" clause (flagged in Complexity Tracking).

**C2 — Skill coaching rewrite.** `skills/implement.md` COMMIT step (currently *"Commit with the task ID and a clear description. One commit per task — no bundling."*) becomes: coach the canonical form `type(scope): subject` with an optional `Task: Txxx` footer, name the allowed types (feat/fix/docs/refactor/test/chore), reference `.spec/convention.md` as the source of truth, and coach the shipped default when it is absent/template. The bare `Txxx:`-first line is removed. `tasks-template.md` line ~250 ("Commit after each task or logical group") becomes convention-aware ("Commit each task as `type(scope): subject` with a `Task: Txxx` footer per `.spec/convention.md`"). `.claude/skills/spec-implement/SKILL.md` is regenerated via `agents update`.

**C3 — `verify-commit.sh` advisor.** Mirrors `verify-constitution-sync.sh` / `verify-spec.sh`: `#!/usr/bin/env bash`, resolve `SCRIPT_DIR`, `source common.sh`, `get_repo_root`, `--help`, **always `exit 0`**. Behavior: (a) report convention status `ABSENT` (no `.spec/convention.md`) / `TEMPLATE` (signature tokens present) / `AUTHORED`; (b) `subject="$(git log -1 --format=%s HEAD)"` (or a rev-range arg) — **skip merge commits only** (parents > 1, via `git rev-list --merges`); merges have their own format and are not reformattable. Other non-conforming subjects (including automated commits) are simply flagged — the advisor is non-blocking (exit 0), so a flag is a report, not a failure, and no bot-detection heuristic is needed; (c) parse the convention's `allowed_types` line (default `feat fix docs refactor test chore` if TEMPLATE/absent); (d) check the subject matches `^(type)(\(scope\))?(!)?: .+` with type ∈ allowed set; (e) report CONFORMING or flag the violation with the rule, always exit 0. It checks the **subject line + recognizes** the optional `Task:` footer (presence not mandated); full body/footer linting and scope-list enforcement are out of scope (v1).

**C4 — State-boundary guardrail.** No logic change. The test asserts `scripts/bash/common.sh`'s state functions (`resolve_feature`, `infer_phase`, `first_pending_task`, `get_feature_paths`) do NOT parse `git log` commit subjects to derive feature/phase/progress. The grep is scoped to those four functions so it does NOT false-positive on `verify-commit.sh`'s legitimate `git log` (which checks FORMAT, never feeds a state function). Baseline confirmed: no such inference exists today.

**C5 — Dogfood + constitution amendment.** Author `.spec/convention.md` for spec-coach: allowed types `feat fix docs refactor test chore`, scope `spec-NNN` (feature slug) or component, `Task: Txxx` footer, no signature tokens (AUTHORED). Amend `.spec/memory/constitution.md`'s Runtime-guidance clause (currently: all runtime guidance → `CLAUDE.md`) to: runtime guidance (linting, local setup) lives in `CLAUDE.md`; **commit convention lives in `.spec/convention.md`**. Footer v1.5.0 → v1.6.0 (the clause materially expands to reference a new governance artifact = MINOR per the constitution-doc semver). Propagation (spec 009 checklist) is light: this refines a Governance note, not a Core Principle, so only the authored constitution + CHANGELOG change — `plan-template.md`'s Constitution Check is generic (no embedded principle wording) and needs no edit; no skill embeds this clause. `verify-constitution-sync.sh` reports CLEAN.

**C7 — Version.** MINOR 2.4.0 → 2.5.0 (new template `convention-template` + new script `verify-commit.sh` = install-contract expansion, additive; `update` is not broken — it refreshes templates/scripts and never touches authored `.spec/convention.md`).

## Complexity Tracking

> No Constitution-Check violations (all five principles honored). The rows below are justified design decisions / explicit spec extensions, recorded per the plan self-review.

| Decision / Extension | Why Needed | Simpler Alternative Rejected Because |
|---|---|---|
| Machine-readable `CONVENTION RULES` block in the template | The advisor must honor a team's declared type set, not a hardcoded list (FR-004 "driven by the declared convention") | A hardcoded Conventional list would violate "configurable" — the whole point of US1 |
| `verify-commit.sh` skips merge commits only; other non-conforming commits are flagged but non-blocking | Merges have their own format and are not reformattable; coach-only means a flag is a report (exit 0), not a failure — so no bot-detection heuristic is needed | A bot-pattern heuristic would be guesswork (automation commits like dependabot already use Conventional Commits) and would silently under-report; flag + exit 0 lets the team judge |
| Status-aware preserve of `.spec/convention.md` on uninstall (C1 extension of FR-001) | FR-001 declares the convention "charter-as-IP, like the constitution"; the constitution's IP treatment (spec 009) includes preserve-on-uninstall. Without this, an authored convention is orphaned/inconsistently handled on uninstall | Leaving it unhandled contradicts the charter-as-IP framing FR-001 explicitly invokes; the cost is one small helper mirroring `isAuthoredConstitution` |
| FR-005 guardrail test scoped to the four state functions | Must catch "commit message → state" inference without false-positive on `verify-commit.sh`'s legitimate `git log` format-check | A blanket "no `git log` anywhere" rule would forbid the advisor itself, defeating FR-004 |

**Open Question (none blocking).** A team declaring a fully custom (non-Conventional) scheme in `.spec/convention.md` prose gets an advisor report of "custom convention — manual review" rather than a hard pass/fail (Coach-Not-Gatekeeper) — the v1 advisor checks the Conventional-shaped `type(scope): subject` form against the declared type set, and defers judgment for schemes that don't fit that shape.
