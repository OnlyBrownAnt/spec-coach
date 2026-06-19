# Implementation Plan: Test Harness Reliability

**Branch**: `012-test-harness-reliability` | **Date**: 2026-06-19 | **Spec**: [spec.md](./spec.md)

**Input**: Feature specification from `/specs/012-test-harness-reliability/spec.md`

## Summary

Make the AI-driven test harness (`tests/run.sh`, `tests/test-helpers.sh`) bound its own runtime and stop producing spurious failures. Four components, all confined to `tests/`:

- **C1 — Group-kill timeout helper.** Replace `_timeout`'s perl `alarm; exec` one-liner (which SIGALRMs only the `bash` wrapper, orphaning `claude`) with a perl `fork` + `setpgrp` + negative-PID group kill that terminates the **entire** `claude` process tree, with a 10s TERM→KILL grace. Used uniformly on all platforms (native `timeout`/`gtimeout` are NOT relied on — they signal only the direct child and can leak grandchildren).
- **C2 — Stream + bounded-retry invoker.** Rewrite `run_claude`/`run_claude_l2` around a single `_invoke_claude` that streams output to a file (so a kill never yields 0 bytes), retries empty-output timeouts up to 2 total attempts, and always emits captured output + a `[TIMEOUT]` marker.
- **C3 — Flag/env propagation.** `run.sh` exports `SPEC_TIMEOUT_L1`/`SPEC_TIMEOUT_L2` defaults (300/600) and threads `--timeout`/`--retry`/`--grace` through env; the 8 test files drop their hardcoded `60`/`120`/`180` budget args so the helper defaults/override apply.
- **C4 — Mechanical regression tests.** A new `tests/units/harness-timeout.test.ts` asserting group-kill, escalation, output preservation, retry, and propagation (node:assert via `child_process.execSync`, same pattern as `constitution-charter.test.ts`).

## Technical Context

**Language/Version**: Bash 3.2+ (macOS system default) and Perl 5 (system `/usr/bin/perl`). No other languages.

**Primary Dependencies**: **None added.** perl and bash are pre-existing platform prerequisites (ship with macOS and Linux), not packages the project installs — so Constitution Principle III (zero dependencies) holds. `gtimeout`/coreutils is explicitly NOT required.

**Storage**: Ephemeral only — `mktemp` files for streamed claude output, cleaned up after each invocation. No persistent storage.

**Testing**: Mechanical regression tests in `tests/units/` using `node:assert/strict`, driven through `child_process.execSync` (zero-dependency, Constitution Principle III). The harness-under-test is bash, exercised the same way `constitution-charter.test.ts` exercises `verify-constitution-sync.sh`.

**Target Platform**: macOS (bash 3.2, **no `setsid`, no `timeout`/`gtimeout`**) and Linux CI. The group-kill mechanism must work on both without `setsid`.

**Project Type**: Test harness — bash helper scripts + a TypeScript test driver.

**Performance Goals**: A timed-out test returns within `budget + grace + margin` per attempt (SC-001); zero orphaned `claude`/descendants after any timed-out test (SC-002); worst-case test wall-clock = `attempts × (budget + grace + margin)`.

**Constraints**: Zero new runtime dependencies (Principle III). Must function under `output=$(run_claude …)` command substitution and nested `bash -c` layers (the real call shape). Must not change the install contract (`.claude/skills/`, `.spec/templates/`, `scripts/`) — only `tests/`.

**Scale/Scope**: 2 harness files (`test-helpers.sh`, `run.sh`) + 8 test files (5 behavioral, 3 integration, one-line budget-arg removal each) + 1 new regression-test file.

## Constitution Check

**III (Zero Dependencies)** — the central principle here — is satisfied: the group-kill is implemented in system **perl** (a platform prerequisite, not an added package), and `coreutils`/`gtimeout` is deliberately not required, so a clean macOS checkout runs the suite with no installs. **V (Verify What Ships)** applies: C4 ships mechanical tests that assert on the harness's *actual behavior* (the whole process tree dies, output survives a kill, retry works), not merely that functions don't throw. Principles **I, II, IV, VI** do not apply directly: this changes no shipped skill or template (the product is untouched — Assumption: skills are already correct, `tests/units/` is 21/21), coaches nothing, and writes only to `mktemp` scratch. The file-structure-as-constraint is respected: only `tests/` is touched; the install layout is unchanged. **No deviations.**

## Project Structure

### Documentation (this feature)

```text
specs/012-test-harness-reliability/
├── spec.md              # Feature spec (approved, clarified)
├── plan.md              # This file
└── tasks.md             # /spec.tasks output (next step)
```

### Source Code (repository root)

```text
tests/
├── run.sh                          # C3: export SPEC_TIMEOUT_L1/L2 defaults; add --retry/--grace; export env
├── test-helpers.sh                 # C1: rewrite _timeout (group-kill); C2: _invoke_claude + run_claude/run_claude_l2
├── behavioral/                     # C3: drop hardcoded budget arg (line 8 in each)
│   ├── test-analyze.sh
│   ├── test-implement.sh
│   ├── test-plan.sh
│   ├── test-specify.sh
│   └── test-tasks.sh
├── integration/                    # C3: drop hardcoded budget arg
│   ├── test-analyze-catches-bugs.sh
│   ├── test-full-sdd-workflow.sh
│   └── test-implement-adversarial.sh
└── units/
    └── harness-timeout.test.ts     # C4: NEW mechanical regression tests
```

**Structure Decision**: No structural change — this feature edits existing `tests/` files in place and adds one test file. The bash helpers stay in `test-helpers.sh` (shared library) and the runner in `run.sh`; mechanical tests stay in `tests/units/` per the established split (spec 003).

### File Mapping & Component Design

| Component | Files | FRs |
|---|---|---|
| **C1** Group-kill timeout helper | `tests/test-helpers.sh` (`_timeout`) | FR-001, FR-002, FR-003, FR-004, FR-009 |
| **C2** Stream + bounded-retry invoker | `tests/test-helpers.sh` (`_invoke_claude`, `run_claude`, `run_claude_l2`) | FR-006, FR-007, FR-008 |
| **C3** Flag/env propagation | `tests/run.sh`; 8 test files (drop budget arg) | FR-005, FR-006, FR-002 (config), FR-008 (config) |
| **C4** Mechanical regression tests | `tests/units/harness-timeout.test.ts` (new) | SC-001…SC-005, verifies FR-001…FR-008 |

**C1 — `_timeout` rewrite (concrete):** forks; the child calls `setpgrp(0,0)` (becomes its own process-group leader, isolating it from the parent's group/session so nesting under `$(…)` is irrelevant) then `exec`s the command; the parent arms `alarm($secs)`, and on fire sends `kill("TERM", -$pid)` to the whole group, `sleep($grace)`, then `kill("KILL", -$pid)`. Returns exit code `124` on timeout (GNU `timeout` convention) so callers distinguish timeout from a real non-zero exit. Negative-PID `kill` targets the process group; because the child is its group leader, `claude` and every descendant die together. `$secs` comes from the caller; `$grace` defaults to 10 (FR-002) and reads `SPEC_GRACE`. **Decision:** used uniformly — native `timeout`/`gtimeout` are NOT preferred even when present, because they signal only the direct child and would re-introduce the grandchild leak (FR-001/FR-004).

```bash
_timeout() {
    local secs="$1"; shift
    local grace="${SPEC_GRACE:-10}"
    perl -e '
        my $secs  = shift @ARGV;
        my $grace = shift @ARGV;
        my $pid = fork(); die "fork: $!" unless defined $pid;
        if ($pid == 0) { setpgrp(0,0); exec @ARGV; die "exec: $!"; }
        my $timed_out = 0;
        local $SIG{ALRM} = sub {
            $timed_out = 1;
            kill("TERM", -$pid); sleep($grace); kill("KILL", -$pid);
        };
        alarm($secs); waitpid($pid, 0);
        exit( $timed_out ? 124 : ($? >> 8) );
    ' -- "$secs" "$grace" "$@"
}
```

**C2 — stream + retry invoker (concrete logic):** a single `_invoke_claude <perm_mode> <prompt> <budget> [allowed_tools]` loops up to `SPEC_RETRIES+1` attempts (default 2 total). Each attempt runs the `claude -p …` command under `_timeout "$budget"`, streaming to a temp file (`> "$out" 2>&1`). If the return is not `124`, it emits the file and returns (clean completion or a real non-zero). On `124` it retries **only if** the captured file is empty (suspected cold-start — FR-008) and attempts remain; otherwise it emits the captured (partial) output to **stdout** and a `[TIMEOUT after ${budget}s]` marker to **stderr** (so `$output` and `run.sh`'s `bash test 2>&1 | tee` log both retain it — never 0 bytes, SC-005/FR-007) and returns `124`. `run_claude` and `run_claude_l2` become thin wrappers passing the permission mode; budget resolves as **per-test arg → `SPEC_TIMEOUT_OVERRIDE` → category default** (`SPEC_TIMEOUT_L1=300` for `run_claude`, `SPEC_TIMEOUT_L2=600` for `run_claude_l2`), so the 8 test files no longer pass a budget.

**C3 — propagation (concrete):** `run.sh` sets `SPEC_TIMEOUT_L1=300` and `SPEC_TIMEOUT_L2=600` defaults (FR-006), and when `--timeout N` is given exports `SPEC_TIMEOUT_OVERRIDE=$N` (applies to every test, FR-005); adds `--retry N` → `SPEC_RETRIES` and `--grace N` → `SPEC_GRACE`. Because the test files are invoked as `bash "$test_path"`, the `export`ed vars are inherited. Each of the 8 test files changes exactly one line — `run_claude "…" 60` → `run_claude "…"` (and `run_claude_l2 "…" 120|180` → `run_claude_l2 "…"`) — so the helper's default/override budget applies.

**C4 — regression tests (six concrete cases below):** `tests/units/harness-timeout.test.ts`, each case via `execSync('bash -c "…"', {timeout})` against the real `test-helpers.sh` (sourced):

1. **Group-kill + bound** (FR-001/003/004, SC-001/002): `_timeout 5 bash -c 'sleep 600 & wait'` — assert the helper returns in ≤ ~20s AND `pgrep -f 'sleep 600'` finds nothing afterward.
2. **TERM→KILL escalation** (FR-002): `_timeout 3 bash -c 'trap "" TERM; sleep 600'` — child ignores TERM; assert it is still gone within grace+margin (SIGKILL) and helper returns 124.
3. **Output preserved on kill** (FR-007, SC-005): `_timeout 2 bash -c 'echo partial; sleep 600'` — assert captured stdout contains `partial` (non-zero bytes despite timeout).
4. **Empty-vs-partial no-retry is behavioral** (FR-008): drive `_invoke_claude` against a stub command that on attempt 1 sleeps past budget producing empty output and on attempt 2 prints `ok` (use a counter temp file) — assert it returns `ok` (retried). A second variant producing partial output on attempt 1 asserts it does NOT retry (returns the partial + 124).
5. **`--timeout` propagation** (FR-005, SC-003): run a test path with `SPEC_TIMEOUT_OVERRIDE=7` and a stub that sleeps 5s then exits 0 — assert it passes (budget 7 respected, not the category default). Companion: without the override, assert the helper's budget equals the `SPEC_TIMEOUT_L1`/`L2` default (FR-006).
6. **No-new-dependency** (FR-009, SC-004): assert `_timeout` does not shell out to `gtimeout`/`timeout` (grep the helper source) and that the suite runs with neither installed.

## Complexity Tracking

No constitution violations — section intentionally contains no justifications. (Principle III is satisfied by using system perl rather than adding a dependency; this is recorded in the Constitution Check above, not a deviation.)
