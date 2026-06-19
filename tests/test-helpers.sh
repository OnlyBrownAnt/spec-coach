#!/usr/bin/env bash
# Shared helpers for spec-coach skill tests.
# Modeled on superpowers tests/claude-code/test-helpers.sh

# Resolve spec-coach root (one level above tests/)
COACH_KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- Cross-platform timeout that kills the WHOLE process tree ----
# macOS has no `timeout`/`gtimeout` and no `setsid`, and native `timeout` (even
# on Linux) only signals its direct child — so a wrapped `claude -p` that spawns
# sub-agents survives as an orphan and holds the test's output pipe open (the
# original 19-minute-hang bug). Fix: a dependency-free perl that forks, puts the
# child in its OWN process group (setpgrp), and on timeout SIGTERMs then SIGKILLs
# the entire group (negative PID). perl is a platform prerequisite, not an added
# package — Constitution Principle III (zero dependencies).
# Returns 124 on timeout (GNU timeout convention) so callers can distinguish it.
_timeout() {
    local secs="$1"; shift
    local grace="${SPEC_GRACE:-10}"
    perl -e '
        my $secs  = shift @ARGV;
        my $grace = shift @ARGV;
        my $pid = fork();
        die "fork: $!" unless defined $pid;
        if ($pid == 0) {            # child: own process group, then exec the command
            setpgrp(0, 0);
            exec @ARGV;
            die "exec: $!";
        }
        my $timed_out = 0;
        local $SIG{ALRM} = sub {
            $timed_out = 1;
            kill("TERM", -$pid);    # SIGTERM the whole group; give it a chance to flush
            sleep($grace);
            kill("KILL", -$pid);    # SIGKILL whatever remains
        };
        alarm($secs);
        waitpid($pid, 0);
        exit($timed_out ? 124 : ($? >> 8));
    ' -- "$secs" "$grace" "$@"
}

# ---- Per-call budget resolution ----
# Precedence: explicit arg > SPEC_TIMEOUT_OVERRIDE (run.sh --timeout) > category
# env var (SPEC_TIMEOUT_L1/L2, exported by run.sh) > built-in fallback (300/600).
_claude_budget() {
    local explicit="$1" default_var="$2" fallback="$3"
    [ -n "$explicit" ] && { echo "$explicit"; return; }
    [ -n "${SPEC_TIMEOUT_OVERRIDE:-}" ] && { echo "$SPEC_TIMEOUT_OVERRIDE"; return; }
    local v="${!default_var:-}"
    [ -n "$v" ] && { echo "$v"; return; }
    echo "$fallback"
}

# ---- Run Claude Code headless, streaming output + bounded retry ----
# One or more attempts of `claude -p`, streaming to a temp file so a kill never
# loses output (FR-007). On a timeout (rc 124): retry ONLY when the captured
# output is empty (suspected cold-start), up to SPEC_RETRIES+1 attempts (FR-008);
# otherwise emit the partial output to stdout and a [TIMEOUT] marker to stderr.
# Non-timeout results are emitted and returned as-is. perm_mode: "plain"|"bypass".
_invoke_claude() {
    local perm_mode="$1" prompt="$2" budget="$3" allowed_tools="${4:-}"
    local max_attempts=$(( ${SPEC_RETRIES:-1} + 1 ))
    local cap; cap=$(mktemp)
    local rc=0 attempt cmd
    for ((attempt=1; attempt<=max_attempts; attempt++)); do
        cmd="claude -p \"$prompt\" --output-format text --plugin-dir \"$COACH_KIT_ROOT\""
        [ "$perm_mode" = "bypass" ] && cmd="$cmd --permission-mode bypassPermissions"
        [ -n "$allowed_tools" ] && cmd="$cmd --allowed-tools=$allowed_tools"
        rc=0; _timeout "$budget" bash -c "$cmd" > "$cap" 2>&1 || rc=$?
        if [ "$rc" -ne 124 ]; then
            cat "$cap"; rm -f "$cap"; return "$rc"
        fi
        # timeout: retry only on empty output with attempts remaining
        if [ -n "$(cat "$cap")" ] || [ "$attempt" -eq "$max_attempts" ]; then
            cat "$cap"                                            # partial/empty output -> stdout (never 0 bytes)
            echo "[TIMEOUT after ${budget}s] (attempt $attempt/$max_attempts)" >&2
            rm -f "$cap"; return 124
        fi
    done
    cat "$cap"; rm -f "$cap"; return 124
}

# Usage: output=$(run_claude "prompt" [budget_override] [allowed_tools])
# Budget resolves via _claude_budget (L1 default 300s).
run_claude() {
    local prompt="$1" budget_override="${2:-}" allowed_tools="${3:-}"
    local budget; budget=$(_claude_budget "$budget_override" SPEC_TIMEOUT_L1 300)
    _invoke_claude "plain" "$prompt" "$budget" "$allowed_tools"
}

# ---- Assertions ----

# Check if output contains a pattern
# Usage: assert_contains "output" "pattern" "test name"
assert_contains() {
    local output="$1"
    local pattern="$2"
    local test_name="${3:-test}"

    if echo "$output" | grep -Eq "$pattern"; then
        echo "  [PASS] $test_name"
        return 0
    else
        echo "  [FAIL] $test_name"
        echo "         Expected to find: $pattern"
        return 1
    fi
}

# Check if output does NOT contain a pattern
# Usage: assert_not_contains "output" "pattern" "test name"
assert_not_contains() {
    local output="$1"
    local pattern="$2"
    local test_name="${3:-test}"

    if echo "$output" | grep -Eq "$pattern"; then
        echo "  [FAIL] $test_name"
        echo "         Unexpected: $pattern"
        return 1
    else
        echo "  [PASS] $test_name"
        return 0
    fi
}

# Check if output contains exactly N occurrences of pattern
# Usage: assert_count "output" "pattern" expected "test name"
assert_count() {
    local output="$1"
    local pattern="$2"
    local expected="$3"
    local test_name="${4:-test}"
    local actual
    actual=$(echo "$output" | grep -Ec "$pattern" 2>/dev/null || echo "0")

    if [ "$actual" -eq "$expected" ]; then
        echo "  [PASS] $test_name (found $actual instances)"
        return 0
    else
        echo "  [FAIL] $test_name"
        echo "         Expected $expected instances, found $actual"
        return 1
    fi
}

# Check if pattern A appears before pattern B by line number
# Usage: assert_order "output" "pattern_a" "pattern_b" "test name"
assert_order() {
    local output="$1"
    local pattern_a="$2"
    local pattern_b="$3"
    local test_name="${4:-test}"
    local line_a
    local line_b
    line_a=$(echo "$output" | grep -En "$pattern_a" | head -1 | cut -d: -f1)
    line_b=$(echo "$output" | grep -En "$pattern_b" | head -1 | cut -d: -f1)

    if [ -z "$line_a" ]; then
        echo "  [FAIL] $test_name — pattern A not found: $pattern_a"
        return 1
    fi
    if [ -z "$line_b" ]; then
        echo "  [FAIL] $test_name — pattern B not found: $pattern_b"
        return 1
    fi

    if [ "$line_a" -lt "$line_b" ]; then
        echo "  [PASS] $test_name (line $line_a < $line_b)"
        return 0
    else
        echo "  [FAIL] $test_name (A at line $line_a, B at $line_b — wrong order)"
        return 1
    fi
}

# ---- Test project isolation ----

# Create an isolated temporary test project directory
# Usage: test_project=$(create_test_project)
create_test_project() {
    local test_dir
    test_dir=$(mktemp -d)
    echo "$test_dir"
}

# Cleanup a test project directory
# Usage: cleanup_test_project "$test_dir"
cleanup_test_project() {
    local test_dir="$1"
    if [ -d "$test_dir" ]; then
        rm -rf "$test_dir"
    fi
}

# Like run_claude but with --permission-mode bypassPermissions for L2 tests
# that need to write files (implement, specify, plan, etc.). L2 default 600s.
run_claude_l2() {
    local prompt="$1" budget_override="${2:-}"
    local budget; budget=$(_claude_budget "$budget_override" SPEC_TIMEOUT_L2 600)
    _invoke_claude "bypass" "$prompt" "$budget" ""
}
