# Tasks: Precise Deletion (Only Remove What Spec Coach Owns)

**Input**: Design documents from `/specs/004-precise-deletion/`

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: This feature is test-driven. Every implementation task is `(RED→GREEN)`: write/extend the mechanical test first, watch it fail for the right reason, then implement. Mechanical tests live in `tests/units/*.test.ts` (`node:assert/strict`, run via `npx tsx tests/units/<name>.test.ts`). `npm test` is AI-driven and cannot run headless in this environment — verification evidence comes from the mechanical suites + `npx tsx src/cli.ts` smokes.

**Organization**: Tasks grouped by user story; foundational state/utils infrastructure first (blocks everything), then US1 (MVP), US2, US3, then polish.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on the in-flight task).
- **[Story]**: US1 = user content survives; US2 = own shells cleaned; US3 = legacy precise.
- Each task names exact file(s) + verification + dependencies.

## Path Conventions

Single project: `src/`, `tests/` at repository root (dogfood — modifying spec-coach itself).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Version + changelog scaffold for the PATCH release.

- [x] T001 [P] — Bump `package.json` `version` 2.0.0 → **2.0.1** and add a `CHANGELOG.md` `## 2.0.1` skeleton entry titled "Precise deletion (only remove what spec-coach owns)". Files: `package.json`, `CHANGELOG.md`. **Verify**: `node -e "console.log(require('./package.json').version)"` prints `2.0.1`; CHANGELOG has the section. **Deps**: none.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: State schema + owned-path computation that EVERY user story depends on. **⚠️ No user-story work until T002–T005 are done.**

- [x] T002 [US1] (RED→GREEN) — Add `createdFiles?: string[]` to `InstalledAgent` in `src/state.ts`; confirm `readState`/`writeState` round-trip it (they already pass arbitrary fields through — add an explicit assertion); extend `recordAgent(projectRoot, key, version, createdFiles?)` to persist `createdFiles` when provided. Files: `src/state.ts`, `tests/units/state.test.ts` (new cases: round-trip createdFiles; recordAgent with createdFiles persists). **Verify**: `npx tsx tests/units/state.test.ts` → green. **Deps**: none. **FR-013, FR-014**.
- [x] T003 [P] [Foundational] (RED→GREEN) — In `src/utils.ts`, export the currently-private `SKILL_NAMES` const and add `ownedSkillUnits(agent: AgentConfig, projectRoot: string): string[]` returning the relative leaf paths `installAllSkills` writes: `agent.dir/spec-{name}` (skills format) and `agent.dir/spec/{name}.md` (markdown format). Files: `src/utils.ts`, `tests/units/owned-paths.test.ts` (NEW — assert ownedSkillUnits(claude) yields 11 `.claude/skills/spec-*` dirs; ownedSkillUnits(cursor) yields 11 `.cursor/commands/spec/*.md`). **Verify**: `npx tsx tests/units/owned-paths.test.ts` → green. **Deps**: none (parallel with T002 — different file). **FR-001/005 source**.
- [x] T004 (RED→GREEN) — In `src/state.ts`, add top-level `createdContextFiles` support without changing `readState`'s return type: `readCreatedContextFiles(projectRoot): string[]` (→ `[]` when absent/unreadable), `recordContextFileCreated(projectRoot, file)` (idempotent union), `removeContextFileCreated(projectRoot, file)` (idempotent removal). State file shape becomes `{ agents, createdContextFiles? }`. Files: `src/state.ts`, `tests/units/state.test.ts` (round-trip; idempotent add; idempotent remove; absent → `[]`). **Verify**: `npx tsx tests/units/state.test.ts` → green. **Deps**: T002 (same file). **FR-013**.
- [x] T005 [P] (RED→GREEN) — In `src/utils.ts`, change `upsertManagedSection(agent, projectRoot)` return type from `void` to `{ created: boolean }`: `created === true` iff the context file did NOT exist immediately before the write (both no-marker branches report correctly; the in-place marker-replace branch reports `false`). Files: `src/utils.ts`, `tests/units/context-inject.test.ts` (UPDATE — assert created:true on absent file, false on existing file, false on re-upsert with markers). **Verify**: `npx tsx tests/units/context-inject.test.ts` → green. **Deps**: T003 (same file); parallel with T004 (different file). **FR-003**.

**Checkpoint**: State schema + owned-path source of truth ready. `agents.ts`/`uninstall.ts` work can begin.

---

## Phase 3: User Story 1 - User content survives every lifecycle op (Priority: P1) 🎯 MVP

**Goal**: `agents add` → `remove` → `uninstall` never deletes user-authored content in `spec-*` dirs, shared `spec/` command dirs, or user context files. Replaces the wildcard/heuristic with provenance-driven deletion.

**Independent Test**: Bind an agent into a project holding colliding user content, run remove then uninstall, and tree-diff: zero user paths deleted.

### Implementation for User Story 1

- [x] T006 [US1] (RED→GREEN) — In `src/commands/agents.ts` `runAgentsAdd`: after `installAllSkills`, compute `createdFiles` via `ownedSkillUnits(agent, projectRoot)` and pass to `recordAgent(root, key, agent.version, createdFiles)`; capture `const { created } = upsertManagedSection(agent, projectRoot)` and, if `created`, call `recordContextFileCreated(root, agent.contextFile)`. Files: `src/commands/agents.ts`, `tests/units/precise-deletion.test.ts` (NEW — after add claude: `readState().claude.createdFiles` has the 11 paths; `CLAUDE.md` ∈ `readCreatedContextFiles` when it was created). **Verify**: `npx tsx tests/units/precise-deletion.test.ts` → green. **Deps**: T002, T003, T004, T005. **FR-001, FR-002**.
- [x] T007 [US1] (RED→GREEN) — In `src/commands/agents.ts`, rewrite `removeAgentSkills(agent, projectRoot, createdFiles?)`: if `createdFiles` provided → delete each path; for skills-format dirs, gate deletion on a new helper `dirContainsOnlyManaged(dir)` (true iff `readdirSync(dir)` set equals `{ "SKILL.md" }` — otherwise preserve + `console.warn`); markdown files delete directly; then `pruneEmptyParents` each. If `createdFiles` absent → Tier 1 fallback deleting exactly `ownedSkillUnits(agent, root)` paths. **Never** a `spec-*` prefix/whole-`spec/` wildcard. Missing paths skipped (`try/catch`). Update `runAgentsRemove` to pass `state[key]?.createdFiles`. Files: `src/commands/agents.ts`, `tests/units/precise-deletion.test.ts` (seed `.claude/skills/spec-user-own/` → add+remove claude → it survives, 11 coach dirs gone; remove with `createdFiles` undefined → whitelist deletes only the known set, user dir still survives). **Verify**: `npx tsx tests/units/precise-deletion.test.ts` → green. **Deps**: T003 (ownedSkillUnits), T006. **FR-004, FR-005, FR-006, FR-007, FR-018**.
- [x] T008 [US1] (RED→GREEN) — In `src/commands/agents.ts`, rewrite `removeAgentContext(agent, projectRoot, { isOwner })`: keep the `otherNonClaudeAgentsInstalled` preservation gate (block stays while other non-Claude agents installed); strip the COACH block via `removeManagedSection` (unchanged); **never** delete the file body when `!isOwner` (user-owned file — preserved even if empty). Update `runAgentsRemove` to pass `isOwner = readCreatedContextFiles(root).includes(agent.contextFile)`. (Owned-shell deletion is added in T012.) Files: `src/commands/agents.ts`, `tests/units/precise-deletion.test.ts` (user pre-created `CLAUDE.md` → add+remove → block stripped, file preserved even if empty; shared `AGENTS.md` with copilot remaining → remove cursor keeps the file). **Verify**: `npx tsx tests/units/precise-deletion.test.ts` → green. **Deps**: T004, T005. **FR-008, FR-010, FR-011 (preserve half)**.
- [x] T009 [P] [US1] (RED→GREEN) — In `src/commands/agents.ts` `runAgentsUpdate`: re-install, then recompute `createdFiles = ownedSkillUnits(agent, root).filter((p) => fs.existsSync(path.join(root, p)))` and re-record via `recordAgent`; if `upsertManagedSection` reports `created`, ensure the context file is in `createdContextFiles`. Files: `src/commands/agents.ts`, `tests/units/agents-update.test.ts` (UPDATE — after update, `createdFiles` equals on-disk owned paths; an extra user `spec-*` dir is NOT in `createdFiles`). **Verify**: `npx tsx tests/units/agents-update.test.ts` → green. **Deps**: T003, T006. **FR-017**.
- [x] T010 [P] [US1] (RED→GREEN) — In `src/commands/uninstall.ts`, iterate **installed** agents (`Object.keys(ensureState(projectRoot))`) instead of the full manifest; for each call `removeAgentSkills(agent, root, state[key]?.createdFiles)` and `removeAgentContext(agent, root, { isOwner: readCreatedContextFiles(root).includes(agent.contextFile) })`; keep `INFRA_PATHS`/`USER_PATHS` logic unchanged. Files: `src/commands/uninstall.ts`, `tests/units/corpus-uninstall.test.ts` (UPDATE — uninstall with `.claude/skills/spec-user-own/` + user `CLAUDE.md` present → all user content survives; coach infra + bindings gone). **Verify**: `npx tsx tests/units/corpus-uninstall.test.ts` → green. **Deps**: T007, T008 (parallel with T009 — different file). **FR-012**.
- [x] T011 [US1] capstone — In `tests/units/precise-deletion.test.ts`, add the SC-001 tree-diff: snapshot a project with colliding user content (`.claude/skills/spec-user-own/`, `.cursor/commands/spec/notes.md`, user `CLAUDE.md`), run `agents add claude` + `agents add cursor` + `agents remove` both + `uninstall --yes`, assert the user paths are byte-identical before/after and all spec-coach paths are gone. Also update `tests/units/lifecycle.test.ts` US3 to seed `.claude/skills/spec-user/` + `.cursor/commands/spec/notes.md` and assert survival through add→remove. Files: `tests/units/precise-deletion.test.ts`, `tests/units/lifecycle.test.ts`. **Verify**: both suites green. **Deps**: T006–T010. **SC-001**.

**Checkpoint**: US1 complete — no user content is ever deleted by remove/uninstall, provably.

---

## Phase 4: User Story 2 - Spec Coach cleans up its own shells (Priority: P2)

**Goal**: The positive complement — files/dirs spec-coach created that are now empty after teardown ARE removed (no litter), gated by provenance.

**Independent Test**: Add an agent into an empty project (spec-coach creates the context file), remove it, and assert the context file + all created skill dirs are gone — while an identical run where the user pre-created the context file keeps it.

### Implementation for User Story 2

- [x] T012 [US2] (RED→GREEN) — In `src/commands/agents.ts`, extend `removeAgentContext` with the owned-shell deletion: when `isOwner` AND (after block strip) the residual is empty or exactly `# ${path.basename(projectRoot)}` → `fs.unlinkSync` the file and call `removeContextFileCreated(root, agent.contextFile)`. For shared `AGENTS.md`: deletion proceeds only when this is the last non-Claude agent AND owned AND empty (the `otherNonClaudeAgentsInstalled` gate already blocks otherwise). Files: `src/commands/agents.ts`, `tests/units/precise-deletion.test.ts` (no `CLAUDE.md` → add claude creates it → remove → file deleted + removed from `createdContextFiles`; coach-created `CLAUDE.md` + user adds a section → remove → file preserved; cursor+copilot both installed → remove copilot last → `AGENTS.md` deleted iff owned+empty). **Verify**: `npx tsx tests/units/precise-deletion.test.ts` → green. **Deps**: T008 (built the preservation half), T006. **FR-009, FR-011 (delete half), SC-003**.

**Checkpoint**: US2 complete — provenance-driven positive teardown; no litter, no over-deletion.

---

## Phase 5: User Story 3 - Legacy projects get precise deletion with zero regression (Priority: P2)

**Goal**: A v2.0.0 project (bindings on disk, no provenance) reconciles on first command and immediately gets precise deletion; already-installed agents are unaffected.

**Independent Test**: Scaffold a v2.0.0-shaped project with colliding user content, run `agents remove` on the new code, and assert it deletes exactly the spec-coach skill set (no wildcard) and preserves the collision.

### Implementation for User Story 3

- [x] T013 [P] [US3] (RED→GREEN) — In `src/state.ts` `reconcileFromFs`: for each detected agent, set `createdFiles = ownedSkillUnits(agent, projectRoot).filter((p) => fs.existsSync(path.join(projectRoot, p)))` (import `ownedSkillUnits` from `./utils.ts` — cycle-safe, verified in plan). Do **not** populate `createdContextFiles`. Files: `src/state.ts`, `tests/units/migration.test.ts` (UPDATE — legacy project: first `getAgentsStatus` reconcile writes `createdFiles` for detected agents, leaves `createdContextFiles` empty), `tests/units/state.test.ts` (reconcile createdFiles = expected∩disk). **Verify**: `npx tsx tests/units/migration.test.ts && npx tsx tests/units/state.test.ts` → green. **Deps**: T002, T003 (ownedSkillUnits); parallel with US1 agents.ts work after T004 (state.ts is free once T004 lands). **FR-015, FR-016**.
- [x] T014 [US3] (RED→GREEN) — In `tests/units/precise-deletion.test.ts`, add the SC-004 legacy scenario: a project with claude bindings on disk + `.claude/skills/spec-user-docs/` (user) + no `createdFiles` → `agents remove claude --force` deletes exactly the 11 coach skill dirs (via reconcile→`createdFiles`, Tier 2) and leaves `spec-user-docs/`; `agents list` reconcile writes `createdFiles`; already-installed agents remain installed. Files: `tests/units/precise-deletion.test.ts`. **Verify**: `npx tsx tests/units/precise-deletion.test.ts` → green. **Deps**: T013, T007. **SC-004**.

**Checkpoint**: US3 complete — legacy projects get precise deletion with zero regression.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: Whole-suite verification, CLI smokes, release finalization.

- [x] T015 [P] — Run the entire mechanical suite and confirm green with no regression vs spec 003's 172 assertions: `for f in tests/units/*.test.ts; do npx tsx "$f" || break; done`. Paste the per-file `=== Results: N passed, M failed ===` lines. Files: none (verification). **Verify**: every suite prints 0 failed. **Deps**: all implementation tasks.
- [x] T016 [P] — CLI smokes in a throwaway tmp project: `npx tsx src/cli.ts init`, `agents add claude`, seed `.claude/skills/spec-smoke/` + a user `CLAUDE.md`, `agents remove claude --force`, `uninstall --yes`; confirm `spec-smoke/` and the user `CLAUDE.md` survive. Files: none (verification). **Verify**: user content intact after teardown; paste `find` output. **Deps**: T015.
- [x] T017 [P] — Finalize `CHANGELOG.md` 2.0.1 entry: document the deletion-precision fix (wildcard → provenance/whitelist; `# projectName` heuristic → `createdContextFiles`), the new optional state fields, and the conservative legacy behavior. Update the constitution SDD STATE block → `Current feature: 004-precise-deletion`, `Last phase: implement`. Files: `CHANGELOG.md`, `.spec/memory/constitution.md`. **Verify**: CHANGELOG complete; SDD STATE reflects 004. **Deps**: T015.
- [x] T018 [P] — Set `specs/004-precise-deletion/spec.md` **Status** → `Implemented`. Files: `specs/004-precise-deletion/spec.md`. **Verify**: status line reads Implemented. **Deps**: T015.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: independent — can start immediately.
- **Foundational (Phase 2, T002–T005)**: T002/T003 start together; T004 follows T002; T005 follows T003. **BLOCKS all user stories.**
- **US1 (Phase 3, T006–T011)**: all depend on Foundational; T006 → T007 → T008; T009 and T010 branch off (parallel, different files); T011 capstone last.
- **US2 (Phase 4, T012)**: depends on T008 (preservation half) + T006.
- **US3 (Phase 5, T013–T014)**: T013 depends on Foundational only (parallel with US1 after T004); T014 depends on T013 + T007.
- **Polish (Phase 6, T015–T018)**: T015 depends on all implementation; T016/T017/T018 parallel after T015.

### Within Each User Story

- Tests are written FIRST and FAIL before implementation (RED→GREEN on every task).
- Foundational helpers (ownedSkillUnits, state accessors) before the commands that consume them.
- Skill removal (T007) before context removal wiring (T008) before update (T009) / uninstall (T010).
- Story complete (capstone green) before moving on.

### Parallel Opportunities

- **T001** independent.
- **T002 ‖ T003** (state.ts ‖ utils.ts).
- **T004 ‖ T005** (after their file's first task: T004 after T002, T005 after T003).
- **T009 ‖ T010** (agents-update ‖ uninstall, both after T007/T008).
- **T013 ‖ US1 work** (US3 state.ts reconcile after T004, while US1 works agents.ts).
- **T016 ‖ T017 ‖ T018** (polish, after T015).

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 (setup) → T002–T005 (foundation) → T006–T011 (US1: precise deletion preserves user content).
2. **STOP and VALIDATE**: `precise-deletion.test.ts` + `lifecycle.test.ts` green; CLI smoke confirms no user-content deletion. The headline bug is fixed and shipped-able as 2.0.1.

### Incremental Delivery

1. Foundation → US1 (no user content deleted) → validate.
2. US2 (own shells cleaned) → validate (positive teardown).
3. US3 (legacy precise) → validate (zero regression on v2.0.0 projects).
4. Polish → full suite + smokes + changelog + SDD state.

### Notes

- Every implementation task is TDD (RED→GREEN); paste the failing-then-passing output as evidence per the spec-implement Iron Laws.
- `npm test` is AI-driven/non-headless — do NOT claim it passes; verification = mechanical suites + tsx CLI smokes.
- Keep the build green between commits: when a function signature changes (e.g. `removeAgentSkills`, `removeAgentContext`, `upsertManagedSection`), update its callers in the same task/commit.

---

## Cross-Check vs Plan

- Every component C1–C8 has ≥1 task: C1→T002/T004; C2→T003/T005; C3→T007; C4→T008/T012; C5→T006/T009; C6→T010; C7→T013; C8→T006–T015.
- Every FR-001..FR-018 maps to a task (see per-task FR tags).
- Every user story (US1/US2/US3) has a phase + independent test + capstone.
- No gaps; no orphan tasks.
