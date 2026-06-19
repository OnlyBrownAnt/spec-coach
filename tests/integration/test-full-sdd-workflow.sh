#!/usr/bin/env bash
# Integration test: Specify phase creates a spec.md file.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Integration Test: Specify ==="

TEST_PROJECT=$(create_test_project)
trap "cleanup_test_project $TEST_PROJECT" EXIT
cd "$TEST_PROJECT"
mkdir -p specs/phone-validator

cat > package.json <<<'{"name":"test","type":"module","scripts":{"test":"node --test"}}'
git init --quiet && git config user.email "t@t.com" && git config user.name "T"
git add . && git commit -m "init" --quiet

FAILED=0

spec_output=$(run_claude_l2 "Use spec-specify: create a spec for a function that validates US phone numbers. Accept formats: (555) 123-4567, 555-123-4567, 5551234567. Return true/false.")

assert_contains "$spec_output" "phone|valid" "Spec mentions phone validation" || FAILED=$((FAILED + 1))

if find "$TEST_PROJECT/specs" -name "spec.md" 2>/dev/null | grep -q .; then
    echo "  [PASS] spec.md created"
else
    echo "  [FAIL] spec.md not created"
    FAILED=$((FAILED + 1))
fi

echo ""
if [ $FAILED -eq 0 ]; then echo "STATUS: PASSED"; exit 0
else echo "STATUS: FAILED ($FAILED failures)"; exit 1; fi
