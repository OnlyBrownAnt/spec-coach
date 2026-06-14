#!/usr/bin/env bash
# Integration test: Full SDD workflow
# Runs specify -> clarify -> plan -> tasks -> implement end-to-end
# and verifies each phase produces expected output.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "========================================"
echo " Integration Test: Full SDD Workflow"
echo "========================================"
echo ""

TEST_PROJECT=$(create_test_project)
echo "Test project: $TEST_PROJECT"
trap "cleanup_test_project $TEST_PROJECT" EXIT

cd "$TEST_PROJECT"

# Initialize project structure
mkdir -p specs/phone-validator
git init --quiet
git config user.email "test@coach-kit.test"
git config user.name "Coach Kit Test"

cat > package.json <<'PKGJSON'
{ "name": "phone-validator-test", "version": "1.0.0", "type": "module",
  "scripts": { "test": "node --test" } }
PKGJSON

git add . && git commit -m "chore: init test project" --quiet

FAILED=0

# ---- Phase 1: Specify ----
echo "--- Phase 1: Specify ---"
spec_output=$(run_claude_l2 "Use coachkit-specify to create a spec for: a function that validates US phone numbers. It should accept formats like (555) 123-4567, 555-123-4567, and 5551234567. It should return true for valid numbers and false for invalid ones." 120)
echo "$spec_output" > "$TEST_PROJECT/claude-specify.log"

assert_contains "$spec_output" "phone|validator|valid" "Spec mentions phone validation" || FAILED=$((FAILED + 1))

SPEC_FILE=$(find "$TEST_PROJECT/specs" -name "spec.md" 2>/dev/null | head -1)
if [ -n "$SPEC_FILE" ]; then
    echo "  [PASS] spec.md created"
else
    echo "  [FAIL] spec.md not created"
    FAILED=$((FAILED + 1))
fi
echo ""

# ---- Phase 2: Clarify ----
echo "--- Phase 2: Clarify ---"
clarify_output=$(run_claude_l2 "Use coachkit-clarify to review the spec at ${SPEC_FILE:-specs/phone-validator/spec.md} for ambiguities. Identify up to 3 unclear areas." 60)
echo "$clarify_output" > "$TEST_PROJECT/claude-clarify.log"

assert_contains "$clarify_output" "clarif|ambigu|unclear|question|NEEDS" "Clarify found ambiguities" || FAILED=$((FAILED + 1))
echo ""

# ---- Phase 3: Plan ----
echo "--- Phase 3: Plan ---"
plan_output=$(run_claude_l2 "Use coachkit-plan to create a technical plan from the spec at ${SPEC_FILE:-specs/phone-validator/spec.md}." 120)
echo "$plan_output" > "$TEST_PROJECT/claude-plan.log"

PLAN_FILE=$(find "$TEST_PROJECT/specs" -name "plan.md" 2>/dev/null | head -1)
if [ -n "$PLAN_FILE" ]; then
    echo "  [PASS] plan.md created"
else
    echo "  [FAIL] plan.md not created"
    FAILED=$((FAILED + 1))
fi
echo ""

# ---- Phase 4: Tasks ----
echo "--- Phase 4: Tasks ---"
tasks_output=$(run_claude_l2 "Use coachkit-tasks to break the plan at ${PLAN_FILE:-specs/phone-validator/plan.md} into tasks." 60)
echo "$tasks_output" > "$TEST_PROJECT/claude-tasks.log"

TASKS_FILE=$(find "$TEST_PROJECT/specs" -name "tasks.md" 2>/dev/null | head -1)
if [ -n "$TASKS_FILE" ]; then
    echo "  [PASS] tasks.md created"
else
    echo "  [FAIL] tasks.md not created"
    FAILED=$((FAILED + 1))
fi
echo ""

# ---- Phase 5: Implement ----
echo "--- Phase 5: Implement ---"
implement_output=$(run_claude_l2 "Use coachkit-implement to execute the implementation plan. The tasks are at ${TASKS_FILE:-specs/phone-validator/tasks.md}." 300)
echo "$implement_output" > "$TEST_PROJECT/claude-implement.log"

if find "$TEST_PROJECT/src" -name "*.js" 2>/dev/null | grep -q .; then
    echo "  [PASS] Production code exists in src/"
else
    echo "  [FAIL] No production code in src/"
    FAILED=$((FAILED + 1))
fi

if find "$TEST_PROJECT" -name "*.test.js" 2>/dev/null | grep -q .; then
    echo "  [PASS] Test files exist"
else
    echo "  [FAIL] No test files found"
    FAILED=$((FAILED + 1))
fi

if echo "$implement_output" | grep -Eq "node --test|npm test|npm run test"; then
    echo "  [PASS] Test command was run"
else
    echo "  [FAIL] Test command was not run"
    FAILED=$((FAILED + 1))
fi
echo ""

# ---- Summary ----
echo "========================================"
echo " Full SDD Workflow Summary"
echo "========================================"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "STATUS: PASSED"
    echo "End-to-end SDD workflow: specify -> clarify -> plan -> tasks -> implement"
    echo "All phases produced expected output."
    exit 0
else
    echo "STATUS: FAILED"
    echo "$FAILED verification(s) failed"
    echo ""
    echo "Logs saved in: $TEST_PROJECT/claude-*.log"
    exit 1
fi
