# Implementation Plan: Constitution as Charter

**Branch**: `009-constitution-charter` | **Date**: 2026-06-18 | **Spec**: `specs/009-constitution-charter/spec.md`

**Input**: Feature specification from `specs/009-constitution-charter/spec.md` (approved). Path 1: behavioral improvements + dogfood re-author, MINOR 2.3.0 → 2.4.0. Root-level move (scope B / MAJOR) deferred to a potential spec 010.

## Summary

Raise the project constitution from "disposable/regenerable tooling" (spec 007's classification) to a `CLAUDE.md`-tier charter: **amend-don't-overwrite, seed-don't-generate, preserve-don't-delete.** Five concrete changes: (1) the `/spec-constitution` skill gains an amend-guard and a seeded cold-start branch keyed on a derived TEMPLATE/AUTHORED/ABSENT status, plus constitution-doc semver and an exhaustive propagation checklist; (2) the existing non-blocking advisor `verify-constitution-sync.sh` is extended to report that status (the discriminator the skill branches on); (3) `uninstall` becomes status-aware — it preserves an AUTHORED constitution as project IP and removes only a never-authored TEMPLATE (joining `specs/` on the preserve tier); (4) the already-true never-clobber invariant (init guards, update never touches the constitution) is codified and locked with regression tests; (5) spec-coach's own live constitution is re-authored via the improved tool as the closing dogfood, natively codifying the charter-as-IP principle and the corrected uninstall clause. No new production dependency; net new code is a small bash extension + a small TS status check + tests.

## Technical Context

**Language/Version**: Bash (the advisor `verify-constitution-sync.sh`) + TypeScript/tsx (the corpus-lifecycle code `src/commands/uninstall.ts`, and the tests). The skill itself is markdown (`skills/constitution.md`) — the product, not code (Constitution I).

**Primary Dependencies**: None added (Constitution III). The advisor reuses the existing `grep`/`sed` tooling already in `verify-constitution-sync.sh`; resolution reuses `get_repo_root` from `common.sh`. Tests use Node's `node:child_process` (`execSync`) + `node:assert` — no new test dependency.

**Storage**: Filesystem only. Constitution status (TEMPLATE/AUTHORED/ABSENT) is **derived read-only** from the file's contents (presence + signature-placeholder detection) — never stored. This mirrors spec 008's derived-state model and adds no state file.

**Testing**: New `tests/units/constitution-charter.test.ts` (`node:assert/strict`). The advisor and uninstall/status behavior are driven headlessly: bash pieces via `execSync` in a `mkdtemp` repo (the pattern proven by `tests/units/workflow-state.test.ts`); TS pieces (`uninstall`, never-clobber) via direct function calls in `mkdtemp`. Skill-prose deliverables (amend-guard, seeding, semver, propagation) are verified by **content-assertion** — the test reads the shipped source skill and asserts the required guidance substrings are present (Constitution V: verify what ships — installed skill integrity, not AI-behavior simulation). `npm test` is AI-driven/non-headless and is NOT the gate (project memory); the gate is `npx tsx tests/units/*.test.ts` + `npx tsx src/cli.ts` smokes.

**Target Platform**: macOS/Linux (Bash) + Node (tsx). The advisor degrades gracefully (status ABSENT) when the file is missing.

**Project Type**: CLI dogfooding itself — changes are to spec-coach's own skill, scripts, corpus-lifecycle code, tests, version, and live constitution.

**Performance Goals**: N/A — read-only status detection is one `grep` for signature tokens + one `grep` for `### ` headings.

**Constraints**: Zero production dependencies (Constitution III); the advisor is non-blocking (always exits 0, advises never gates — Constitution II); constitution status is derived, never stored (spec 008 precedent); the authored constitution is preserved across `init`/`update`/plain-`uninstall` (FR-006/FR-007).

**Scale/Scope**: 1 bash script extended, 1 skill source edited (+ its installed copy regenerated), 1 TS file edited (uninstall, status-aware), the never-clobber invariant codified (comment + tests, ~no logic), 1 new test file, version bump + changelog, and the live-constitution re-author (content). ~5 code/doc files + 1 test + content. Small MINOR.

## Constitution Check

Checked against spec-coach's real principles (v1.4.0; the live file is the template post-reset, so the principle set is read from git history — `HEAD~1:.spec/memory/constitution.md`). spec 009 is **principle-aligned, not in tension**: **I (Markdown Is the Product)** — the core deliverable is markdown-coaching (the skill gains amend/seeding/semver/propagation guidance); the bash advisor is read-only distribution plumbing, not a coaching gate, so "code only when markdown cannot" holds. **II (Coach, Not Gatekeeper)** — this is the heart of the feature: the amend-guard and the status advisor are non-blocking (they report status and branch, never refuse); seeded cold-start *proposes* candidates for human ratification, never auto-inserts. **III (Zero Dependencies)** — no dependency added; net code is tiny. **IV (Precision in Templates)** — the TEMPLATE/AUTHORED/ABSENT discriminator keys on a precise, documented signature-token set (the template's footer + principle placeholders), and the semver rules are explicit (MAJOR/MINOR/PATCH). **V (Verify What Ships)** — tests verify the *installed* skill content and the *shipped* script/CLI behavior end-to-end (content assertions + execSync/mktmp), not a reimplementation. **One principled evolution, not a violation**: spec 007's iron rule classified the constitution as "regenerable tooling, removed on uninstall." spec 009 refines this — the constitution crosses tooling→IP once authored, so an AUTHORED constitution is preserved like `specs/`/`CLAUDE.md`. This is a documented governance amendment (the re-authored charter codifies it), not a silent violation, and it does not change the install file-structure contract (→ MINOR, not MAJOR). No deviations require Complexity-Tracking justification beyond the three items below.

## Project Structure

### Documentation (this feature)

```text
specs/009-constitution-charter/
├── spec.md      # approved specification
├── plan.md      # this file
└── tasks.md     # (/spec-tasks output — not created by this plan)
```

### Source Code (repository root)

```text
.spec/scripts/bash/
└── verify-constitution-sync.sh   # +TEMPLATE/AUTHORED/ABSENT status (signature-token detection)

skills/
└── constitution.md               # source: +status-branch preamble (amend-guard, seeded
                                  #  cold-start), +constitution semver, +exhaustive propagation

.claude/skills/spec-constitution/
└── SKILL.md                      # installed copy (now tracked post-reset): regenerated from
                                  #  skills/constitution.md to stay in sync (frontmatter added by install)

src/commands/
└── uninstall.ts                  # status-aware: preserve AUTHORED .spec/memory/, remove TEMPLATE

src/
└── utils.ts                      # (codify only) never-clobber invariant comment on
                                  #  installConstitutionToMemory; no logic change

specs/009-constitution-charter/   # (no code)
└── ...

.spec/memory/
└── constitution.md               # RE-AUTHORED (FR-008 dogfood): template → authored charter
                                  #  with charter-as-IP clause + corrected uninstall clause

tests/units/
└── constitution-charter.test.ts  # NEW — advisor detection + uninstall preserve/remove +
                                  #  never-clobber + skill-content assertions

package.json                      # 2.3.0 → 2.4.0
CHANGELOG.md                      # 2.4.0 entry
```

**Structure Decision**: Single-project (the repo is spec-coach itself). All changes are to existing files plus one new test file and the re-authored constitution. No new directory, no new package. The `.claude/skills/.../SKILL.md` entry is the installed copy of the skill source (tracked since the reset) and is regenerated from `skills/constitution.md` rather than hand-edited, preserving the source→installed derivation.

### Component & File Mapping (FR → component → file)

| Component | What it does | Files | FRs |
|-----------|--------------|-------|-----|
| **C1 status advisor** | Extend `verify-constitution-sync.sh` to report constitution status: scan for the template's **signature tokens** (`[CONSTITUTION_VERSION]`, `[RATIFICATION_DATE]`, `[LAST_AMENDED_DATE]`, `[PROJECT_NAME]`, `[PRINCIPLE_1_NAME]`) → `TEMPLATE` (≥1 token present); else (no tokens) → `AUTHORED` (report the principle count alongside, which MAY be 0 — an authored shell is still AUTHORED, per the spec edge case); file missing → `ABSENT` (already reported as "not found"). Status line printed alongside the existing principle/Sync-Report output. Non-blocking (exit 0), additive (no existing output removed). | `.spec/scripts/bash/verify-constitution-sync.sh` (edit) | FR-002 |
| **C2 skill: amend-guard + seeded cold-start + semver + propagation** | Edit the source skill to (a) add a "Constitution state" preamble: run the advisor to get status, then **branch** — `AUTHORED` → amend path (anchor to existing principles; never rewrite a settled principle unless it is the explicit amendment target); `TEMPLATE`/`ABSENT` → cold-start path; (b) cold-start reads concrete repo signals (`package.json` name+deps, the primary source/skills dir, `README.md`, existing `specs/`) and **proposes** candidate principles + the two flexible sections for human ratification — nothing written until approved; (c) add constitution-doc **semver** rules (MAJOR = principle removed/redefined/renamed; MINOR = principle/section added or materially expanded; PATCH = wording) applied to the footer on amendment, with stated rationale; (d) expand the propagation checklist (step 4) to `spec-template.md`, `plan-template.md`, `tasks-template.md`, and every installed skill embedding principle wording (not only `plan-template.md`). Then **regenerate** the installed `.claude/skills/spec-constitution/SKILL.md` from the edited source so the tracked installed copy stays in sync. | `skills/constitution.md` (edit) + `.claude/skills/spec-constitution/SKILL.md` (regenerate) | FR-001, FR-003, FR-004, FR-005 |
| **C3 status-aware uninstall** | In `uninstall.ts`: remove `.spec/memory` from `INFRA_PATHS`. After the infra-removal loop, check `.spec/memory/constitution.md`: if AUTHORED (no signature tokens) → **preserve** `.spec/memory` (project IP); if TEMPLATE or absent → remove `.spec/memory` (tooling, never crossed to IP). A small `isAuthoredConstitution(path)` TS helper detects signature tokens (the same token set as C1 — minor, documented duplication, since TS cannot cleanly `source` the bash script). `pruneIfEmpty(.spec)` already handles the remainder: preserving `.spec/memory` leaves `.spec/` non-empty (charter survives in a shell, like `CLAUDE.md`); removing it lets `.spec/` prune. | `src/commands/uninstall.ts` (edit) | FR-006 |
| **C4 never-clobber invariant (codify + lock)** | Confirmed already-true: `installConstitutionToMemory` (src/utils.ts:272) has `if (fs.existsSync(constDest)) return false; // never overwrite` and is called only from `init.ts:105`; `update.ts` explicitly "Never modifies user artifacts (specs/, constitution, etc.)". Action: (a) add a one-line invariant comment to `installConstitutionToMemory`; (b) add regression tests (init over authored → preserved; the guard holds). No logic change — this locks the existing behavior as the invariant FR-007 names. | `src/utils.ts` (comment only) + `tests/units/constitution-charter.test.ts` (tests) | FR-007 |
| **C5 tests** | New `tests/units/constitution-charter.test.ts`: (a) advisor TEMPLATE/AUTHORED/ABSENT detection via `execSync` in `mkdtemp` (write a template, an authored file, assert status lines); (b) uninstall: AUTHORED `.spec/memory` preserved on plain uninstall, TEMPLATE removed, both removed on `--force` (TS in `mkdtemp`); (c) never-clobber: `init` over an authored constitution preserves it; (d) skill-content assertions: read `skills/constitution.md`, assert the amend-guard, seeded-cold-start, semver, and propagation guidance are present. Headless; `node:assert`. | `tests/units/constitution-charter.test.ts` (add) | SC-001…SC-006 |
| **C6 dogfood re-author** | Run the improved `/spec-constitution` cold-start on THIS repo to author `.spec/memory/constitution.md` (currently the template). Content task (judgment about spec-coach's principles), NOT TDD. Produces an AUTHORED charter: the 5 standing principles (I–V) + the charter-as-IP clause + the corrected uninstall clause (preserve on plain uninstall, remove only on `--force`), superseding spec 007's "regenerable tooling" classification; footer version per C2 semver (continuing the v1.4.0 lineage). Verify with the advisor (reports AUTHORED) and a content assertion (the two clauses present). | `.spec/memory/constitution.md` (re-author) | FR-008, SC-006 |
| **C7 version + changelog** | `package.json` 2.3.0 → 2.4.0; `CHANGELOG.md` 2.4.0 entry (constitution-as-charter: amend-guard, seeded cold-start, status advisor, preserve-on-uninstall, never-clobber codified, dogfood re-author). | `package.json`, `CHANGELOG.md` (edit) | (release hygiene; supports all FRs) |

**Coverage check** — every FR maps to ≥1 component: FR-001/003/004/005→C2, FR-002→C1, FR-006→C3, FR-007→C4, FR-008→C6. SC-001 (amend path)→C2+C5, SC-002 (seeding)→C2+C5, SC-003 (uninstall)→C3+C5, SC-004 (semver)→C2+C5, SC-005 (never-clobber)→C4+C5, SC-006 (re-author)→C6+C5. No orphan components; no orphan FRs.

**File-safety / edit order** (drives task sequencing): advisor status (C1) first — the skill branches on its output; then the source skill (C2) references the advisor; regenerate the installed skill copy (C2) from the edited source; status-aware uninstall (C3) reuses the same signature-token set; never-clobber codify+tests (C4) independent; tests (C5) written RED-first alongside C1/C3/C4 (behavior) and as content-assertions alongside C2; dogfood re-author (C6) LAST (the improved skill must exist first); version/changelog (C7) final.

## Complexity Tracking

| Item | Why needed / status | Simpler alternative rejected because |
|------|---------------------|--------------------------------------|
| **Testing the bash advisor + skill-prose from a TS/node:assert harness** | The advisor is Bash and the skill is markdown; there is no TS function to assert directly. Invoking the shipped advisor via `execSync` in a `mkdtemp` repo and asserting `stdout` is the only way to verify the *installed artifact's* behavior headlessly (Constitution V); skill-content assertions (read the source, assert guidance substrings) verify the shipped coaching prose without simulating AI behavior. Both patterns are already established (`workflow-state.test.ts`). | A pure-TS reimplementation of the detector was rejected — it would duplicate the Bash logic and test a copy, not the shipped code. |
| **Status-aware uninstall duplicates the signature-token set in TS** | `uninstall.ts` (TS) must decide preserve-vs-remove from the constitution's status but cannot cleanly `source` the bash advisor. The detector is a ~5-token `includes()` check. Duplication is minor and cross-referenced by comment. | Shelling out from TS uninstall to the bash advisor was rejected — it couples the corpus-lifecycle TS path to a bash script's output format and adds a process spawn for a trivial check. |
| **FR-008 re-author is a content (judgment) task, not TDD** | Authoring spec-coach's own charter is human/AI judgment about which principles matter — not testable behavior. It is the closing dogfood: it proves the improved cold-start works end-to-end and removes the code/charter drift. Verified by content assertion + the advisor reporting AUTHORED, not RED-first. This matches the precedent of constitution-amendment tasks in prior specs (e.g., spec 008 T012). | Forcing it through TDD was rejected — there is no "behavior to break"; the acceptance is "an authored, clause-consistent charter exists." |
| **`.claude/skills/.../SKILL.md` is now tracked (post-reset) and must be regenerated, not hand-edited** | The reset opened tracking on `.claude/`, so both the source (`skills/constitution.md`) and the installed copy are in git. The installed copy is *derived* (install adds frontmatter); editing the source and regenerating preserves that derivation and keeps the two in sync. | Hand-editing both copies was rejected — it breaks the source→installed derivation and invites drift. Reverting `.claude/` to gitignored is out of scope for spec 009 (it is a separate repo-hygiene decision the user owns). |
