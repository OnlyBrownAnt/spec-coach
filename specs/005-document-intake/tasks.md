# Tasks: Document Intake Pipeline (Bring Existing Docs Into the Corpus)

**Input**: Design documents from `/specs/005-document-intake/`

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: This feature is test-driven. Every code task is `(RED→GREEN)`: write/extend the mechanical test first, watch it fail for the right reason, then implement. Mechanical tests live in `tests/units/*.test.ts` (`node:assert/strict`, run via `npx tsx tests/units/<name>.test.ts`). `npm test` is AI-driven and cannot run headless in this environment — verification evidence comes from the mechanical suites + `npx tsx src/cli.ts` smokes. Note: the mechanical harness is itself a non-TTY process, so any scan/process that completes there is by construction non-blocking (FR-003/017).

**Organization**: Tasks grouped by user story; foundational intake module (types + stores + discovery) first — it blocks everything — then US1 (scan + verbatim, MVP), US2 (AI-coached transform + skill), US3 (ignore + idempotency), then polish (init nudge, uninstall, constitution amendment, suite, smokes, release).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on the in-flight task).
- **[Story]**: US1 = discover + verbatim absorb; US2 = AI-coached transform; US3 = ignore + idempotent.
- Each task names exact file(s) + verification + dependencies.

## Path Conventions

Single project: `src/`, `skills/`, `tests/` at repository root (dogfood — modifying spec-coach itself).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Version + changelog scaffold for the MINOR release.

- [ ] T001 [P] — Bump `package.json` `version` 2.0.1 → **2.1.0** and add a `CHANGELOG.md` `## 2.1.0` skeleton entry titled "Document intake pipeline (bring existing docs into the corpus)". Files: `package.json`, `CHANGELOG.md`. **Verify**: `node -e "console.log(require('./package.json').version)"` prints `2.1.0`; CHANGELOG has the section. **Deps**: none.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The intake module's types, two stores, and discovery engine — every user story depends on these. **⚠️ No user-story work until T002–T004 are done.** All three touch the new `src/commands/intake.ts`, so they are sequential (same file).

- [ ] T002 [Foundational] (RED→GREEN) — Create `src/commands/intake.ts` with the `Candidate` types and the manifest store. `type CandidateStatus = "pending" | "absorbed-verbatim" | "absorb-ai-pending" | "absorbed-ai" | "ignored" | "source-missing"`; `interface Candidate { path: string; hash: string; size: number; status: CandidateStatus; destination?: string }`; manifest JSON shape `{ candidates: Candidate[] }` at `.spec/intake/manifest.json`; `readManifest(projectRoot): Candidate[]` (→ `[]` when absent/unreadable); `writeManifest(projectRoot, candidates): void` (creates `.spec/intake/`). Files: `src/commands/intake.ts` (NEW), `tests/units/intake.test.ts` (NEW — round-trip a few candidates; absent file → `[]`). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: none. **FR-004**.
- [ ] T003 [Foundational] (RED→GREEN) — Add the ignore store to `src/commands/intake.ts`: `readIgnoreList(projectRoot): string[]` (→ `[]` when absent), `writeIgnoreList(projectRoot, patterns): void` (writes `.spec/intake/ignore.json` = `{ patterns: string[] }`), and `isIgnored(relPath, patterns): boolean` — `true` iff `relPath === p` OR `relPath` starts with `p + "/"` for some `p`. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (round-trip patterns; `isIgnored` exact match, dir-prefix match, non-match). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T002 (same file). **FR-012**.
- [ ] T004 [Foundational] (RED→GREEN) — Add discovery to `src/commands/intake.ts`: `PRESET_SCAN_DIRS` = project-root top-level files plus `docs/`, `doc/`, `design/`, `spec/`, `requirements/`; `isCandidate(absPath)` — `.md` file whose name contains a keyword (`spec`/`plan`/`feature`/`design`/`requirement`/`roadmap`) OR whose content contains a marker (`Overview`/`User Story`/`FR-`/`## Requirements`/`Acceptance`); `discoverCandidates(projectRoot, ignoreList): Candidate[]` — list `.md` in preset dirs, keep candidates, exclude corpus-internal relative paths (`specs/`, `.spec/`, `.git/`, `node_modules/`) and any `isIgnored` path, compute `hash` (`node:crypto` sha256 of contents) + `size`, status `pending`. Deterministic; **no stdin read anywhere**. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (seed `docs/old-spec.md` + `design/arch.md` + corpus-internal `.spec/x.md` + `node_modules/m.md` + an ignored path → `discoverCandidates` returns exactly the two real candidates with correct hash/size). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T002, T003. **FR-001, FR-002, FR-003, FR-005**.

**Checkpoint**: Intake module foundation ready (types + manifest/ignore stores + discovery). Command handlers can be built.

---

## Phase 3: User Story 1 - Discover existing docs and absorb them verbatim (Priority: P1) 🎯 MVP

**Goal**: `intake scan` writes the manifest deterministically (non-TTY-safe); `intake process --verbatim` copies each candidate unchanged into `.spec/absorbed/` and never touches the source. This is the shippable MVP.

**Independent Test**: Seed a project with a few matching docs + corpus/ignored noise; run `intake scan` headlessly (manifest lists exactly the real candidates, exits cleanly); `intake process --verbatim --all` copies each byte-identical into `.spec/absorbed/` while sources stay in place.

### Implementation for User Story 1

- [ ] T005 [US1] (RED→GREEN) — Add `runIntakeScan(projectRoot): CommandResult` to `src/commands/intake.ts`: `discoverCandidates(root, readIgnoreList(root))` → merge into the existing manifest **preserving** any entry whose status is `absorbed-verbatim`/`absorbed-ai`/`absorbed-ai-pending`/`ignored` (matched by `path`); mark genuinely-new paths `pending`; drop entries whose source no longer exists (`source-missing` is NOT written back — they're pruned); write the manifest; return a summary message with the pending count. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (scan writes pending entries; re-scan after marking one `absorbed-verbatim` keeps it absorbed and surfaces only new pending — idempotent; a vanished source is pruned). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T004. **FR-004, FR-013**.
- [ ] T006 [US1] (RED→GREEN) — Add verbatim absorb to `src/commands/intake.ts`: `safeAbsorbedName(sourcePath): string` (flatten to a collision-safe `.spec/absorbed/` filename, suffix `-2`/`-3` on clash) and `runIntakeProcess(projectRoot, { mode, target }): CommandResult` handling `mode: "verbatim"`: resolve targets (`"all"` = all pending, else the one matching path), copy each source **unchanged** to `.spec/absorbed/<safe-name>.md`, set the manifest entry `status = "absorbed-verbatim"` + `destination`. **Never** move/rename/delete the source (read-only open). Files: `src/commands/intake.test.ts` extend (verbatim `--all` → each pending copied byte-identical, source unchanged in place, status updated; `target` = single path copies just that one). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T005. **FR-006, FR-007**.
- [ ] T007 [US1] — Wire the `intake` top-level command into `src/cli.ts`: new `case "intake"` dispatching `scan` → `runIntakeScan`; `process [--verbatim|--ai|--ignore] [path|--all]` → `runIntakeProcess` (mode from the flag, target from the positional or `--all`); `ignore <list|add|remove> [pattern]` → `runIntakeIgnore` (handler lands in US3; parse it now). Add an "Intake" block to `printHelp`. At this checkpoint only `scan` + `process --verbatim` are exercised (ai/ignore handlers come later). Files: `src/cli.ts`. **Verify**: smoke `npx tsx src/cli.ts intake scan` then `intake process --verbatim --all` in a seeded tmp project → manifest written, docs copied; exits 0, no prompt. **Deps**: T005, T006. **FR-015, FR-017**.
- [ ] T008 [US1] capstone — In `tests/units/intake.test.ts`, add the SC-001/SC-002 end-to-end: seed `docs/old-spec.md` + `design/arch.md` + corpus-internal + ignored noise; `runIntakeScan` → manifest has exactly the 2 candidates (no corpus/ignored, no prompt — the headless run itself proves non-TTY safety); `runIntakeProcess({mode:"verbatim", target:"all"})` → both copied byte-identical into `.spec/absorbed/`, sources unchanged. Re-scan → both stay `absorbed-verbatim`, zero new pending. Files: `tests/units/intake.test.ts`. **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T005, T006, T007. **SC-001, SC-002**.

**Checkpoint**: US1 complete — deterministic, non-blocking discovery + verbatim absorb, shippable as the MVP.

---

## Phase 4: User Story 2 - Turn rough docs into proper spec artifacts via AI coaching (Priority: P1)

**Goal**: `intake process --ai` stages a candidate for the `spec-absorb` skill (marks it + emits instructions) with zero transform code in the CLI; the new `spec-absorb` skill coaches the AI to write `specs/NNN-slug/spec.md`.

**Independent Test**: Run `intake process --ai <source>`; assert the entry becomes `absorb-ai-pending`, the output instructs invoking `spec-absorb`, and no spec file is written by the CLI; assert `spec-absorb` installs as the 12th skill.

### Implementation for User Story 2

- [ ] T009 [US2] (RED→GREEN) — Add `sanitizeSlug(name, projectRoot): string` to `src/commands/intake.ts`: kebab-case the input (lowercase, non-alphanumeric → `-`, collapse/trim), then guarantee uniqueness within `specs/` by suffixing `-2`, `-3`, … if `specs/<slug>/` already exists. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` ("My Design Doc!" → `my-design-doc`; "A B" with `specs/a-b/` present → `a-b-2`). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T002. **FR-010**.
- [ ] T010 [US2] (RED→GREEN) — Extend `runIntakeProcess` with `mode: "ai"` in `src/commands/intake.ts`: for the targeted pending candidate, set status `absorb-ai-pending` and return a `CommandResult.ok` message instructing the user to invoke the **`spec-absorb` skill** on the source to produce `specs/<sanitizeSlug>/spec.md`. **No file is transformed or written by the CLI** (no template rendering, no spec creation). Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (ai mode: entry → `absorb-ai-pending`; message names `spec-absorb` and the source; no new file under `specs/` created). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T005, T009. **FR-008**.
- [ ] T011 [US2] (RED→GREEN) — Author the `spec-absorb` skill and register it. Create `skills/absorb.md` (frontmatter `name: spec-absorb`, `description: Transform a staged source document into a spec-coach spec artifact. Use after \`intake process --ai\` stages a candidate.`) with a coaching body: read the staged source + `.spec/templates/spec-template.md`, extract intent (what triggers it / what it produces / what it MUST NOT affect), choose a kebab slug unique within `specs/`, and write `specs/<slug>/spec.md` following the template — coaching, not gating. Add `"absorb"` to `SKILL_NAMES` in `src/utils.ts` (11 → 12). **Update the spec 004 skill-count assertions** that now read 11 → 12: `tests/units/owned-paths.test.ts` (ownedSkillUnits length 11 → 12) and `tests/units/precise-deletion.test.ts` (`createdFiles.length === 11` → `12`). Files: `skills/absorb.md` (NEW), `src/utils.ts`, `tests/units/owned-paths.test.ts`, `tests/units/precise-deletion.test.ts`. **Verify**: `npx tsx tests/units/owned-paths.test.ts && npx tsx tests/units/precise-deletion.test.ts` → green; a fresh `agents add claude` installs `.claude/skills/spec-absorb/SKILL.md`. **Deps**: T002 (intake exists). **FR-009**.
- [ ] T012 [US2] capstone — Smoke + SC-003 in `tests/units/intake.test.ts`: after `runIntakeScan`, `runIntakeProcess({mode:"ai", target:<src>})` marks the entry `absorb-ai-pending` and the returned message instructs the `spec-absorb` skill — and **grep the CLI source** (`src/commands/intake.ts`) to assert there is no spec-template rendering / spec-writing code path (the transform lives only in `skills/absorb.md`). CLI smoke: `npx tsx src/cli.ts intake process --ai <src>` prints the instructions and writes nothing under `specs/`. Files: `tests/units/intake.test.ts`. **Verify**: suite green; smoke output pasted. **Deps**: T010, T011. **SC-003**.

**Checkpoint**: US2 complete — AI-coached transform staged with zero transform code; `spec-absorb` ships as the 12th skill.

---

## Phase 5: User Story 3 - Ignore noise and keep scans clean and idempotent (Priority: P2)

**Goal**: `intake process --ignore` and `intake ignore {list|add|remove}` manage the ignore list; subsequent scans exclude ignored paths and never re-surface absorbed sources.

**Independent Test**: Scan, ignore one candidate + absorb another; re-scan; the ignored path is excluded, the absorbed source stays absorbed, only new pending surfaces.

### Implementation for User Story 3

- [ ] T013 [US3] (RED→GREEN) — Extend `runIntakeProcess` with `mode: "ignore"` in `src/commands/intake.ts`: for each targeted candidate, append its source path to the ignore list (idempotent union via `writeIgnoreList`) and set the manifest entry `status = "ignored"`. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (ignore one candidate → path in `readIgnoreList`, entry `ignored`; ignore same again is a no-op union). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T003, T005. **FR-011**.
- [ ] T014 [US3] (RED→GREEN) — Add `runIntakeIgnore(projectRoot, verb, pattern?): CommandResult` to `src/commands/intake.ts`: `list` → message joining `readIgnoreList`; `add <pattern>` → union + write; `remove <pattern>` → filter out + write. Files: `src/commands/intake.ts`, `tests/units/intake.test.ts` (add then list shows it; remove then list omits it; list of empty is a clean empty message). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T003. **FR-012**.
- [ ] T015 [US3] capstone — Smoke + SC-004 in `tests/units/intake.test.ts`: scan (2 candidates) → `runIntakeProcess({mode:"ignore", target:<a>})` → `runIntakeProcess({mode:"verbatim", target:<b>})` → re-scan → `<a>` excluded (ignored), `<b>` stays `absorbed-verbatim`, a newly-added `docs/new.md` surfaces as the only `pending`. CLI smoke: `npx tsx src/cli.ts intake ignore list` / `add docs/x` / `remove docs/x`. Files: `tests/units/intake.test.ts`. **Verify**: suite green; smoke output pasted. **Deps**: T013, T014, T007 (CLI ignore dispatch already wired). **SC-004**.

**Checkpoint**: US3 complete — ignore list persists; scans are idempotent and noise-free.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: init nudge, uninstall integration, constitution amendment, whole-suite verification, smokes, release finalization.

- [ ] T016 [P] (RED→GREEN) — `init` nudge: in `src/commands/init.ts`, after scaffolding call `const n = discoverCandidates(projectRoot, []).length` (import from `./intake.ts`); if `n > 0` print one line "found N candidate docs — run `spec-coach intake scan`"; always continue/exit normally — **no readline, no prompt, no refusal**. Files: `src/commands/init.ts`, `tests/units/intake.test.ts` (run the init nudge path on a project with candidates → prints the line, returns/exits 0; empty project → no nudge line). **Verify**: `npx tsx tests/units/intake.test.ts` → green. **Deps**: T004. **FR-014, SC-005**.
- [ ] T017 [P] (RED→GREEN) — Uninstall integration: in `src/commands/uninstall.ts`, add `".spec/intake"` to `INFRA_PATHS` (regenerable — removed on plain uninstall alongside `.spec/agents.json`). `.spec/absorbed` is already in `USER_PATHS` (preserved unless `--force`). Files: `src/commands/uninstall.ts`, `tests/units/corpus-uninstall.test.ts` (UPDATE — after seeding `.spec/intake/manifest.json` + `.spec/absorbed/x.md`, plain `uninstall` removes `.spec/intake/` and keeps `.spec/absorbed/x.md`; `--force` removes both). **Verify**: `npx tsx tests/units/corpus-uninstall.test.ts` → green. **Deps**: none (parallel — different file). **FR-016**.
- [ ] T018 [P] — Constitution amendment **v1.1.0 → v1.2.0**: in `.spec/memory/constitution.md`, rewrite the "CLI surface" Development Constraint from two surfaces to three — add the **document lifecycle** (`intake scan`/`process`/`ignore`) and note "the three never mutate each other's owned content; intake absorbs documents INTO the corpus without moving sources." Update the footer `Version: 1.2.0`, `Last Amended: 2026-06-18`. Files: `.spec/memory/constitution.md`. **Verify**: the CLI-surface bullet names three surfaces; footer reads 1.2.0. **Deps**: none. **C11 (governance)**.
- [ ] T019 [P] — Run the entire mechanical suite and confirm green with no regression: `for f in tests/units/*.test.ts; do npx tsx "$f" || break; done`. Paste every per-file `=== Results: N passed, M failed ===` line. Confirm the spec 004 `11 → 12` updates (T011) landed and all prior suites still pass. Files: none (verification). **Verify**: every suite prints 0 failed. **Deps**: all implementation tasks (T002–T017). **SC-006**.
- [ ] T020 [P] — CLI smokes in a throwaway tmp project, pasting output: `npx tsx src/cli.ts init` (expect the intake nudge if candidates exist), `agents add claude` (expect 12 skills incl. `spec-absorb`), seed `docs/old.md`, `intake scan`, `intake process --verbatim --all`, `intake process --ai docs/old.md`, `intake ignore add docs/old.md`, `intake ignore list`, `uninstall --yes` (expect `.spec/intake/` gone, `.spec/absorbed/` kept). Files: none (verification). **Verify**: every command behaves as specified; paste output. **Deps**: T019.
- [ ] T021 [P] — Finalize `CHANGELOG.md` 2.1.0 entry: document the intake pipeline (scan/process/ignore), the `.spec/intake/` manifest + ignore list, the dual absorb modes (verbatim → `.spec/absorbed/`, AI → `specs/NNN-slug/` via the new `spec-absorb` skill), the non-blocking design (closes the spec 001 class), the init nudge, the constitution amendment v1.2.0 (third CLI surface), and the MINOR rationale (new skill). Update the constitution SDD STATE block → `Current feature: 005-document-intake`, `Last phase: implement`. Files: `CHANGELOG.md`, `.spec/memory/constitution.md`. **Verify**: CHANGELOG complete; SDD STATE reflects 005. **Deps**: T019.
- [ ] T022 [P] — Set `specs/005-document-intake/spec.md` **Status** → `Implemented`. Files: `specs/005-document-intake/spec.md`. **Verify**: status line reads Implemented. **Deps**: T019.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: independent — start immediately.
- **Foundational (Phase 2, T002–T004)**: sequential (all in the new `intake.ts`) — T002 → T003 → T004. **BLOCKS all user stories.**
- **US1 (Phase 3, T005–T008)**: T005 → T006 → T007; T008 capstone after T007.
- **US2 (Phase 4, T009–T012)**: T009 (slug) is independent of US1 handlers; T010 (ai) deps T005 + T009; T011 (skill + SKILL_NAMES) deps T002 only; T012 capstone deps T010 + T011.
- **US3 (Phase 5, T013–T015)**: T013 deps T003 + T005; T014 deps T003; T015 capstone deps T013 + T014 + T007.
- **Polish (Phase 6)**: T016 deps T004; T017/T018 independent; T019 deps all implementation; T020/T021/T022 parallel after T019.

### Within Each User Story

- Tests written FIRST and FAIL before implementation (RED→GREEN on every code task).
- Stores/discovery (T002–T004) before any `run*` handler.
- `runIntakeScan` (T005) before `runIntakeProcess` modes (T006/T010/T013), since process reads the manifest scan produces.
- `sanitizeSlug` (T009) before ai mode (T010).
- CLI dispatch wired once (T007) exercising scan+verbatim; later modes verified via their capstone smokes (T012/T015).
- Story capstone green before the next priority.

### Parallel Opportunities

- **T001** independent.
- **T009** (slug) parallel with US1's T006/T007 once T002 lands (it only needs the `Candidate` types).
- **T011** (skill + SKILL_NAMES) parallel with US1/US2 handler work — different files (`skills/absorb.md`, `utils.ts`, two test files), deps only T002.
- **T016** (init nudge) parallel with US2/US3 — different file (`init.ts`), deps only T004.
- **T017** (uninstall) ‖ **T018** (constitution) — both independent, different files.
- **T020 ‖ T021 ‖ T022** (final polish), after T019.

---

## Implementation Strategy

### MVP First (US1 only)

1. T001 (setup) → T002–T004 (foundation) → T005–T008 (US1: scan + verbatim absorb, non-blocking).
2. **STOP and VALIDATE**: `intake.test.ts` green (SC-001/002); CLI smoke confirms scan→verbatim works headlessly. The pipeline's deterministic core is shippable.

### Incremental Delivery

1. Foundation → US1 (scan + verbatim) → validate.
2. US2 (AI-coached transform + `spec-absorb` skill) → validate (zero transform code in CLI).
3. US3 (ignore + idempotent re-scans) → validate.
4. Polish → init nudge, uninstall, constitution v1.2.0, full suite, smokes, changelog, SDD state.

### Notes

- Every code task is TDD (RED→GREEN); paste failing-then-passing output as evidence per the spec-implement Iron Laws.
- `npm test` is AI-driven/non-headless — do NOT claim it passes; verification = mechanical suites + tsx CLI smokes.
- Keep the build green between commits: T011 changes the skill count (11→12) — update `owned-paths.test.ts` + `precise-deletion.test.ts` in the same commit.
- The harness running headlessly IS the FR-003/017 non-TTY proof — never introduce `readline`/blocking stdin into any intake path.

---

## Cross-Check vs Plan

- Every component C1–C12 has ≥1 task: C1 → T002/T003; C2 → T004; C3 → T005; C4 → T006; C5 → T009/T010/T011; C6 → T013/T014; C7 → T007; C8 → T011; C9 → T016; C10 → T017; C11 → T018; C12 → T002–T015 + T019.
- Every FR-001..FR-018 maps to a task (see per-task FR tags).
- Every SC-001..SC-006 maps to a capstone/verification task.
- Every user story (US1/US2/US3) has a phase + independent test + capstone.
- No gaps; no orphan tasks.
