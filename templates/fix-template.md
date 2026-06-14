# Fix: [BUG TITLE]

**Bug**: [One-line description of the defect]

**Spec**: `specs/<feature>/spec.md` — [updated / unchanged]

**Date**: [DATE] | **Status**: [Fixed / Escalated]

**Classification**: [Spec omission / Implementation deviation]

## Root Cause

<!--
  ACTION REQUIRED: Describe the root cause — not the symptom.
  Trace from the visible bug back to the original mistake.
  Include enough context that someone reading this 3 months later
  understands why the bug existed.
-->

[Root cause analysis with trace from symptom → origin]

## Similar Issues Found (Horizontal Scan)

<!--
  Only include if horizontal scan was performed and user approved.
  If skipped, write "Not performed."
-->

| File | Match Type | Issue | Fixed? |
|------|-----------|-------|--------|
| `path/to/file.ts:45` | 🔴 Confirmed | [Description] | ✅ / ❌ (deferred) |
| `path/to/other.ts:102` | 🟡 Potential | [Description] | ❌ (needs investigation) |
| `path/to/safe.ts:7` | ⚪ Clear | [Why it's safe] | — |

## Spec Change

<!-- Only if spec was updated. Otherwise write "No spec change required." -->

- [ ] **Added FR-0XX**: [Requirement description]
- [ ] **Added Edge Case**: [Edge case description]
- [ ] **Clarified**: [What was ambiguous and how it was resolved]

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `path/to/file.ts:45-50` | [What changed] | [Why] |

## Regression Test

**Test location**: `path/to/test.ts` — `testName()`

**What it verifies**: [The exact condition that this bug exposed, now locked in as a test]

## Notes

<!-- Any additional context, deferred issues, or follow-up actions -->
