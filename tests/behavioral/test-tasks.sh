#!/usr/bin/env bash
# Behavioral test: coachkit-tasks skill
# Verifies the skill breaks plans into dependency-ordered,
# independently verifiable tasks without implementation code.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: tasks skill ==="
echo ""

# Test 1: Skill recognition
echo "--- Test 1: Skill recognition ---"
output=$(run_claude "What is the coachkit-tasks skill? What does it do?" 60)
assert_contains "$output" "task|breakdown|decompose|break.*down" "Skill recognized"
echo ""

# Test 2: Each task independently verifiable
echo "--- Test 2: Task verifiability ---"
output=$(run_claude "How does coachkit-tasks ensure each task can be verified? What makes a task complete?" 60)
assert_contains "$output" "verif|test|complet|criteria" "Tasks are verifiable"
echo ""

# Test 3: Dependency-ordered
echo "--- Test 3: Dependency ordering ---"
output=$(run_claude "How does coachkit-tasks order the task list? What determines the sequence?" 60)
assert_contains "$output" "depend|order|prerequisite|sequence" "Dependency-ordered"
echo ""

# Test 4: Tasks don't contain implementation code
echo "--- Test 4: No implementation code ---"
output=$(run_claude "Do coachkit-tasks entries contain full implementation code? What level of detail do they provide?" 60)
assert_contains "$output" "no.*code|not.*code|not.*contain|not.*implement|description" "Tasks don't contain code"
echo ""

echo "=== All tasks tests passed ==="
