#!/usr/bin/env bash
# Behavioral test: coachkit-analyze skill is accessible and understood.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: analyze skill ==="
output=$(run_claude "Describe the coachkit-analyze skill, its core process, and its non-negotiable rules." 60)
assert_contains "$output" "analy" "Skill accessible and understood"
echo "=== PASS ==="
