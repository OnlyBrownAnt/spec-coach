# Implementation Plan: Internal Cleanup (Dead Code, Type Dedup, State Cohesion)

**Branch**: `006-internal-cleanup` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/006-internal-cleanup/spec.md`

## Summary

A zero-behavior-change refactor (PATCH 2.1.1) in three independent moves:

1. **Dead-code sweep** — remove the unused `AgentKey` type alias; simplify `runInit`/`runUpdate` to single-arg `(projectRoot)` (dropping the vestigial `_agent`/`_skipAbsorb` params from spec 003's `--agent` decoupling) and update every caller; correct the stale `AGENTS` / "T018 removes them" comments. **Retain `AGENTS`** (`agent-config.test.ts` depends on it).
2. **`CmdResult` dedup** — extract the command-result union (currently defined identically in `agents.ts` and `intake.ts`) to a single shared `src/result.ts`; repoint all importers.
3. **State cohesion** — move `ensureState` + `corpusExists` from `agents.ts` to their conceptual home `state.ts`.

No new behavior, no install-contract change, no constitution amendment. The verification gate is the existing 18-suite mechanical suite staying green (refactor discipline — only call-argument edits are permitted in tests).

## Technical Context

**Language/Version**: TypeScript via `tsx` (no compile step). No syntax beyond the existing codebase.

**Primary Dependencies**: None added. `node:fs`/`node:path` only; tests `node:assert/strict`. Constitution III satisfied.

**Storage**: The filesystem only; no state-schema change. One new internal module file (`src/result.ts`). No change to anything under `.spec/` or any installed artifact.

**Testing**: Mechanical suites in `tests/units/*.test.ts` via `npx tsx`. This is a pure refactor → **the existing suite is the regression net** (spec-implement REFACTOR: keep green, add no behavior). No new behavior means no RED-first new tests; a small relocation-confirmation assertion MAY pin the new export locations. `npm test` is AI-driven/non-headless (per memory) — evidence = mechanical suites + `npx tsx src/cli.ts` smokes.

**Target Platform**: Cross-platform CLI on Node; `node:path` for separator safety (unchanged).

**Project Type**: CLI tool (dogfood — modifying spec-coach's own `src/`).

**Performance Goals**: N/A.

**Constraints**: Zero behavior change (FR-010); zero new dependencies (FR-009); no install-contract change; no cycle introduced by the `ensureState` move (FR-007).

**Scale/Scope**: Touches `utils.ts`, `state.ts`, `cli.ts`, `init.ts`, `update.ts`, `agents.ts`, `intake.ts`, `uninstall.ts` + 4 test files (caller-arg updates). Adds 1 file (`src/result.ts`). Pure relocation/subtraction.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Markdown Is the Product** — Not applicable. Pure TypeScript refactor of the distributor; no coaching capability or markdown skill touched.
- **II. Coach, Not Gatekeeper** — Not applicable. No skill tone or gating language touched.
- **III. Zero Dependencies, Zero Friction** — Satisfied. No dependency added; everything is `node:fs`/`node:path`/`node:assert`.
- **IV. Precision in Templates** — Not applicable. No document template modified.
- **V. Verify What Ships** — Satisfied. The unchanged mechanical suite verifies that installed behavior (init/update/agents/intake/uninstall output) is byte-for-byte identical before and after — exactly "test what ships."

**Development Constraints**:
- *Language / File structure*: **unchanged contract.** A new internal file `src/result.ts` is added, but the installed file structure (skills at `skills/<name>.md` → `agent.dir/spec-{name}/`; templates at `.spec/templates/`; scripts at `.spec/scripts/`) is untouched. `update` is not broken.
- *CLI surface*: **Not violated.** No new top-level command or verb; `init`/`update` keep their CLI behavior (the dropped params were always `null`/unused).
- *Agent support*: **Not violated.** No manifest or agent-config change; `AGENTS` (manifest-derived) retained.

**Release Workflow — Versioning (DECISION)**: **PATCH 2.1.1.** The constitution rule: *"PATCH bumps for fixes that don't change the install contract."* This changes nothing in the installed output (no skill/template/script/CLI-surface/agent-support change); it is internal cleanup. Not MINOR (no new skill/template field), not MAJOR (installed file structure unchanged, `update` not broken). No constitution amendment (internal only; no principle/constraint text changes — only the SDD STATE pointer advances to `006`).

**SDD STATE**: advances to `006 / plan` here, `implement` at close.

**Net**: No constitution violation, no amendment, no `verify-constitution-sync` change. PATCH 2.1.1.

## Project Structure

### Documentation (this feature)

```text
specs/006-internal-cleanup/
├── spec.md              # Approved specification
├── plan.md              # This file
├── analysis.md          # (optional, /spec.analyze output)
└── tasks.md             # (/spec.tasks output — not created by plan)
```

### Source Code (repository root)

```text
src/
├── result.ts            # NEW — CmdResult (single source of truth, US2)
├── state.ts             # +ensureState, +corpusExists (moved from agents.ts, US3)
├── utils.ts             # -AgentKey; AGENTS comment corrected (AGENTS retained, US1)
├── cli.ts               # runInit/runUpdate call sites updated (no leading arg, US1)
└── commands/
    ├── agents.ts        # -CmdResult def (import result.ts); -ensureState/-corpusExists (import state.ts)
    ├── init.ts          # runInit(projectRoot) signature + JSDoc (US1)
    ├── update.ts        # runUpdate(projectRoot); -unused AgentConfig import; JSDoc (US1)
    ├── intake.ts        # -CmdResult def (import result.ts, US2)
    └── uninstall.ts     # CmdResult ← result.ts; ensureState ← state.ts (US2/US3)

tests/units/             # caller-arg updates only (FR-002/003); no assertion-logic changes
├── corpus-init.test.ts        # runInit(claude,t) -> runInit(t); drop unused claude decl + import
├── corpus-update.test.ts      # runInit/runUpdate(claude,t) -> (t); drop unused claude decl + import
├── corpus-lifecycle.test.ts   # runInit/runUpdate(null,t) -> (t)
└── corpus-uninstall.test.ts   # runInit(null,X) -> runInit(X) (6 sites)
```

**Structure Decision**: Single-project CLI layout (unchanged). The only new file is `src/result.ts` — a focused, single-responsibility home for the shared command-result type. `state.ts` already imports `manifest.ts` and `utils.ts`, so receiving `ensureState`/`corpusExists` adds **no new import edge** and **no cycle** (`state.ts` does not import `agents.ts`). All moves are pure relocation; all removals are grep-confirmed dead.

### Component & File Mapping

| # | Component | Files | FRs | Key change |
|---|-----------|-------|-----|------------|
| C1 | Dead-code + signature sweep | `src/utils.ts`, `src/commands/init.ts`, `src/commands/update.ts`, `src/cli.ts`, + 4 test files | FR-001..FR-004, FR-010 | Remove `AgentKey` (zero importers). `runInit(projectRoot)` / `runUpdate(projectRoot)` (drop `_agent`/`_skipAbsorb`); update cli.ts + the 4 corpus test callers; remove now-unused `import type { AgentConfig }` in update.ts and the unused `const claude`/`loadAgentConfig` import in corpus-init/corpus-update tests. Correct stale `AGENTS` comment + runInit/runUpdate JSDoc. **Retain `AGENTS`.** |
| C2 | `CmdResult` dedup | `src/result.ts` (NEW), `src/commands/agents.ts`, `src/commands/intake.ts`, `src/commands/uninstall.ts` | FR-005, FR-006, FR-009 | New `src/result.ts` exports `CmdResult` (shape unchanged). `agents.ts` + `intake.ts` drop their local defs and import it; `uninstall.ts` repoints its `CmdResult` import from `agents.ts` → `result.ts`. Grep-confirm no other importer before/after. |
| C3 | State cohesion move | `src/state.ts`, `src/commands/agents.ts`, `src/commands/uninstall.ts` | FR-007, FR-008 | Move `ensureState` + `corpusExists` from `agents.ts` → `state.ts` (behavior/signature unchanged). `agents.ts` + `uninstall.ts` import them from `state.ts`. Verify `state.ts` does not import `agents.ts` (no cycle). |
| C4 | Tests — relocation pins + green gate | `tests/units/state.test.ts` (or a new `relocation.test.ts`) | SC-001..SC-006 | Optional small assertions pinning the new homes (`CmdResult` importable from `result.ts`; `ensureState`/`corpusExists` from `state.ts`). Primary gate = full 18-suite run green after each component, with only call-arg edits in the 4 corpus tests. |

**Type / signature consistency (locked across components)**:

- `src/result.ts`: `export type CmdResult = { ok: true; message: string } | { ok: false; reason: string };` (shape unchanged — single source of truth)
- `runInit(projectRoot: string): Promise<void>` (was `(_agent, projectRoot, _skipAbsorb?)`)
- `runUpdate(projectRoot: string): Promise<void>` (was `(_agent, projectRoot)`)
- `ensureState(projectRoot: string): InstalledState` — now exported from `src/state.ts` (was `agents.ts`)
- `corpusExists(projectRoot: string): boolean` — now exported from `src/state.ts` (was `agents.ts`)
- `AgentKey` — **removed** (no callers)

## Complexity Tracking

> Justification for the one new file (Constitution Governance: "If a change adds a file... explain why simpler alternatives were rejected").

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| `src/result.ts` (new file) | `CmdResult` is shared by three command modules and is currently **duplicated** (`agents.ts` + `intake.ts`) — the duplication is the drift risk this feature removes. It needs a neutral single home. | **Keep duplicating**: rejected — it is the bug being fixed (silent return-shape drift). **Put it in `agents.ts` and import from there** (as `uninstall.ts` does today): rejected — couples unrelated command modules to `agents.ts` for a generic type, and is exactly the stance that let the second copy appear in `intake.ts`. **Put it in `utils.ts`**: rejected — `utils.ts` is already a 417-line grab-bag; a focused single-type module is cleaner and finds faster. A dedicated `result.ts` is the minimal neutral home. |

No other complexity is added: `ensureState`/`corpusExists` are relocations (net-zero files), and the dead-code sweep is pure subtraction.

**Open Questions**: None. Every FR maps to a component; every signature is named; no TBD/placeholder. Version (PATCH 2.1.1) and no-amendment are resolved by the constitution check. The grep-confirmed-dead guarantees (AgentKey zero importers; the full ripple of runInit/runUpdate callers) are verified at implementation time with the suite as backstop.
