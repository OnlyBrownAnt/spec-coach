# Implementation Plan: Resource Ownership & Document Safety

**Branch**: `007-resource-ownership` | **Date**: 2026-06-18 | **Spec**: specs/007-resource-ownership/spec.md

**Input**: Feature specification from `specs/007-resource-ownership/spec.md` (approved, `b79fb91`)

## Summary

Harden spec-coach's project footprint around one iron rule — **spec-coach is read-only on user documents; it only appends to `specs/`.** Four changes: (1) `init` no longer clobbers `.spec/agents.json` on re-run (bug fix at `init.ts:73`); (2) plain `uninstall` removes all `.spec/` tooling including the constitution (reclassified as regenerable tooling), preserving only `specs/`; (3) the entire `intake` subsystem is removed — CLI command, manifest, ignore list, `.spec/absorbed/`, `.spec/intake/`, and the `src/commands/intake.ts` module — leaving `/spec-absorb` (function unchanged) as the sole document→spec path, reading originals in place; (4) `init` detects existing `specs/` and emits a non-blocking guidance block. The model is codified in a constitution amendment (v1.2.0→v1.3.0). MINOR 2.1.1→2.2.0. Behavior change → RED-first.

## Technical Context

**Language/Version**: TypeScript (ESM, executed via tsx); Node ≥ what tsx requires. Boring syntax only.

**Primary Dependencies**: zero production dependencies (Constitution III). `node:fs`, `node:path` only (no `node:crypto` after intake removal).

**Storage**: filesystem — `.spec/` (tooling), `specs/` (user specs), agent skill dirs, managed context sections.

**Testing**: `tests/units/*.test.ts` (`node:assert/strict`, run via `npx tsx tests/units/<name>.test.ts`). `npm test` is AI-driven/non-headless — verification = the mechanical suites + `npx tsx src/cli.ts` smokes. RED-first (this is a behavior change, not a refactor).

**Target Platform**: macOS/Linux CLI (darwin 24.6.0 verified).

**Project Type**: CLI that dogfoods its own SDD workflow.

**Performance Goals**: N/A — trivial file ops.

**Constraints**: zero dependencies; no stdin/blocking (non-TTY safe, Constitution Principle II); **uninstall is the inverse of init** (removes exactly what init creates, minus user content `specs/`).

**Scale/Scope**: ~5 src files edited, 1 deleted (`intake.ts`); ~3 test files edited, 1 deleted (`intake.test.ts`); 1 skill rewritten (`absorb.md`); constitution amended; version bump.

## Constitution Check

- **I. Markdown Is the Product**: removing intake's TS state-machine and keeping the `absorb` skill (markdown) as the sole doc→spec path *strengthens* this — less orchestration code, the transform stays a skill. ✓
- **II. Coach, Not Gatekeeper**: init's guidance block is advisory and non-blocking (never prompts); removing intake eliminates a gate-like triage subsystem the user had to learn and maintain. ✓
- **III. Zero Dependencies**: no dependency added; all `node:` builtins. ✓
- **IV. Precision in Templates**: the constitution amendment and the `absorb.md` rewrite use precise language; the iron rule is stated exactly (read-only on user documents, append-only to `specs/`). ✓
- **V. Verify What Ships**: RED-first tests pin the new behavior (re-init safety, uninstall boundary, iron rule via untouched `docs/`, init guidance); the full mechanical suite is the regression net. ✓
- **Dev Constraint — CLI surface**: the amendment reduces the surface from **3 to 2** (corpus + agent); document→spec moves from a CLI command to the on-demand `/spec-absorb` skill. A deliberate, documented amendment (FR-014). ✓
- **Dev Constraint — lifecycles never mutate each other's content**: the iron rule sharpens this into a global guarantee — spec-coach never mutates a user document under any command. ✓

## Project Structure

### Documentation (this feature)

```text
specs/007-resource-ownership/
├── spec.md      # approved (b79fb91)
├── plan.md      # this file
└── tasks.md     # next: /spec-tasks
```

### Source Code (repository root)

```text
src/
├── cli.ts                       # C3: remove intake dispatch/help/import/header; C2: fix uninstall prompt+help text
├── commands/
│   ├── init.ts                  # C1: writeState conditional; C4: drop intakeNudge; C6: guidance block
│   ├── update.ts                # unchanged (verified: no writeState call, no intake import)
│   ├── uninstall.ts             # C2: INFRA={templates,scripts,agents.json,memory}; USER={specs}
│   └── intake.ts                # C4: DELETE
├── state.ts                     # unchanged (writeState callers here are read-modify-write; only init clobbers)
├── result.ts                    # cosmetic only: stale comment mentions deleted intake.ts
└── utils.ts                     # unchanged (SKILL_NAMES retains "absorb")
skills/
└── absorb.md                    # C7: rewrite to direct-path invocation (transform function unchanged)
.spec/memory/
└── constitution.md              # C8: amendment v1.2.0→v1.3.0 + SDD STATE→007
tests/units/
├── intake.test.ts               # DELETE
├── corpus-uninstall.test.ts     # flip constitution PRESERVED→REMOVED; remove T017 (.spec/intake+.spec/absorbed) block
├── corpus-lifecycle.test.ts     # flip constitution PRESERVED→REMOVED
├── corpus-init.test.ts          # add: agents.json preserved on re-init; guidance emitted; docs/ untouched
├── relocation.test.ts           # cosmetic only: stale comment mentions deleted intake.ts
├── owned-paths.test.ts          # unchanged (12-skill set incl absorb; NO .spec/intake reference)
├── precise-deletion.test.ts     # unchanged (NO .spec/intake reference)
└── agents-update.test.ts        # unchanged (NO .spec/intake reference)
package.json                     # C9: 2.1.1 → 2.2.0
CHANGELOG.md                     # C9: 2.2.0 entry
```

### Component / File Mapping

| Component | Files | FRs | Change (decided, no placeholders) |
|---|---|---|---|
| **C1** Init re-entry safety | `src/commands/init.ts` | FR-001, FR-002 | Replace the unconditional `writeState(projectRoot, {})` at line 73 with `if (!fs.existsSync(path.join(projectRoot, ".spec", "agents.json"))) writeState(projectRoot, {})`. Fresh dir still creates `{ agents: {} }`; an existing `agents.json` is preserved verbatim. (Confirmed via grep: `init.ts:73` is the ONLY clobbering `writeState` call — `update.ts` has none.) |
| **C2** Uninstall ownership boundary | `src/commands/uninstall.ts`; `src/cli.ts` | FR-003, FR-004, FR-005 | `INFRA_PATHS = [".spec/scripts", ".spec/templates", ".spec/agents.json", ".spec/memory"]`; `USER_PATHS = ["specs"]` (drop `.spec/intake` from INFRA; drop `.spec/absorbed` + `.spec/memory` from USER). `purge` branch unchanged (removes USER_PATHS + prunes empty `.spec`). `cli.ts`: the uninstall prompt (line ~128: "User content (specs/, constitution) is preserved…") and help (lines ~45-47: "constitution (otherwise preserved)") are corrected — plain uninstall REMOVES the constitution as tooling; only `specs/` is "preserved unless --force". |
| **C3** intake CLI removal | `src/cli.ts` | FR-006 | Remove the import (line 24), the header comment's Document-lifecycle line (line 8), the help "Document lifecycle" section (lines 55-61), and the `case "intake":` block (lines 163-196). Header comment → "Two isolated command surfaces". `spec-coach intake …` becomes an unknown command. |
| **C4** intake module removal | DELETE `src/commands/intake.ts`; `src/commands/init.ts` | FR-007, FR-009 | Delete `intake.ts` (manifest/ignore stores, `runIntakeScan`/`runIntakeProcess`/`runIntakeIgnore`, `discoverCandidates`, `intakeNudge`, `safeAbsorbedName`, `sanitizeSlug`). `init.ts`: remove `import { intakeNudge } from "./intake.ts"` (line 18) and the nudge call (lines 75-76). `.spec/intake/` and `.spec/absorbed/` are no longer created by any command; `init` no longer scans outside `specs/`. (Confirmed importers of `intake.ts`: only `cli.ts`, `init.ts`, and `intake.test.ts`.) |
| **C5** Iron rule (invariant) | verified by C4 + a new test | FR-008 | No command moves/renames/deletes/overwrites a user document outside spec-coach's owned paths. intake's verbatim-copy was the only writer to `.spec/absorbed`; it is gone. Verified mechanically: a pre-existing `docs/keep.md` is byte-for-byte unchanged after `runInit` (added to `corpus-init.test.ts`). |
| **C6** Init awareness + guidance | `src/commands/init.ts` | FR-010, FR-011 | New helper `existingSpecs(projectRoot): { count: number; highest: number }` — reads `specs/` direct children, counts those matching `/^\d{3}-.+/`, tracks the max leading number (0 when none/empty). New `printDocumentGuidance(projectRoot)` emits the block: when `count > 0`, an existing-specs line ("adopted as-is, highest N, new specs continue from N+1; review with `ls specs/`"); always the safety rule ("your documents are never moved/deleted/overwritten") and the how-to ("turn a doc into a spec: `/spec-absorb <path>`; originals stay put; ignore the rest"). Called after `printNextSteps`. NEVER modifies `specs/`. |
| **C7** absorb.md rewrite | `skills/absorb.md` | FR-013 | Rewrite "When to use" + "The process" to **direct-path invocation**: the user points the skill at any document path; remove all references to `intake process --ai`, `.spec/intake/manifest.json`, "staged source", `absorb-ai-pending`, and the "later intake scan marks absorbed-ai" step. The transform algorithm is identical: read the source in place → follow `.spec/templates/spec-template.md` → write `specs/NNN-slug/spec.md` → do NOT move/rename/delete the source. `SKILL_NAMES` retains `"absorb"` (owned-paths/agents-update still assert the 12-skill set). |
| **C8** Constitution amendment | `.spec/memory/constitution.md` | FR-014 | In **Development Constraints — CLI surface**: change "Three isolated surfaces" to **two** (corpus lifecycle + agent lifecycle); remove the document-lifecycle/intake sentence; state that document→spec is the on-demand `/spec-absorb` skill, not a CLI command. Add a short **Ownership & Safety** clause: the iron rule (read-only on user documents; append-only to `specs/`) and the uninstall preservation set (`specs/` only; all else under `.spec/` is regenerable tooling). Footer: Version 1.2.0 → 1.3.0, Last Amended 2026-06-18. SDD STATE block → `Current feature: 007-resource-ownership`, `Last phase: plan`. |
| **C9** Cross-cutting | `package.json`, `CHANGELOG.md` | FR-012 | Version `2.1.1 → 2.2.0`; CHANGELOG 2.2.0 entry describing the installed-output/behavior change (intake removed; uninstall preserves only `specs/`). No dependency added. |

**Structure Decision**: Single-project CLI layout (template Option 1). All edits within existing `src/commands/*`, `src/cli.ts`, `skills/`, `.spec/memory/`, `tests/units/`. One file deleted (`intake.ts`); no new module — `existingSpecs`/`printDocumentGuidance` live inside `init.ts` (~30 lines) to preserve "init is one cohesive file" and avoid a trivial new module.

## Complexity Tracking

| Item | Why it came up | Decision |
|---|---|---|
| Constitution amendment vs. template propagation | Spec flagged mirroring the model into `constitution-template.md` as a plan-level open question. | **Amend spec-coach's OWN constitution only** (dogfood source of truth). The generic template stays principle-shaped; new projects do not need the ownership detail because the *code* enforces it, not the doc. |
| Test-impact correction vs. spec edge-case | Spec's edge-case listed `owned-paths`/`precise-deletion`/`agents-update` as needing `.spec/intake` removal. A full `grep -rn "intake" src/ tests/` shows they do **not** reference `.spec/intake` — only `intake.test.ts`, `corpus-uninstall`, `corpus-lifecycle`, `corpus-init` do. | Actual test impact: **delete** `intake.test.ts`; **flip** constitution assertions in `corpus-uninstall` (line ~61) + `corpus-lifecycle` (line ~80) PRESERVED→REMOVED; **remove** the T017 `.spec/intake`+`.spec/absorbed` block in `corpus-uninstall` (lines 87-104); **augment** `corpus-init`. `owned-paths`/`precise-deletion`/`agents-update` are UNCHANGED (verified — they assert the 12-skill set incl. `absorb`, with no intake paths). |
| Legacy `.spec/intake` / `.spec/absorbed` orphans | A spec-005 project may still have these dirs; the new uninstall will not remove them (not in the removal set). | **Leave as harmless orphans** (documented). This keeps "uninstall = inverse of init" exact: init no longer creates them, so uninstall does not target them. The user can delete manually. |
| `absorb.md` "function unchanged" vs. wording | FR-013 updates invoke guidance because the staging it described is gone. | **Wording rewrite only**; the transform algorithm is identical. `SKILL_NAMES` retains `"absorb"`. |
| `result.ts` / `relocation.test.ts` stale comments | Both mention "intake.ts" in historical comments that become stale once the file is deleted. | **Cosmetic touchup only** (update the comment text); not functionally required, done for cleanliness if touched in the same task. |
