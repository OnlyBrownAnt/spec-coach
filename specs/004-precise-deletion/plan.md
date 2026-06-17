# Implementation Plan: Precise Deletion (Only Remove What Spec Coach Owns)

**Branch**: `004-precise-deletion` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/004-precise-deletion/spec.md`

## Summary

Upgrade spec-coach's `agents remove` / `uninstall` deletion from imprecise mechanisms (a `spec-*` prefix wildcard for skills-format agents; a whole-`spec/`-subdir delete for markdown-format agents; a `# projectName` content heuristic for context-file bodies) to **provable precision**: delete only paths whose creation spec-coach can attribute to itself.

The mechanism is a three-layer ownership model:
1. **Per-agent `createdFiles`** — recorded at install time, the leaf paths an agent owns (skill dir `spec-{name}` for skills format; file `spec/{name}.md` for markdown). Drives Tier 2 skill deletion.
2. **Project-level `createdContextFiles`** — the context files spec-coach created from scratch. Drives context-file-body deletion (only when owned AND now empty).
3. **COACH marker block** — unchanged; already precise.

A **Tier 1 whitelist** (the known skill-name set) is the fallback when `createdFiles` is absent, so legacy v2.0.0 projects get precise deletion immediately — never a wildcard. A **directory-integrity guard** protects a spec-coach-owned skill dir that has accumulated unexpected user files. Legacy migration is conservative: `reconcileFromFs` backfills `createdFiles` (expected ∩ on-disk) but never `createdContextFiles` (provenance for pre-existing context files is unrecoverable).

## Technical Context

**Language/Version**: TypeScript, executed via `tsx` (no compile step). Node version: whatever `tsx` requires; no syntax beyond the existing codebase.

**Primary Dependencies**: None. All file/state work uses `node:fs` and `node:path`; tests use `node:assert/strict`. Constitution Principle III (Zero Dependencies) is satisfied by construction.

**Storage**: The filesystem only. The single piece of state is `.spec/agents.json`, whose schema gains two optional, backward-compatible fields (`agents[key].createdFiles`, top-level `createdContextFiles`). No database, no other files.

**Testing**: Mechanical suites in `tests/units/*.test.ts` using `node:assert/strict`, run via `npx tsx tests/units/<name>.test.ts`. `npm test` is AI-driven (shells out to the `claude` CLI) and cannot run headless in this environment — per project memory, verification evidence comes from the mechanical suites + `npx tsx src/cli.ts` smokes.

**Target Platform**: Cross-platform CLI on Node (darwin/linux/Windows). Path operations use `node:path` for separator safety.

**Project Type**: CLI tool (dogfooding — modifying spec-coach's own `src/`).

**Performance Goals**: N/A. All operations are on small project-local file trees (a handful of skill dirs/files); sub-second, no perf-sensitive paths.

**Constraints**: Zero production dependencies (Principle III); state-schema additions MUST be optional and backward-compatible; the CLI contract and agent-support manifest MUST NOT change; deletion MUST be idempotent and never throw on missing paths.

**Scale/Scope**: Single-project lifecycle. Touches 4 source files (`state.ts`, `utils.ts`, `commands/agents.ts`, `commands/uninstall.ts`), adds 1 new test suite and updates 3 existing ones.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Markdown Is the Product** — Not violated. This feature is TypeScript lifecycle code (the distributor), not a coaching capability. It adds no markdown skill and reaches for no code to solve a coaching problem; it fixes a correctness bug in the installer's remove/uninstall path, which is legitimate TS domain.
- **II. Coach, Not Gatekeeper** — Not violated. No skill tone is touched. The existing `--yes` / `--force` confirmations (from spec 003 FR-014) are unchanged; no new gating language is introduced.
- **III. Zero Dependencies, Zero Friction** — Satisfied. No dependency added; everything is `node:fs` / `node:path` / `node:assert`.
- **IV. Precision in Templates** — Not applicable. No template is modified. The spec itself uses RFC 2119 MUST/SHOULD.
- **V. Verify What Ships** — Satisfied. The new `precise-deletion.test.ts` suite verifies installed-output lifecycle integrity (what survives, what is removed), exactly the "test what ships" intent.

**Development Constraints**:
- *Language / File structure*: unchanged — we modify existing `src/` modules; no skill/template/script path moves.
- *CLI surface*: **Not violated.** No new top-level command or verb is added; we harden existing `agents remove` and `uninstall`.
- *Agent support*: **Not violated.** All logic is agent-agnostic, driven by the manifest's `dir`/`format`/`separator`. No agent-specific branch.

**Release Workflow — Versioning (DECISION, corrects the spec draft)**: The spec drafted this as MINOR 2.1.0. The constitution's versioning rule controls: *"PATCH bumps for fixes that don't change the install contract."* This feature is a deletion-correctness fix; the install contract (which skills install to which paths) is unchanged, no new skill or template field ships, and the state-schema fields are optional/internal/backward-compatible. Therefore the correct bump is **PATCH 2.0.1**, not MINOR. (MAJOR is ruled out — the installed file structure does not change, so `update` is not broken.) This correction is reflected in the plan; the spec's Assumption line will be reconciled to PATCH 2.0.1.

**SDD STATE**: the constitution's SDD STATE block still reads `003 / implement`; it advances to `004 / plan→implement` as the phases progress (updated at implement close, per the established pattern).

**Net**: No constitution violation, no amendment needed, no `verify-constitution-sync` change. The only governance note is the version correction above.

## Project Structure

### Documentation (this feature)

```text
specs/004-precise-deletion/
├── spec.md              # Approved specification
├── plan.md              # This file
├── analysis.md          # (optional, /spec.analyze output)
└── tasks.md             # (/spec.tasks output — not created by plan)
```

### Source Code (repository root)

```text
src/
├── state.ts                # State schema + accessors (createdFiles, createdContextFiles)
├── manifest.ts             # Unchanged (manifest load/validate)
├── utils.ts                # ownedSkillUnits, SKILL_NAMES export, upsertManagedSection→{created}
├── cli.ts                  # Unchanged (no new command/flag)
└── commands/
    ├── agents.ts           # Provenance-aware removeAgentSkills/removeAgentContext + add/update recording
    ├── init.ts             # Unchanged
    ├── update.ts           # Unchanged (corpus-only)
    └── uninstall.ts        # Iterate installed agents; provenance-aware teardown

tests/units/
├── precise-deletion.test.ts   # NEW — full provenance + collision + legacy coverage
├── state.test.ts              # UPDATED — createdFiles round-trip, reconcile behavior
├── lifecycle.test.ts          # UPDATED — US3 gains colliding user content
└── corpus-uninstall.test.ts   # UPDATED — provenance-aware uninstall
```

**Structure Decision**: Single-project CLI layout (the existing structure). No new directories; the change is internal to four `src/` modules plus tests. `state.ts` imports `ownedSkillUnits` from `utils.ts` — this is cycle-safe because `utils.ts` imports only `manifest.ts` and does **not** import `state.ts` (verified). `manifest.ts` remains self-contained.

### Component & File Mapping

| # | Component | Files | FRs | Key change |
|---|-----------|-------|-----|------------|
| C1 | State schema + accessors | `src/state.ts` | FR-013, FR-014 | `InstalledAgent { version; createdFiles?: string[] }`; state file shape `{ agents, createdContextFiles? }`; `recordAgent(root,key,version,createdFiles?)`; new `readCreatedContextFiles(root)`, `recordContextFileCreated(root,file)`, `removeContextFileCreated(root,file)`; `readState` preserves `createdFiles` (already round-trips arbitrary fields); new fields all optional. |
| C2 | Owned-path computation + upsert reporting | `src/utils.ts` | FR-001, FR-003, FR-005 | `export const SKILL_NAMES` (was private); new `ownedSkillUnits(agent, root): string[]` returning relative leaf paths (`agent.dir/spec-{name}` skills / `agent.dir/spec/{name}.md` markdown) — single source of truth for install/record/remove/reconcile; `upsertManagedSection(agent, root): { created: boolean }` (was `void`) — `created` true iff the context file did not exist immediately before write. |
| C3 | Precise skill removal | `src/commands/agents.ts` | FR-004, FR-005, FR-006, FR-007, FR-018 | Rewrite `removeAgentSkills(agent, root, createdFiles?)`: if `createdFiles` given → delete each (skills-format dirs pass an integrity guard `dirContainsOnlyManaged(dir)` = readdir == `{"SKILL.md"}`; markdown files delete directly) + `pruneEmptyParents`; else → whitelist fallback deleting `ownedSkillUnits(agent)` paths. Never wildcard. Missing paths skipped (`try/catch`, FR-018). |
| C4 | Precise context-file removal | `src/commands/agents.ts` | FR-008, FR-009, FR-010, FR-011 | Rewrite `removeAgentContext(agent, root, { isOwned })`: keep `otherNonClaudeAgentsInstalled` preservation (FR-011); strip COACH block via `removeManagedSection` (FR-008, unchanged); delete the file body only if `isOwner` AND residual is empty or exactly `# {projectName}` (FR-009); never delete when `!isOwner` (FR-010); **when the body IS deleted, call `removeContextFileCreated(root, agent.contextFile)`** so the record cannot outlive the file and later mis-attribute a user-recreated file. |
| C5 | Add/Update provenance recording | `src/commands/agents.ts` | FR-001, FR-002, FR-017 | `runAgentsAdd`: `const { created } = upsertManagedSection(...)`; `recordAgent(root,key,ver, ownedSkillUnits(agent,root))`; if `created` → `recordContextFileCreated(root, agent.contextFile)`. `runAgentsUpdate`: re-install, then recompute `createdFiles = ownedSkillUnits(agent,root).filter((p) => fs.existsSync(path.join(projectRoot, p)))` and re-record; if upsert created a context file, ensure it is in `createdContextFiles` (FR-017). |
| C6 | Provenance-aware uninstall | `src/commands/uninstall.ts` | FR-012 (+ shares C3/C4) | Iterate **installed** agents (`Object.keys(ensureState(root))`) — not the full manifest (FR-012); for each call `removeAgentSkills(agent, root, state[key].createdFiles)` + `removeAgentContext(agent, root, { isOwned: createdContextFiles.includes(agent.contextFile) })`; `INFRA_PATHS` deletion unchanged; `USER_PATHS` preservation unchanged. |
| C7 | Legacy migration | `src/state.ts` | FR-015, FR-016 | `reconcileFromFs`: for each detected agent set `createdFiles = ownedSkillUnits(agent,root).filter(exists)` (FR-015); do **not** populate `createdContextFiles` (FR-016). |
| C8 | Tests | `tests/units/precise-deletion.test.ts` (new), `state.test.ts`, `lifecycle.test.ts`, `corpus-uninstall.test.ts` (updated) | All FRs verifiable | New suite: 11 edge cases + 3 US acceptance scenarios + SC-001..004 assertions (collision tree diff, user-file preserved, owned-shell deleted, legacy whitelist). `lifecycle.test.ts` US3: add `.claude/skills/spec-user/` + `.cursor/commands/spec/notes.md`, assert survival through add→remove. |

**Type / signature consistency (locked across components)**:
- `interface InstalledAgent { version: string; createdFiles?: string[] }`
- state file JSON: `{ "agents": { [key]: InstalledAgent }, "createdContextFiles"?: string[] }`
- `recordAgent(projectRoot: string, key: string, version: string, createdFiles?: string[]): InstalledState`
- `readCreatedContextFiles(projectRoot: string): string[]`
- `recordContextFileCreated(projectRoot: string, file: string): void` (idempotent union)
- `removeContextFileCreated(projectRoot: string, file: string): void` (idempotent removal — called whenever a context-file body is deleted, so a stale "we own it" record cannot survive the file and later mis-attribute a user-recreated file)
- `ownedSkillUnits(agent: AgentConfig, projectRoot: string): string[]`
- `upsertManagedSection(agent: AgentConfig, projectRoot: string): { created: boolean }`
- `removeAgentSkills(agent: AgentConfig, projectRoot: string, createdFiles?: string[]): void`
- `removeAgentContext(agent: AgentConfig, projectRoot: string, opts: { isOwner: boolean }): void`
- `dirContainsOnlyManaged(dirPath: string): boolean` (skills-format integrity guard; expected set = `{ "SKILL.md" }`)

## Complexity Tracking

> Justification for the one new concept introduced (Constitution Governance: "Complexity must be justified").

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| Ownership provenance (`createdFiles` + `createdContextFiles` in `.spec/agents.json`) | The feature's entire purpose is "delete only what spec-coach owns." Without recording what was created, deletion can only guess (wildcard/heuristic) — which is the bug being fixed (silent deletion of user content in the `spec-*` / shared `spec/` / context-file namespaces). | **Wildcard-only (status quo)**: rejected — it is the imprecise behavior that destroys user content (spec US1). **Whitelist-only (Tier 1, no provenance)**: rejected as sole mechanism — it is precise for the *current* skill-name set but cannot decide context-file-body deletion (is this `CLAUDE.md` ours or the user's?) and cannot survive cross-version skill-set drift; provenance is the minimal addition that makes both decisions provable. The fields are optional + backward-compatible, so the added complexity is bounded to two arrays. |
| Directory-integrity guard (`dirContainsOnlyManaged`, FR-007) | Covers the rare "user repurposed a spec-coach-owned skill dir" case without checksumming file contents. | **Checksum every written file**: rejected — heavyweight for a lifecycle tool; the guard (dir contains only the expected `SKILL.md`) catches the realistic threat (user dropped extra files in) at near-zero cost. |

**Open Questions**: None. Every FR maps to a component; every signature is named and consistent; no TBD/placeholder remains. Version is resolved by the constitution check (PATCH 2.0.1).
