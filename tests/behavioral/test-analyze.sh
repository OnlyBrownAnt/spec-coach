#!/usr/bin/env bash
# Behavioral test: coachkit-analyze skill
# Verifies the skill cross-checks spec/plan/tasks for consistency,
# reports gaps with specific citations, and doesn't fabricate issues.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: analyze skill ==="
echo ""

# Test 1: Skill recognition
echo "--- Test 1: Skill recognition ---"
output=$(run_claude "What is the coachkit-analyze skill? What does it check?" 60)
assert_contains "$output" "cross.*check|consistency|review|analy" "Skill recognized"
echo ""

# Test 2: Checks spec->plan coverage
echo "--- Test 2: Spec to plan coverage ---"
output=$(run_claude "How does coachkit-analyze verify that the plan covers the spec? What specifically does it look for?" 60)
assert_contains "$output" "coverage|requirement.*covered|FR.*plan|gap" "Checks spec-to-plan coverage"
echo ""

# Test 3: Checks plan->tasks coverage
echo "--- Test 3: Plan to tasks coverage ---"
output=$(run_claude "Does coachkit-analyze check that every plan component has a corresponding task? How?" 60)
assert_contains "$output" "plan|component" "Mentions plan or component"
assert_contains "$output" "task|implement" "Mentions tasks"
echo ""

# Test 4: Reports inconsistencies with specific citations
echo "--- Test 4: Specific findings required ---"
output=$(run_claude "When coachkit-analyze finds an issue, how should it report it? Give specific or general descriptions?" 60)
assert_contains "$output" "specific|citation|section|reference|FR-" "Reports with specific citations"
echo ""

# Test 5: Does not fabricate issues
echo "--- Test 5: No fabrication ---"
output=$(run_claude "If coachkit-analyze checks a perfectly consistent spec/plan/tasks set, what should it report?" 60)
assert_contains "$output" "no issue|consistent|pass|none|no.*gap" "Does not fabricate issues"
echo ""

echo "=== All analyze tests passed ==="
