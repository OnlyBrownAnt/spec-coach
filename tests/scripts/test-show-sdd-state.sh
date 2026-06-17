#!/usr/bin/env bash
# Mechanical test for scripts/bash/show-sdd-state.sh
# Fast, deterministic, no AI. Run: bash tests/scripts/test-show-sdd-state.sh
# TDD: written BEFORE the script. Covers FR-006 + edge cases (analysis finding #3).
set -u

COACH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$COACH_ROOT/scripts/bash/show-sdd-state.sh"

PASS=0
FAIL=0
pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# Constitutions
CONST_WITH_STATE="$TMP/const-with-state.md"
CONST_NO_STATE="$TMP/const-no-state.md"
CONST_MALFORMED="$TMP/const-malformed.md"

cat > "$CONST_WITH_STATE" <<'EOF'
# Constitution
## Core Principles
### I. Markdown Is the Product
<!-- SDD STATE START -->
**Current feature**: 099-test
**Last phase**: tasks
**Skipped phases**: clarify
**Decisions**: chose artifact inference over SDD STATE
<!-- SDD STATE END -->
EOF

cat > "$CONST_NO_STATE" <<'EOF'
# Constitution
## Core Principles
### I. Markdown Is the Product
**Version**: 1.0.0
EOF

cat > "$CONST_MALFORMED" <<'EOF'
# Constitution
<!-- SDD STATE START -->
**Decisions**: partial — no end marker
EOF

mkfeat() { mkdir -p "$TMP/$1"; }        # create empty feature dir
touchf() { mkdir -p "$(dirname "$2")"; : > "$2"; }  # ensure dir + touch file

echo "=== test-show-sdd-state ==="

# --- last phase inferred from artifacts ---
mkfeat spec-only;  touchf "" "$TMP/spec-only/spec.md"
mkfeat plan-stage; touchf "" "$TMP/plan-stage/spec.md"; touchf "" "$TMP/plan-stage/plan.md"
mkfeat tasks-stage; touchf "" "$TMP/tasks-stage/tasks.md"
mkfeat analyze-stage; touchf "" "$TMP/analyze-stage/tasks.md"; touchf "" "$TMP/analyze-stage/analysis.md"
mkfeat empty-stage

OUT="$(bash "$SCRIPT" "$TMP/spec-only" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Last phase: specify" && pass "spec.md only → specify" || fail "spec.md only → specify"
OUT="$(bash "$SCRIPT" "$TMP/plan-stage" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Last phase: plan" && pass "spec+plan → plan" || fail "spec+plan → plan"
OUT="$(bash "$SCRIPT" "$TMP/tasks-stage" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Last phase: tasks" && pass "tasks.md → tasks" || fail "tasks.md → tasks"
OUT="$(bash "$SCRIPT" "$TMP/analyze-stage" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Last phase: analyze" && pass "tasks+analysis → analyze (most advanced)" || fail "→ analyze"
OUT="$(bash "$SCRIPT" "$TMP/empty-stage" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Last phase: constitution" && pass "empty feature dir → constitution" || fail "empty → constitution"

# --- feature id surfaced ---
OUT="$(bash "$SCRIPT" "$TMP/spec-only" "$CONST_NO_STATE" 2>&1)"; echo "$OUT" | grep -q "Feature: spec-only" && pass "feature id (basename) surfaced" || fail "feature id surfaced"

# --- decisions/skipped from SDD STATE block ---
OUT="$(bash "$SCRIPT" "$TMP/spec-only" "$CONST_WITH_STATE" 2>&1)"
echo "$OUT" | grep -q "Decisions: chose artifact inference over SDD STATE" && pass "decisions parsed from SDD STATE" || fail "decisions parsed"
echo "$OUT" | grep -q "Skipped phases: clarify" && pass "skipped phases parsed from SDD STATE" || fail "skipped parsed"

# --- no SDD STATE → decisions/skipped 'none' ---
OUT="$(bash "$SCRIPT" "$TMP/spec-only" "$CONST_NO_STATE" 2>&1)"
echo "$OUT" | grep -q "Decisions: none" && pass "no SDD STATE → decisions 'none'" || fail "decisions none"
echo "$OUT" | grep -q "Skipped phases: none" && pass "no SDD STATE → skipped 'none'" || fail "skipped none"

# --- missing feature dir → graceful (edge case #3) ---
OUT="$(bash "$SCRIPT" "$TMP/does-not-exist" "$CONST_NO_STATE" 2>&1)"; CODE=$?
echo "$OUT" | grep -qiE "none|no feature" && pass "missing feature dir handled gracefully" || fail "missing dir graceful"
[ "$CODE" -eq 0 ] && pass "missing feature dir exits 0" || fail "missing dir exits 0 (got $CODE)"

# --- malformed SDD STATE (START, no END) → graceful, still parses what it can (edge case #3) ---
OUT="$(bash "$SCRIPT" "$TMP/spec-only" "$CONST_MALFORMED" 2>&1)"; CODE=$?
echo "$OUT" | grep -q "partial" && pass "malformed SDD STATE still surfaces partial decisions" || fail "malformed graceful"
[ "$CODE" -eq 0 ] && pass "malformed SDD STATE exits 0" || fail "malformed exits 0 (got $CODE)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
