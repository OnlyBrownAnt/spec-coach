#!/usr/bin/env bash
# Behavioral test: coachkit-specify skill
# Verifies the skill turns feature descriptions into structured specs,
# distinguishes FR/NFR, requires edge cases, and rejects vague input.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: specify skill ==="
echo ""

# Test 1: Skill recognition
echo "--- Test 1: Skill recognition ---"
output=$(run_claude "What is the coachkit-specify skill? What does it do?" 60)
assert_contains "$output" "spec|specification|feature" "Skill recognized"
echo ""

# Test 2: Outputs structured spec
echo "--- Test 2: Structured output ---"
output=$(run_claude "What sections does coachkit-specify include in its output spec document? What structure does it follow?" 60)
assert_contains "$output" "functional|FR|requirement" "Mentions functional requirements"
assert_contains "$output" "user story|user stories" "Mentions user stories"
echo ""

# Test 3: FR/NFR distinction
echo "--- Test 3: Requirement types ---"
output=$(run_claude "Does coachkit-specify distinguish between functional and non-functional requirements? How?" 60)
assert_contains "$output" "functional|non-functional|FR|NFR" "Distinguishes requirement types"
echo ""

# Test 4: Edge cases required
echo "--- Test 4: Edge cases ---"
output=$(run_claude "How does coachkit-specify handle edge cases? Are they required in the spec?" 60)
assert_contains "$output" "edge|boundary|corner|error.*handl cases"
echo ""

# Test 5: Rejects vague input
echo "--- Test 5: Rejects vague input ---"
output=$(run_claude "If a user says 'build something cool' and asks you to use coachkit-specify, how should you respond according to the skill?" 60)
assert_contains "$output" "clarify|ask|specific|more.*detail|what" "Rejects overly vague input"
echo ""

echo "=== All specify tests passed ==="
