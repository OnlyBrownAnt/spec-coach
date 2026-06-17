# Feature Specification: Unified Agent Lifecycle

**Feature Branch**: `003-unified-agent-lifecycle`

**Created**: 2026-06-17

**Status**: Implemented

**Input**: User description: "需要进行统一设计，后续会频繁遇到 AI工具的安装、更新卸载" — design a unified model for installing, updating, and uninstalling AI-tool (agent) integrations, because these operations will be frequent. Scope chosen by user: **full lifecycle** (manifest-driven agents + list/add/update/remove verbs + installed-state tracking + multi-agent coexistence + universal context injection).

## Context

spec-coach currently ships agents as a **hardcoded 6-entry TypeScript enum** (`AGENTS` in `src/utils.ts`) and only two commands — `init` and `update` — both of which require a single `--agent` and install exactly one agent. There is **no `uninstall`, no `list`, no `detect`**. Context injection (`upsertClaudeManagedSection`) exists only for Claude (`CLAUDE.md`); the other five agents get bare file copies and no context pointer, so the governance reach built in spec 002 (`show-sdd-state.sh`, managed section) only benefits Claude.

The agents differ along purely **configurational** axes (dir, format, separator, frontmatter, contextFile, argumentHints) — there is no per-agent install *logic*. This means a data-driven lifecycle is achievable **without** spec-kit's per-agent Python-module machinery, staying zero-dependency. This feature externalizes agents into a manifest and introduces **two strictly isolated lifecycles**: the **spec-corpus lifecycle** (`init` / `update` / `uninstall` — the durable product: `.spec/` infrastructure, `specs/`, constitution) and the **agent-binding lifecycle** (`agents add` / `update` / `remove` — the ephemeral transport to a particular AI tool). The two never cross: an agent can retire (`agents remove`) while the spec corpus is fully preserved, and the corpus can be bootstrapped (`init`) with no agent installed. The old `init --agent` / `update --agent` coupling is deleted.

## User Scenarios & Testing *(mandatory)*

### User Story 1 - Manifest-Driven Agents (Priority: P1)

Agents are defined in a data manifest (`agents.json` at the package root), not in TypeScript source. The CLI reads the manifest at runtime to resolve any agent's config. Adding a new AI tool requires only a manifest entry — no code change, no recompile.

**Why this priority**: This is the foundation every other story builds on. Without externalizing the config, "frequent add/remove of AI tools" still costs a code change each time. It also closes degradation point #3 (hardcoded enum, no extension point).

**Independent Test**: Add a 7th agent by appending one JSON entry to `agents.json`, then install it — no `.ts` file touched, no rebuild. If only this story shipped, the tool would already be extensible.

**Acceptance Scenarios**:

1. **Given** the package ships `agents.json` describing all 6 current agents, **When** the CLI resolves an agent config, **Then** it reads from `agents.json` (not an in-source enum), and all 6 install identically to today.
2. **Given** a developer wants to support a new agent "foo", **When** they add a `foo` entry to `agents.json`, **Then** `spec-coach agents add foo` works with zero TypeScript edits.
3. **Given** a manifest entry is missing a required field, **When** the CLI loads it, **Then** it rejects the entry with a specific error naming the field, rather than failing mid-install.

---

### User Story 2 - Unified Lifecycle Verbs (Priority: P1)

The tool exposes a single `agents` command group covering the full lifecycle: `list`, `add`, `update`, `remove`. This replaces ad-hoc install logic with one coherent verb set.

**Why this priority**: "Install / update / uninstall, frequently" is the literal ask. A unified verb set is the user-facing contract that makes the model usable day-to-day.

**Independent Test**: Run `spec-coach agents list` to see what's available and installed; `add` an agent; `update` it; `remove` it. Each verb works end-to-end on its own.

**Acceptance Scenarios**:

1. **Given** a project with no agents installed, **When** the user runs `spec-coach agents list`, **Then** output shows all manifest agents marked "available" and none marked "installed".
2. **Given** an agent is installed, **When** the user runs `spec-coach agents remove <key>`, **Then** the agent's files are removed and `list` no longer marks it installed.
3. **Given** an installed agent, **When** the user runs `spec-coach agents update <key>`, **Then** its skill files and managed context section are refreshed from current sources (scripts/templates are corpus infrastructure, refreshed separately by `spec-coach update`).

---

### User Story 3 - Install Is the Precise Inverse of Uninstall (Priority: P1)

`add` and `remove` are exact inverses, tracked via an installed-state file (`.spec/agents.json`). `remove` deletes exactly what `add` wrote and nothing else; project-level shared files are never lost.

**Why this priority**: Reversibility is the core safety property of any lifecycle model. Without it, "frequent uninstall" is dangerous. This closes degradation point #3's safety dimension and is what makes the model trustworthy.

**Independent Test**: `add` an agent, snapshot the project, `remove` it — the agent-owned paths return to the pre-`add` state while `.spec/scripts`, `.spec/templates`, `.spec/memory/constitution.md` survive.

**Acceptance Scenarios**:

1. **Given** a clean project, **When** the user runs `add cursor` then `remove cursor`, **Then** `.cursor/commands/spec/*` and the managed section are gone, but `.spec/scripts`, `.spec/templates`, and `constitution.md` are unchanged.
2. **Given** a project with both claude and cursor installed, **When** the user runs `agents remove cursor`, **Then** only `.cursor/commands/spec/*` and cursor's context section are removed — `.claude/skills/spec-*` and the entire spec corpus remain untouched (`remove` is scoped to exactly one agent).
3. **Given** the user runs `remove <key>` for an agent that is not installed, **When** no such agent is in state, **Then** the tool reports "not installed" and exits cleanly without deleting anything.

---

### User Story 4 - Multi-Agent Coexistence (Priority: P2)

A single project can have multiple agents installed at once. `add` is additive and idempotent — installing a second agent never disturbs the first.

**Why this priority**: Real projects use more than one AI tool. This closes degradation point #1 (single-agent hard-lock). P2 because it builds on the P1 verbs and state tracking.

**Independent Test**: `add claude` then `add cursor`; both are present and functional; `list` shows both installed; removing one leaves the other intact.

**Acceptance Scenarios**:

1. **Given** Claude is installed, **When** the user runs `add cursor`, **Then** `.cursor/commands/spec/*` is created and `.claude/skills/spec-*` is untouched.
2. **Given** both claude and cursor installed, **When** the user runs `agents list`, **Then** both are marked installed.
3. **Given** both installed, **When** the user runs `add claude` again, **Then** it upgrades in place with no duplicate files (idempotent).

---

### User Story 5 - Universal Context Injection (Priority: P2)

Every installed agent receives a managed context section in its declared context file — Claude in `CLAUDE.md`, non-Claude agents in a shared `AGENTS.md`. This generalizes `upsertClaudeManagedSection` so the spec 002 governance reach (workflow-state pointer, `show-sdd-state.sh`) applies to **all** agents, not just Claude. This closes degradation point #2.

**Why this priority**: It removes the asymmetry where only Claude benefits from the coaching context. P2 because it depends on the manifest (US1) carrying a `contextFile` field.

**Independent Test**: `add cursor` into a fresh project and confirm `.spec`-adjacent `AGENTS.md` contains the managed section pointing to `show-sdd-state.sh`, then `remove cursor` and confirm the section is gone.

**Acceptance Scenarios**:

1. **Given** a fresh project, **When** the user runs `add cursor`, **Then** a managed section is injected into `AGENTS.md` (created if absent) with the COACH markers and the workflow-state pointer.
2. **Given** AGENTS.md already has user content outside the markers, **When** context is injected/updated, **Then** the user content outside the markers is preserved unchanged.
3. **Given** both cursor and copilot installed (both non-Claude → shared AGENTS.md), **When** the user runs `remove cursor`, **Then** copilot's context remains intact (the shared section is preserved while copilot is still installed; cleaned only when the last non-Claude agent is removed).

---

### User Story 6 - Isolated Spec-Corpus Lifecycle (Priority: P2)

The spec corpus (`.spec/` infrastructure, `specs/`, constitution) and the agent bindings (`.claude/skills`, `.cursor/commands`, context sections) are **two independent lifecycles that never mutate each other**. The corpus has its own verbs — `init` (bootstrap), `update` (refresh infrastructure), `uninstall` (remove spec-coach footprint) — none of which install an agent. An agent retiring (`agents remove`) leaves the corpus untouched; this is the explicit "AI config retires, spec docs preserved" scenario.

**Why this priority**: This is the architectural backbone: the spec documents are the durable product (Constitution Principle I), agent bindings are ephemeral transport. P2 because it reshapes the command surface (decoupling corpus from agents) but builds on the manifest and verbs of US1/US2.

**Independent Test**: `init` a project (no agent installed) and confirm `.spec/` + constitution exist; then `agents add claude` followed by `agents remove claude`; confirm `.spec/`, `specs/`, and constitution are unchanged by the agent add/remove cycle.

**Acceptance Scenarios**:

1. **Given** an empty directory, **When** the user runs `spec-coach init`, **Then** `.spec/` corpus is created (templates, scripts, constitution seeded if absent) and **no agent files are installed** (no `.claude/skills`, no context section). `init` does NOT absorb or transform any existing documents — document intake is deferred to a separate pipeline.
2. **Given** a project with claude installed, **When** the user runs `agents remove claude`, **Then** `.claude/skills/spec-*` and the CLAUDE.md managed section are removed, but `.spec/scripts`, `.spec/templates`, `.spec/memory/constitution.md`, and `specs/` are unchanged.
3. **Given** the user wants to stop using spec-coach, **When** they run `spec-coach uninstall`, **Then** spec-coach infrastructure and all agent bindings are removed, but user-authored `specs/` and `constitution.md` are preserved unless `--force` is passed.

---

### Edge Cases

- **Corrupt or missing `.spec/agents.json`**: The system MUST NOT guess installed state. It treats state as empty, warns the user, and rebuilds state from an actual filesystem scan of known agent dirs (which `.claude/skills/spec-*`, `.cursor/commands/spec/*`, etc. exist) — recording what it can verify.
- **Manifest references a skill/template that doesn't exist**: preserve current behavior — warn and skip that artifact, do not abort the whole install.
- **Broken symlink inside an agent dir during `remove`**: mirror `ensureDir`'s existing resilience (do not crash; remove what is removable).
- **`remove` invoked on a project that never had `.spec` initialized**: report "nothing installed", exit cleanly, delete nothing.
- **Two non-Claude agents share AGENTS.md**: the shared managed section is written once (deduplicated). Removing one non-Claude agent keeps the section while any non-Claude agent remains; the section is removed only when the last non-Claude agent is removed.
- **Manifest entry with an unknown `format` value** (not `skills`/`markdown`): reject the entry with a specific error at load time.
- **Idempotent re-add / re-update**: running `add` or `update` twice produces no duplicate skill files and no duplicated managed section.
- **Version drift**: if `agents.json` carries a version per agent, `update` upgrades installed agents whose recorded version differs from the manifest version.
- **`agents add` when `agents.json` is empty or missing**: fail with a clear error ("no agents defined in manifest") rather than silently installing nothing.
- **`agents add` without a corpus**: MUST error helpfully ("run `spec-coach init` first") and install nothing — agent bindings are never created without a corpus.
- **Corpus `uninstall` preserving user content**: `uninstall` MUST keep `specs/` and `constitution.md` by default; only an explicit `--force` removes them, and even then it MUST confirm.
- **Template drift**: when `update` refreshes `.spec/templates/`, already-written user specs in `specs/` MUST keep their original form — `update` never retroactively rewrites existing specs to match new templates (specs are immutable artifacts).
- **Old-project reconciliation**: a project created by a prior spec-coach version (`.spec/` present, `.spec/agents.json` absent) MUST be auto-reconciled on first use of any `agents` command — agent dirs detected from the filesystem and registered into state, with a one-line notice.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: System MUST define installable agents via a data manifest (`agents.json` at the package root), not via a hardcoded source enum.
- **FR-002**: Each manifest entry MUST specify, at minimum: `key`, `name`, `dir`, `format` (`skills` | `markdown`), `separator`, `frontmatter`, `contextFile`, and `argumentHints`.
- **FR-003**: The CLI MUST resolve agent configs by reading the manifest at runtime; there MUST be no compile-time agent enum.
- **FR-004**: System MUST provide `spec-coach agents list` that shows every manifest agent and marks which are installed (per installed-state).
- **FR-005**: System MUST provide `spec-coach agents add <key>` that installs ONLY the agent's skill files (into its `dir`) and its managed context section — idempotently (re-adding upgrades in place, no duplicates). It MUST NOT install scripts or templates, which are corpus infrastructure owned by `init`/`update`.
- **FR-006**: System MUST provide `spec-coach agents remove <key>` that is the precise inverse of `add`: it removes the agent's `dir` subtree and that agent's managed context section, and nothing else.
- **FR-007**: System MUST persist installed-agent state in `.spec/agents.json` (installed keys and version), as the source of truth for `list`, `update`, and `remove`.
- **FR-008**: `agents remove` MUST NEVER delete or modify spec-corpus files (`.spec/scripts`, `.spec/templates`, `.spec/memory/constitution.md`, `specs/`). Agent retirement and the corpus are isolated lifecycles; there is no "last agent" special case that reaches into the corpus.
- **FR-009**: System MUST support multiple agents installed in one project; `add` MUST be additive and MUST NOT remove or overwrite another installed agent's files.
- **FR-010**: System MUST inject a managed context section into every installed agent's declared `contextFile` (Claude → `CLAUDE.md`; non-Claude → shared `AGENTS.md`), generalizing the current Claude-only injection.
- **FR-011**: The managed context section MUST be per-agent reversible: `remove` deletes exactly that agent's section; when multiple non-Claude agents share `AGENTS.md`, the shared section is preserved while any non-Claude agent remains installed.
- **FR-012**: System MUST provide `spec-coach agents update [key | --all]` that refreshes installed agents' files from current manifest/templates/skills and updates recorded state.
- **FR-013**: spec-coach MUST expose two isolated command surfaces: the **corpus lifecycle** (`init`, `update`, `uninstall`) which operate only on the spec corpus and install no agent, and the **agent lifecycle** (`agents add`/`update`/`remove`/`list`). `agents add <key>` MUST require the corpus to already exist and MUST error with guidance ("run `spec-coach init` first") if `.spec/` is absent — it MUST NOT bootstrap the corpus.
- **FR-016**: `spec-coach uninstall` MUST remove spec-coach infrastructure (`.spec/scripts`, `.spec/templates`, `.spec/agents.json`, all agent bindings and managed context sections) while PRESERVING user-authored content (`specs/`, `.spec/memory/constitution.md`, `.spec/absorbed/`) unless an explicit `--force` flag is passed; it MUST confirm before deleting.
- **FR-017**: `spec-coach init` and `update` MUST install/refresh ONLY corpus infrastructure (`.spec/templates/`, `.spec/scripts/`, and seeding `constitution.md` if absent on `init`). They MUST NOT install agent skill files and MUST NOT modify any user artifact (`specs/`, an existing `constitution.md`, `.spec/feature.json`, `.spec/agents.json`, `.spec/absorbed/`). Additionally, `init` MUST NOT scan for, move, transform, or delete existing documents (no auto-absorb); document intake is a separate concern.
- **FR-018**: When `.spec/agents.json` is absent but the corpus exists (`.spec/` present — e.g. a project created by a prior spec-coach version), the CLI MUST reconcile installed state by scanning the filesystem for known agent dirs and populating `.spec/agents.json`, so existing bindings are recognized by `agents list`/`update`/`remove` without re-installation.
- **FR-014**: Destructive operations (`agents remove`, `uninstall`) MUST confirm before deleting by default; lifecycle commands MUST degrade gracefully and exit nonzero only on genuine errors, never on "nothing to do".
- **FR-015**: System MUST validate manifest entries at load time and reject malformed ones (missing required field, unknown `format`) with a specific, actionable error, rather than failing partway through an install.

### Key Entities *(include if feature involves data)*

- **Agent Manifest** (`agents.json`): the catalog of installable agents. Pure data; each entry fully describes one agent's install behavior. Adding an agent = adding an entry.
- **Installed Agent State** (`.spec/agents.json`): per-project record of which agents are installed and at what version. Source of truth for `list`/`update`/`remove`.
- **Managed Context Section**: a reversible, marker-delimited block (`<!-- COACH START/END -->`) injected into an agent's contextFile. Per-agent on `CLAUDE.md`; shared/deduplicated on `AGENTS.md`.
- **Spec Corpus**: the durable product, split into two tiers: (1) **tool infrastructure** — `.spec/templates/`, `.spec/scripts/`, refreshable by `update`, owned by spec-coach; (2) **user artifacts** — `specs/`, `.spec/memory/constitution.md`, `.spec/absorbed/`, `.spec/feature.json`, authored content that NO lifecycle op may modify except `uninstall --force`. Survives all agent-binding changes. Embodies Constitution Principle I.
- **Agent Binding**: the ephemeral transport — an agent's `dir` subtree plus its managed context section. Owned by one agent; removable without touching the corpus.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: Adding support for a new AI tool requires zero TypeScript code changes — only a manifest entry in `agents.json`.
- **SC-002**: `add <key>` followed by `remove <key>` leaves agent-owned paths identical to the pre-`add` state (precise inverse), and shared project files are never lost.
- **SC-003**: A single project can have two or more agents installed simultaneously, both functional (commands/skills present and context injected).
- **SC-004**: All six currently-supported agents (claude, cursor, copilot, codex, windsurf, kiro) both install AND receive injected context — closing the spec 002 reach gap that limited context to Claude alone.
- **SC-005**: Removing all installed agents leaves the spec corpus fully intact (`.spec/`, `specs/`, constitution unchanged); the corpus and agent lifecycles are independently operable — an AI tool can retire without losing any spec documentation.
- **SC-006**: Lifecycle operations are idempotent — running `add` or `update` twice yields no duplicate files and no duplicate managed sections.

## Assumptions

- spec-coach is early-stage with a small user base, so the old `init --agent`/`update --agent` coupling is **deleted**. In its place are two strictly isolated surfaces: the corpus lifecycle (`init`/`update`/`uninstall`, no agent) and the agent lifecycle (`agents add`/`update`/`remove`/`list`). First-time setup is now two commands (`spec-coach init`, then `spec-coach agents add <key>`) — accepted as the price of clean isolation.
- Non-Claude agents share a single `AGENTS.md` managed section (the emerging cross-agent standard that cursor/copilot/codex/windsurf/kiro all read). Per-agent native context files (e.g. `.cursor/rules/*.mdc`) are out of scope for v1.
- The existing install payload (skills/*.md, scripts/bash/*.sh, templates/*.md) is unchanged; this feature re-orchestrates installation, it does not alter the payload.
- Auto-absorption of existing documents (formerly performed by `init`) is **removed from this feature** and deferred to a dedicated document-intake pipeline (planned as a separate spec). 003's `init` scaffolds the corpus without scanning, moving, transforming, or deleting any existing documents.
- `.spec/agents.json` is the source of truth for installed state; when missing or corrupt, the system rebuilds conservatively from a filesystem scan and warns, rather than guessing destructively.
- The package remains zero-dependency beyond `tsx`; the manifest is plain JSON read via `node:fs` — no new runtime dependencies.
- This is a dogfood feature (spec-coach editing itself); the project constitution (5 principles) governs the plan stage, where deviations (e.g. bash/scripts use) will be justified in the Complexity Tracking section.
