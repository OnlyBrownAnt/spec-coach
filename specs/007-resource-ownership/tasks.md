# Tasks: Resource Ownership & Document Safety

**Input**: Design documents from `specs/007-resource-ownership/` (spec.md `b79fb91`, plan.md `af1e242`)

**Prerequisites**: plan.md ✓, spec.md ✓

**Tests**: RED-first for new behavior (US1/US2/US4 — write the failing test, watch it fail, then implement). US3 is **removal**, verified by "suite stays green + CLI smoke confirms the command is gone" (no new behavior to RED-test). Verification via `npx tsx tests/units/<name>.test.ts` + `npx tsx src/cli.ts …` smokes. `npm test` is AI-driven/non-headless — not the gate.

**Organization**: Tasks grouped by user story (US1 P1, US2 P1, US3 P1, US4 P2). One task = one meaningful commit.

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different files, no dependency on a same-file predecessor)
- **[Story]**: User story this task traces to (US1–US4), or none for cross-cutting
- Exact file paths + a verification step are included in every task

## Path Conventions

Single project: `src/`, `tests/` at repo root (dogfood — these are spec-coach's own sources).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Release scaffolding.

- [x] **T001** Bump version `2.1.1 → 2.2.0` + CHANGELOG skeleton (C9 part 1).
  - Files: `package.json` (`version`), `CHANGELOG.md` (new `## 2.2.0` entry, TBD bullets: init re-entry safety, uninstall ownership, intake removal, init guidance, constitution v1.3.0).
  - Verify: `npx tsx src/cli.ts --version` prints `2.2.0`.

---

## Phase 2: Foundational (Blocking Prerequisites)

**None.** This is a behavior change to existing code — there is no new shared foundation to build. Each user story is an independent edit; the only constraint is **file ordering** (init.ts is touched by US1→US3→US4; cli.ts by US2→US3), which executing the user stories in priority order (Phase 3 → 6) naturally satisfies. User story work may begin immediately after T001.

---

## Phase 3: User Story 1 — Re-running `init` never loses installed-agent state (Priority: P1) 🎯 MVP

**Goal**: Re-running `init` preserves `.spec/agents.json` instead of clobbering it to `{}`.

**Independent Test**: `agents add claude` → `runInit` twice → `agents.json` still records `claude`.

### Tests for User Story 1

- [x] **T002** **[US1] RED** — assert re-init preserves installed-agent state.
  - File: `tests/units/corpus-init.test.ts`. Add a block: `mktmp` → `runAgentsAdd("claude", t)` → snapshot `readState(t)` → `runInit(t)` again → `ok("re-init preserves agents.json", readState(t).claude !== undefined)` + `ok("re-init preserves createdFiles", (readState(t).claude?.createdFiles?.length ?? 0) === 12)`.
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → these two assertions **FAIL** (today `writeState({})` wipes state on the second init). Confirm failure is "state reset", not a typo.

### Implementation for User Story 1

- [x] **T003** **[US1] GREEN** — guard the state write in `init.ts`.
  - File: `src/commands/init.ts:73`. Replace `writeState(projectRoot, {});` with `if (!fs.existsSync(path.join(projectRoot, ".spec", "agents.json"))) writeState(projectRoot, {});` (add `import * as fs from "node:fs"` if not present — it is NOT currently imported in init.ts).
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → all PASS (incl. T002 + the existing "re-init keeps a single constitution"). Run the full suite; 0 regressions.

**Checkpoint**: US1 complete — re-running `init` is safe. (FR-001, FR-002)

---

## Phase 4: User Story 2 — Plain `uninstall` removes tooling (incl. constitution), preserves only `specs/` (Priority: P1)

**Goal**: Plain `uninstall` removes all `.spec/` tooling including the constitution; only `specs/` survives. `--force` also removes `specs/`.

**Independent Test**: confirmed plain `uninstall` removes the constitution, preserves `specs/`; `--force` removes `specs/`.

### Tests for User Story 2

- [x] **T004** **[US2] RED** — flip the constitution assertions + drop the obsolete intake block.
  - Files: `tests/units/corpus-uninstall.test.ts`, `tests/units/corpus-lifecycle.test.ts`.
    - `corpus-uninstall.test.ts` ~line 61: change `ok("constitution PRESERVED", exists(t, ".spec/memory/constitution.md"))` → `ok("constitution REMOVED on plain uninstall", !exists(t, ".spec/memory/constitution.md"))`.
    - `corpus-uninstall.test.ts` lines 87-104: **delete** the entire `T017/FR-016 (spec 005)` block (it asserts `.spec/intake` removed + `.spec/absorbed` preserved — obsolete once intake is gone and `.spec/intake` leaves the removal set).
    - `corpus-lifecycle.test.ts` ~line 80: change `ok("uninstall: constitution PRESERVED", exists(...))` → `ok("uninstall: constitution REMOVED", !exists(...))`.
  - Verify: `npx tsx tests/units/corpus-uninstall.test.ts` and `corpus-lifecycle.test.ts` → the flipped assertions **FAIL** (constitution is currently preserved).

### Implementation for User Story 2

- [x] **T005** **[US2] GREEN** — set the ownership boundary + correct user-facing text.
  - Files: `src/commands/uninstall.ts`, `src/cli.ts`.
    - `uninstall.ts:25-26`: `INFRA_PATHS = [".spec/scripts", ".spec/templates", ".spec/agents.json", ".spec/memory"]`; `USER_PATHS = ["specs"]` (drop `.spec/intake` from INFRA; drop `.spec/absorbed` + `.spec/memory` from USER).
    - `cli.ts` uninstall prompt (~line 128): change "User content (specs/, constitution) is preserved unless --force" → "User content (specs/) is preserved; the constitution is removed as tooling. --force also purges specs/." (~line 129 force clause updated to match).
    - `cli.ts` help (~lines 45-47): `uninstall --yes [--force]` description → "Remove spec-coach infrastructure + agent bindings + constitution. --force also purges specs/." (drop "constitution (otherwise preserved)").
  - Verify: `npx tsx tests/units/corpus-uninstall.test.ts` + `corpus-lifecycle.test.ts` → PASS. Full suite green.

**Checkpoint**: US2 complete — the ownership boundary is set; constitution is tooling. (FR-003, FR-004, FR-005)

---

## Phase 5: User Story 3 — The `intake` subsystem is gone; documents become specs without being touched (Priority: P1)

**Goal**: Remove the entire `intake` CLI/module/state; `/spec-absorb` (unchanged) is the sole document→spec path; the iron rule (spec-coach never touches user documents) is pinned.

**Independent Test**: `spec-coach intake …` is an unknown command; `/spec-absorb <doc>` reads a doc in place; `docs/` is never mutated.

> **Note — not RED-first.** US3 is removal + a characterization pin. There is no new behavior to drive a failing test; verification is "the full suite stays green after each removal" + a CLI smoke confirming `intake` is gone. The iron-rule assertion (T008) passes today and locks the invariant.

### Implementation for User Story 3

- [x] **T006** **[US3]** — remove `intake` from the CLI.
  - File: `src/cli.ts`. Delete: the import `import { runIntakeScan, runIntakeProcess, runIntakeIgnore } from "./commands/intake.js";` (line 24); the header comment's "Document lifecycle: intake …" line (line 8, change "Two isolated command surfaces (spec 003) + document lifecycle (spec 005)" → "Two isolated command surfaces"); the help "Document lifecycle (bring existing docs in):" block (lines 55-61); the `case "intake":` block (lines 163-196).
  - Verify: `npx tsx src/cli.ts intake scan` → prints "Unknown command: intake" (smoke). `npx tsx src/cli.ts --help` → no "Document lifecycle" section. Full suite green.

- [x] **T007** **[US3]** — drop the `intakeNudge` wiring and delete the intake module + its test.
  - Files: `src/commands/init.ts`, `src/commands/intake.ts` (DELETE), `tests/units/intake.test.ts` (DELETE).
    - `init.ts`: remove `import { intakeNudge } from "./intake.ts";` (line 18) and the nudge call (lines 75-76, the `const nudge = intakeNudge(...)` + `if (nudge) console.log(nudge)`).
    - `git rm src/commands/intake.ts tests/units/intake.test.ts`.
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → PASS (init no longer imports intake). `npx tsx src/cli.ts init` (in a tmp dir) → runs without error. Full suite green (intake.test.ts removed). `grep -rn "from.*intake" src/` → no matches.

- [x] **T008** **[P] [US3]** — pin the iron rule (FR-008).
  - File: `tests/units/corpus-init.test.ts`. Add: create `docs/keep.md` with known content before `runInit`, then `ok("iron rule: user doc untouched by init", fs.readFileSync(path.join(t,"docs/keep.md"),"utf-8") === <original>)` and `ok("iron rule: no .spec/intake created", !exists(t,".spec/intake"))` and `ok("iron rule: no .spec/absorbed created", !exists(t,".spec/absorbed"))`.
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → PASS (characterization — locks the invariant; these pass today and must keep passing). Depends on: T003 + T007 (corpus-init + intake state settled).

- [x] **T009** **[P] [US3]** — rewrite `absorb.md` to direct-path invocation (C7).
  - File: `skills/absorb.md`. Rewrite "When to use" + "The process" so the skill is pointed at any document path the user names; remove every reference to `intake process --ai`, `.spec/intake/manifest.json`, "staged source", `absorb-ai-pending`, and the "later intake scan marks absorbed-ai" step. The transform algorithm is unchanged: read the source in place → follow `.spec/templates/spec-template.md` → write `specs/NNN-slug/spec.md` → do NOT move/rename/delete the source.
  - Verify: `grep -in "intake\|manifest\|staged\|absorb-ai" skills/absorb.md` → no matches. `npx tsx tests/units/owned-paths.test.ts` + `agents-update.test.ts` → PASS (the `absorb` skill is still in `SKILL_NAMES`, 12-skill set intact).

**Checkpoint**: US3 complete — intake is gone; the iron rule is pinned; `/spec-absorb` is the sole doc→spec path. (FR-006, FR-007, FR-008, FR-009, FR-013)

---

## Phase 6: User Story 4 — `init` recognizes existing `specs/` and guides the user (Priority: P2)

**Goal**: `init` detects existing `NNN-slug` specs and emits a non-blocking guidance block (safety rule + `/spec-absorb` how-to); never modifies existing specs.

**Independent Test**: `init` in a dir with `specs/003-x` emits guidance acknowledging it and leaves it untouched.

### Tests for User Story 4

- [x] **T010** **[US4] RED** — assert the guidance block (existing-specs + fresh cases).
  - File: `tests/units/corpus-init.test.ts`. Capture `runInit` stdout (e.g., override `console.log` to a buffer). Add: (a) dir with `specs/003-thing/spec.md` → `ok("US4: acknowledges existing spec", <stdout> includes "003" or "existing")` + `ok("US4: existing spec untouched", <spec.md bytes unchanged>)`; (b) fresh dir → `ok("US4: fresh emits safety rule + absorb how-to", <stdout> includes "/spec-absorb")` and `ok("US4: fresh has no existing-specs line", !<stdout includes "existing">)`.
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → the US4 assertions **FAIL** (no guidance emitted today).

### Implementation for User Story 4

- [x] **T011** **[US4] GREEN** — add `existingSpecs` + `printDocumentGuidance` to `init.ts`.
  - File: `src/commands/init.ts`. Add `existingSpecs(projectRoot): { count: number; highest: number }` — reads direct children of `specs/`, counts those matching `/^\d{3}-.+/`, returns the max leading number (0 when none/missing). Add `printDocumentGuidance(projectRoot)` — when `count > 0`: a line acknowledging existing specs (count + highest, "adopted as-is; review with `ls specs/`; new specs continue from N+1"); always: the safety rule ("your documents are never moved/deleted/overwritten") + the how-to ("turn a doc into a spec: `/spec-absorb <path>`; originals stay put; ignore the rest"). Call it after `printNextSteps`. NEVER modify `specs/`.
  - Verify: `npx tsx tests/units/corpus-init.test.ts` → PASS (incl. T010). Full suite green.

**Checkpoint**: US4 complete — `init` educates and adopts. (FR-010, FR-011)

---

## Phase 7: Polish & Cross-Cutting Concerns

- [x] **T012** **[P]** Constitution amendment v1.2.0 → v1.3.0 (C8).
  - File: `.spec/memory/constitution.md`. In **Development Constraints — CLI surface**: "Three isolated surfaces" → **two** (corpus lifecycle + agent lifecycle); delete the document-lifecycle/intake sentence; state that document→spec is the on-demand `/spec-absorb` skill, not a CLI command. Add an **Ownership & Safety** clause: the iron rule (read-only on user documents; append-only to `specs/`) + the uninstall preservation set (`specs/` only; all else under `.spec/` is regenerable tooling). Footer: Version `1.2.0 → 1.3.0`, Last Amended `2026-06-18`. SDD STATE block → `Current feature: 007-resource-ownership`, `Last phase: tasks`.
  - Verify: read-through confirms the two-surfaces + iron-rule wording. (If `.spec/scripts/bash/verify-constitution-sync.sh` exists, run it; it should be CLEAN — no SYNC IMPACT block since this amendment does not add/rename a Core Principle.)

- [x] **T013** Finalize release (C9 part 2).
  - Files: `CHANGELOG.md` (fill the 2.2.0 bullets from the implemented changes), `.spec/memory/constitution.md` SDD STATE → `Last phase: implement`.
  - Verify: `npx tsx src/cli.ts --version` → `2.2.0`. Full suite green. CLI smoke: `init` (tmp dir), `uninstall --yes`, `--help` all behave as designed.

- [x] **T014** **[P]** Cosmetic — fix stale `intake.ts` comments.
  - Files: `src/result.ts:6` (comment "was duplicated in agents.ts + intake.ts" → drop the intake.ts mention), `tests/units/relocation.test.ts:18` (same). Behavior-neutral comment-only edits.
  - Verify: `npx tsx tests/units/relocation.test.ts` → PASS. `grep -rn "intake.ts" src/ tests/` → no matches.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (Phase 1, T001)**: no dependencies — start immediately.
- **Foundational (Phase 2)**: none required — skip straight to user stories.
- **User Stories (Phase 3–6)**: execute in priority order US1 → US2 → US3 → US4. This order is also the **file-safe** order (it serializes the shared-file edits: `init.ts` is touched US1→US3→US4; `cli.ts` is touched US2→US3).
- **Polish (Phase 7)**: T012/T014 may run any time after their inputs exist (T012 after the behavior is settled; T014 after T007); T013 (finalize) is **last**.

### User Story Dependencies

- **US1 (T002→T003)**: after T001. No dependency on other stories. Edits `init.ts` (1st of 3 touches).
- **US2 (T004→T005)**: after T001. No dependency on US1. Edits `uninstall.ts` + `cli.ts` (1st of 2 cli.ts touches). Independent of US1 (different files).
- **US3 (T006→T007→T008→T009)**: T006 (cli.ts, 2nd touch) after T005; T007 (init.ts, 2nd touch) after T003; **T007 deletes `intake.ts` only after T006 removed its last `cli.ts` importer**; T008 after T003 + T007 (corpus-init + intake settled); T009 fully independent.
- **US4 (T010→T011)**: after T003 + T007 + T008 (corpus-init is in its final pre-US4 state; init.ts 3rd touch). No dependency on US2/US3's other tasks.

### Within Each User Story

- Tests (RED) written and **fail** before implementation (US1, US2, US4).
- US3 is removal: suite stays green at each step; CLI smoke confirms removal.
- Commit after each task.

### Parallel Opportunities

- **T008** (corpus-init iron-rule pin) ∥ **T009** (`absorb.md` rewrite) — different files, both after T007. `[P]`
- **T012** (constitution) ∥ **T014** (cosmetic comments) — independent doc/comment files. `[P]`
- US1 ∥ US2 are independent (different files) but are kept sequential in priority order for clarity; a second stream could take US2 while US1 runs.

---

## Implementation Strategy

### MVP First (US1 + US2)

1. T001 (version scaffold) → T002/T003 (US1: init re-entry safety) → T004/T005 (US2: uninstall boundary).
2. **STOP and VALIDATE**: re-running `init` preserves agent state; plain `uninstall` removes the constitution and preserves `specs/`. The ownership closed loop is shippable here.

### Incremental Delivery

3. T006–T009 (US3: remove intake, pin the iron rule, rewrite absorb.md) → validate: `intake` gone, `/spec-absorb` is the sole path, `docs/` never touched.
4. T010/T011 (US4: init guidance) → validate: `init` acknowledges existing specs and educates the user.
5. T012–T014 (polish: constitution amendment, finalize, cosmetic) → validate: v2.2.0, suite green, smokes clean.

### Iron Rule as the Spine

Every task is checked against the iron rule: **spec-coach is read-only on user documents and only appends to `specs/`.** No task may introduce a move/rename/delete/overwrite of a user file. T008 is the explicit pin.

---

## Notes

- [P] tasks = different files, no same-file predecessor.
- [Story] labels trace each task to US1–US4 (or none for cross-cutting T001/T012/T013/T014).
- Each US is independently testable at its checkpoint.
- Verify RED tests fail before implementing; verify the full suite stays green after every task.
- Commit after each task.
