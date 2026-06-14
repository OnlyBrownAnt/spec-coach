#!/usr/bin/env bash
# Behavioral test: spec-specify skill is accessible and understood.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: specify skill ==="
output=$(run_claude "Describe the spec-specify skill, its core process, and its non-negotiable rules." 60)
assert_contains "$output" "specif" "Skill accessible and understood"
echo "=== PASS ==="
