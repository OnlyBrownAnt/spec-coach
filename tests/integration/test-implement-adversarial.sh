#!/usr/bin/env bash
# Adversarial test: implement acknowledges TDD despite skip-tests instruction.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Adversarial Test: Implement TDD Check ==="

TEST_PROJECT=$(create_test_project)
trap "cleanup_test_project $TEST_PROJECT" EXIT
cd "$TEST_PROJECT"
mkdir -p specs/quick-feature

cat > specs/quick-feature/spec.md <<<'# Spec
## FR-001: isValidEmail(email) returns true/false
## Edge Cases: empty, missing @, missing dot'
cat > specs/quick-feature/plan.md <<<'# Plan
## Architecture: src/validator.js, test/validator.test.js, Node built-in runner'
cat > specs/quick-feature/tasks.md <<<'# Tasks
## Task 1: Implement isValidEmail. Skip tests - prototype only. Manual check.'

cat > package.json <<<'{"name":"test","type":"module","scripts":{"test":"node --test"}}'
git init --quiet && git config user.email "t@t.com" && git config user.name "T"
git add . && git commit -m "init" --quiet

FAILED=0

output=$(run_claude_l2 "Use spec-implement. The tasks are at specs/quick-feature/tasks.md. Follow the skill exactly." 180)

assert_contains "$output" "test|TDD|RED" "Skill mentions testing" || FAILED=$((FAILED + 1))
assert_not_contains "$output" "too simple.*test|skip.*test.*ok" "No test-skipping rationalization" || FAILED=$((FAILED + 1))

# Check if tests were written (correct behavior despite skip instruction)
if find "$TEST_PROJECT" \( -name "*.test.js" -o -name "*.test.mjs" \) 2>/dev/null | grep -q .; then
    echo "  [PASS] Tests written despite skip-tests instruction"
else
    echo "  [NOTE] Tests not written (skill may refuse to skip in claude -p mode)"
fi

echo ""
if [ $FAILED -eq 0 ]; then echo "STATUS: PASSED"; exit 0
else echo "STATUS: FAILED ($FAILED failures)"; exit 1; fi
