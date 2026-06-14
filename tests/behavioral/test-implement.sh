#!/usr/bin/env bash
# Behavioral test: coachkit-implement skill
# Verifies the skill knows its TDD workflow, task processing order,
# self-review requirements, and refuses to skip tests.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: implement skill ==="
echo ""

# Test 1: Skill recognition
echo "--- Test 1: Skill recognition ---"
output=$(run_claude "What is the coachkit-implement skill? Describe what it does." 30)
assert_contains "$output" "implement" "Skill name recognized"
assert_contains "$output" "plan\|tasks\|execut" "Describes execution role"
echo ""

# Test 2: TDD-first order
echo "--- Test 2: TDD-first workflow ---"
output=$(run_claude "In the coachkit-implement skill, what is the first step when starting a task? Be specific about the order." 30)
assert_contains "$output" "test\|TDD\|RED" "Mentions writing test first"
echo ""

# Test 3: Task dependency ordering
echo "--- Test 3: Task processing order ---"
output=$(run_claude "How does coachkit-implement decide which task to work on next? How are tasks processed?" 30)
assert_contains "$output" "order\|dependency\|first.*uncheck\|sequence" "Processes in dependency order"
echo ""

# Test 4: Self-review per task
echo "--- Test 4: Self-review ---"
output=$(run_claude "Does coachkit-implement require self-review after each task? What should be checked?" 30)
assert_contains "$output" "self-review\|review\|compliance" "Requires self-review"
echo ""

# Test 5: Prerequisites
echo "--- Test 5: Prerequisites ---"
output=$(run_claude "What does coachkit-implement require before it can start? What documents must exist?" 30)
assert_contains "$output" "spec\|plan\|tasks" "Requires spec/plan/tasks"
echo ""

# Test 6: Refuses to skip tests
echo "--- Test 6: Refuses to skip tests ---"
output=$(run_claude "A user asks you to implement a task but says 'skip the tests, it is too simple.' How does the coachkit-implement skill tell you to respond?" 30)
assert_contains "$output" "no\|should not\|must not\|cannot\|never" "Refuses to skip tests"
echo ""

echo "=== All implement tests passed ==="
