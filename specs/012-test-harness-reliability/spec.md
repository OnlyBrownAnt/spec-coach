# Feature Specification: Test Harness Reliability

**Feature Branch**: `012-test-harness-reliability`

**Created**: 2026-06-19

**Status**: Implemented

**Input**: User description: "Make the AI-driven test harness (`tests/run.sh` / `tests/test-helpers.sh`) reliable. Today it is both flaky AND cannot bound its own runtime, because of three compounding defects: (1) orphan-leak — `_timeout`'s perl `alarm` fallback SIGALRMs only the `bash` wrapper, not its child `claude -p`, so an orphaned claude holds the output pipe open (observed: a 60s-timeout test hung 1144s); (2) the `--timeout N` flag is parsed but never propagated into the per-test `run_claude` calls (hardcoded 60/120/180s); (3) a timeout-kill discards captured output (0 bytes → spurious failure) and budgets are too tight for AI latency variance. Goal: a timeout that terminates the whole claude process tree and bounds wall-clock; a functional propagated per-test timeout; and no spurious failures from slow-but-correct runs — dependency-free (Constitution Principle III)."

## User Scenarios & Testing *(mandatory)*

### User Story 1 - A hung claude is killed at the timeout, not 19 minutes later (Priority: P1)

As a maintainer running `run.sh all`, when a `claude -p` invocation hangs or runs far past its budget, the test fails at its configured timeout — not many minutes later — because the timeout terminates the **entire** claude process tree (the wrapper, claude, and every descendant it spawned). The suite's wall-clock is bounded by the timeouts, not by however long claude decides to live.

**Why this priority**: This is the root cause that makes the suite unusable today. A 60s-timeout test hanging 1144s (and `run.sh all` taking 30+ min) is the worst symptom; without killing the tree, nothing else matters.

**Independent Test**: Point the timeout helper at a command that spawns a long-lived child (e.g. `sleep 600 &` then a parent that waits) with a short budget; assert the helper returns within budget + grace, and that no `sleep`/child process remains alive afterward. Delivers value on its own even before the `--timeout` plumbing is fixed.

**Acceptance Scenarios**:

1. **Given** the timeout helper wrapping a command that spawns descendant processes, **When** the budget elapses, **Then** the helper returns within `budget + grace-period + 5s` AND no descendant of the wrapped command is still alive.
2. **Given** a `claude -p` invocation that would run indefinitely, **When** a test with a 60s budget runs it, **Then** the test completes in well under two minutes (not 1144s) and leaves no orphaned `claude` process.
3. **Given** the wrapped command ignores the graceful termination signal, **When** the grace period elapses, **Then** the helper escalates to a forceful kill so control still returns on schedule.

---

### User Story 2 - The `--timeout` flag actually controls per-test budgets (Priority: P2)

As a maintainer, `run.sh all --timeout 600` makes every test use a 600s budget, overriding the hardcoded 60/120/180s defaults — matching what the README already advertises ("Default: 300s per test", "L2 tests may need --timeout 600"). The flag stops being dead code.

**Why this priority**: The advertised knob is non-functional today, but the suite can still bound runtime once US1 is fixed (via the per-test defaults). Giving the operator real control is the next most valuable fix.

**Independent Test**: Run a single test with `--timeout N` set above its old hardcoded default and an invocation that takes longer than the old default but less than N; assert the test passes (the new budget was respected and propagated).

**Acceptance Scenarios**:

1. **Given** `run.sh` invoked with `--timeout 600`, **When** any test runs, **Then** its `run_claude`/`run_claude_l2` budget equals 600 (overriding the file's default).
2. **Given** `run.sh` invoked without `--timeout`, **When** a test runs, **Then** it uses a sane per-test default appropriate to its category (matching the README's documented defaults), not the legacy 60/120/180s hardcodes.

---

### User Story 3 - A slow-but-correct run is not a spurious failure (Priority: P3)

As a maintainer, a `claude` call that responds just past the budget (producing correct output) does not register as a hard failure: the harness preserves whatever output was captured before the kill and optionally retries the invocation a bounded number of times before declaring failure. Failures no longer come back with zero bytes of output.

**Why this priority**: This removes the run-to-run rotating failures caused by AI latency variance, but it is layered on top of US1/US2; without bounded timeouts, retry would compound the hang problem.

**Independent Test**: Drive `run_claude` against a command that succeeds on its second attempt (first attempt exceeds the budget, second finishes in time); assert the helper ultimately returns the captured output and the test passes.

**Acceptance Scenarios**:

1. **Given** a `claude` invocation that exceeds the budget but would produce correct output, **When** the timeout fires, **Then** any partial output already streamed is preserved (not zero bytes) and the harness retries up to its bounded retry count.
2. **Given** all retry attempts are exhausted, **When** the helper gives up, **Then** it declares failure WITH the last captured output preserved for diagnosis.
3. **Given** a `claude` invocation that returns empty output on its own (a genuine empty result, not a timeout), **When** the helper assesses it, **Then** it is NOT treated as a timeout (the two conditions are distinguished).

---

### Edge Cases

- What happens when `claude` spawns sub-agents or tool subprocesses (the heavy skills like spec-implement)? They are descendants in the process group, so the group kill must reap all of them — this is exactly the case that leaked before.
- What happens when SIGTERM does not kill a descendant within the grace period? The helper MUST escalate to SIGKILL so the test still returns on schedule.
- What happens when the timeout fires while `claude` is mid-write to the captured output? The partial output up to that point MUST survive (stream-then-kill, not capture-only-at-end).
- What happens when `--timeout N` is set smaller than a test genuinely needs? The test fails fast at budget N (it must NOT hang) and reports clearly; the operator raises N.
- What happens when native `timeout`/`gtimeout` IS present (Linux CI)? The group-kill path is still used, because native `timeout` only signals its direct child and can also leak grandchildren — presence of those tools is not relied upon.
- What happens when `claude` exits 0 but produced genuinely empty output? That is a normal (assertion) outcome, NOT a timeout — the two must not be conflated.
- What happens under `output=$(run_claude ...)` command substitution and nested `bash -c` layers? The group kill MUST function there (that is the real call shape).
- What happens on macOS bash 3.2 with no `setsid`? The mechanism MUST work without `setsid` and without bash 4+ features.

## Requirements *(mandatory)*

### Functional Requirements

- **FR-001**: The timeout helper MUST terminate the entire process tree of the command it wraps — the wrapper, the direct child (e.g. `claude`), and every descendant — so no orphaned descendant can outlive the timeout.
- **FR-002**: When the budget elapses, the helper MUST send a graceful termination signal (SIGTERM) to the whole process group first, then escalate to a forceful kill (SIGKILL) after a **10-second grace period** if any process in the group remains. The grace period MUST be configurable.
- **FR-003**: A timed-out test MUST return control to the runner within `budget + grace-period + small margin` **per attempt**, regardless of how long the wrapped `claude` would otherwise run. The overall test wall-clock is bounded by `(attempts × (budget + grace + margin))` — never the unbounded "however long claude lives" of today.
- **FR-004**: After a timeout-kill completes, zero descendants of the wrapped command (e.g. no `claude`, no spawned sub-processes) MUST remain alive on the system.
- **FR-005**: `run.sh --timeout N` MUST propagate `N` as the per-test budget into every `run_claude`/`run_claude_l2` call, overriding the per-test defaults.
- **FR-006**: The default per-test budget MUST be **300s for L1 (behavioral)** and **600s for L2 (integration)** — matching the two values `tests/README.md` already documents ("300s per test" default; "L2 tests may need --timeout 600") — replacing the legacy 60/120/180s hardcodes. Every default is ≥ 300s, giving generous margin over observed latencies (L1 ~16–45s, L2 ~85–111s).
- **FR-007**: On a timeout-kill, the helper MUST preserve any output the wrapped command produced before being killed (streamed to the capture target), so a killed run never yields zero bytes.
- **FR-008**: By default the harness MUST retry a timed-out invocation up to **2 total attempts (1 retry)**, for both L1 and L2 tests, but ONLY when the timeout produced empty (or near-empty) output — a suspected cold-start/latency spike — NOT when the run already produced meaningful partial output (that indicates a genuinely slow productive run, which should not be retried). The retry count MUST be configurable (e.g. `--retry N`), including `0` to disable.
- **FR-009**: The timeout/kill mechanism MUST be dependency-free (no `coreutils`/`gtimeout` requirement) per Constitution Principle III, and MUST work on macOS (bash 3.2, no `setsid`) and on Linux.

### Key Entities *(include if feature involves data)*

This feature changes harness behavior, not a data model — no key entities.

## Success Criteria *(mandatory)*

### Measurable Outcomes

- **SC-001**: A test whose `claude` invocation would hang indefinitely completes within `budget + grace + 5s` (e.g. a 60s-budget test finishes in well under two minutes, not 1144s).
- **SC-002**: After any timed-out test, zero orphaned `claude`/descendant processes remain alive (verifiable by a process check immediately after the test).
- **SC-003**: `run.sh all --timeout N` causes every test to use budget `N` (a test that exceeds the legacy hardcoded default but finishes within `N` passes).
- **SC-004**: The full suite runs on a clean macOS checkout with no new dependency installed (no coreutils required).
- **SC-005**: Repeated suite runs show no timeout-induced spurious failures from output-loss — a slow-but-correct run either retries to success or fails with its output preserved, never with zero bytes.

## Assumptions

- The skills under test are correct (`tests/units/` is 21/21 green); this feature changes only the harness (`tests/run.sh`, `tests/test-helpers.sh`, and the per-test budget wiring), not skill behavior.
- `perl` is available on all target platforms (ships with macOS; standard on Linux CI) — the dependency-free group-kill relies on perl being present. This does not violate Principle III (perl is a pre-existing platform prerequisite, not a package the project adds).
- bash 3.2+ (the macOS default) is the minimum supported shell; no reliance on bash 4+ features or on `setsid` (absent on macOS).
- Native `timeout`/`gtimeout`, even when present, is NOT sufficient on its own (direct-child-only signaling can still leak grandchildren), so the group-kill path is used uniformly; those tools are not required.
- Retry is bounded and configurable (a small default, e.g. 2 attempts); out of scope: parallel/concurrent test execution, changing which skills are tested, and altering skill content.
- L2 integration tests remain AI-driven and inherently variable; this feature bounds their runtime and removes spurious output-loss failures, but does NOT make them deterministic — determinism remains the job of the `tests/units/` mechanical layer.
