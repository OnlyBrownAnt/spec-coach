#!/usr/bin/env bash
# Adversarial integration test: analyze catches planted inconsistencies
# Plants gaps between spec/plan/tasks and verifies analyze discovers them.
set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "========================================"
echo " Adversarial Test: Analyze Catches Bugs"
echo "========================================"
echo ""

TEST_PROJECT=$(create_test_project)
echo "Test project: $TEST_PROJECT"
trap "cleanup_test_project $TEST_PROJECT" EXIT

cd "$TEST_PROJECT"
mkdir -p specs/email-validator

# ---- Plant deliberate inconsistencies ----
# Spec: defines FR1 (email: 5 rules) and FR2 (phone validation)
cat > specs/email-validator/spec.md <<'SPECEOF'
# Email Validator Spec

## Overview
Validate email addresses according to RFC-like rules.

## Functional Requirements
- **FR-001**: isValidEmail must validate format: contains @, has local part, has domain with dot, no spaces, max 254 chars
- **FR-002**: Phone number validation with US format support

## Edge Cases
- Empty string returns false
- null/undefined throws TypeError

## Non-Goals
- This feature does NOT send verification emails
SPECEOF

# Plan: only covers 3 of 5 email rules, completely omits phone validation
cat > specs/email-validator/plan.md <<'PLANEOF'
# Email Validator Technical Plan

## Architecture
- Single file: src/validators.js
- Node.js built-in test runner

## Component Mapping

### FR-001: Email Format Validation
- Check for @ symbol
- Check domain contains dot
- Reject empty local part
- (3 rules covered)

## File Structure
- src/validators.js — validation functions
- test/validators.test.js — test suite
PLANEOF

# Tasks: only has email validator task, missing phone validator
cat > specs/email-validator/tasks.md <<'TASKSEOF'
# Email Validator Tasks

## Task 1: Implement email validator [P]
**File:** src/validators.js
Implement isValidEmail(email) checking @ presence, domain dot, and non-empty local part.

**Tests:** test/validators.test.js — 5 test cases covering FR-001.

**Verification:** npm test
TASKSEOF

git init --quiet
git config user.email "test@coach-kit.test"
git config user.name "Coach Kit Test"
git add . && git commit -m "chore: baseline with planted inconsistencies" --quiet

echo "Planted inconsistencies:"
echo "  1. spec.md: FR-001 = 5 rules, FR-002 = phone validation"
echo "  2. plan.md: Only covers 3 of 5 email rules, zero phone validation"
echo "  3. tasks.md: Only email validator task, no phone validator task"
echo ""

FAILED=0

# ---- Run analyze ----
echo "--- Running coachkit-analyze ---"
analyze_output=$(run_claude_l2 "Use coachkit-analyze to cross-check the spec, plan, and tasks at specs/email-validator/. Report all inconsistencies you find." 120)
echo "$analyze_output" > "$TEST_PROJECT/analyze-output.log"

# ---- Assertions ----
echo "--- Verification ---"
echo ""

# Test 1: Phone validation gap found
echo "Test 1: Phone validation (FR-002) gap..."
assert_contains "$analyze_output" "phone|FR-002|FR2|FR.002" "Phone validation gap identified" || FAILED=$((FAILED + 1))
echo ""

# Test 2: Partial email rule coverage found
echo "Test 2: Email rule coverage gap..."
assert_contains "$analyze_output" "missing|gap|incomplete|not.*cover|only.*3" "Email rule coverage gap identified" || FAILED=$((FAILED + 1))
echo ""

# Test 3: Output has findings/issues structure
echo "Test 3: Output structure..."
assert_contains "$analyze_output" "issue|finding|gap|inconsistency|missing|problem" "Output contains findings" || FAILED=$((FAILED + 1))
echo ""

# ---- Summary ----
echo "========================================"
echo " Analyze Adversarial Summary"
echo "========================================"
echo ""

if [ $FAILED -eq 0 ]; then
    echo "STATUS: PASSED"
    echo "Analyze correctly identified:"
    echo "  - Phone validation (FR-002) missing from plan and tasks"
    echo "  - Email rules only partially covered (3 of 5)"
    echo "  - Output structured as findings/issues"
    exit 0
else
    echo "STATUS: FAILED"
    echo "$FAILED verification(s) failed"
    echo ""
    echo "Analyze output saved to: $TEST_PROJECT/analyze-output.log"
    exit 1
fi
