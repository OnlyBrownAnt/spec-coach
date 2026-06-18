# Fix: plain uninstall leaves an empty `.spec/` orphan

**Bug**: Plain `uninstall --yes` removes every `.spec/` child (scripts, templates, `agents.json`, the constitution) but leaves the now-empty `.spec/` directory itself behind.

**Spec**: `specs/007-resource-ownership/spec.md` — unchanged (constitution v1.3.0 + FR-005 already specified the intent; this was an implementation gap).

**Date**: 2026-06-18 | **Status**: Fixed

**Classification**: Implementation deviation

## Root Cause

`pruneIfEmpty(path.join(projectRoot, ".spec"))` lived **only** inside the `if (opts.purge)` branch of `runUninstall`. Plain uninstall removed the `INFRA_PATHS` children but never pruned the parent.

This was *correct* before spec 007: plain uninstall preserved `.spec/memory` (the constitution) + `.spec/absorbed/` (`USER_PATHS`), so `.spec/` was non-empty after a plain uninstall — it legitimately held preserved user content and must not be pruned. Spec 007 then (a) moved the constitution to regenerable tooling (removed on plain uninstall) and (b) dropped `.spec/absorbed` from `USER_PATHS`. After 007, plain uninstall empties `.spec/` entirely — but the prune was never moved to the plain branch, leaving an empty-shell orphan. The fix completes 007's own stated principle ("uninstall = inverse of init").

```
Symptom: empty .spec/ left after plain uninstall
  ↓ why?
pruneIfEmpty(.spec) only in the purge branch
  ↓ why?
007 emptied .spec/ on plain uninstall (constitution→tooling) but didn't move the prune   ← ROOT CAUSE
```

## Similar Issues Found (Horizontal Scan)

Pattern searched: `pruneIfEmpty` / "remove dir children, leave empty parent".

| File | Match Type | Issue | Fixed? |
|------|-----------|-------|--------|
| `src/commands/uninstall.ts:60` | 🔴 Confirmed | The bug (only prune site for `.spec/`) | ✅ |
| `src/commands/agents.ts:146` | ⚪ Clear | `rmdirSync` in precise-deletion prunes empty *agent skill* parent dirs — a different concern; precise-deletion suite (42 assertions) is green. Not a sibling. | — |

Single-site fix; no siblings.

## Spec Change

No spec change required. The constitution v1.3.0 (amended in 007) states "uninstall removes *every* `.spec/` artifact init creates," and spec 007 FR-005 states "every other `.spec/` artifact… removed on plain uninstall." Both already specify the intent; the code partially implemented it. Classification = implementation deviation.

## Files Changed

| File | Change | Rationale |
|------|--------|-----------|
| `src/commands/uninstall.ts` | Moved `pruneIfEmpty(.spec)` out of the purge-only branch to run after both plain-infra and purge-user removal | Prune an emptied `.spec/` on plain uninstall too (was purge-only) |
| `tests/units/corpus-uninstall.test.ts` | +`plain uninstall prunes an emptied .spec/`; +`.spec/ preserved when it holds non-infra content` | Regression test (RED→GREEN) + safety guard |

## Regression Test

**Test location**: `tests/units/corpus-uninstall.test.ts` — `plain uninstall prunes an emptied .spec/` (+ `.spec/ preserved when it holds non-infra content` guard).

**What it verifies**: After a confirmed plain uninstall, an emptied `.spec/` is gone (pruned); a `.spec/` holding non-infra content (`.spec/feature.json`) is preserved. Locks the inverse-of-init prune + the empty-only safety.

## Notes

- Versioned **PATCH 2.2.1** (bug fix; no install-contract change, no constitution amendment).
- `.spec/feature.json` (SDD workflow state, per `CLAUDE.md`) is not in any removal list — if it exists it keeps `.spec/` alive (non-empty). That is consistent (it is not spec-coach-installed infra); a separate decision could add it to the infra set, but that is out of scope for this fix.
