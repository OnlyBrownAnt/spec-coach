#!/usr/bin/env bash
# Shared helpers for spec-coach skill tests.
# Modeled on superpowers tests/claude-code/test-helpers.sh

# Resolve spec-coach root (one level above tests/)
COACH_KIT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

# ---- Cross-platform timeout (macOS lacks `timeout`) ----
_timeout() {
    local secs="$1"; shift
    if command -v timeout &>/dev/null; then timeout "$secs" "$@"
    elif command -v gtimeout &>/dev/null; then gtimeout "$secs" "$@"
    else perl -e 'alarm shift; exec @ARGV; die "exec failed: $!"' "$secs" "$@"
    fi
}

# ---- Run Claude Code headless and capture output ----
# Usage: output=$(run_claude "prompt" [timeout_seconds] [allowed_tools])
run_claude() {
    local prompt="$1"
    local timeout_val="${2:-60}"
    local allowed_tools="${3:-}"
    local output_file
    output_file=$(mktemp)

    local cmd="claude -p \"$prompt\" --output-format text --plugin-dir \"$COACH_KIT_ROOT\""
    if [ -n "$allowed_tools" ]; then
        cmd="$cmd --allowed-tools=$allowed_tools"
    fi

    if _timeout "$timeout_val" bash -c "$cmd" > "$output_file" 2>&1; then
        cat "$output_file"
        rm -f "$output_file"
        return 0
    else
        local exit_code=$?
        cat "$output_file" >&2
        rm -f "$output_file"
        return $exit_code
    fi
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
# that need to write files (implement, specify, plan, etc.).
run_claude_l2() {
    local prompt="$1"
    local timeout_val="${2:-60}"
    local output_file
    output_file=$(mktemp)

    local cmd="claude -p \"$prompt\" --output-format text --plugin-dir \"$COACH_KIT_ROOT\" --permission-mode bypassPermissions"

    if _timeout "$timeout_val" bash -c "$cmd" > "$output_file" 2>&1; then
        cat "$output_file"
        rm -f "$output_file"
        return 0
    else
        local exit_code=$?
        cat "$output_file" >&2
        rm -f "$output_file"
        return $exit_code
    fi
}
