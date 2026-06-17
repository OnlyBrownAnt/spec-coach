# Tasks: Unified Agent Lifecycle

**Input**: Design documents from `/specs/003-unified-agent-lifecycle/`

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: Tests ARE requested (Constitution Principle V "Verify What Ships"; plan defines 4 mechanical test files). TDD throughout — each test written and failing before its implementation.

**Organization**: Tasks grouped by user story. Shared infrastructure (manifest, state, context injection) lives in Foundational (Phase 2) so user stories stay independent.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Source**: `src/` (cli.ts, manifest.ts, state.ts, utils.ts, commands/*) at repository root
- **Tests**: `tests/scripts/` (mechanical, fixture-driven bash tests — no AI, fast)
- **Data**: `agents.json` at repository root (manifest); `.spec/agents.json` per-project (state)
- **Dogfood note**: this feature edits spec-coach itself — `src/`, `agents.json`, `.spec/memory/constitution.md`, `package.json`

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Externalize agent data and ensure it ships.

- [x] T001 Create `agents.json` at repo root: extract the 6 agents currently hardcoded in `src/utils.ts` `AGENTS` (claude/cursor/copilot/codex/windsurf/kiro) into entries with fields `key, name, dir, format, separator, frontmatter, contextFile, contextMarkers, argumentHints, version`. Add `"agents.json"` to the `files` array in `package.json`. **Verify**: `npm pack --dry-run` output lists `agents.json`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: Core infrastructure that MUST be complete before ANY user story verb can be built.

**⚠️ CRITICAL**: No user-story command work can begin until this phase is complete.

- [x] T002 [P] [US1] `src/manifest.ts` — define `AgentEntry` type; `loadManifest()` reads `agents.json` via `PACKAGE_ROOT`; `validateAgentEntry(e)` rejects missing `key/name/dir/format` or unknown `format` value with a field-named error (FR-015). Write `tests/scripts/test-manifest.sh` FIRST (valid load returns 6 agents; each malformed entry — missing key, missing dir, bad format — rejected). Depends T001.
- [x] T003 [P] [US3] `src/state.ts` — define `InstalledState` type; `readState(projectRoot)`, `writeState(projectRoot, state)` for `.spec/agents.json`; `reconcileFromFs(projectRoot)` scans known agent dirs (`.claude/skills/spec-*`, `.cursor/commands/spec/*`, etc.) to populate state when `.spec/agents.json` is absent (FR-007, FR-018). Write `tests/scripts/test-state.sh` FIRST (write→read round-trip preserves keys+version; reconcile populates state from a fixture project's agent dirs). No dependencies — parallel with T002.
- [x] T004 [US1] `src/utils.ts` — remove the `AGENTS` literal and `AgentKey` enum; add `loadAgentConfig(key): AgentConfig` backed by `loadManifest()` (T002). Keep `installSkill`, `installAllSkills`, `installDocumentTemplates`, `installConstitutionToMemory`, `installScripts`, `ensureDir`, frontmatter helpers unchanged. **Verify**: `loadAgentConfig("claude")` returns the claude config; existing install code still references resolve correctly. Depends T002.
- [x] T005 [US5] `src/utils.ts` — generalize `upsertClaudeManagedSection` → `upsertManagedSection(agent, projectRoot)` reading `contextFile` + `contextMarkers` from the agent config (claude→CLAUDE.md, non-claude→AGENTS.md), and add `removeManagedSection(agent, projectRoot)` (FR-010, FR-011). Write `tests/scripts/test-context-inject.sh` FIRST (claude writes CLAUDE.md section; cursor writes AGENTS.md section; remove clears the section; shared AGENTS.md section preserved while a non-claude agent remains; user content outside markers preserved). Depends T004.

**Checkpoint**: Foundation ready — manifest, state, agent-config resolution, and context injection are all independently usable. User-story verbs can now be built.

---

## Phase 3: User Story 1 - Manifest-Driven Agents (Priority: P1) 🎯 MVP

**Goal**: Adding an AI tool is a data edit (one JSON entry), never a code change.

**Independent Test**: Append a 7th agent to `agents.json` and resolve it — no `.ts` file touched.

### Tests for User Story 1

- [x] T006 [US1] Extend `tests/scripts/test-manifest.sh`: append a fixture agent `foo` to a temp `agents.json`, assert `loadAgentConfig("foo")` resolves all fields, and assert the test added NO `.ts` edits (diff check) (FR-001, FR-002, FR-003, SC-001). Depends T002, T004.

**Checkpoint**: Agents are purely data-driven — SC-001 satisfied. This alone is a shippable MVP.

---

## Phase 4: User Story 2 - Unified Lifecycle Verbs (Priority: P1)

**Goal**: `agents list / add / update / remove` work as one coherent verb set.

**Independent Test**: `agents list` (nothing installed) → `agents add cursor` → `agents update cursor` → `agents remove cursor`.

### Implementation for User Story 2

- [x] T007 [P] [US2] `src/commands/agents.ts` — `runAgentsList(projectRoot)`: join manifest (T002) with installed state (T003), print each agent with an installed/available mark (FR-004). Depends T002, T003, T004.
- [x] T008 [US2] [US4] `src/commands/agents.ts` — `runAgentsAdd(key, projectRoot)`: guard requires corpus (FR-013) — if `.spec/` absent, print coach-tone guidance ("run `spec-coach init` first") and exit nonzero WITHOUT installing; otherwise install skills via `installSkill` + context via `upsertManagedSection` (T005), idempotently, and write state (FR-005, FR-009). Depends T005, T007.
- [x] T009 [US2] [US3] `src/commands/agents.ts` — `runAgentsRemove(key, projectRoot)`: confirm before deleting; remove the agent's `dir` subtree + `removeManagedSection` (T005); NEVER touch corpus files (FR-008); update state (FR-006, FR-014). Depends T005, T007.
- [x] T010 [US2] `src/commands/agents.ts` — `runAgentsUpdate(target, projectRoot)`: refresh installed agents' skills + context sections from current sources (FR-012); `--all` refreshes every installed agent. Depends T007.

**Checkpoint**: All four verbs implemented (CLI wiring lands in T018).

---

## Phase 5: User Story 3 - Install Is the Precise Inverse of Uninstall (Priority: P1)

**Goal**: `add` and `remove` are exact inverses; the spec corpus is never touched by agent ops.

**Independent Test**: `add cursor` → snapshot → `remove cursor` → agent-owned paths return to pre-add; `.spec/` unchanged.

### Tests for User Story 3

- [x] T011 [US3] `tests/scripts/test-lifecycle.sh`: on a fixture project `agents add cursor`, snapshot agent-owned paths, `agents remove cursor`, assert paths match pre-add exactly; assert `.spec/scripts`, `.spec/templates`, `.spec/memory/constitution.md`, `specs/` unchanged; assert state round-trips (FR-006, FR-008, FR-014). Depends T008, T009.

**Checkpoint**: Reversibility proven — the core safety property of the lifecycle.

---

## Phase 6: User Story 4 - Multi-Agent Coexistence (Priority: P2)

**Goal**: Multiple agents installed at once; `add` is additive and idempotent.

**Independent Test**: `add claude` + `add cursor` → both installed; re-`add claude` → no duplicates.

### Tests for User Story 4

- [x] T012 [US4] Extend `tests/scripts/test-lifecycle.sh`: `add claude` then `add cursor`, assert both marked installed and both dirs present; `remove cursor` leaves claude intact; `add claude` again produces no duplicate skill files and no duplicate managed section (FR-009). Depends T011.

**Checkpoint**: Multi-agent coexistence proven.

---

## Phase 7: User Story 5 - Universal Context Injection (Priority: P2)

**Goal**: Every installed agent receives a managed context section; non-Claude agents share `AGENTS.md`.

**Independent Test**: `add cursor` → `AGENTS.md` gains the section; remove the last non-Claude agent → section cleared; claude always uses `CLAUDE.md`.

### Tests for User Story 5

- [x] T013 [US5] Extend `tests/scripts/test-context-inject.sh`: via `agents add cursor` (T008), assert `AGENTS.md` gains the managed section (pointing to `show-sdd-state.sh`); removing the last non-Claude agent clears it; claude always writes `CLAUDE.md` (FR-010, FR-011). Depends T005, T008.

**Checkpoint**: Context injection reaches all six agents — closes the spec-002 reach gap.

---

## Phase 8: User Story 6 - Isolated Spec-Corpus Lifecycle (Priority: P2)

**Goal**: Corpus lifecycle (`init`/`update`/`uninstall`) is decoupled from agent bindings; an agent retiring leaves the corpus intact.

**Independent Test**: `init` (no agent) → `agents add claude` → `agents remove claude` → corpus byte-unchanged.

### Implementation for User Story 6

- [x] T014 [P] [US6] `src/commands/init.ts` rewrite — corpus scaffold ONLY: `createProjectStructure` + `installDocumentTemplates` + `installConstitutionToMemory` + `installScripts` + create empty `.spec/agents.json`; NO `installAllSkills`, NO context section, NO absorb (FR-013, FR-017). Depends T003.
- [x] T015 [P] [US6] `src/commands/update.ts` rewrite — refresh `.spec/templates/` + `.spec/scripts/` ONLY; no skills, no context, no user-artifact mutation (FR-013, FR-017). Parallel with T014.
- [x] T016 [US6] `src/commands/uninstall.ts` (new) — remove `.spec/scripts`, `.spec/templates`, `.spec/agents.json`, all agent dirs + managed sections; PRESERVE `specs/`, `.spec/memory/constitution.md`, `.spec/absorbed/` unless `--force`; confirm before deleting (FR-014, FR-016). Depends T005, T009.
- [x] T017 [US6] Extend `tests/scripts/test-lifecycle.sh`: `init` creates corpus with NO agent files (no `.claude/skills`); `update` touches only templates/scripts; `uninstall` preserves `specs/` + constitution by default (FR-016, FR-017). Depends T014, T015, T016.

**Checkpoint**: Corpus and agent lifecycles fully isolated and independently operable.

---

## Phase 9: Polish & Cross-Cutting Concerns

**Purpose**: CLI wiring, constitution amendment, migration, release smoke.

- [x] T018 [Cross] `src/cli.ts` — full router: top-level `init` / `update` / `uninstall` + `agents {list, add, update, remove}` with arg parsing; remove the old `--agent` coupling (FR-013). Depends T007–T010, T014, T015, T016.
- [x] T019 [Cross] Constitution amendment: update `.spec/memory/constitution.md` Development Constraints — (a) replace "Two commands: init and update" with the two-surface lifecycle, (b) replace the `AGENTS`-map clause with the `agents.json` manifest; add a `<!-- SYNC IMPACT START/END -->` rationale block (run `scripts/bash/verify-constitution-sync.sh`). Bump `package.json` to `2.0.0`; add a changelog entry naming the install-contract change + reconcile migration. Depends on all prior tasks.
- [x] T020 [Cross] Migration + release smoke: build a fixture old-project (`.spec/` + agent dirs, NO `.spec/agents.json`), run an `agents` command, assert reconcile populates state non-destructively (FR-018); run `npm test` (all green); `npm pack --dry-run` ships `agents.json`; temp-project `init` → `agents add claude` → `agents remove claude` works end-to-end. Depends T018.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1)**: No dependencies — start immediately.
- **Foundational (Phase 2)**: Depends on Setup — BLOCKS all user stories.
- **US1 (Phase 3)**: Depends on Foundational. Ships the data-driven MVP.
- **US2 (Phase 4)**: Depends on Foundational (incl. context injection T005 + state T003) — NOT on other user stories.
- **US3/US4/US5 (Phases 5–7)**: Verification tasks; depend on US2 verbs (T008/T009) but not on each other.
- **US6 (Phase 8)**: Depends on Foundational; its corpus commands are independent of US2's agent verbs (different files) → can run in parallel with US2–US5.
- **Polish (Phase 9)**: Depends on all commands existing (T018) and on the feature being functionally complete (T019/T020).

### User Story Dependencies

- **US1 (P1)**: Foundational only. No story-to-story dependency.
- **US2 (P1)**: Foundational only (context injection + state live there by design, avoiding a US→US dependency).
- **US3 (P1)**: Verifies US2's add/remove; depends on T008/T009.
- **US4 (P2)**: Verifies US2 add; depends on T008 (via T011).
- **US5 (P2)**: Implementation is Foundational (T005); this phase verifies it end-to-end via US2 add (T008).
- **US6 (P2)**: Foundational only; parallel-safe with US2–US5.

### Within Each User Story

- Test written and FAILING before implementation (TDD — Iron Law).
- Manifest/state before config resolution; config resolution before commands.
- Commands before CLI wiring.

### Parallel Opportunities

- T002 and T003 run in parallel (different files, both after T001).
- T014 and T015 run in parallel (different files).
- US6 (Phase 8) runs in parallel with US2–US5 (corpus commands vs agent verbs — disjoint files).
- US3/US4/US5 verification tests run in parallel once US2 verbs land.

---

## Implementation Strategy

### MVP First (Setup + Foundational + US1)

1. Complete Phase 1: Setup (`agents.json` ships).
2. Complete Phase 2: Foundational (manifest, state, config, context injection).
3. Complete Phase 3: US1 (data-driven agents).
4. **STOP and VALIDATE**: prove adding a 7th agent is a JSON-only edit (SC-001). This is a deployable MVP.

### Incremental Delivery

1. Setup + Foundational → foundation ready.
2. + US1 → data-driven agents (MVP).
3. + US2 → lifecycle verbs usable.
4. + US3 → reversibility proven (safety).
5. + US4 → multi-agent.
6. + US5 → universal context injection (closes spec-002 gap).
7. + US6 → corpus isolation complete.
8. Polish → constitution amendment, migration, release smoke (2.0.0).

### Parallel Team Strategy

With multiple streams after Foundational:
- Stream A: US2 verbs → US3/US4/US5 verification.
- Stream B: US6 corpus lifecycle (disjoint files).
- Merge in Polish (T018 CLI wiring unifies both).

---

## Notes

- [P] tasks = different files, no dependencies.
- [Story] label maps each task to its user story for traceability.
- Every task ships one commit; tests precede implementation (TDD).
- This is dogfood — the feature edits spec-coach's own `src/`, `agents.json`, and `.spec/memory/constitution.md`.
- T019 amends the constitution itself (CLI-surface + agent-support clauses) — the documented compelling reason is this spec/plan; migration is FR-018 reconcile.
- MAJOR version bump (2.0.0) reflects the changed install contract; reconcile makes it non-destructive.
