#!/usr/bin/env bash
# Behavioral test: spec-plan skill is accessible and understood.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: plan skill ==="
output=$(run_claude "Describe the spec-plan skill, its core process, and its non-negotiable rules." 60)
assert_contains "$output" "plan" "Skill accessible and understood"
echo "=== PASS ==="
