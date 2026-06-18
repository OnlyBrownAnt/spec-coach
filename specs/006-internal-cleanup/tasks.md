# Tasks: Internal Cleanup (Dead Code, Type Dedup, State Cohesion)

**Input**: Design documents from `/specs/006-internal-cleanup/`

**Prerequisites**: plan.md (required), spec.md (required for user stories).

**Tests**: This is a **zero-behavior-change refactor**, so the discipline is spec-implement's REFACTOR step — **keep the existing suite green; add no behavior** — NOT RED-first (there is no new behavior to write a failing test for). The full 18-suite mechanical run is the regression net after every task. The ONLY permitted test-text edits are the call-argument updates required by T003/T004 (FR-002/003); any assertion-logic change signals an accidental behavior change and must be rejected. Mechanical tests run via `npx tsx tests/units/<name>.test.ts`; `npm test` is AI-driven/non-headless (per memory).

**Organization**: Setup → US1 (dead-code sweep) → US2 (CmdResult dedup) → US3 (ensureState move) → polish. Components are independent peers (no foundational blocking phase).

## Format: `[ID] [P?] [Story] Description`

- **[P]**: Can run in parallel (different file, no dependency on the in-flight task).
- **[Story]**: US1 = dead-code sweep; US2 = CmdResult dedup; US3 = state cohesion.
- Each task names exact file(s) + verification + dependencies.

## Path Conventions

Single project: `src/`, `tests/` at repository root (dogfood — modifying spec-coach itself).

---

## Phase 1: Setup (Shared Infrastructure)

**Purpose**: Version + changelog scaffold for the PATCH release.

- [ ] T001 [P] — Bump `package.json` `version` 2.1.0 → **2.1.1** and add a `CHANGELOG.md` `## 2.1.1` skeleton entry titled "Internal cleanup (dead code, type dedup, state cohesion)". Files: `package.json`, `CHANGELOG.md`. **Verify**: `node -e "console.log(require('./package.json').version)"` prints `2.1.1`; CHANGELOG has the section. **Deps**: none.

---

## Phase 2: User Story 1 - Readers aren't misled by vestigial dead code (Priority: P1)

**Goal**: Remove `AgentKey`; simplify `runInit`/`runUpdate` signatures; correct stale comments; retain `AGENTS`.

**Independent Test**: `grep -rn "AgentKey" src/` empty; `runInit`/`runUpdate` are single-arg; suite green.

### Implementation for User Story 1

- [ ] T002 [P] [US1] — Remove the `AgentKey` type alias from `src/utils.ts` and correct the stale `AGENTS` comment (drop "retained until cli.ts is rewritten (T018)" / "Legacy callers: cli.ts/init.ts/update.ts" → accurate "manifest-derived convenience map; runtime code prefers loadAgentConfig"). **Pre-check**: `grep -rnE "\bAgentKey\b" src/ tests/` returns only the definition (zero importers) before removing. **Retain `AGENTS`** (do not remove — `agent-config.test.ts` depends on it). Files: `src/utils.ts`. **Verify**: `npx tsx tests/units/agent-config.test.ts` green; `grep -rn "AgentKey" src/` empty. **Deps**: none (parallel — isolated file). **FR-001, FR-004 (AGENTS half)**.
- [ ] T003 [US1] — Simplify `runInit` to `runInit(projectRoot: string): Promise<void>`: drop `_agent` + `_skipAbsorb` params and fix the JSDoc (remove "T018 removes them"/"accepted for backward compatibility"). Update **every** caller: `cli.ts` (`runInit(null, projectRoot)` → `runInit(projectRoot)`) and the test callers `runInit(claude|null, t)` → `runInit(t)` in `corpus-init.test.ts` (2 sites; also drop the now-unused `const claude` + `loadAgentConfig` import), `corpus-lifecycle.test.ts` (1 site), `corpus-uninstall.test.ts` (6 sites). Files: `src/commands/init.ts`, `src/cli.ts`, `tests/units/corpus-init.test.ts`, `tests/units/corpus-lifecycle.test.ts`, `tests/units/corpus-uninstall.test.ts`. **Verify**: `npx tsx tests/units/corpus-init.test.ts && npx tsx tests/units/corpus-lifecycle.test.ts && npx tsx tests/units/corpus-uninstall.test.ts` green. **Deps**: none (init signature is independent of T002). **FR-002, FR-004 (runInit JSDoc)**.
- [ ] T004 [P] [US1] — Simplify `runUpdate` to `runUpdate(projectRoot: string): Promise<void>`: drop `_agent` param, remove the now-unused `import type { AgentConfig }`, fix the JSDoc. Update callers: `cli.ts` (`runUpdate(null, projectRoot)` → `runUpdate(projectRoot)`) and tests `runUpdate(claude|null, t)` → `runUpdate(t)` in `corpus-update.test.ts` (1 site; also drop the now-unused `const claude` + `loadAgentConfig` import) and `corpus-lifecycle.test.ts` (1 site). Files: `src/commands/update.ts`, `src/cli.ts`, `tests/units/corpus-update.test.ts`, `tests/units/corpus-lifecycle.test.ts`. **Verify**: `npx tsx tests/units/corpus-update.test.ts && npx tsx tests/units/corpus-lifecycle.test.ts` green. **Deps**: none (parallel with T003 — different primary file `update.ts` vs `init.ts`; both touch `cli.ts` + `corpus-lifecycle.test.ts`, so if done concurrently resolve those two files' edits cleanly — otherwise sequence after T003). **FR-003, FR-004 (runUpdate JSDoc)**.

**Checkpoint**: US1 complete — no dead `AgentKey`, no vestigial params, no stale comments; suite green.

---

## Phase 3: User Story 2 - No duplicated command-result type can drift (Priority: P1)

**Goal**: One `CmdResult` definition in `src/result.ts`; all command modules import it.

**Independent Test**: `grep -rn "type CmdResult" src/` returns exactly one line (in `result.ts`); suite green.

### Implementation for User Story 2

- [ ] T005 [US2] — Create `src/result.ts` exporting `type CmdResult = { ok: true; message: string } | { ok: false; reason: string }` (shape unchanged). Remove the local `CmdResult` definition from `src/commands/agents.ts` (line ~48) and `src/commands/intake.ts` (line ~38); add `import type { CmdResult } from "../result.ts";` to both. Repoint `src/commands/uninstall.ts`'s `CmdResult` import from `./agents.ts` → `../result.ts`. **Pre-check**: `grep -rnE "CmdResult" src/` to enumerate every importer; repoint all. Files: `src/result.ts` (NEW), `src/commands/agents.ts`, `src/commands/intake.ts`, `src/commands/uninstall.ts`. **Verify**: `grep -rn "type CmdResult" src/` returns exactly one line; full suite green (`for f in tests/units/*.test.ts; do npx tsx "$f" || break; done`). **Deps**: none (independent of US1). **FR-005, FR-006**.

**Checkpoint**: US2 complete — `CmdResult` has a single source of truth.

---

## Phase 4: User Story 3 - State-read logic lives with state (Priority: P2)

**Goal**: `ensureState` + `corpusExists` defined in `state.ts`, imported from there.

**Independent Test**: both defined in `state.ts`; `state.ts` does not import `agents.ts`; suite green.

### Implementation for User Story 3

- [ ] T006 [US3] — Move `ensureState` and `corpusExists` (signatures/behavior unchanged) from `src/commands/agents.ts` to `src/state.ts`. In `agents.ts`, replace the definitions with `import { ensureState, corpusExists } from "../state.ts";` (alongside the existing state imports). In `src/commands/uninstall.ts`, repoint `ensureState` from `./agents.ts` → `../state.ts`. **Cycle check**: confirm `state.ts`'s import list does NOT include `agents.ts` (it imports only `manifest.ts` + `utils.ts`); `ensureState` needs `loadManifest` (already imported in state.ts) + `readState`/`reconcileFromFs` (already defined there) + `corpusExists` (moved with it) — no new edge. Files: `src/state.ts`, `src/commands/agents.ts`, `src/commands/uninstall.ts`. **Verify**: `grep -nE "export function (ensureState|corpusExists)" src/state.ts` hits both; `grep -n "agents.ts" src/state.ts` empty (no cycle); full suite green. **Deps**: T005 (both edit `agents.ts` + `uninstall.ts` — sequence to avoid churn conflicts). **FR-007, FR-008**.

**Checkpoint**: US3 complete — state logic co-located; no cycle.

---

## Phase 5: Polish & Cross-Cutting Concerns

**Purpose**: relocation pins, whole-suite verification, smokes, release finalization.

- [ ] T007 [P] — Relocation-confirmation assertions (optional pin): in `tests/units/state.test.ts` add `import { ensureState, corpusExists } from "../../src/state.ts";` and assert both are functions; add a tiny `tests/units/result-type.test.ts` asserting `import { CmdResult } from "../../src/result.ts"` resolves and a value of each branch satisfies the union. (Characterization, not behavior.) Files: `tests/units/state.test.ts`, `tests/units/result-type.test.ts` (NEW). **Verify**: both green. **Deps**: T005, T006. **SC-003, SC-004 (pin half)**.
- [ ] T008 — Full mechanical suite green: `for f in tests/units/*.test.ts; do npx tsx "$f" || break; done`. Paste every per-file `=== Results: N passed, M failed ===`. Confirm **zero assertion-logic changes** — only call-arg edits from T003/T004. Files: none (verification). **Verify**: every suite 0 failed. **Deps**: T002–T006. **SC-005**.
- [ ] T009 [P] — CLI smokes in a throwaway tmp project: `npx tsx src/cli.ts init`, `update`, `agents add claude` (12 skills), `intake scan`, `uninstall --yes` — confirm identical behavior to 2.1.0 (no regression from the refactor). Files: none (verification). **Verify**: paste output. **Deps**: T008.
- [ ] T010 [P] — Finalize `CHANGELOG.md` 2.1.1 entry: document the three cleanups and the "no install-contract change / no constitution amendment / zero behavior change" framing. Update the constitution SDD STATE block → `Current feature: 006-internal-cleanup`, `Last phase: implement`. Files: `CHANGELOG.md`, `.spec/memory/constitution.md`. **Verify**: CHANGELOG complete; SDD STATE reflects 006. **Deps**: T008.
- [ ] T011 [P] — Set `specs/006-internal-cleanup/spec.md` **Status** → `Implemented`. Files: `specs/006-internal-cleanup/spec.md`. **Verify**: status reads Implemented. **Deps**: T008.

---

## Dependencies & Execution Order

### Phase Dependencies

- **Setup (T001)**: independent — start immediately.
- **US1 (T002–T004)**: T002 isolated; T003 (runInit) and T004 (runUpdate) are independent of T002 and of US2/US3 (different files), but T003/T004 share `cli.ts` + `corpus-lifecycle.test.ts` — sequence them relative to each other.
- **US2 (T005)**: independent of US1; touches `agents.ts`/`intake.ts`/`uninstall.ts`/`result.ts`.
- **US3 (T006)**: depends on T005 (both edit `agents.ts` + `uninstall.ts`).
- **Polish (T007–T011)**: T007 deps T005/T006; T008 deps all implementation; T009/T010/T011 parallel after T008.

### Parallel Opportunities

- **T001** independent.
- **T002** (utils.ts) parallel with everything.
- **T003 ‖ T005** (init/cli/tests vs result/agents/intake/uninstall — no shared file).
- **T004 ‖ T005** (update/cli/tests vs result/agents/intake/uninstall — shared `cli.ts` only if T003 hasn't run; sequence T003→T004 for the shared files).
- **T009 ‖ T010 ‖ T011** (polish, after T008).

### Within the Refactor

- After each implementation task, run the **full 18-suite** mechanical run (not just the touched file) — a refactor's safety net is the whole suite, since the change is "nothing breaks anywhere."
- Grep-confirm dead symbols (AgentKey, CmdResult importers) immediately before removal/repoint.

---

## Implementation Strategy

### Sequential (single implementer)

1. T001 (setup) → T002 (AgentKey) → T003 (runInit) → T004 (runUpdate) → T005 (CmdResult) → T006 (ensureState) → T007 (pins) → T008 (full green) → T009/T010/T011 (polish).
2. **VALIDATE at T008**: full suite green with zero assertion-logic changes — that IS the proof the refactor changed no behavior.

### Notes

- Refactor discipline (spec-implement REFACTOR): keep tests green throughout; **add no behavior**. No RED-first new tests except the optional relocation pins (T007).
- `npm test` is AI-driven/non-headless — do NOT claim it passes; verification = mechanical suites + tsx CLI smokes.
- When a signature/import changes, update all callers in the SAME commit (the suite's init/update tests are the backstop for missed callers).

---

## Cross-Check vs Plan

- Every component C1–C4 has ≥1 task: C1 → T002/T003/T004; C2 → T005; C3 → T006; C4 → T007/T008.
- Every FR-001..FR-010 maps to a task (see per-task FR tags).
- Every SC-001..SC-006 maps to a task/capstone (SC-001/002 → T002/T003/T004; SC-003/004 → T005/T006/T007; SC-005 → T008; SC-006 → T001).
- Every user story (US1/US2/US3) has a phase + independent test + checkpoint.
- No gaps; no orphan tasks.
