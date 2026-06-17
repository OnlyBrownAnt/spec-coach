# Implementation Plan: Constitution Enforcement Reach

**Branch**: `constitution-enforcement-reach` | **Date**: 2026-06-17 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/002-constitution-enforcement-reach/spec.md`

## Summary

Restore the constitution's enforcement reach across spec-coach by closing six spec-kit absorption gaps, using the agreed Approach D: **markdown carries the coaching voice; zero-dependency bash scripts carry the verification capability; the agent wires them through self-discipline; nothing blocks.**

Concretely: (1) the `/spec-constitution` skill gains an amendment-propagation checklist and Sync Impact Report (markdown coaching); a narrow `verify-constitution-sync.sh` checks the one real cross-reference — constitution principle count/names against `plan-template`'s Constitution Check section — and confirms a Sync Impact Report was recorded (spec/tasks templates have no constitution section, so no broader drift check is even possible); (2) `/spec-analyze` loads the constitution and classifies principle violations as CRITICAL — deliberately markdown-only, because violation detection is semantic judgment a bash script cannot make; (3) a `show-sdd-state.sh` surfaces the current feature (from `.spec/feature.json`) and infers last phase from which artifacts exist (`tasks.md`→tasks, `analysis.md`→analyze, `plan.md`→plan, `spec.md`→specify, else constitution) — it does NOT rely on the SDD STATE `Last phase` field, which no skill ever updates; decisions/skipped are read from the SDD STATE block when present. The `CLAUDE.md` managed section points at this capability; (4) `/spec-specify` gains a ≤3-round iterative validation loop with a scope>security>UX>technical rubric, backed by `verify-spec.sh`, which flags the canonical placeholder set — `TBD`, `TODO`, unfilled `[ALL_CAPS]` tokens, and the generic filler phrases already enumerated in `skills/plan.md`'s Self-Review (e.g. "implement later", "add appropriate error handling" without specifics); (5) `/spec-specify` and `/spec-tasks` load the constitution during authoring; (6) a markdown-native `.spec/hooks.md` seam lets teams inject steps without editing source skills. All verification scripts are non-blocking (exit 0, findings to stdout) and add no npm dependencies. This is a dogfood change to spec-coach's own skills and scripts.

## Technical Context

**Language/Version**: TypeScript 5.x (CLI) + Bash (scripts, targeting macOS/Linux; `set -e` conventions per existing `scripts/bash/`) + Markdown (skills, templates). No language version bump.

**Primary Dependencies**: `tsx` (sole existing production dependency, runtime). Scripts rely only on `bash` + `jq`/`python3`/`grep`/`sed` with graceful fallbacks (the pattern already established in `common.sh`). **No new dependencies added.**

**Storage**: filesystem only — `.spec/memory/constitution.md` (SDD STATE block), `.spec/feature.json` (current feature), `.spec/hooks.md` (team extensions), `specs/<id>/*.md` (artifacts), `skills/*.md` (source skills), `scripts/bash/*.sh` (source scripts).

**Testing**: `bash tests/run.sh` (a.k.a. `npm test`) — behavioral + integration tests that drive the *installed* skills end-to-end. New mechanical verification scripts get dedicated fast tests under `tests/scripts/` (no AI, fixture-driven). After editing source skills/scripts, run `spec-coach update` (or re-`init` in a temp dir) so installed copies reflect changes before running behavioral tests.

**Target Platform**: developer workstations running bash (macOS/Linux). Windows/PowerShell is out of scope (documented assumption).

**Project Type**: CLI tool + markdown-skill library.

**Performance Goals**: verification scripts complete in well under 1s (mechanical grep/parse over a handful of files); no network, no AI calls.

**Constraints**: zero new npm dependencies (FR-015, SC-007); verification scripts MUST be non-blocking (FR-014); markdown-first — code only where markdown provably cannot achieve the result; existing coach-voice advantages (Iron Laws, HARD-GATE, placeholder scan in `/spec-plan`) preserved, not replaced.

**Scale/Scope**: single repo. Edits: 4 skill files (`constitution`, `analyze`, `specify`, `tasks`), 2 TS files (`init.ts`, `update.ts`), 1 line in `package.json`. New: 3 bash scripts, `tests/scripts/` mechanical tests. No new dependencies, no new install-contract directories.

## Constitution Check

Checked against `.spec/memory/constitution.md` (5 principles):

- **I. Markdown Is the Product** — **DEVIATION (justified, see Complexity Tracking).** The plan adds three bash verification scripts. This is permitted by the principle's own escape clause ("code is added only when markdown alone cannot achieve the result"): mechanical checks — placeholder scanning, constitution↔template drift detection, and reliable state surfacing — cannot be performed reliably by markdown prose alone. The gap-3 lesson is precisely that a markdown-only "remember to check" is a fake fix. Non-blocking + zero-dependency keeps the deviation within the principle's spirit.
- **II. Coach, Not Gatekeeper** — **SATISFIED.** Every verification script is non-blocking (FR-014): it reports findings for the agent to act on; it never halts the workflow, forces an action, or auto-edits artifacts.
- **III. Zero Dependencies, Zero Friction** — **SATISFIED.** No production npm dependencies are added (FR-015, SC-007). Scripts reuse `jq`/`python3`/`grep`/`sed` with documented fallbacks, matching `common.sh`'s existing resilience pattern.
- **IV. Precision in Templates** — **SATISFIED / N-A.** No document template's RFC 2119 precision is weakened. New skill prose and the `.spec/hooks.md` format spec use deliberate MUST/SHOULD/MAY language with concrete definitions.
- **V. Verify What Ships** — **STRONGLY SATISFIED.** The feature *is* verification capability. New scripts each receive mechanical tests under `tests/scripts/`; the existing `npm test` suite continues to guard installed-skill behavior. A passing suite means the verification scripts installed correctly and behave as specified.

## Project Structure

### Documentation (this feature)

```text
specs/002-constitution-enforcement-reach/
├── spec.md          # specification (this feature's WHAT)
├── plan.md          # this file (the HOW)
├── tasks.md         # task breakdown (/spec-tasks output — next step)
└── analysis.md      # optional cross-artifact review (/spec-analyze output)
```

Note: unlike spec-kit, spec-coach's `/spec-plan` does not generate `research.md`, `data-model.md`, `quickstart.md`, or `contracts/` — artifact fan-out is deferred to implementation. Those entries are intentionally absent here.

### Source Code (repository root)

```text
skills/
├── constitution.md   # +amendment-propagation checklist + Sync Impact Report section
├── analyze.md        # +constitution load step + CRITICAL classification for principle violations
├── specify.md        # +≤3-round iterative validation loop + priority rubric + constitution load
└── tasks.md          # +constitution load during authoring

scripts/bash/
├── verify-constitution-sync.sh   # NEW — narrow: constitution principles vs plan-template Constitution Check + confirm Sync Impact Report recorded
├── verify-spec.sh                # NEW — scan a spec for the canonical placeholder set (TBD/TODO/[ALL_CAPS]/filler phrases from skills/plan.md)
└── show-sdd-state.sh             # NEW — current feature (feature.json) + last phase (inferred from artifacts) + decisions/skipped (SDD STATE block)

src/commands/
├── init.ts          # extend createCLAUDEmd(): managed section gains an SDD STATE pointer line
└── update.ts        # upsert the managed CLAUDE.md section so existing projects get the pointer

package.json         # add "scripts/" to the files array (latent defect fix — see Complexity Tracking)

tests/scripts/       # NEW — mechanical, fixture-driven tests for the three verify scripts
├── test-verify-constitution-sync.sh
├── test-verify-spec.sh
└── test-show-sdd-state.sh

# Existing, unchanged:
.spec/memory/constitution.md   # carries the SDD STATE block (read by show-sdd-state.sh)
.spec/feature.json             # script-authoritative current feature (read by show-sdd-state.sh)
.spec/hooks.md                 # team-created (optional); format documented in skills
common.sh                      # sourced by all new scripts (get_repo_root, get_feature_paths, json_escape)
```

**Structure Decision**: single-project layout (the repo's existing shape). All changes are additive to existing directories — no new install-contract directories, so `spec-coach update` compatibility is preserved (constitution Principle I file-structure contract unchanged in shape). Source skills live at `skills/*.md`; installed copies (`.claude/skills/`, `.kiro/skills/`) are regenerated by `init`/`update` and are not hand-edited. Source scripts live at `scripts/bash/*.sh`; `installScripts()` auto-collects every `*.sh` via `readdirSync`, so the three new scripts ship without any registration code change.

### Component & File Mapping (FR → component → files)

| FR | Component | File(s) |
|----|-----------|---------|
| FR-001 | Constitution propagation guidance | `skills/constitution.md` |
| FR-002 | Sync Impact Report | `skills/constitution.md` |
| FR-003 | Constitution-sync verification (narrow: plan-template + report existence) | `scripts/bash/verify-constitution-sync.sh` |
| FR-004 | Analyze loads constitution | `skills/analyze.md` |
| FR-005 | CRITICAL classification of principle violations | `skills/analyze.md` |
| FR-006 | State surfacing (feature←feature.json, last phase←artifacts, decisions/skipped←SDD STATE) | `scripts/bash/show-sdd-state.sh` |
| FR-007 | CLAUDE.md managed-section pointer | `src/commands/init.ts`, `src/commands/update.ts` |
| FR-008 | Specify iterative loop (≤3 rounds) | `skills/specify.md` |
| FR-009 | Priority rubric (scope>security>UX>technical) | `skills/specify.md` |
| FR-010 | Spec placeholder/ambiguity scan | `scripts/bash/verify-spec.sh` |
| FR-011 | Authoring-time constitution load | `skills/specify.md`, `skills/tasks.md` |
| FR-012 | Markdown hooks mechanism | `.spec/hooks.md` (user-created) + format spec in `skills/constitution.md` |
| FR-013 | Surface/skip declared hooks | hook-paragraph seams in `skills/{constitution,specify,plan,tasks,analyze}.md` |
| FR-014 | Non-blocking verification (cross-cutting) | all three new scripts: `exit 0`, findings to stdout |
| FR-015 | Zero-dependency (cross-cutting) | `package.json` (`scripts/` added to `files`); no new deps in `dependencies` |

**Spec coverage**: all 15 FRs mapped. No orphan FRs.

## Complexity Tracking

| Violation / Complexity | Why Needed | Simpler Alternative Rejected Because |
|------------------------|------------|-------------------------------------|
| **Principle I deviation — 3 bash verification scripts** (`verify-constitution-sync.sh` narrowed, `verify-spec.sh`, `show-sdd-state.sh`) | Each backs a check markdown provably cannot do: token scanning (FR-010), reliable last-phase inference from artifacts (FR-006), and a narrow constitution↔plan-template consistency check (FR-003). The constitution's escape clause permits code when markdown alone cannot achieve the result. | (a) Pure-markdown "remember to check" rejected — it is the advisory gap this feature closes. (b) Attaching a script to gap 2 (analyze) explicitly rejected: violation detection is semantic judgment, not mechanics; a script there would be a fake check. Scripts are concentrated only where mechanical verification is real. |
| **SDD STATE `Last phase` is never maintained** (verified: only `skills/constitution.md` writes the block) | `show-sdd-state.sh` would otherwise surface a perpetually-stale "Last phase: constitution". Reliable awareness requires a source that does not depend on every skill remembering to write state. | Teaching each phase skill to update the block rejected — fragile, couples every skill to state-writing. Instead `show-sdd-state.sh` **infers last phase from which artifacts exist** (tasks/analysis/plan/spec.md), which is mechanical and always correct. The SDD STATE `Last phase` field is thereby deprecated; the block is read only for decisions/skipped. *Note: this supersedes the spec's Key Entity description of the SDD STATE block as the last-phase source.* |
| **Latent defect fix — add `scripts/` to `package.json` `files`** | `installScripts()` reads `PACKAGE_ROOT/scripts/bash`, but the `files` array omits `scripts/`, so an `npm publish` would not include the bash scripts. This bites only registry-publish distribution (git-clone / `npm link` already expose the whole repo); the new verification scripts must still ship in published installs. | Leaving it unfixed rejected — published installs would silently lack FR-003/006/010. One-line fix, tightly scoped. If the project distributes only via clone/link, the fix remains correct and harmless. |
| **`update.ts` upserts the CLAUDE.md managed section** (beyond `init.ts`) | FR-007 must reach *existing* projects, not only fresh `init`s. Without an update path, the SDD STATE pointer never lands for projects initialized before this feature. | Documenting "re-run `init`" rejected as fragile (re-init can clobber user CLAUDE.md edits outside the managed markers). A marker-bounded upsert in `update.ts` — mirroring spec-kit's `agent-context` pattern — reaches existing projects safely. |
