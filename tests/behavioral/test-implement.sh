#!/usr/bin/env bash
# Behavioral test: coachkit-implement skill is accessible and understood.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: implement skill ==="
output=$(run_claude "Describe the coachkit-implement skill, its core process, and its non-negotiable rules." 60)
assert_contains "$output" "implement" "Skill accessible and understood"
echo "=== PASS ==="
