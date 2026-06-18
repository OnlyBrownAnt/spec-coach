# Tasks: Constitution as Charter

**Input**: Design documents from `/specs/009-constitution-charter/` (spec.md, plan.md).

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: REQUIRED for this feature (spec-coach Constitution V — verify what ships; spec SC-001…SC-006). Behavioral tasks are RED-first (write the failing test, watch it fail, then implement). The skill-prose tasks use content-assertion tests (read the shipped source skill, assert guidance substrings). `npm test` is AI-driven/non-headless and is NOT the gate; the gate is `npx tsx tests/units/constitution-charter.test.ts` + the existing `tests/units/*.test.ts` suite (no regressions) + bash/CLI smokes.

**Organization**: Tasks grouped by user story. US1 (amend) and US2 (seed) share the same skill-file rewrite (the status-branch serves both), so they form one phase with tasks labeled `[US1,US2]`.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependencies)
- **[Story]**: US1 / US2 / US3 / US4 / infra
- Each task: exact file(s) + verification + dependency → one commit.

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Release-version skeleton (matches the spec 008 T001 convention — bump early, finalize CHANGELOG last).

- [x] **T001** `[P]` `[infra]` Bump `package.json` version `2.3.0` → `2.4.0` (MINOR; constitution-as-charter — new skill behavior + uninstall behavior, no install file-structure change).
  - **File**: `package.json`.
  - **Verify**: `node -e "console.log(require('./package.json').version)"` → `2.4.0`.
  - **Depends on**: nothing.

**Checkpoint**: Dev version set; behavioral work begins.

---

## Phase 2: Foundational (Blocking Prerequisites)

**Purpose**: The status discriminator BOTH the skill (US1/US2) and uninstall (US3) depend on.

**⚠️ CRITICAL**: No user-story work can begin until this phase is complete — the skill branches on the advisor's status output, and uninstall reuses its token set.

- [x] **T002** `[foundational]` Extend `verify-constitution-sync.sh` to report constitution **status**: scan for the template's signature tokens (`[CONSTITUTION_VERSION]`, `[RATIFICATION_DATE]`, `[LAST_AMENDED_DATE]`, `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`) → `TEMPLATE` (≥1 token present); else (no tokens) → `AUTHORED` (report the principle count alongside — MAY be 0, so an authored shell classifies as AUTHORED, per the spec edge case); file missing → `ABSENT` (existing "not found" path). Additive (no existing output removed); non-blocking (exit 0). Create `tests/units/constitution-charter.test.ts` with **RED-first** advisor tests via `execSync` in `mkdtemp`: write a template fixture → assert status `TEMPLATE`; write an authored fixture (principles, no placeholders) → `AUTHORED`; write an authored shell (no placeholders, zero principles) → `AUTHORED` (edge case); missing file → `ABSENT`.
  - **Files**: `.spec/scripts/bash/verify-constitution-sync.sh` (edit); `tests/units/constitution-charter.test.ts` (create).
  - **Verify**: `npx tsx tests/units/constitution-charter.test.ts` (RED before edit → GREEN after); `bash .spec/scripts/bash/verify-spec.sh specs/009-constitution-charter/spec.md` still CLEAN.
  - **Depends on**: nothing (base layer).

**Checkpoint**: Status discriminator ready; skill + uninstall can build on it.

---

## Phase 3: User Story 1 & 2 — Skill coaching: amend-guard + seeded cold-start (Priority: P1/P2) 🎯 MVP

**Goal**: The improved `/spec-constitution` — on an AUTHORED charter it AMENDS (US1); on TEMPLATE/ABSENT it seeds a cold-start proposal from repo signals (US2).

**Independent Test**: Content-assertion that `skills/constitution.md` contains the status-branch (run advisor → AUTHORED=amend / TEMPLATE·ABSENT=seed), the amend-guard (never rewrite a settled principle unless explicitly targeted), and the seeded-cold-start guidance (read `package.json`/source/README/`specs/`, propose candidates, ratify before writing). Plus the advisor (T002) reports status end-to-end.

### Implementation for User Story 1 & 2

- [x] **T003** `[US1,US2]` Edit `skills/constitution.md` (source): add a **"Constitution state"** preamble — run `verify-constitution-sync.sh` to get status, then branch: `AUTHORED` → **amend path** (anchor to the existing principle set; never rewrite a settled principle unless it is the explicit amendment target; full rewrite only via explicit `--reset`); `TEMPLATE`/`ABSENT` → **seeded cold-start path** (read `package.json` name+deps, the primary source/`skills` dir, `README.md`, existing `specs/`; PROPOSE candidate principles + the two flexible sections for human ratification; write nothing until approved). Reframe "Your Role" to state the charter-as-IP principle (CLAUDE.md-tier; amend never overwrite). **Regenerate** the installed `.claude/skills/spec-constitution/SKILL.md` from the edited source via `npx tsx src/cli.ts agents update` (re-installs all skills for the installed agent, re-adding frontmatter; the tracked installed copy then reflects the source). Add **content-assertion tests** to `tests/units/constitution-charter.test.ts`: read `skills/constitution.md`, assert the amend-guard, status-branch, seeded-cold-start guidance, and the `--reset` full-rewrite escape hatch substrings are present.
  - **Files**: `skills/constitution.md` (edit); `.claude/skills/spec-constitution/SKILL.md` (regenerate); `tests/units/constitution-charter.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/constitution-charter.test.ts` GREEN; `diff` confirms installed copy matches source body.
  - **Depends on**: T002 (skill branches on advisor status).

- [x] **T004** `[US1,US2]` Edit `skills/constitution.md`: add **constitution-doc semver** rules (MAJOR = principle removed/redefined/renamed; MINOR = principle/section added or materially expanded; PATCH = wording) applied to the footer on amendment with a stated rationale; **expand the propagation checklist** (step 4) to `spec-template.md`, `plan-template.md`, `tasks-template.md`, and every installed skill embedding principle wording (not only `plan-template.md`). Regenerate the installed copy via `npx tsx src/cli.ts agents update`. Add content-assertion tests for the semver rules + the expanded propagation list.
  - **Files**: `skills/constitution.md` (edit); `.claude/skills/spec-constitution/SKILL.md` (regenerate); `tests/units/constitution-charter.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/constitution-charter.test.ts` GREEN.
  - **Depends on**: T003 (same skill file — serial).

**Checkpoint**: `/spec-constitution` is amend-don't-overwrite + seeded cold-start + semver + exhaustive propagation. US1 & US2 delivered.

---

## Phase 4: User Story 3 — Preserve on uninstall (Priority: P3)

**Goal**: An AUTHORED constitution is project IP — plain `uninstall` preserves it; only `--force` removes it; a never-authored TEMPLATE is removed (tooling).

**Independent Test**: TS in `mkdtemp` — after plain `uninstall --yes` on a repo with an AUTHORED `.spec/memory/constitution.md`, the file survives; with a TEMPLATE constitution, it is removed; `--force` removes everything.

### Implementation for User Story 3

- [x] **T005** `[US3]` Make `uninstall` **status-aware** in `src/commands/uninstall.ts`: remove `.spec/memory` from `INFRA_PATHS`; after the infra-removal loop, check `.spec/memory/constitution.md` — if AUTHORED (no signature tokens) preserve `.spec/memory`; if TEMPLATE or absent, remove `.spec/memory` (tooling). Add a small `isAuthoredConstitution(path)` helper (signature-token `includes()` check — same token set as T002, documented duplication since TS cannot `source` the bash script). `pruneIfEmpty(.spec)` already handles the rest. **RED-first** tests in `tests/units/constitution-charter.test.ts`: AUTHORED preserved on plain uninstall; TEMPLATE removed; both removed on `--force`.
  - **Files**: `src/commands/uninstall.ts` (edit); `tests/units/constitution-charter.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/constitution-charter.test.ts` GREEN (RED before edit); existing `tests/units/corpus-uninstall.test.ts` still GREEN — its fixture is a TEMPLATE constitution (created via `init`), which T005 still removes, so the `:61` assertion still passes (no functional break). Reframe that test's stale name/premise ("regenerable tooling") to "template constitution removed on plain uninstall"; the AUTHORED-preserve case is covered by T005's new tests (SC-003).
  - **Depends on**: T002 (reuses the signature-token set). **[P]** with T003/T004 (different file: `uninstall.ts` vs the skill).

**Checkpoint**: The authored charter survives uninstall; US3 delivered.

---

## Phase 5: User Story 4 — Dogfood: re-author spec-coach's own charter (Priority: P4)

**Goal**: spec-coach ships with its OWN constitution authored by the improved tool — closing the loop and removing the code/charter drift (the re-authored charter natively codifies the charter-as-IP principle + the corrected uninstall clause).

**Independent Test**: `verify-constitution-sync.sh` reports AUTHORED on `.spec/memory/constitution.md`; content assertion confirms both required clauses are present.

### Implementation for User Story 4

- [x] **T006** `[US4]` **Re-author** `.spec/memory/constitution.md` (currently the template) via the improved `/spec-constitution` cold-start (T003/T004 must exist). Produce an AUTHORED charter: the 5 standing principles (I Markdown-Is-the-Product … V Verify-What-Ships), each with a rationale, + a **charter-as-IP clause** (global, agent-agnostic, human-owned; amended never overwritten, preserved never deleted) + the **corrected uninstall clause** (plain uninstall preserves the authored constitution; only `--force` removes it), superseding spec 007's "regenerable tooling, removed on uninstall" classification. Set the footer version to **v1.5.0** (MINOR per FR-004: the charter-as-IP clause is added/expanded; the 5 principles are unchanged so not MAJOR; continuing the v1.4.0 lineage). This is a **content task (judgment), not TDD** — verified by content assertion + the advisor.
  - **Files**: `.spec/memory/constitution.md` (re-author); `tests/units/constitution-charter.test.ts` (extend — assert AUTHORED + the two clauses).
  - **Verify**: `bash .spec/scripts/bash/verify-constitution-sync.sh` → status AUTHORED, principles listed; content-assertion test GREEN; `bash .spec/scripts/bash/verify-spec.sh specs/009-constitution-charter/spec.md` CLEAN.
  - **Depends on**: T004 (the improved skill — amend/seed/semvar — must exist).

**Checkpoint**: spec-coach's own charter is authored and clause-consistent with the new code. US4 delivered.

---

## Phase 6: Polish & Cross-Cutting Concerns

**Purpose**: The never-clobber invariant (FR-007, cross-cutting) + release finalization.

- [x] **T007** `[P]` `[infra]` Codify the **never-clobber invariant** (FR-007): add a one-line invariant comment to `installConstitutionToMemory` in `src/utils.ts` (already guarded by `if (fs.existsSync(constDest)) return false`; `update.ts` already "Never modifies user artifacts"). Add **RED-first** regression tests to `tests/units/constitution-charter.test.ts`: `init` over an AUTHORED constitution preserves it (not clobbered by the template). No logic change — this locks existing behavior as the invariant.
  - **Files**: `src/utils.ts` (comment only); `tests/units/constitution-charter.test.ts` (extend).
  - **Verify**: `npx tsx tests/units/constitution-charter.test.ts` GREEN.
  - **Depends on**: nothing (independent — `[P]`, can run anytime after T002).

- [x] **T008** `[infra]` Finalize release: add the **CHANGELOG.md** `2.4.0` entry (constitution-as-charter: status advisor, amend-guard, seeded cold-start, semver, exhaustive propagation, status-aware uninstall preserve, never-clobber codified, dogfood re-author). Run the **full headless suite** (`npx tsx tests/units/*.test.ts`) + smokes (`bash .spec/scripts/bash/verify-constitution-sync.sh`; `npx tsx src/cli.ts --help`). Confirm 0 failures.
  - **Files**: `CHANGELOG.md` (edit).
  - **Verify**: full `tests/units/*.test.ts` suite GREEN (paste the `=== Results: N passed, 0 failed ===` lines); CLI/help smokes clean.
  - **Depends on**: all prior tasks.

**Checkpoint**: Release-ready; all FRs and SCs met.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: no deps — start immediately.
- **Foundational (T002)**: no deps — BLOCKS all user-story work (the discriminator both the skill and uninstall depend on).
- **US1&US2 (T003→T004)**: blocked by T002; T004 blocked by T003 (same skill file, serial).
- **US3 (T005)**: blocked by T002 (token set); **[P]** with T003/T004 (different file).
- **US4 (T006)**: blocked by T004 (improved skill must exist).
- **Polish (T007, T008)**: T007 independent `[P]`; T008 last (depends on all).

### Parallel Opportunities

- **T001** `[P]` (version skeleton).
- **T005** `[P]` with **T003/T004** (uninstall.ts vs the skill markdown — different files), after T002.
- **T007** `[P]` (never-clobber — independent init/utils tests), anytime after T002.

### Critical (Serial) Path

`T001 → T002 → T003 → T004 → T006 → T008` (with T005 and T007 riding in parallel off T002).

---

## Implementation Strategy

### MVP First (US1 & US2)

1. T001 (version) + T002 (advisor) — foundation.
2. T003 + T004 — the improved `/spec-constitution` (amend-guard + seeded cold-start + semver + propagation).
3. **STOP and VALIDATE**: content-assertion tests GREEN; advisor reports status end-to-end. The core value (amend-don't-overwrite + seeded cold-start) is delivered here.

### Incremental Delivery

1. Foundation (T001, T002) → discriminator ready.
2. US1&US2 (T003, T004) → improved skill. **Validate.**
3. US3 (T005, parallel) → preserve-on-uninstall. **Validate.**
4. US4 (T006) → dogfood re-author. **Validate** (spec-coach's own charter authored + clause-consistent).
5. Polish (T007 parallel, T008 final) → never-clobber locked + release finalized.

### Notes

- Behavioral tasks (T002, T005, T007) are **RED-first**; the skill-prose tasks (T003, T004) and the content task (T006) use **content-assertion** verification (Principle V — verify what ships).
- `npm test` is non-headless and is NOT the gate; verify via `npx tsx tests/units/*.test.ts` + bash/CLI smokes.
- One commit per task, message ending `Co-Authored-By: Claude Opus 4.8 <noreply@anthropic.com>`.
- Watch for the `corpus-uninstall.test.ts` regression in T005 (old suite may assert the pre-009 "memory always removed/present" behavior — update to the new status-aware expectation).
- Dogfood: this feature changes spec-coach's own skill, uninstall code, advisor, tests, version, and live constitution.
