# Implementation Plan: Derived Workflow State (Eliminate the Stored-State Subsystem)

**Branch**: `008-derived-workflow-state` | **Date**: 2026-06-18 | **Spec**: `specs/008-derived-workflow-state/spec.md`

**Input**: Feature specification from `specs/008-derived-workflow-state/spec.md` (approved). Φ design: eliminate the writable, behavior-driving workflow-state store; derive state read-only from `specs/NNN/` artifacts via a single resolver.

## Summary

Replace spec-coach's drift-prone parallel state subsystem (`.spec/feature.json` + `_persist_feature_json` + `SPECIFY_FEATURE`-as-source + the constitution's `<!-- SDD STATE -->` block + the `spec-constitution` step that appends it) with **derived read-only state**. One new core function `resolve_feature()` in `scripts/bash/common.sh` resolves the current feature (precedence: explicit token incl. opt-in `@` branch shorthand → `SPECIFY_FEATURE` env override → most-recently-modified `specs/NNN-*/` → none), with a `--strict` variant (single-candidate only, else empty) for the writing path so it never silently picks among multiple features (analysis C1). The existing `get_feature_paths()` is reformed to call it (in strict mode), transparently fixing its 4 callers (`setup-plan.sh`, `setup-tasks.sh`, `check-prerequisites.sh`, `verify-spec.sh`). `show-sdd-state.sh` becomes a pure read-only reporter (phase inferred from artifacts; decisions as a pointer to `spec.md`/`CHANGELOG`; resume breakpoint = first unchecked task in `tasks.md`). The state-writing apparatus is deleted; legacy `feature.json`/block instances are read-tolerant (ignored, never migrated). Constitution amended v1.3.0 → v1.4.0 to codify "state is derived, not stored."

## Technical Context

**Language/Version**: Bash (the entire workflow-state layer: `scripts/bash/*.sh`) + TypeScript/tsx (the CLI surface, which only holds a doc string at `src/utils.ts:333`).

**Primary Dependencies**: None added (Constitution III). Resolution reuses the existing `jq → python3 → grep/sed` fallback ladder already in `common.sh`. Tests use Node's `node:child_process` (`execSync`) + `node:assert` — no new test dependency.

**Storage**: Filesystem only. The "state" is the artifacts themselves (`specs/NNN/{spec,plan,tasks,analysis}.md` + the `[x]`/`[ ]` checkboxes in `tasks.md`). **No state file is written or read by any command.**

**Testing**: `tests/units/workflow-state.test.ts` (new) using `node:assert/strict`. Because the resolver/reporter are Bash, tests invoke them via `child_process.execSync('bash -c "source …/common.sh; <fn> …"')` and via end-to-end `bash scripts/bash/show-sdd-state.sh` runs inside a `mkdtemp` repo, asserting `stdout` substrings and exit code. RED-first for US1/US2 (tests assert derived behavior that the current feature.json/block-reading code fails); US3 removals verified by suite-green + direct script smokes. `npm test` is AI-driven/non-headless and is NOT the gate (project memory).

**Target Platform**: macOS/Linux (Bash). `@` branch parse uses `git branch --show-current` (Git ≥ 2.22); the resolver degrades gracefully (returns none) when git is absent or HEAD is detached.

**Project Type**: CLI dogfooding itself — the changes are to spec-coach's own scripts/skill/constitution.

**Performance Goals**: N/A — read-only reporting; resolution is a directory listing + a couple of `test -f` calls.

**Constraints**: Zero production dependencies (Constitution III); every resolution path is non-blocking (`show-sdd-state.sh` always exits 0); the reporter never mutates a file (contents + mtimes unchanged across an invocation); `@` is the only git coupling and is explicit opt-in only.

**Scale/Scope**: One new core function (`resolve_feature`) + one extracted helper (`infer_phase`) + one breakpoint helper (`first_pending_task`); reform of `get_feature_paths`; rewrite of `show-sdd-state.sh`; deletion of 2 common.sh functions + 1 skill step + 1 constitution block; retarget text in `verify-spec.sh` + `create-new-feature.sh` + `src/utils.ts`; constitution amendment; version bump. ~6 scripts + 1 skill + 1 constitution + 1 new test file.

## Constitution Check

Φ is a **reduction**, so it aligns with every principle rather than tensioning any. **I (Markdown Is the Product):** skills stay pure guidance — the `spec-constitution` skill *loses* a step (the SDD STATE append), and no code is added to do coaching; the resolver is distribution plumbing, not a coaching gate. **II (Coach, Not Gatekeeper):** the reporter is non-blocking and non-driving (exit 0, never mutates, never refuses); it advises "here is where you are" and lists candidates on ambiguity instead of erroring. **III (Zero Dependencies):** no dependency added; net code is *removed*. **IV (Precision in Templates):** the resolver's precedence contract is documented exactly (explicit token > `SPECIFY_FEATURE` env > mtime default > none; `@` opt-in only) — a precise, testable contract. **V (Verify What Ships):** tests assert the *derived behavior end-to-end* (run the shipped script in a tmp repo, assert stdout) — they verify the installed artifact's behavior, not just a function. The amendment v1.3.0 → v1.4.0 follows **Governance** (documented rationale: codify the derived-state model; no principle added/removed; no install-contract change). No violations; no justified deviations needed beyond the two tracked in Complexity Tracking (bash-from-TS testing, and the `@` opt-in coupling).

## Project Structure

### Documentation (this feature)

```text
specs/008-derived-workflow-state/
├── spec.md      # approved specification
├── plan.md      # this file
└── tasks.md     # (/spec-tasks output — not created by this plan)
```

### Source Code (repository root)

```text
scripts/bash/
├── common.sh               # +resolve_feature(), +infer_phase(), +first_pending_task();
│                           #  get_feature_paths() reformed; -read_feature_json_feature_directory,
│                           #  -_persist_feature_json, get_current_branch() reduced/removed
├── show-sdd-state.sh       # rewritten as pure read-only reporter
├── create-new-feature.sh   # -_persist_feature_json call (line ~262); branch + export hint kept
└── verify-spec.sh          # help/comment text retargeted (no-arg path already calls get_feature_paths)

skills/
└── constitution.md         # -step 5 "Initialize SDD State" (the SDD STATE append)

.spec/memory/
└── constitution.md         # -<!-- SDD STATE --> block; +derived-state clause; v1.3.0 → v1.4.0

src/
└── utils.ts                # line ~333 Workflow State doc string retargeted

tests/units/
└── workflow-state.test.ts  # NEW — execSync-driven bash tests (RED-first for US1/US2)

package.json                # 2.2.1 → 2.3.0
CHANGELOG.md                # 2.3.0 entry
```

**Structure Decision**: Single-project (the repo is spec-coach itself). All changes are to existing scripts/skill/constitution plus one new test file. No new directory, no new package.

### Component & File Mapping (FR → component → file)

| Component | What it does | Files | FRs |
|-----------|--------------|-------|-----|
| **C1 `resolve_feature()`** | Single feature resolver, two policies. **Soft** (default): explicit token (`NNN`/slug/path, incl. `@`) → `SPECIFY_FEATURE`/`SPECIFY_FEATURE_DIRECTORY` env → mtime-newest `specs/NNN-*/` → none (may guess — read-only use). **Strict** (`--strict`): same explicit/env tiers, but the no-token tier resolves ONLY when exactly one candidate exists, else empty (never guesses among multiple — writing use). `@` → `git branch --show-current`, parse leading `\d{3}` → `specs/<NNN>-*/`. Read-tolerant of legacy `feature.json` (ignores it). Signature: `resolve_feature [--strict] [token]` → echoes absolute feature dir or empty; never errors. | `scripts/bash/common.sh` (add) | FR-001, FR-002, FR-003, FR-013 |
| **C2 `infer_phase()`** | Extract `show-sdd-state.sh`'s existing artifact if/elif into a reusable function: `analysis.md`→analyze, `tasks.md`→tasks, `plan.md`→plan, `spec.md`→specify, else constitution. Signature: `infer_phase <feature_dir>` → echoes phase string. | `scripts/bash/common.sh` (add) | FR-004 |
| **C3 reform `get_feature_paths()`** | Replace the `SPECIFY_FEATURE_DIRECTORY`/`feature.json` tier with a call to `resolve_feature --strict` (writing path never silently mtime-picks among multiple features — analysis C1). Keep emitting `REPO_ROOT`/`FEATURE_DIR`/`FEATURE_SPEC`/`IMPL_PLAN`/`TASKS`/`RESEARCH`/`DATA_MODEL`/`QUICKSTART`/`CONTRACTS_DIR`, and keep error-when-unresolvable (empty OR ambiguous-without-explicit-input; the 4 callers that `exit 1` on failure are unchanged). Accepts an optional token arg forwarded to `resolve_feature`. | `scripts/bash/common.sh` (edit) | FR-012 |
| **C4 rewrite `show-sdd-state.sh`** | Pure read-only reporter: feature via `resolve_feature` (soft policy — the read-only reporter may guess), phase via `infer_phase`, decisions as a pointer to `spec.md`/`CHANGELOG.md` (+ optional `specs/NNN/decisions.md` if present). On "none"/ambiguity: say so; for ambiguity list each candidate with phase + mtime. Drops all `feature.json`/block reads. Never mutates; always `exit 0`. Accepts an optional token arg (`@` allowed) → `resolve_feature`. | `scripts/bash/show-sdd-state.sh` (rewrite) | FR-005, FR-006 |
| **C5 `first_pending_task()`** | Resume breakpoint: first `- [ ]` (not `- [x]`) in `specs/NNN/tasks.md`. Returns the task line/id or "no pending task"; "no tasks.md yet" when absent. Signature: `first_pending_task <feature_dir>` → echoes the task or a status string. Resume feature resolution reuses C1 (FR-008). | `scripts/bash/common.sh` (add) | FR-007, FR-008 |
| **C6 `create-new-feature.sh` teardown** | Remove the `_persist_feature_json "$REPO_ROOT" "$FEATURE_DIR"` call (~line 262). Keep branch creation and the `# To persist: export SPECIFY_FEATURE=…` hint (env remains the explicit-override channel). | `scripts/bash/create-new-feature.sh` (edit) | FR-009 |
| **C7 common.sh function removal** | After all callers are gone (C3/C6), delete `read_feature_json_feature_directory` and `_persist_feature_json`. Reduce `get_current_branch()` to honoring `SPECIFY_FEATURE` only (or remove if `resolve_feature` subsumes it) — it ceases to be a parallel source. | `scripts/bash/common.sh` (edit) | FR-009, FR-011 |
| **C8 `verify-spec.sh` text retarget** | No-arg resolution already calls `get_feature_paths` (reformed by C3) — behavior fixed transparently. Update the help/comment text that says "via `.spec/feature.json`" to reflect derived resolution. | `scripts/bash/verify-spec.sh` (edit) | FR-012 |
| **C9 `spec-constitution` skill step removal** | Remove step 5 "Initialize SDD State" (the block that appends `<!-- SDD STATE START -->…END -->` to the constitution). Renumber subsequent steps. | `skills/constitution.md` (edit) | FR-010 |
| **C10 constitution amendment** | In `.spec/memory/constitution.md`: remove the `<!-- SDD STATE -->` block; under Development Constraints add a clause codifying the model ("workflow state is derived read-only from `specs/NNN/` artifacts; no command writes a workflow-state file; `show-sdd-state.sh` is a non-driving reporter; the current feature resolves by explicit token / `SPECIFY_FEATURE` override / opt-in `@` / mtime default"). Bump footer v1.3.0 → v1.4.0, Last Amended 2026-06-18. (`constitution-template.md` is **unchanged** — it has no SDD STATE block.) | `.spec/memory/constitution.md` (edit) | FR-014 |
| **C11 `src/utils.ts` doc string** | Update the Workflow State line (~333) to: state is derived from artifacts; run `show-sdd-state.sh [feature|@]`; no state file. | `src/utils.ts` (edit) | (cross-cutting doc; supports FR-014) |
| **C12 version + changelog** | `package.json` 2.2.1 → 2.3.0; `CHANGELOG.md` 2.3.0 entry (derived state; removed subsystem; `@`; amendment v1.4.0); constitution footer version (C10). | `package.json`, `CHANGELOG.md` (edit) | FR-014 |
| **C13 tests** | New `tests/units/workflow-state.test.ts` (execSync-driven, RED-first for US1/US2): (a) show reports correct feature+phase with NO feature.json/block; (b) no-arg mtime default; (c) `@` branch→feature; (d) ambiguity lists candidates; (e) resume breakpoint = first unchecked task; (f) read-only (no mtime/content change, exit 0); (g) legacy feature.json tolerated. Update/remove any existing test asserting `feature.json`/block. | `tests/units/workflow-state.test.ts` (add) + existing tests (edit) | SC-001…SC-007 |

**Coverage check** — every FR maps to ≥1 component: FR-001/002/003/013→C1, FR-004→C2, FR-005/006→C4, FR-007/008→C5(+C1), FR-009→C6/C7, FR-010→C9/C10, FR-011→C7/C1, FR-012→C3/C8, FR-014→C10/C12, FR-015→all (no-dep constraint, no component needed). No orphan components; no orphan FRs.

**File-safety / edit order** (drives task sequencing): `common.sh` resolver (C1/C2/C5) first → reform `get_feature_paths` (C3) → rewrite `show-sdd-state.sh` (C4) → teardown importers (`create-new-feature.sh` C6, `verify-spec.sh` C8) → delete dead common.sh functions (C7, after C3/C6 drop callers) → skill step (C9) + constitution amendment (C10) → doc string (C11) → version/changelog (C12) → tests written RED-first alongside C1/C4/C5 (C13).

## Complexity Tracking

| Item | Why needed / status | Simpler alternative rejected because |
|------|---------------------|--------------------------------------|
| **Testing Bash from the `node:assert` harness** (`execSync`-driven `workflow-state.test.ts`) | The entire state layer is Bash (`common.sh`, `show-sdd-state.sh`); there is no TS function to assert against directly. Invoking the shipped script in a `mkdtemp` repo via `execSync` and asserting `stdout`/exit is the only way to verify the *installed artifact's behavior* (Constitution V) headlessly. This is the first such test in the suite. | A pure-TS reimplementation of the resolver was rejected — it would duplicate the Bash logic and test a copy, not the shipped code. |
| **Spec precision correction (FR-014 / Assumptions)** | The spec said the teardown "removes the SDD STATE block from `constitution-template.md`." Inspection shows the **template has no block** — only the `spec-constitution` skill appends it, and only this repo's live `constitution.md` carries one. So C10 edits the live constitution + the skill step (C9); the template is untouched. **Versioning is still MINOR 2.2.1 → 2.3.0** — the rationale is the constitution amendment (v1.3.0→v1.4.0) + observable behavior change (show derives; no state file; `@` added), matching the spec 007 precedent (amendment + behavior change ⇒ MINOR), not "template content removed." | — (correction, not a deferral) |
| **`@` adds an (opt-in, read-only) git coupling** | `@` parses `git branch --show-current`. This is a git coupling, but it is **explicit opt-in** (the user/skill passes `@`) and feeds only the **read-only reporter** — it never silently drives behavior and never mutates. This is the designed escape valve, distinct from the *illegitimate* silent git-coupling the rejected Ω design had. | Silent branch-derivation as the default (Ω) was rejected: branches change for non-SDD reasons and would corrupt state silently. |
