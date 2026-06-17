#!/usr/bin/env bash
# Mechanical test for scripts/bash/verify-spec.sh
# Fast, deterministic, no AI. Run: bash tests/scripts/test-verify-spec.sh
# TDD: written BEFORE the script. Covers FR-010 + edge cases (analysis finding #3).
set -u

COACH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$COACH_ROOT/scripts/bash/verify-spec.sh"

PASS=0
FAIL=0
pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

# spec WITH placeholder tokens + filler phrases
cat > "$TMP/dirty.md" <<'EOF'
# Feature Spec: Widget
## Requirements
- FR-001: System MUST [NEEDS CLARIFICATION: auth method]
- FR-002: TBD
- FR-003: System MUST validate [EMAIL_FORMAT]
- FR-004: implement later
- FR-005: add appropriate error handling
EOF

# clean spec — no tokens
cat > "$TMP/clean.md" <<'EOF'
# Feature Spec: Widget
## Requirements
- FR-001: System MUST validate email addresses with an RFC-compliant regex.
- FR-002: System MUST reject addresses over 254 characters.
EOF

echo "=== test-verify-spec ==="

# --- dirty spec: tokens detected ---
OUT="$(bash "$SCRIPT" "$TMP/dirty.md" 2>&1)"; CODE=$?
echo "$OUT" | grep -q "TBD" && pass "detects TBD" || fail "detects TBD"
echo "$OUT" | grep -q "NEEDS CLARIFICATION\|EMAIL_FORMAT" && pass "detects bracketed ALL_CAPS token" || fail "detects bracketed token"
echo "$OUT" | grep -qi "implement later" && pass "detects filler 'implement later'" || fail "detects 'implement later'"
echo "$OUT" | grep -qi "error handling" && pass "detects filler 'add appropriate error handling'" || fail "detects 'error handling'"
echo "$OUT" | grep -qiE "template token|confirm" && pass "labels bracketed token for author confirmation (intentional-slot advisory)" || fail "labels bracketed token"
[ "$CODE" -eq 0 ] && pass "dirty spec exits 0 (non-blocking, FR-014)" || fail "dirty exits 0 (got $CODE)"

# --- clean spec: no findings ---
OUT="$(bash "$SCRIPT" "$TMP/clean.md" 2>&1)"; CODE=$?
echo "$OUT" | grep -qiE "CLEAN|0 unresolved|no unresolved|no findings" && pass "clean spec reports CLEAN" || fail "clean reports CLEAN"
[ "$CODE" -eq 0 ] && pass "clean spec exits 0" || fail "clean exits 0 (got $CODE)"

# --- missing file: graceful ---
OUT="$(bash "$SCRIPT" "$TMP/missing.md" 2>&1)"; CODE=$?
echo "$OUT" | grep -qiE "not found|missing|absent" && pass "missing spec handled gracefully" || fail "missing graceful"
[ "$CODE" -eq 0 ] && pass "missing spec exits 0" || fail "missing exits 0 (got $CODE)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
