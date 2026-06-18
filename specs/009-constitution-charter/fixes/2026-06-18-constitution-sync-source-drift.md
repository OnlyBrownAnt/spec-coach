# Fix: constitution status detection never shipped (source drift)

**Bug**: spec 009's constitution status detection (`TEMPLATE`/`AUTHORED`/`ABSENT`) was added to the INSTALLED `.spec/scripts/bash/verify-constitution-sync.sh` but NOT the SOURCE `scripts/bash/verify-constitution-sync.sh` — so `init`/`update` (which copy source → installed) shipped a copy WITHOUT the detection. The feature never reached new users.

**Spec**: `specs/009-constitution-charter/spec.md` — unchanged (FR-002 was correct; this is an implementation deviation, not a spec gap).

**Date**: 2026-06-18 | **Status**: Fixed

**Classification**: Implementation deviation

## Root Cause

spec 009's T002 added the `TEMPLATE`/`AUTHORED`/`ABSENT` status detection (and the zero-principle count fix) by editing the INSTALLED copy `.spec/scripts/bash/verify-constitution-sync.sh` directly. It never edited the SOURCE `scripts/bash/verify-constitution-sync.sh`.

`installScripts` (`src/utils.ts:293`) copies `PACKAGE_ROOT/scripts/bash/*.sh` → the project's `.spec/scripts/bash/`. **The source is what ships.** Because the source lacked the detection, any new project running `init` got an advisor that could not report constitution status — so `/spec-constitution`'s amend-vs-cold-start branch (US1) and the `TEMPLATE`/`AUTHORED`/`ABSENT` reporting (FR-002) were silently absent for everyone except the spec-coach dev repo.

The bug was masked because `tests/units/constitution-charter.test.ts` pointed `ADVISOR` at the INSTALLED path (`.spec/scripts/bash/verify-constitution-sync.sh`), which DID have the detection — so the suite stayed green and gave false confidence. **Lesson (Principle V — verify what ships): the regression test now asserts the SOURCE carries the detection, not just the installed copy, plus a class guard that every `scripts/bash/*.sh` source equals its installed copy.**

## Similar Issues Found (Horizontal Scan)

Scanned all `scripts/bash/*.sh` source vs installed (the same drift pattern: a change landed in only one of the pair).

| File | Match Type | Issue | Fixed? |
|------|-----------|-------|--------|
| `scripts/bash/verify-constitution-sync.sh` | 🔴 Confirmed | Source missing spec-009 status detection + count fix | ✅ |
| `scripts/bash/{check-prerequisites,common,create-new-feature,setup-plan,setup-tasks,show-sdd-state,verify-spec}.sh` | ⚪ Clear | source == installed (7 of 8 scripts match) | — |

Only one script drifted. No other instances.

## Spec Change

No spec change required. (spec 009 FR-002 already required the advisor to report status; the implementation simply missed the source file.)

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `scripts/bash/verify-constitution-sync.sh` | Ported spec-009 status detection (`TEMPLATE`/`AUTHORED` + `ABSENT` branch) + the zero-principle count fix from the installed copy; source now == installed | The source is what `installScripts` ships; it must carry the feature |
| `tests/units/constitution-charter.test.ts` | Added regression block: SOURCE carries the detection + every `scripts/bash/*.sh` source == installed | Lock the fix and guard the whole drift class |

## Regression Test

**Test location**: `tests/units/constitution-charter.test.ts` — "SOURCE verify-constitution-sync.sh ships TEMPLATE/AUTHORED detection", "…ships the ABSENT branch", "…zero-principle count fix", and `source==installed: <name>` for every script.

**What it verifies**: the SOURCE advisor carries the spec-009 detection (so it ships), and no `scripts/bash/*.sh` can drift from its installed copy again.

## Notes

- Versioned **PATCH 2.4.0 → 2.4.1** (a fix; install file structure unchanged — `update` not broken). Distinct from the unmerged spec-010 branch (2.5.0); merge order resolves cleanly (2.4.1 < 2.5.0).
- The dev-repo installed copy already had the detection (tests passed against it), which is exactly why this slipped through — the suite tested the installed artifact, not the shipped source.
