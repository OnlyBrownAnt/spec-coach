#!/usr/bin/env bash
# spec-coach skill test runner
# Usage: run.sh [all|list|results|<test-name>] [--verbose] [--timeout N]
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
source "$SCRIPT_DIR/test-helpers.sh"

TIMEOUT=300
VERBOSE=false
SPECIFIC_TEST=""
RUN_INTEGRATION=false
L2_ONLY=false

# ---- Parse args ----
while [[ $# -gt 0 ]]; do
    case "$1" in
        --verbose|-v)
            VERBOSE=true; shift ;;
        --timeout)
            TIMEOUT="$2"; shift 2 ;;
        all)
            RUN_INTEGRATION=true; shift ;;
        l2)
            L2_ONLY=true; shift ;;
        list)
            echo "L1 — Behavioral Tests:"
            for f in "$SCRIPT_DIR"/behavioral/test-*.sh; do
                [ -f "$f" ] && echo "  $(basename "$f")"
            done
            echo ""
            echo "L2 — Integration Tests:"
            for f in "$SCRIPT_DIR"/integration/test-*.sh; do
                [ -f "$f" ] && echo "  $(basename "$f")"
            done
            exit 0 ;;
        results)
            if [ -d "$SCRIPT_DIR/.test-output" ]; then
                echo "Last runs:"
                ls -1t "$SCRIPT_DIR/.test-output/" 2>/dev/null | head -20 | while read d; do
                    v=""
                    [ -f "$SCRIPT_DIR/.test-output/$d/status" ] && v=$(cat "$SCRIPT_DIR/.test-output/$d/status")
                    echo "  $d — ${v:-unknown}"
                done
            else
                echo "No test runs yet."
            fi
            exit 0 ;;
        --help|-h)
            echo "Usage: run.sh [command] [options]"
            echo ""
            echo "Commands:"
            echo "  (none)          Run all L1 behavioral tests"
            echo "  all             Run all tests (L1 + L2)"
            echo "  l2              Run only L2 integration tests"
            echo "  list            List available tests"
            echo "  results         Show recent run history"
            echo "  <test-name>     Run specific test (e.g., test-implement)"
            echo ""
            echo "Options:"
            echo "  --verbose, -v   Show full Claude output"
            echo "  --timeout N     Per-test timeout in seconds (default: 300)"
            exit 0 ;;
        -*)
            echo "Unknown option: $1. Use --help for usage." >&2; exit 1 ;;
        *)
            SPECIFIC_TEST="$1"; shift ;;
    esac
done

# ---- Discover tests ----
L1_TESTS=()
L2_TESTS=()

for f in "$SCRIPT_DIR"/behavioral/test-*.sh; do
    [ -f "$f" ] && L1_TESTS+=("$(basename "$f")")
done

for f in "$SCRIPT_DIR"/integration/test-*.sh; do
    [ -f "$f" ] && L2_TESTS+=("$(basename "$f")")
done

if [ "$L2_ONLY" = true ]; then
    ALL_TESTS=("${L2_TESTS[@]}")
elif [ "$RUN_INTEGRATION" = true ]; then
    ALL_TESTS=("${L1_TESTS[@]}" "${L2_TESTS[@]}")
else
    ALL_TESTS=("${L1_TESTS[@]}")
fi

# Filter to specific test if requested
if [ -n "$SPECIFIC_TEST" ]; then
    MATCHED=()
    for t in "${ALL_TESTS[@]}"; do
        [[ "$t" == *"$SPECIFIC_TEST"* ]] && MATCHED+=("$t")
    done
    if [ ${#MATCHED[@]} -eq 0 ]; then
        # Also check in L2 if not already included
        for f in "$SCRIPT_DIR"/integration/test-*.sh; do
            bn=$(basename "$f")
            [[ "$bn" == *"$SPECIFIC_TEST"* ]] && MATCHED+=("$bn")
        done
    fi
    ALL_TESTS=("${MATCHED[@]}")
fi

# ---- Pre-flight ----
if ! command -v claude &>/dev/null; then
    echo "ERROR: Claude Code CLI not found. Install: https://code.claude.com" >&2
    exit 1
fi

echo "========================================"
echo " spec-coach Skill Test Suite"
echo "========================================"
echo ""
echo "Time:    $(date '+%Y-%m-%d %H:%M')"
echo "Claude:  $(claude --version 2>/dev/null || echo 'installed')"
echo "Timeout: ${TIMEOUT}s per test"
echo ""

# ---- Run tests ----
PASSED=0
FAILED=0
SKIPPED=0
START_TIME=$(date +%s)

run_test() {
    local test_name="$1"
    local category="$2"
    local test_path

    if [ "$category" = "L1" ]; then
        test_path="$SCRIPT_DIR/behavioral/$test_name"
    else
        test_path="$SCRIPT_DIR/integration/$test_name"
    fi

    if [ ! -f "$test_path" ]; then
        echo "Running: $test_name  ........ [SKIP] not found"
        SKIPPED=$((SKIPPED + 1))
        return
    fi

    [ ! -x "$test_path" ] && chmod +x "$test_path"

    echo "Running: $test_name"
    local test_start
    test_start=$(date +%s)
    local dur

    local output_dir="$SCRIPT_DIR/.test-output/$(date +%s)-${test_name%.sh}"
    mkdir -p "$output_dir"

    # Run test with real-time output via tee. Each run_claude has its own 60s
    # timeout, so we don't need an outer timeout wrapper that breaks on macOS.
    if bash "$test_path" 2>&1 | tee "$output_dir/output.log"; then
        test_end=$(date +%s)
        dur=$((test_end - test_start))
        echo "PASS" > "$output_dir/status"
        echo "  PASS (${dur}s)"
        PASSED=$((PASSED + 1))
    else
        test_end=$(date +%s)
        dur=$((test_end - test_start))
        echo "FAILED" > "$output_dir/status"
        echo "  FAIL (${dur}s)"
        FAILED=$((FAILED + 1))
    fi
}

# Detect category for a test name
category_for() {
    local name="$1"
    for t in "${L1_TESTS[@]}"; do
        [ "$t" = "$name" ] && { echo "L1"; return; }
    done
    echo "L2"
}

if [ "$L2_ONLY" = true ]; then
    echo "--- L2: Integration Tests ---"
    for t in "${ALL_TESTS[@]}"; do
        run_test "$t" "L2"
    done
elif [ ${#ALL_TESTS[@]} -gt 0 ] && [ "$RUN_INTEGRATION" = true ]; then
    echo "--- L1: Behavioral Tests ---"
    for t in "${L1_TESTS[@]}"; do
        found=false
        for at in "${ALL_TESTS[@]}"; do
            [ "$at" = "$t" ] && found=true
        done
        $found && run_test "$t" "L1"
    done
    echo ""
    echo "--- L2: Integration Tests ---"
    for t in "${L2_TESTS[@]}"; do
        found=false
        for at in "${ALL_TESTS[@]}"; do
            [ "$at" = "$t" ] && found=true
        done
        $found && run_test "$t" "L2"
    done
else
    echo "--- L1: Behavioral Tests ---"
    for t in "${ALL_TESTS[@]}"; do
        cat=$(category_for "$t")
        run_test "$t" "$cat"
    done

    if [ ${#L2_TESTS[@]} -gt 0 ]; then
        echo ""
        echo "Note: L2 integration tests not run. Use 'run.sh l2' or 'run.sh all'."
    fi
fi

echo ""

# ---- Summary ----
END_TIME=$(date +%s)
TOTAL_DURATION=$((END_TIME - START_TIME))

echo "========================================"
echo " Test Results Summary"
echo "========================================"
echo ""
echo "  Passed:  $PASSED"
echo "  Failed:  $FAILED"
echo "  Skipped: $SKIPPED"
echo "  Duration: ${TOTAL_DURATION}s"
echo ""

if [ $FAILED -gt 0 ]; then
    echo "STATUS: FAILED"
    exit 1
else
    echo "STATUS: PASSED"
    exit 0
fi
