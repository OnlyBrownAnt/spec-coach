# Changelog

## 2.2.0 — 2026-06-18

### Resource ownership & document safety (spec 007)

Harden spec-coach's project footprint around one iron rule: spec-coach is
**read-only on user documents** and only appends to `specs/`. Behavior change
(a new `init`-safety guarantee, a new `uninstall` boundary, and the removal of
the over-built `intake` subsystem) + a constitution amendment v1.2.0 → v1.3.0.

- `init` is now safe to re-run: it no longer clobbers `.spec/agents.json` to
  `{}` (writes the empty managed state only when the file is absent).
- Plain `uninstall` now removes **all** `.spec/` tooling — including the
  constitution (reclassified as regenerable tooling) — and preserves only
  `specs/` as user content. `--force` also purges `specs/`.
- **Removed the `intake` subsystem** (`intake scan`/`process`/`ignore`, the
  `.spec/intake/` manifest + ignore list, `.spec/absorbed/`, and
  `src/commands/intake.ts`). Document→spec conversion is now the sole job of
  the on-demand `/spec-absorb` skill, which reads a document in place and
  writes `specs/NNN-slug/spec.md` without ever touching the original.
- `init` detects existing `specs/` and emits a non-blocking guidance block
  (acknowledges prior specs; states the document-safety rule; shows the
  `/spec-absorb` path).
- Constitution amended v1.2.0 → v1.3.0: CLI surface 3 → 2; codifies the iron
  rule, the ownership model, and the uninstall preservation set.
- Versioned **MINOR 2.2.0** (observable `init`/`uninstall` change + amendment).

## 2.1.1 — 2026-06-18

### Internal cleanup — dead code, type dedup, state cohesion (spec 006)

Zero-behavior-change refactor. No install-contract change, no constitution
amendment.

- Removed the unused `AgentKey` type alias. Simplified `runInit`/`runUpdate` to
  single-arg `(projectRoot)` (dropped the vestigial `_agent`/`_skipAbsorb` params
  from spec 003's `--agent` decoupling) and updated every caller.
- Deduplicated `CmdResult` (was defined identically in `agents.ts` and
  `intake.ts`) into a single shared `src/result.ts`.
- Moved `ensureState` + `corpusExists` from `agents.ts` to their conceptual home
  `state.ts` (no import cycle).
- Corrected stale comments (the `AGENTS` "retained until cli.ts is rewritten"
  note and the `runInit`/`runUpdate` "T018 removes them" JSDoc). `AGENTS` itself
  is retained (`agent-config.test.ts` depends on it).
- Versioned **PATCH 2.1.1** (internal cleanup, no install-contract change).

## 2.1.0 — 2026-06-18

### Document intake pipeline — bring existing docs into the corpus (spec 005)

- New `intake` top-level command (the document lifecycle): `intake scan`,
  `intake process`, `intake ignore`.
- `intake scan` discovers existing `.md` docs in preset directories and writes a
  staging registry at `.spec/intake/manifest.json` (a manifest of candidates, not
  a copy of bodies). It is deterministic and non-interactive — never blocking on
  stdin — closing the non-TTY blocking class that caused spec 001 to remove
  auto-absorb from `init`.
- Two absorb modes via `intake process`: `--verbatim` copies a candidate
  unchanged into `.spec/absorbed/`; `--ai` stages it for the new `spec-absorb`
  skill, which coaches the AI to transform the source into a
  `specs/NNN-slug/spec.md` (the CLI contains no transformation logic).
- `intake ignore {list|add|remove}` manages an ignore list; scans exclude
  ignored paths and are idempotent (absorbed/ignored sources never re-surface).
- `init` now detects candidate docs and prints a one-line nudge
  ("run `spec-coach intake scan`") without ever blocking or refusing.
- New `spec-absorb` skill (the install set grows 11 → 12; existing projects get
  it via `agents update --all`). `uninstall` removes the regenerable
  `.spec/intake/` and preserves `.spec/absorbed/` (user content) unless `--force`.
- Constitution amendment **v1.2.0**: the CLI surface grows from two lifecycles
  (corpus, agent) to three (adds the document lifecycle).
- Versioned **MINOR 2.1.0** per the constitution rule (a new skill ships).

## 2.0.1 — 2026-06-17

### Precise deletion — only remove what spec-coach owns (spec 004)

- `agents remove` / `uninstall` now delete only paths spec-coach can attribute
  to itself, replacing the `spec-*` prefix wildcard (skills format) and the
  whole-`spec/`-subdir delete (markdown format). User-authored content in those
  namespaces now survives every lifecycle operation.
- Per-agent `createdFiles` (recorded at install) and a project-level
  `createdContextFiles` list drive deletion. A skill-name whitelist is the
  fallback when provenance is absent, so legacy projects get precise deletion
  too — never a wildcard.
- Context-file bodies are deleted only when spec-coach created the file AND it
  is empty after teardown (replaces the `# projectName` content heuristic). A
  directory-integrity guard preserves a coach skill dir that has accumulated
  unexpected user files.
- State-schema additions (`agents[key].createdFiles`, top-level
  `createdContextFiles`) are optional and backward compatible; `update`
  recomputes provenance so it is never dropped. Legacy v2.0.0 projects reconcile
  on first use and get precise deletion with zero regression.
- Versioned **PATCH 2.0.1** per the constitution rule (a fix that does not change
  the install contract) — no CLI, agent-support, or constitution change.

## 2.0.0 — 2026-06-17

### Breaking — unified agent lifecycle (spec 003)

- **CLI restructured into two isolated surfaces**: the corpus lifecycle
  (`init`, `update`, `uninstall`) and the agent lifecycle
  (`agents add` / `update` / `remove` / `list`). The old `init --agent <key>`
  and `update --agent <key>` coupling is removed.
- **Agents are data-driven** via a root `agents.json` manifest. Adding an AI
  tool is a JSON entry, not a code change.
- **`init` no longer installs skills or absorbs documents.** Bind an agent with
  `agents add`; document intake is deferred to a future pipeline.
- **Install is reversible**: `agents add` / `agents remove` are precise inverses
  scoped to agent-owned paths; multi-agent coexistence is supported.
- **Universal context injection**: every agent now gets a managed section
  (Claude → `CLAUDE.md`; others → shared `AGENTS.md`), closing the gap where
  only Claude received context.
- **Migration**: existing projects are reconciled automatically on first
  `agents` command (`.spec/agents.json` rebuilt from the filesystem); no data
  loss.

### Constitution amendment (v1.1.0)

- Development Constraints updated: CLI surface (two isolated lifecycles) and
  agent support (`agents.json` manifest, replacing the in-source `AGENTS` map).
