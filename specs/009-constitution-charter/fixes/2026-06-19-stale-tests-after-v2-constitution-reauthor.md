# Fix: Dogfood unit tests pinned v1.6.0 after the v2.0.0 constitution re-author

**Bug**: Two deterministic unit tests (`constitution-charter.test.ts`, `commit-convention.test.ts`) failed 6 assertions because they still pinned the pre-v2.0.0 constitution state.

**Spec**: `specs/009-constitution-charter/spec.md` — unchanged (the artifact was correct; the *tests* had drifted).

**Date**: 2026-06-19 | **Status**: Fixed

**Classification**: Implementation deviation (in the tests)

## Root Cause

Commit `a6c82d5 docs: re-author constitution v2.0.0 + reset governance templates`
ran a `--reset` cold-start of the constitution via `/spec-constitution`:

- Constitution bumped **v1.6.0 → 2.0.0** (MAJOR): added Principle VI
  "Read-Only on User Documents", renamed IV to "Templates Are the Contract",
  reorganized Development Constraints + Release & Verification Workflow.
- `.spec/convention.md` reset **AUTHORED v1.0.0 → TEMPLATE** ("re-author pending").

The re-author was intentional and correctly propagated to the live artifacts.
The dogfood unit-test assertions, however, were NOT updated in that commit and
kept asserting v1.6.0 specifics:

| Stale assertion (v1.6.0) | v2.0.0 reality |
|---|---|
| `constitution footer is v1.6.0` | footer is `2.0.0` |
| `advisor reports 5 principles` | advisor reports `Principles (6)` |
| `convention.md is AUTHORED (no signature tokens)` | intentionally reset to TEMPLATE |
| `charter-as-IP clause: "amended never overwritten"` | subsumed by Principle VI |
| `uninstall clause: "PRESERVES an AUTHORED constitution"` | subsumed by Principle VI |

Trace: failing assertion ← test pinned v1.6.0 string ← commit a6c82d5 changed the
artifact without updating the dogfood tests ← **ROOT CAUSE: test/artifact drift
after an intentional re-author.**

The invariant the two absent clauses encoded (authored content is never
silently overwritten / preserved on uninstall) is **stronger** in v2.0.0 as
top-level Principle VI ("spec-coach is a guest in the user's repository …
Append-only is the floor of that trust") and is still locked functionally by
the T005 (uninstall preservation) and T007 (never-clobber) checks in the same
file. The value was preserved; only the pinned wording changed.

## Similar Issues Found (Horizontal Scan)

Implicitly performed by running the full `tests/units/` suite (19 pass → 21
pass after fix). No other test files pinned v1.6.0 state; the 6 failures were
all contained in the two T006 dogfood blocks fixed below.

| File | Match Type | Issue | Fixed? |
|------|-----------|-------|--------|
| `tests/units/constitution-charter.test.ts` (T006) | 🔴 Confirmed | 4 stale v1.6.0 assertions | ✅ |
| `tests/units/commit-convention.test.ts` (T006) | 🔴 Confirmed | 2 stale v1.6.0 assertions | ✅ |

## Spec Change

No spec change required. The constitution (v2.0.0) and the spec-009 feature
spec are correct; only the tests had drifted.

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `tests/units/constitution-charter.test.ts:211` | `Principles (5)` → `Principles (6)` | Principle VI added in v2.0.0 |
| `tests/units/constitution-charter.test.ts:213-214` | Two superseded clause checks → single Principle VI "Read-Only on User Documents" check | Clauses subsumed by Principle VI; behavior still locked by T005/T007 |
| `tests/units/constitution-charter.test.ts:216` | footer `1.6.0` → `2.0.0` | Version bump |
| `tests/units/commit-convention.test.ts:250-251` | convention.md `AUTHORED` (negated regex) → `TEMPLATE` (positive regex) | Intentionally reset to TEMPLATE in v2.0.0, re-author pending |
| `tests/units/commit-convention.test.ts:258` | footer `1.6.0` → `2.0.0` | Version bump |

## Regression Test

**Test location**: `tests/units/constitution-charter.test.ts` + `tests/units/commit-convention.test.ts` — T006 dogfood blocks.

**What it verifies**: The dogfood suite now pins the *current* v2.0.0 charter
state (6 principles, `2.0.0` footer, TEMPLATE convention, Principle VI). If the
constitution is re-authored again without updating these tests, they fail —
locking test/artifact sync going forward.

## Notes

- **Verification**: `tests/units/` → **21/21 PASS** (was 19/21). Run via
  `npx tsx tests/units/*.test.ts`.
- **Separate finding (NOT fixed here)**: the originally-reported 3 failures from
  `./run.sh all` (`test-plan`, `test-analyze-catches-bugs`,
  `test-implement-adversarial`) are **AI-driven flakiness, not defects**.
  Identical `claude -p` prompts swap pass/hang within minutes; the skills
  produce correct output (verified). Root cause is harness brittleness:
  hardcoded tight per-test timeouts (60/120/180s), a non-functional
  `--timeout N` knob (`run.sh` never passes `$TIMEOUT` into the `run_claude`
  calls despite the README advertising a 300s default), and output loss on
  `_timeout`'s SIGALRM kill. This matches the existing memory note that the
  AI suite is unreliable and `tests/units/` is the real gate. A spec-driven
  harness-hardening (configurable timeouts + retry + output preservation)
  would be a separate `/spec-specify` effort if desired; per the >3-files /
  pattern-defect rule it should not be an ad-hoc patch.
- When `.spec/convention.md` is re-authored (currently TEMPLATE, "re-author
  pending"), the `commit-convention.test.ts:250` assertion must flip back to
  AUTHORED.
