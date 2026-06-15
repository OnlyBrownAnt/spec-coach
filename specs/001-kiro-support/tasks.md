# Tasks: Kiro Agent Support

**Input**: Design documents from `/specs/001-kiro-support/`

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: No new tests requested in spec. Existing regression tests serve as validation.

**Organization**: All user stories are satisfied by the same minimal code change (one AgentConfig entry). Tasks are organized by implementation step, with per-story verification.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1, US2, US3)
- Include exact file paths in descriptions

## Path Conventions

- **Single project**: `src/` at repository root
- This feature modifies only `src/utils.ts` (2 edits: type union + AGENTS map entry)

---

## Phase 1: Implementation (All User Stories)

**Purpose**: Add the Kiro AgentConfig — one entry serves US1, US2, and US3.

**Goal**: `spec-coach init --agent kiro` works end-to-end.

**Independent Test**: Run `spec-coach init --agent kiro` in a temp directory, verify 11 skills installed in `.kiro/steering/`, verify `--help` output lists kiro.

- [x] T001 [US1][US2][US3] Add `"kiro"` to `AgentKey` type union at `src/utils.ts:22`
- [x] T002 [US1][US2][US3] Add `kiro` AgentConfig entry to `AGENTS` map at `src/utils.ts` (after windsurf, line 78): `dir: ".kiro/steering"`, `format: "skills"`, `separator: "-"`, `frontmatter: {}`
- [x] T003 Verify TypeScript compilation: `npx tsx --noEmit`

**Checkpoint**: Kiro agent is registered. All three user stories are now verifiable.

---

## Phase 2: User Story 1 - Initialize SDD Project with Kiro (Priority: P1) 🎯 MVP

**Goal**: User runs `spec-coach init --agent kiro` and gets a working SDD project with 11 skills in `.kiro/steering/`.

**Independent Test**: `spec-coach init --agent kiro` in temp dir → 11 SKILL.md files exist with valid frontmatter.

### Verification for User Story 1

- [x] T004 [US1] Smoke test: run `spec-coach init --agent kiro` in a temp directory, confirm exit code 0 and 11 skills installed
- [x] T005 [P] [US1] Verify `.kiro/steering/spec-specify/SKILL.md` exists and contains valid YAML frontmatter with `name` and `description` fields
- [x] T006 [P] [US1] Verify `.kiro/steering/spec-plan/SKILL.md` body matches `skills/plan.md` source (same skill content as other agents)
- [x] T007 [P] [US1] Verify `spec-coach update --agent kiro` refreshes skills without overwriting `.spec/memory/constitution.md`

**Checkpoint**: US1 verified — init + update work for Kiro.

---

## Phase 3: User Story 2 - CLI Validates Kiro as Supported Agent (Priority: P1)

**Goal**: CLI accepts `--agent kiro`, help text lists kiro, invalid agent gives clear error.

**Independent Test**: `spec-coach --help` lists kiro; `spec-coach init --agent invalid` exits with code 1.

### Verification for User Story 2

- [x] T008 [US2] Verify `spec-coach --help` output includes `kiro` in supported agent list
- [x] T009 [P] [US2] Verify `spec-coach init --agent kiro` banner shows "Agent: Kiro | Format: skills"
- [x] T010 [P] [US2] Verify `spec-coach init --agent invalid` exits with code 1 and message listing kiro among supported agents

**Checkpoint**: US2 verified — CLI discovery and error handling work.

---

## Phase 4: User Story 3 - Kiro Skills Match Standard Skills Format (Priority: P2)

**Goal**: Kiro-installed skills have same body content as Claude Code skills, differing only in frontmatter (no Claude-specific fields).

**Independent Test**: Diff Kiro vs Claude Code skill files — bodies identical, Kiro frontmatter excludes `user-invocable` and `disable-model-invocation`.

### Verification for User Story 3

- [x] T011 [US3] Run `spec-coach init --agent claude` and `spec-coach init --agent kiro` side by side, diff `spec-plan/SKILL.md` bodies — must be identical
- [x] T012 [P] [US3] Verify Kiro-installed SKILL.md frontmatter does NOT contain `user-invocable` or `disable-model-invocation`
- [x] T013 [P] [US3] Verify all 11 Kiro skill SKILL.md files have `description` frontmatter field (required for Kiro auto-activation)

**Checkpoint**: US3 verified — skill content consistency across agents.

---

## Phase 5: Regression

**Purpose**: Ensure existing agents are unaffected.

- [x] T014 Run `npm test` — all existing tests pass
- [x] T015 [P] Run `npm run test:all` — full test suite passes (L1 only — L2 requires Claude Code with project context)

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Implementation)**: No dependencies — can start immediately
- **Phase 2 (US1 Verify)**: Depends on Phase 1
- **Phase 3 (US2 Verify)**: Depends on Phase 2 (same init output, but verification is independent — can immediately follow T001-T003)
- **Phase 4 (US3 Verify)**: Depends on Phase 1 — needs Kiro + Claude init outputs to diff
- **Phase 5 (Regression)**: Depends on Phase 1 — can run anytime after implementation

### Within Phases

- T001 → T002 (both in same file, but T001 is type definition, T002 is config value — do them in one commit since they must be consistent)
- T001 + T002 → T003 (compile check validates the edits)
- T004 → T005, T006, T007 (init must succeed before inspecting output; T005-T007 can then run in parallel)
- T011 → T012, T013 (need both init outputs first; T012-T013 can then run in parallel)

### Parallel Opportunities

- T005, T006, T007 — parallel after T004
- T009, T010 — parallel
- T012, T013 — parallel
- T014, T015 — different test commands, but serial is fine for 2 commands

---

## Implementation Strategy

### MVP First (Phases 1 + 2)

1. T001-T003: Add kiro AgentConfig, verify compilation
2. T004: Smoke test init
3. **STOP and VALIDATE**: `spec-coach init --agent kiro` works
4. This is the entire feature — T005-T013 are verification, T014-T015 are regression

### Incremental Delivery

Not applicable — this feature is a single atomic change. All 3 user stories are implemented by the same 2-line edit. Verification is the only incremental work.

---

## Notes

- T001 and T002 should be committed together (type + value must be consistent) as one commit: `feat: add Kiro agent support`
- All verification tasks (T005-T013) are manual smoke tests — no new automated test infrastructure needed
- This is the minimal feature template — 3 user stories, 1 code change. Don't over-engineer the task breakdown.
- [P] tasks can be verified by different team members in parallel
