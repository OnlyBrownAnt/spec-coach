# Implementation Plan: Unified Agent Lifecycle

**Branch**: `003-unified-agent-lifecycle` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/003-unified-agent-lifecycle/spec.md`

## Summary

spec-coach today hardcodes its 6 supported agents as a TypeScript enum (`AGENTS` in `src/utils.ts`) and couples agent installation to project bootstrapping through two commands — `init --agent` and `update --agent`. There is no uninstall, no list, no multi-agent, and context injection (`upsertClaudeManagedSection`) only serves Claude.

This feature introduces **two strictly isolated lifecycles**: a **spec-corpus lifecycle** (`init` / `update` / `uninstall` — the durable product) and an **agent-binding lifecycle** (`agents add` / `update` / `remove` / `list` — the ephemeral transport). Agents become data: a root `agents.json` manifest externalizes every agent's config, so adding an AI tool is a JSON edit, not a code change. Installation is made reversible (`add`/`remove` are precise inverses scoped to agent-owned paths), multi-agent coexistence is supported, and context injection is generalized so all agents — not just Claude — receive a managed section. Existing projects created by the old coupled `init` are migrated transparently via filesystem reconciliation.

## Technical Context

**Language/Version**: TypeScript, executed via `tsx` at runtime (no compile step). Boring syntax, no minimum Node version beyond what `tsx` requires.

**Primary Dependencies**: `tsx` (sole existing production dependency). No new dependencies — the manifest is plain JSON read via `node:fs`; state is plain JSON read/written via `node:fs`. Constitution Principle III preserved.

**Storage**: Filesystem only.
- `agents.json` (package root) — the agent manifest (shipped, read-only at runtime).
- `.spec/agents.json` (per-project) — installed-agent state (read/write).
- Agent-owned paths: `<agent.dir>/spec-*` and the managed section in each agent's `contextFile`.

**Testing**: `npm test` (bash harness). New mechanical, fixture-driven tests under `tests/scripts/` (no AI, fast, deterministic) covering manifest load/validation, state read/write/reconcile, `add`/`remove` inverse, multi-agent, context injection per agent, and corpus isolation. Behavioral (AI-driven) tests remain optional/secondary per the existing harness limitation.

**Target Platform**: Cross-platform CLI (macOS/Linux/Windows via Node).

**Project Type**: CLI tool / developer tooling.

**Performance Goals**: `init` and `agents add` complete in under 1 second on a warm disk; not performance-critical otherwise.

**Constraints**: Zero production dependencies beyond `tsx`. Markdown-skills-first (Constitution Principle I): the product stays markdown; code is lifecycle orchestration only. Existing install payload (`skills/*.md`, `scripts/bash/*.sh`, `templates/*.md`) is unchanged.

**Scale/Scope**: 6 agents today; manifest designed to scale to many more without code changes. Single-project-per-invocation; no network, no concurrency.

## Constitution Check

Checked against all five Core Principles and the Development Constraints / Release Workflow.

- **I. Markdown Is the Product** — *Deviation, justified.* This feature adds orchestration TypeScript (`manifest.ts`, `state.ts`, new command modules). Markdown cannot perform file lifecycle operations (install/uninstall/state tracking), so code is unavoidable here. The deviation is faithful to Principle I's own clause: "TypeScript code exists solely to distribute them" — the code added distributes and manages the markdown product; the product itself (skills, templates) remains 100% markdown. No SDD *capability* is implemented in code; only its *transport*. Justified in Complexity Tracking.

- **II. Coach, Not Gatekeeper** — *Compliant.* The strict-isolation error path (e.g. `agents add` without a corpus) is phrased as guidance ("This project isn't initialized — run `spec-coach init` first"), not a harsh `ERROR`. Confirmation prompts use coach tone.

- **III. Zero Dependencies, Zero Friction** — *Compliant.* No new dependencies. Manifest and state are JSON over `node:fs`. Install remains a single command.

- **IV. Precision in Templates** — *Compliant.* No template content changes in this feature; the templates' RFC 2119 contract is untouched.

- **V. Verify What Ships** — *Compliant.* Tests verify the installed *output* — that manifest-driven `add` produces correct agent files, that `remove` is the exact inverse, that the corpus is untouched by agent operations, and that all agents receive context injection. Not just `runInit()` internals.

- **Development Constraints — "CLI surface: Two commands: init and update"** — **Violated. Requires constitution amendment.** This feature adds `agents` and `uninstall`. The compelling reason is the feature itself: the unified, reversible, multi-agent lifecycle cannot exist without remove/uninstall verbs, and the spec IS that documented reason. See Complexity Tracking row 1.

- **Development Constraints — "Agent support: adding a new agent means adding one entry to the `AGENTS` map"** — **Violated. Requires constitution amendment.** The `AGENTS` map is replaced by `agents.json`. The reason is FR-001/SC-001: data-driven extensibility (adding an agent must be a data edit, not a code change). See Complexity Tracking row 2.

- **Release Workflow — Versioning** — *MAJOR bump (2.0.0).* The install contract changes: `init` no longer installs skills, `update` is corpus-scoped, new commands appear, and old projects require reconciliation. Constitution defines MAJOR as "installed file structure changes (breaks update)" — the semantics of what `init`/`update` install change fundamentally. Migration is handled by FR-018 reconcile. See Complexity Tracking row 4.

**Constitution amendment required as part of this feature**: update the Development Constraints section to (a) replace the "Two commands: init and update" clause with the two-surface lifecycle (`init`/`update`/`uninstall` + `agents add`/`update`/`remove`/`list`), and (b) replace the "AGENTS map" clause with the `agents.json` manifest. Amendment follows Governance: documented rationale (this plan), migration plan (FR-018 reconcile), maintainer review.

## Project Structure

### Documentation (this feature)

```text
specs/003-unified-agent-lifecycle/
├── spec.md      # Requirements (this feature)
├── plan.md      # This file
├── tasks.md     # Task breakdown (next phase)
└── analysis.md  # Cross-artifact review (optional next phase)
```

### Source Code (repository root)

```text
agents.json                    # NEW — agent manifest (data, shipped). Replaces AGENTS enum.
src/
├── cli.ts                      # REWRITE — router: init/update/uninstall + agents {list,add,update,remove}
├── manifest.ts                 # NEW — loadManifest(), validateAgentEntry(), AgentEntry type
├── state.ts                    # NEW — readState(), writeState(), reconcileFromFs(), InstalledState type
├── utils.ts                    # EDIT — drop AGENTS literal/AgentKey enum; generalize
│                               #        upsertClaudeManagedSection → upsertManagedSection(agent) +
│                               #        removeManagedSection(agent); keep install* helpers
└── commands/
    ├── init.ts                 # REWRITE — corpus scaffold only (no skills, no absorb)
    ├── update.ts               # REWRITE — refresh templates/scripts only (corpus-scoped)
    ├── uninstall.ts            # NEW — remove infra + all bindings, preserve user content
    └── agents.ts               # NEW — runAgentsList/Add/Update/Remove (+ requireCorpus guard)
tests/
└── scripts/
    ├── test-manifest.sh        # NEW — manifest load + validation (FR-001,002,003,015)
    ├── test-state.sh           # NEW — state read/write/reconcile (FR-007,018)
    ├── test-lifecycle.sh       # NEW — add/remove inverse, multi-agent, corpus isolation (FR-005,006,008,009)
    └── test-context-inject.sh  # NEW — per-agent contextFile injection (FR-010,011)
```

**Structure Decision**: Flat `src/commands/` (one file per top-level verb) plus two new supporting modules (`manifest.ts`, `state.ts`) that keep `utils.ts` focused on file/install primitives. `agents.ts` owns the whole agent verb group rather than splitting into a subdirectory — six handlers do not justify a nested package. The single root `agents.json` mirrors how `package.json` sits at root and is loaded the same way (via `PACKAGE_ROOT`).

### Component & File Mapping

| Spec requirement | Implementation | File |
|------------------|----------------|------|
| FR-001, FR-002, FR-003 — manifest-driven agents | 6 entries externalized; runtime load | `agents.json`, `src/manifest.ts` |
| FR-015 — manifest validation | reject malformed entries at load | `src/manifest.ts` (`validateAgentEntry`) |
| FR-007 — installed state | read/write `.spec/agents.json` | `src/state.ts` (`readState`/`writeState`) |
| FR-018 — reconcile/migration | scan agent dirs when state absent | `src/state.ts` (`reconcileFromFs`) |
| FR-013, FR-017 — corpus `init` | scaffold templates/scripts/constitution, no skills, no absorb | `src/commands/init.ts` |
| FR-013, FR-017 — corpus `update` | refresh templates/scripts only | `src/commands/update.ts` |
| FR-014, FR-016 — corpus `uninstall` | remove infra + bindings, confirm, preserve `specs/`/constitution unless `--force` | `src/commands/uninstall.ts` |
| FR-004 — `agents list` | manifest ∩ state, mark installed | `src/commands/agents.ts` |
| FR-005, FR-009 — `agents add` | skills + context, require corpus, idempotent | `src/commands/agents.ts` |
| FR-012 — `agents update` | refresh installed bindings | `src/commands/agents.ts` |
| FR-006, FR-008, FR-014 — `agents remove` | inverse of add, confirm, never touch corpus | `src/commands/agents.ts` |
| FR-010, FR-011 — universal context injection | per-agent `contextFile` upsert/remove | `src/utils.ts` (`upsertManagedSection`/`removeManagedSection`) |
| Constitution amendment | update Dev Constraints (CLI surface + agent support) | `.spec/memory/constitution.md` |

## Complexity Tracking

| Violation | Why Needed | Simpler Alternative Rejected Because |
|-----------|------------|-------------------------------------|
| **Constitution: "Two commands: init/update"** — adds `agents` + `uninstall` | The reversible, multi-agent lifecycle (the feature's core) cannot exist without `remove`/`uninstall`; "AI config retires, spec preserved" (FR-008) needs them. The spec is the documented compelling reason. | Keeping only `init`/`update` cannot express uninstall or multi-agent removal — the entire user request ("frequent install/update/uninstall") is unsatisfiable. Requires a constitution amendment. |
| **Constitution: "AGENTS map"** — replaced by `agents.json` manifest | FR-001/SC-001 require that adding an agent is a data edit, not a code change. | Extending the in-source `AGENTS` literal keeps a per-agent code change and recompile, directly defeating SC-001 ("zero code changes to add a tool"). Requires a constitution amendment. |
| **Principle I deviation** — new orchestration code (`manifest.ts`, `state.ts`, commands) | File lifecycle (install/uninstall/state/reconcile) cannot be expressed in markdown. | Markdown-only is impossible for filesystem mutation; the product (skills/templates) stays markdown and the code remains pure distribution/lifecycle per Principle I's own "code exists solely to distribute them." Justified, no amendment. |
| **Versioning: MAJOR (2.0.0)** | Install contract changes (init no longer installs skills; update corpus-scoped; new verbs; old projects need reconcile). Constitution: "MAJOR when installed file structure changes (breaks update)." | MINOR (new skills/fields) is wrong — the change alters what `init`/`update` install, a contract break. Migration is non-destructive via FR-018 reconcile (no data loss). |
| **Two new modules** (`manifest.ts`, `state.ts`) vs. expanding `utils.ts` | Separating manifest I/O and state I/O from file primitives keeps each module single-purpose and testable. | Stuffing loader + state + reconcile into `utils.ts` bloats it past its "file/install primitives" role and couples unrelated concerns. |

### Migration & non-goals

- **Migration**: existing projects (including this repo, set up by old `init --agent`) have `.spec/` + agent dirs but no `.spec/agents.json`. FR-018 reconcile runs on first `agents` command, detects agent dirs from the filesystem, and populates state — no data loss, no re-install.
- **Non-goals (deferred to spec 004+)**: document intake/absorb pipeline (`scan`/`process`/`ignore`, verbatim/AI modes); spec-corpus health/drift views and a spec registry. `init` in this feature explicitly does NOT absorb (FR-017).
- **Open risks**: the shared-`AGENTS.md` decision for non-Claude agents (spec Assumptions) means multiple non-Claude agents share one managed section; `remove` must preserve it while any non-Claude agent remains (FR-011). Tested explicitly in `test-context-inject.sh`.
