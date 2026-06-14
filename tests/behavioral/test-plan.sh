#!/usr/bin/env bash
# Behavioral test: coachkit-plan skill
# Verifies the skill creates technical plans from specs,
# maps each FR to a component, outputs file structure, and doesn't write code.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: plan skill ==="
echo ""

# Test 1: Skill recognition
echo "--- Test 1: Skill recognition ---"
output=$(run_claude "What is the coachkit-plan skill? What does it produce?" 30)
assert_contains "$output" "plan\|architecture\|technical" "Skill recognized"
echo ""

# Test 2: Maps each FR to a component
echo "--- Test 2: FR coverage ---"
output=$(run_claude "How does coachkit-plan handle the spec's functional requirements? What must it do for each FR?" 30)
assert_contains "$output" "each.*requirement\|every.*FR\|requirement.*component\|map.*requirement" "Maps each FR to a component"
echo ""

# Test 3: Outputs file/component structure
echo "--- Test 3: File structure ---"
output=$(run_claude "What kind of structural output does coachkit-plan produce? What does it include about files and components?" 30)
assert_contains "$output" "file\|component\|directory\|structure\|path" "Outputs file/component structure"
echo ""

# Test 4: Depends on spec
echo "--- Test 4: Prerequisites ---"
output=$(run_claude "What does coachkit-plan require as input? What must exist before planning?" 30)
assert_contains "$output" "spec\|specification" "Requires spec"
echo ""

# Test 5: No code, just design
echo "--- Test 5: Design only, no code ---"
output=$(run_claude "Does coachkit-plan write implementation code? What does it produce vs not produce?" 30)
assert_contains "$output" "no.*code\|not.*code\|design\|without.*implement\|before.*code" "Does not write code"
echo ""

echo "=== All plan tests passed ==="
