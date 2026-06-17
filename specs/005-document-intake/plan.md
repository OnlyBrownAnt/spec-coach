# Implementation Plan: Document Intake Pipeline (Bring Existing Docs Into the Corpus)

**Branch**: `005-document-intake` | **Date**: 2026-06-18 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/005-document-intake/spec.md`

## Summary

Build the document intake pipeline that spec 003 explicitly deferred. A new `intake` top-level command with three subcommands — `scan` / `process` / `ignore` — discovers existing `.md` docs scattered in preset directories, stages them in a `.spec/intake/manifest.json` **registry** (no body copy), and absorbs each into the corpus one of two ways:

1. **Verbatim** — copy the source unchanged into `.spec/absorbed/`.
2. **AI-coached** — a new `spec-absorb` SKILL transforms the source into `specs/NNN-slug/spec.md`. The CLI only **stages the source and points the AI at the skill**; it contains zero transformation logic (Constitution Principle I — the judgment call lives in markdown).

Discovery is **deterministic and non-interactive** — it writes the manifest and exits, never blocking on stdin — which closes the spec 001 non-TTY blocking class for good (that bug is why spec 003 removed absorb from `init` in the first place). `init` runs the same detection and **nudges** ("run `intake scan`") without ever blocking or refusing (Principle II). Sources are never moved, renamed, or deleted (FR-007 — mirrors spec 004's "only touch what spec-coach owns"). Re-scans are idempotent: absorbed and ignored sources never re-surface.

Ships as **MINOR 2.1.0** (a new skill, `spec-absorb`) with a **constitution amendment to v1.2.0** adding `intake` as the third top-level CLI surface (the document lifecycle).

## Technical Context

**Language/Version**: TypeScript, executed via `tsx` (no compile step). No syntax beyond the existing codebase.

**Primary Dependencies**: None. All work uses `node:fs`, `node:path`, `node:crypto` (built-in SHA-256 for the manifest's advisory content hash — not an external dependency), and `node:assert/strict` for tests. Constitution Principle III satisfied by construction.

**Storage**: The filesystem only. Three new on-disk artifacts, all under `.spec/`:
- `.spec/intake/manifest.json` — the staging registry (`{ candidates: Candidate[] }`); regenerable spec-coach state.
- `.spec/intake/ignore.json` — the ignore list (`{ patterns: string[] }`); regenerable.
- `.spec/absorbed/` — verbatim-absorbed docs (user-originated content; **already** in `uninstall.ts` `USER_PATHS`, preserved unless `--force`).
Plus one canonical skill body: `skills/absorb.md` (the source `installSkill` reads).

**Testing**: Mechanical suites in `tests/units/*.test.ts` using `node:assert/strict`, run via `npx tsx tests/units/<name>.test.ts`. `npm test` is AI-driven (shells out to `claude`) and cannot run headless here — per project memory, evidence comes from the mechanical suites + `npx tsx src/cli.ts` smokes.

**Target Platform**: Cross-platform CLI on Node (darwin/linux/Windows); `node:path` for separator safety; `node:crypto` for hashing.

**Project Type**: CLI tool (dogfooding — modifying spec-coach's own `src/` + `skills/`).

**Performance Goals**: Scan bounded to the preset directories (no full recursive walk) — sub-second on typical projects; not perf-sensitive.

**Constraints**: Zero production dependencies (Principle III); discovery/processing MUST be non-interactive and never block on stdin (FR-003/017 — the spec 001 class); sources MUST never be mutated (FR-007); the CLI MUST contain no document-transformation logic (FR-008 — transform is a markdown skill); new skill ⇒ MINOR; new top-level command ⇒ constitution amendment.

**Scale/Scope**: Adds 1 new command module (`src/commands/intake.ts`), 1 new skill (`skills/absorb.md`), edits `cli.ts` / `init.ts` / `uninstall.ts` / `utils.ts` / constitution; 1 new test suite + 2 updated.

## Constitution Check

*GATE: Must pass before Phase 0 research. Re-check after Phase 1 design.*

- **I. Markdown Is the Product** — **SATISFIED (this is the canonical case).** The AI-transform mode IS a new markdown skill (`spec-absorb`); the CLI reaches for TypeScript only for the parts markdown cannot do — deterministic filesystem discovery, the manifest/ignore stores, and a verbatim byte-copy. The transform itself (judgment) stays in the skill. This is "ship the capability as a markdown skill first; code only what markdown cannot."
- **II. Coach, Not Gatekeeper** — **SATISFIED.** `init` detects candidates and prints a one-line nudge; it never blocks, prompts, or refuses. `intake` never refuses either — it surfaces candidates and coaches absorption via the skill. No gating language.
- **III. Zero Dependencies, Zero Friction** — **SATISFIED.** No dependency added. Ignore matching is exact-path + directory-prefix (no glob library); hashing is `node:crypto` (built-in).
- **IV. Precision in Templates** — **Not applicable.** No document template is modified. The `spec-absorb` skill coaches toward the *existing* `spec-template.md`.
- **V. Verify What Ships** — **SATISFIED.** The new `intake.test.ts` suite verifies discovery, manifest round-trip, verbatim byte-identity, AI-staging (no transform code), ignore persistence, idempotency, and non-TTY exit — exactly "test what ships."

**Development Constraints**:
- *Language / File structure*: **unchanged structure.** The new skill lives at `skills/absorb.md`, conforming to the existing `skills/<name>.md` convention (`skillSource` → `PACKAGE_ROOT/skills/<name>.md`). `.spec/intake/` is new regenerable state; `.spec/absorbed/` is already a preserved user-artifact path. No skill/template/script *path* moves, so `update` is not broken.
- *CLI surface*: **AMENDMENT REQUIRED — v1.1.0 → v1.2.0.** The constitution's "CLI surface" constraint currently enumerates **two** surfaces (corpus + agent). This feature adds the **document lifecycle** as a third (`intake scan`/`process`/`ignore`). Rationale: document intake is a distinct concern — spec 003 explicitly deferred it as its own pipeline rather than fold it back into `init` (which would re-create the blocking coupling 003 removed) or into `agents` (which would conflate docs with agent bindings). Migration is non-destructive: a command + skill are added; no installed file is restructured. This parallels spec 003's v1.1.0 amendment. **No Core Principle changes** — only the CLI-surface enumeration grows. Amendment wording is specified in C11 below.
- *Agent support*: **MINOR impact, agent-agnostic.** Adding `"absorb"` to `SKILL_NAMES` grows the per-agent install set 11→12; logic stays data-driven (no agent-specific branch). Existing projects gain `spec-absorb` via `agents update --all` (re-installs the now-12-skill set).

**Release Workflow — Versioning (DECISION)**: **MINOR 2.1.0.** The constitution rule: *"MINOR bumps for new skills or template fields."* This ships a new skill (`spec-absorb`), so MINOR. Not MAJOR — the installed file *structure* is unchanged (skills still resolve `skills/<name>.md` → `agent.dir/spec-{name}/`; `update` is not broken, and `.spec/intake/`+`.spec/absorbed/` are runtime state, not part of the `update`-synced contract). Not PATCH — a new skill ships, which the rule makes MINOR, not PATCH. (Note: spec 004 was correctly PATCH 2.0.1 because it shipped no new skill; 005 does.)

**SDD STATE**: the constitution's SDD STATE block reads `005 / specify` (set when the spec was written); it advances to `plan` here and `implement` at close.

**Net**: One constitution amendment (CLI surface → three surfaces, v1.2.0). No Core Principle change. MINOR 2.1.0. No `verify-constitution-sync` change.

## Project Structure

### Documentation (this feature)

```text
specs/005-document-intake/
├── spec.md              # Approved specification
├── plan.md              # This file
├── analysis.md          # (optional, /spec.analyze output)
└── tasks.md             # (/spec.tasks output — not created by plan)
```

### Source Code (repository root)

```text
skills/
└── absorb.md                 # NEW — spec-absorb skill body (coaches AI transform)

src/
├── utils.ts                  # SKILL_NAMES += "absorb" (11 → 12)
├── cli.ts                    # NEW "intake" top-level case + subcommand dispatch + help
└── commands/
    ├── intake.ts             # NEW — types + manifest/ignore stores + discovery + scan/process/ignore
    ├── init.ts               # detect candidates → print nudge (non-blocking)
    └── uninstall.ts          # INFRA_PATHS += ".spec/intake" (regenerable state)

tests/units/
├── intake.test.ts            # NEW — discovery/manifest/absorb/idempotency/non-TTY
├── owned-paths.test.ts       # UPDATED — 11 → 12 skill units
└── precise-deletion.test.ts  # UPDATED — createdFiles length 11 → 12

.spec/memory/constitution.md  # AMENDMENT v1.2.0 — CLI surface → three surfaces
```

**Structure Decision**: Single-project CLI layout (the existing structure). Intake is self-contained in one new module, `src/commands/intake.ts`, which owns its types, the two stores, discovery, and the three command handlers — and **exports `discoverCandidates`** so `init.ts` can run detection for its nudge. This mirrors the established cross-command import pattern (`uninstall.ts` imports from `agents.ts`); it is cycle-safe because `intake.ts` imports only `utils.ts`/`manifest.ts` and never `init.ts`. If the module grows past ~300 lines it can split into `src/intake-store.ts`, but one cohesive module is the YAGNI choice for now.

### Component & File Mapping

| # | Component | Files | FRs | Key change |
|---|-----------|-------|-----|------------|
| C1 | Types + stores | `src/commands/intake.ts` | FR-004, FR-012, FR-016 | `Candidate` / `CandidateStatus` types; `readManifest`/`writeManifest` (`.spec/intake/manifest.json` = `{ candidates: Candidate[] }`); `readIgnoreList`/`writeIgnoreList` (`.spec/intake/ignore.json` = `{ patterns: string[] }`); `isIgnored(relPath, patterns)` — exact-path OR directory-prefix. All reads tolerate absent files (return `[]`). |
| C2 | Discovery | `src/commands/intake.ts` | FR-001, FR-002, FR-003, FR-005 | `PRESET_SCAN_DIRS` = root top-level files + `docs/`, `doc/`, `design/`, `spec/`, `requirements/`; `discoverCandidates(root, ignoreList): Candidate[]` — list `.md` files in preset dirs, match filename keywords (`spec`/`plan`/`feature`/`design`/`requirement`/`roadmap`) OR content markers (`Overview`/`User Story`/`FR-`/`## Requirements`/`Acceptance`), exclude corpus-internal (`specs/`, `.spec/`, `.git/`, `node_modules/`) and ignored paths; compute `hash` via `node:crypto` sha256 + `size`. Deterministic, **no stdin**. |
| C3 | `intake scan` | `src/commands/intake.ts` | FR-004, FR-013 | `runIntakeScan(root)`: discover → merge into the manifest **preserving** existing `absorbed-*` / `ignored` statuses (idempotent — FR-013), mark genuinely-new finds `pending`, drop entries whose source vanished; write manifest; print a summary count. |
| C4 | Verbatim absorb | `src/commands/intake.ts` | FR-006, FR-007 | `runIntakeProcess(root, { mode:"verbatim", target })`: for each targeted pending candidate, copy the source **unchanged** to `.spec/absorbed/<safe-name>.md` (collision-safe name via `safeAbsorbedName`), mark `absorbed-verbatim` + `destination`. Source is read-only here — never moved/renamed/deleted (FR-007). |
| C5 | AI-transform staging | `src/commands/intake.ts` + `skills/absorb.md` | FR-008, FR-009, FR-010 | `runIntakeProcess(root, { mode:"ai", target })`: mark the candidate `absorb-ai-pending` and print instructions to invoke the `spec-absorb` skill on that source → produce `specs/NNN-slug/spec.md`. **No transform code in the CLI** (FR-008). `sanitizeSlug(name, root)` enforces kebab-case + uniqueness within `specs/` before any dir is created (FR-010). After the skill writes the artifact, a follow-up `runIntakeProcess`/scan marks the entry `absorbed-ai` with its destination. |
| C6 | Ignore (process + command) | `src/commands/intake.ts` | FR-011, FR-012 | `runIntakeProcess(root, { mode:"ignore", target })`: append each targeted candidate's path to `ignore.json` + mark `ignored`. `runIntakeIgnore(root, verb, pattern?)`: `list` prints patterns; `add <pattern>` appends; `remove <pattern>` filters it out. |
| C7 | CLI wiring | `src/cli.ts` | FR-015, FR-017 | New `case "intake"`: dispatch `scan` / `process [--verbatim|--ai|--ignore] [path|--all]` / `ignore <list|add|remove> [pattern]`; `printHelp` gains an "Intake" section. `process` is **flag-driven** (no interactive prompt) — the simplest guarantee of FR-003/017; an optional TTY review is a future enhancement, out of scope here. |
| C8 | `spec-absorb` skill + SKILL_NAMES | `skills/absorb.md`, `src/utils.ts` | FR-009 | Author `skills/absorb.md` (frontmatter `name: spec-absorb`, `description: …`) — coaching body: read the staged source + the spec template, extract intent, write `specs/NNN-slug/spec.md` following the template. Add `"absorb"` to `SKILL_NAMES`; `installSkill` then installs it as `spec-absorb` (skills format) / `absorb.md` (markdown format). |
| C9 | init nudge | `src/commands/init.ts` | FR-014 | After scaffolding: `const n = discoverCandidates(root, []).length`; if `n > 0` print "found N candidate docs — run `spec-coach intake scan`"; always exit 0, **no prompt, no block**. |
| C10 | uninstall integration | `src/commands/uninstall.ts` | FR-016 | `INFRA_PATHS` += `".spec/intake"` (regenerable; removed on plain `uninstall`, like `.spec/agents.json`). `.spec/absorbed` **already** in `USER_PATHS` (preserved unless `--force`) — no change needed there. |
| C11 | Constitution amendment | `.spec/memory/constitution.md` | (governance) | v1.1.0 → **v1.2.0**. Rewrite the "CLI surface" constraint from two surfaces to three: *"Three isolated surfaces — the **corpus lifecycle** (`init`, `update`, `uninstall`), the **agent lifecycle** (`agents add`/`update`/`remove`/`list`), and the **document lifecycle** (`intake scan`/`process`/`ignore`). The three never mutate each other's owned content: an agent can retire while the spec corpus is fully preserved; intake absorbs documents INTO the corpus without moving sources."* Bump footer `Version: 1.2.0`, `Last Amended: 2026-06-18`. |
| C12 | Tests | `tests/units/intake.test.ts` (new), `owned-paths.test.ts`, `precise-deletion.test.ts` (updated) | All FRs verifiable | New suite: discovery (preset dirs hit, corpus/ignored excluded, no full walk), manifest round-trip + idempotent re-scan, verbatim copy byte-identical + source preserved, AI-staging marks `absorb-ai-pending` + no transform code path, `sanitizeSlug` kebab+unique, ignore exact/prefix match + persistence + re-scan exclusion, non-TTY scan exits 0 with no prompt, init nudge prints + exits 0. Update the two `11` assertions → `12`. |

**Type / signature consistency (locked across components)**:

- `type CandidateStatus = "pending" | "absorbed-verbatim" | "absorb-ai-pending" | "absorbed-ai" | "ignored" | "source-missing"`
- `interface Candidate { path: string; hash: string; size: number; status: CandidateStatus; destination?: string }`
- manifest JSON: `{ candidates: Candidate[] }` at `.spec/intake/manifest.json`
- ignore JSON: `{ patterns: string[] }` at `.spec/intake/ignore.json`
- `discoverCandidates(projectRoot: string, ignoreList: string[]): Candidate[]`
- `isIgnored(relPath: string, patterns: string[]): boolean` — `true` iff `relPath === p` or `relPath` starts with `p + "/"` for some `p` in `patterns`
- `readManifest(projectRoot: string): Candidate[]` / `writeManifest(projectRoot: string, candidates: Candidate[]): void`
- `readIgnoreList(projectRoot: string): string[]` / `writeIgnoreList(projectRoot: string, patterns: string[]): void`
- `safeAbsorbedName(sourcePath: string): string` — collision-safe filename under `.spec/absorbed/` (e.g. flattened dir__file.md, suffixed on clash)
- `sanitizeSlug(name: string, projectRoot: string): string` — kebab-case, unique within `specs/` (suffix `-2`, `-3`, … on clash)
- `type CommandResult = { ok: boolean; message?: string; reason?: string }` (existing return shape used by `report()`)
- `runIntakeScan(projectRoot: string): CommandResult`
- `runIntakeProcess(projectRoot: string, opts: { mode: "verbatim" | "ai" | "ignore"; target: string | "all" }): CommandResult`
- `runIntakeIgnore(projectRoot: string, verb: "list" | "add" | "remove"; pattern?: string): CommandResult`

## Complexity Tracking

> Justification for the additions (Constitution Governance: "Complexity must be justified").

| Addition | Why Needed | Simpler Alternative Rejected Because |
|----------|------------|--------------------------------------|
| New top-level command `intake` (vs folding into `init` or `agents`) | Document intake is a distinct lifecycle concern; spec 003 **deferred it explicitly** rather than keep it in `init`. | **Fold into `init`**: rejected — it re-creates the exact blocking `init ↔ absorb` coupling (and the spec 001 hang) that 003 removed; `init` is corpus *infrastructure*, intake is corpus *content*. **Fold into `agents`**: rejected — conflates documents with agent bindings; docs have nothing to do with which AI tool is bound. A dedicated command is the minimal clean separation. (The constitution requires justification for a new top-level command → amendment v1.2.0.) |
| Staging manifest (vs copy-on-discover) | Decouples discovery from absorption: enables idempotent re-scans (FR-013), the ignore list (FR-011/012), and AI-staging (FR-008) without duplicating document bodies into a staging dir. | **Copy candidates into `.spec/intake/` on scan**: rejected — duplicates potentially large docs, muddies ownership (is the copy spec-coach's or the user's?), and fights the spec 004 precise-deletion theme. A registry of paths + status is the minimal, ownership-clean choice. |
| `node:crypto` content hash in the manifest | Built-in (zero-dep); gives change detection and advisory dedup signaling for free. | **Size-only signature**: viable for MVP, but hash is one built-in call and far more reliable for "did this source change"; the spec (FR-004) calls for hash + size. |
| Two absorb modes split as CLI-stage vs SKILL-transform | Constitution Principle I mandates this factoring — the transform is judgment (markdown), the mechanics are deterministic (code). | **Transform in code**: rejected — violates Principle I and the project's AI-driven model; a hardcoded transformer would be brittle and un-coachable. **Verbatim-only**: rejected — drops the AI-transform mode the user explicitly asked for. The split is not extra complexity; it is the principle-aligned shape. |
| `process` is flag-driven (no interactive review) | The simplest, bulletproof way to honor FR-003/017 (never block on stdin) — there is no prompt path to hang in non-TTY. | **Interactive per-candidate review (TTY)**: deferred — adds an `isTTY`-guarded branch with marginal MVP value and a residual blocking risk; revisit as a future enhancement once the deterministic path is proven. |

**Open Questions**: None. Every FR maps to a component; every signature is named and consistent; no TBD/placeholder remains. Version (MINOR 2.1.0) and the amendment (v1.2.0) are resolved by the constitution check.
