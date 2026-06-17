# Tasks: Constitution Enforcement Reach

**Input**: Design documents from `/specs/002-constitution-enforcement-reach/`

**Prerequisites**: plan.md (required), spec.md (required)

**Tests**: Mechanical tests for the three new verification scripts ARE included (Constitution Principle V — "Verify What Ships"). They live under `tests/scripts/` and are fast, fixture-driven, no-AI. Behavioral regression is covered by the existing `npm test` suite.

**Organization**: Tasks are grouped by user story (one phase per US, P1 → P2 → P3), preceded by a Setup phase and followed by a Polish phase. Each user story touches disjoint files, so US phases can proceed in parallel after Setup (with the noted `skills/constitution.md` serialization).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: Which user story this task belongs to (e.g., US1…US6)
- Include exact file paths in descriptions
- Every task lists: file(s), verification, dependency

## Path Conventions

- **Source skills**: `skills/<name>.md` (installed copies in `.claude/skills/`, `.kiro/skills/` are regenerated — never hand-edited)
- **Source scripts**: `scripts/bash/*.sh` (`installScripts()` auto-collects every `*.sh`; no registration code needed)
- **CLI**: `src/commands/{init,update}.ts`, `src/utils.ts`
- **Tests**: `tests/scripts/` (new, mechanical); existing behavioral tests under `tests/behavioral/` + `tests/integration/`
- Refresh installed copies after editing source: `spec-coach update` (in-place) or `npm run init` in a temp dir (clean)

---

## Phase 1: Setup

**Purpose**: Ship prerequisite so the new verification scripts actually reach installed projects.

- [ ] T001 Add `"scripts/"` to the `files` array in `package.json` (after `"src/"`, ~line 13). **Verify**: `npm pack --dry-run` output lists `scripts/bash/*.sh` in the packed file list. **Depends on**: none. [FR-015]

**Checkpoint**: New scripts will ship in published installs. (Latent defect fix — only affects `npm publish` distribution, but required for FR-003/006/010 to reach users.)

---

## Phase 2: User Story 1 - Constitution Amendments Propagate (Priority: P1) 🎯 MVP

**Goal**: `/spec-constitution` guides amendment propagation and records a Sync Impact Report; `verify-constitution-sync.sh` mechanically confirms plan-template consistency + report existence.

**Independent Test**: Rename/add a principle in `.spec/memory/constitution.md`, run `scripts/bash/verify-constitution-sync.sh` → reports drift; after performing the guided propagation + recording a Sync Impact Report, re-run → clean.

- [ ] T002 [US1] Add an "Amendment Propagation Checklist" + "Sync Impact Report" section to `skills/constitution.md` (after Step 3 "Write the Constitution", before the SDD STATE step). The checklist names the dependent artifacts to re-align (`plan-template` Constitution Check section, plus any skill that embeds principles); the report is recorded as an HTML-comment block (marker `<!-- SYNC IMPACT: ... -->`) capturing old→new principle names and pending files. **Verify**: source body contains both sections + the marker convention; `spec-coach update` then grep installed `.claude/skills/spec-constitution/SKILL.md` for "Sync Impact Report". **Depends on**: none. [FR-001, FR-002]
- [ ] T003 [US1] Create `scripts/bash/verify-constitution-sync.sh`. Source `common.sh`; extract `### Principle` headings from `$REPO_ROOT/.spec/memory/constitution.md`; compare count/names against the principle references expected by `$REPO_ROOT/templates/plan-template.md`'s Constitution Check section; if a `<!-- SYNC IMPACT -->` marker indicates a recent amendment, confirm a Sync Impact Report was recorded; print findings to stdout; **non-blocking (exit 0)**; `--help` exits 0. **Verify**: run in this repo → prints current principle count + consistency status; `echo $?` is 0. **Depends on**: T002 (uses the SYNC IMPACT marker convention). [FR-003]
- [ ] T004 [US1] Add mechanical test `tests/scripts/test-verify-constitution-sync.sh` with three fixtures: (a) matching principles → clean, (b) a renamed principle → drift reported, (c) amendment without report → flagged; all exit 0. **Verify**: `bash tests/scripts/test-verify-constitution-sync.sh` passes. **Depends on**: T003. [FR-003, Principle V]

**Checkpoint**: US1 done — constitution authority survives amendments.

---

## Phase 3: User Story 2 - Analyze Treats Constitution Violations as Critical (Priority: P1)

**Goal**: `/spec-analyze` loads the constitution and routes principle violations to CRITICAL.

**Independent Test**: Create a plan that contradicts a stated principle; run `/spec-analyze`; output contains a CRITICAL finding citing the principle by name.

- [ ] T005 [P] [US2] Edit `skills/analyze.md`: (1) in "1. Load All Artifacts" add `.spec/memory/constitution.md`; (2) add a "Constitution" row to the "3. Consistency Checks" table ("every artifact honors each stated principle — violations are CRITICAL"); (3) in the analysis output template, route principle violations to the **Critical** section with a citation of the principle name. **Verify**: `spec-coach update`; skill body loads constitution + the Critical routing exists; `bash tests/behavioral/test-analyze.sh` still passes. **Depends on**: none (disjoint file from US1). [FR-004, FR-005]

**Checkpoint**: US2 done — the safety net sees the constitution. (Markdown-only by design — violation detection is semantic, no script.)

---

## Phase 4: User Story 3 - Agent Knows Current Feature and Phase (Priority: P2)

**Goal**: `show-sdd-state.sh` surfaces current feature + inferred last phase + decisions/skipped; `CLAUDE.md` managed section points at it for new AND existing projects.

**Independent Test**: Mid-workflow on this feature, run `scripts/bash/show-sdd-state.sh` → prints feature `002-constitution-enforcement-reach`, last phase `plan` (inferred from plan.md), and decisions from SDD STATE; `CLAUDE.md` managed section names the SDD STATE location.

- [ ] T006 [P] [US3] Create `scripts/bash/show-sdd-state.sh`. Source `common.sh`; current feature ← `read_feature_json_feature_directory "$REPO_ROOT"`; **last phase ← infer from artifacts** in the feature dir (`tasks.md`→tasks, `analysis.md`→analyze, `plan.md`→plan, `spec.md`→specify, else constitution) — do NOT read the never-maintained SDD STATE `Last phase`; decisions/skipped ← `sed` the SDD STATE block if present else "none"; print human-readable + `--json` mode (reusing `json_escape`); **non-blocking (exit 0)**, graceful on missing feature.json. **Verify**: run in this repo → prints feature + `plan` phase; `echo $?` is 0. **Depends on**: none. [FR-006]
- [ ] T007 [P] [US3] Refactor the CLAUDE.md managed-section content in `src/commands/init.ts` into a shared `buildClaudeManagedSection()` helper (same file or `src/utils.ts`) that appends one pointer line: "Current feature & workflow phase: run `scripts/bash/show-sdd-state.sh` (state lives in `.spec/feature.json` + the SDD STATE block in `.spec/memory/constitution.md`)." `createCLAUDEmd()` calls it. **Verify**: `npx tsx --noEmit`; fresh `npm run init` in temp dir → `CLAUDE.md` contains the pointer inside the `<!-- COACH -->` markers. **Depends on**: none. [FR-007]
- [ ] T008 [US3] Add a managed-section upsert to `src/commands/update.ts` that calls `buildClaudeManagedSection()` and replaces content between the `<!-- COACH START/END -->` markers (mirrors `createCLAUDEmd`), so existing projects gain the pointer. **Verify**: `npx tsx --noEmit`; run `spec-coach update` on a temp project whose CLAUDE.md predates this feature → pointer appears, content outside markers untouched. **Depends on**: T007. [FR-007]
- [ ] T009 [US3] Add mechanical test `tests/scripts/test-show-sdd-state.sh`: fixtures where the feature dir has only `spec.md` (→specify), only `tasks.md` (→tasks), and is empty (→constitution); plus missing `.spec/feature.json` → graceful message, exit 0. **Verify**: `bash tests/scripts/test-show-sdd-state.sh` passes. **Depends on**: T006. [FR-006, Principle V]

**Checkpoint**: US3 done — agent can surface workflow state reliably (artifact-inferred, not stale).

---

## Phase 5: User Story 4 - Specify Iterates to Resolve Ambiguity (Priority: P2)

**Goal**: `/spec-specify` runs a ≤3-round validation loop with a scope>security>UX>technical rubric; `verify-spec.sh` scans each round for unresolved tokens.

**Independent Test**: Feed specify a description likely to leave placeholders; the skill iterates; `verify-spec.sh` reports unresolved tokens after round 1 and zero after resolution.

- [ ] T010 [P] [US4] Edit `skills/specify.md`: replace the one-shot Self-Review (step 6) with a capped **3-round iterative validation loop**, each round verified by `scripts/bash/verify-spec.sh`; add a priority rubric ordering unresolved issues **scope > security > UX > technical**; after round 3, any residual is explicitly surfaced (not dropped). Also in this same file: add a constitution-load line to "1. Scope Check" context (FR-011 specify half). **Verify**: `spec-coach update`; skill body has the loop + rubric + constitution load; `bash tests/behavioral/test-specify.sh` passes. **Depends on**: none (disjoint file). [FR-008, FR-009, FR-011 (specify)]
- [ ] T011 [P] [US4] Create `scripts/bash/verify-spec.sh`. Source `common.sh`; resolve `FEATURE_SPEC` via `get_feature_paths`; grep the canonical placeholder set — `TBD`, `TODO`, unfilled `[ALL_CAPS]` tokens, and the filler phrases enumerated in `skills/plan.md` Self-Review ("implement later", "add appropriate error handling" w/o specifics, etc.); print matches with file:line; **non-blocking (exit 0)**. **Verify**: run against a spec containing `TBD` → reported; against this spec.md (clean) → no findings; `echo $?` is 0. **Depends on**: none. [FR-010]
- [ ] T012 [US4] Add mechanical test `tests/scripts/test-verify-spec.sh`: fixture spec with tokens → all detected with line numbers; clean fixture → none; both exit 0. **Verify**: `bash tests/scripts/test-verify-spec.sh` passes. **Depends on**: T011. [FR-010, Principle V]

**Checkpoint**: US4 done — specs can't quietly ship placeholders.

---

## Phase 6: User Story 5 - Governance Loads Constitution at Authoring (Priority: P3)

**Goal**: `/spec-tasks` loads the constitution during authoring (specify half already done in T010).

**Independent Test**: `/spec-tasks` skill body instructs loading `.spec/memory/constitution.md`; task design respects a relevant principle.

- [ ] T013 [P] [US5] Add a constitution-load line to `skills/tasks.md` "1. Load Context" step (read `.spec/memory/constitution.md`; honor governing principles when deriving tasks). **Verify**: `spec-coach update`; installed `spec-tasks` SKILL.md references the constitution; `bash tests/behavioral/test-tasks.sh` passes. **Depends on**: none (disjoint file). [FR-011 (tasks)]

**Checkpoint**: US5 done — governance reaches authoring, not just plan.

---

## Phase 7: User Story 6 - Markdown Extensibility Seam (Priority: P3)

**Goal**: A `.spec/hooks.md` format lets teams declare steps; `/spec-constitution` surfaces them; absent/malformed → skip gracefully.

**Independent Test**: Add a sample `.spec/hooks.md` entry; run `/spec-constitution`; the declared step is surfaced; remove/mangle the file → skill skips it without failing.

- [ ] T014 [US6] Edit `skills/constitution.md`: define the `.spec/hooks.md` format (a markdown list of `### [phase]` sections each with declared steps) and add a "Load Hooks" step that reads `.spec/hooks.md` if present, surfaces declared steps, and **skips silently if absent or unparseable**. **Verify**: `spec-coach update`; create a sample `.spec/hooks.md`, invoke `/spec-constitution`, confirm the step appears; delete the file → no error. **Depends on**: T002 (same file `skills/constitution.md` — serialize). [FR-012, FR-013 (seed)]

**Checkpoint**: US6 mechanism exists and is testable in the constitution skill. (Full seam propagation to other skills is the cross-cutting task T016.)

---

## Phase 8: Polish & Cross-Cutting Concerns

**Purpose**: Cross-cutting guarantees that span user stories.

- [ ] T015 [P] Audit all three new scripts for the non-blocking contract (FR-014): each `exit 0` even when findings exist, findings to stdout only, no `set -e`-triggered abort on a check miss, `--help`/bad-args exit 0. **Verify**: for each script run with findings present then `; echo $?` → 0. **Depends on**: T003, T006, T011. [FR-014]
- [ ] T016 Propagate the "Load Hooks" seam (defined in T014) to `skills/specify.md`, `skills/plan.md`, `skills/tasks.md`, `skills/analyze.md`. Justified multi-file edit: the same 2-line "read `.spec/hooks.md`, skip if absent" addition per skill — a seam only works if present in every phase skill. **Verify**: `spec-coach update`; each installed skill surfaces a sample hooks entry. **Depends on**: T014. [FR-013 (full)]
- [ ] T017 Reinstall into this repo (`spec-coach update`) so `.claude/skills/` + `.spec/scripts/bash/` reflect every source change, then run `npm test` for behavioral regression. **Verify**: `npm test` passes (existing agents/skills unaffected). **Depends on**: all implementation tasks (T002–T014). [SC-008]
- [ ] T018 [P] End-to-end SDD workflow smoke (SC-008): in a temp dir, walk `/spec-constitution` → `/spec-specify` → `/spec-plan` → `/spec-tasks` → `/spec-analyze` on a throwaway feature; confirm no workflow breakage and that the new capabilities are present (`verify-spec.sh` runs in specify, `show-sdd-state.sh` reports the right phase, `/spec-analyze` can cite the constitution). **Verify**: workflow completes; new capabilities observable. **Depends on**: T017. [SC-008]
- [ ] T019 [P] Run all mechanical script tests: `bash tests/scripts/test-verify-constitution-sync.sh && bash tests/scripts/test-verify-spec.sh && bash tests/scripts/test-show-sdd-state.sh`. **Verify**: all three pass. **Depends on**: T004, T009, T012. [Principle V]

---

## Dependencies & Execution Order

### Phase Dependencies

- **Phase 1 (Setup)**: No dependencies — start immediately. T001 enables scripts to ship.
- **Phases 2–7 (User Stories)**: All depend on Phase 1. US phases are otherwise **file-disjoint and parallel-capable**, except the `skills/constitution.md` serialization: T002 (US1) → T014 (US6) must be sequential (same file).
- **Phase 8 (Polish)**: T015/T019 depend on the script tasks; T016 depends on T014; T017 depends on all implementation; T018 depends on T017.

### Within / Between Phases

- T001 → (everything that ships a script: T003, T006, T011)
- US1: T002 → T003 → T004
- US2: T005 (single task)
- US3: T006 ∥ T007 → T008; T006 → T009
- US4: T010 ∥ T011 → T012
- US5: T013 (single task)
- US6: T014 (after T002)
- T015 ← {T003, T006, T011}; T016 ← T014; T017 ← all impl; T018 ← T017; T019 ← {T004, T009, T012}

### Parallel Opportunities

- After Phase 1, the first task of each file-disjoint US can start together: **T002, T005, T006, T007, T010, T011, T013** (note T002 before T014).
- Within US3: T006 ∥ T007.
- Within US4: T010 ∥ T011.
- Polish: T015 ∥ T019 (different concerns); T018 after T017.

---

## Implementation Strategy

### MVP First (Setup + US1 + US2)

1. T001: package.json `files` fix
2. T002–T004: constitution propagation + verify script + test
3. T005: analyze constitution authority
4. **STOP and VALIDATE**: amend a principle → propagation + verify work; a violating plan → analyze flags CRITICAL. The two P1 stories restore the constitution's authority — this is the core of the feature.

### Incremental Delivery

5. US3 (T006–T009): workflow-state awareness
6. US4 (T010–T012): specify iterative validation
7. US5 (T013): authoring-time governance
8. US6 (T014): markdown extensibility seam
9. Polish (T015–T019): non-blocking audit, full hooks seam, reinstall, regression, e2e smoke

Each story adds enforcement reach without breaking prior stories.

---

## Notes

- `skills/constitution.md` is edited by TWO tasks (T002 propagation, T014 hooks) — serialize them; do not parallelize.
- FR-011 is split across T010 (specify.md, folded with the loop edit) and T013 (tasks.md) so no two tasks touch the same file.
- T016 is the only justified >3-file task (same 2-line hooks seam across 4 skills); every other task is single-file or tightly-coupled (T007/T008 share the helper).
- All three new scripts are non-blocking by contract (FR-014) — T015 audits this; a script that exits non-zero on findings is a bug.
- Mechanical tests (`tests/scripts/`) are deterministic and fast; behavioral tests (`npm test`) require reinstalling source changes first (`spec-coach update`).
- Commit per task. Suggested messages follow `feat:` / `fix:` / `test:` scoped to the concern (e.g., `feat(spec): add iterative validation loop + verify-spec.sh`).
