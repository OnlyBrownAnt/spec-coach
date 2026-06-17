#!/usr/bin/env bash
# Mechanical test for scripts/bash/verify-constitution-sync.sh
# Fast, deterministic, no AI. Run: bash tests/scripts/test-verify-constitution-sync.sh
# TDD: written BEFORE the script. Covers FR-003 + edge cases (finding #3 from analysis).
set -u

COACH_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
SCRIPT="$COACH_ROOT/scripts/bash/verify-constitution-sync.sh"

PASS=0
FAIL=0
pass() { echo "  [PASS] $1"; PASS=$((PASS + 1)); }
fail() { echo "  [FAIL] $1"; FAIL=$((FAIL + 1)); }

# write_constitution <path> <principles-block> <sync-block|"">
write_constitution() {
  local path="$1" principles="$2" sync_block="$3"
  {
    echo "# Spec Coach Constitution"
    echo "## Core Principles"
    printf '%s\n' "$principles"
    if [ -n "$sync_block" ]; then
      echo ""
      echo "<!-- SYNC IMPACT START -->"
      printf '%s\n' "$sync_block"
      echo "<!-- SYNC IMPACT END -->"
    fi
    echo ""
    echo "**Version**: 1.0.0 | **Last Amended**: 2026-06-17"
  } > "$path"
}

TMP="$(mktemp -d)"
trap 'rm -rf "$TMP"' EXIT

echo "=== test-verify-constitution-sync ==="

# --- A: clean — no sync block, 3 principles ---
write_constitution "$TMP/clean.md" \
  "### I. Alpha
### II. Beta
### III. Gamma" ""
OUT_A="$(bash "$SCRIPT" "$TMP/clean.md" 2>&1)"; CODE_A=$?
echo "$OUT_A" | grep -q "CLEAN" && pass "A: clean constitution reports CLEAN" || fail "A: clean reports CLEAN"
{ echo "$OUT_A" | grep -q "Alpha" && echo "$OUT_A" | grep -q "Beta" && echo "$OUT_A" | grep -q "Gamma"; } \
  && pass "A: lists all 3 principles" || fail "A: lists all 3 principles"
[ "$CODE_A" -eq 0 ] && pass "A: exits 0 (non-blocking, FR-014)" || fail "A: exits 0 (got $CODE_A)"

# --- B: pending — sync block records a rename + a pending dependent file ---
write_constitution "$TMP/pending.md" \
  "### I. Alpha
### II. Beta-Renamed
### III. Gamma" \
  "Renamed: Beta -> Beta-Renamed
Pending re-alignment: templates/plan-template.md"
OUT_B="$(bash "$SCRIPT" "$TMP/pending.md" 2>&1)"; CODE_B=$?
echo "$OUT_B" | grep -q "PENDING" && pass "B: pending amendment reports PENDING" || fail "B: reports PENDING"
echo "$OUT_B" | grep -q "plan-template" && pass "B: cites the pending dependent file" || fail "B: cites pending file"
[ "$CODE_B" -eq 0 ] && pass "B: exits 0 (non-blocking)" || fail "B: exits 0 (got $CODE_B)"

# --- C: incomplete — sync marker present but report empty (whitespace only) ---
write_constitution "$TMP/incomplete.md" \
  "### I. Alpha
### II. Beta" "   "
OUT_C="$(bash "$SCRIPT" "$TMP/incomplete.md" 2>&1)"; CODE_C=$?
echo "$OUT_C" | grep -q "INCOMPLETE" && pass "C: empty/malformed sync block reports INCOMPLETE" || fail "C: reports INCOMPLETE"
[ "$CODE_C" -eq 0 ] && pass "C: exits 0 (non-blocking)" || fail "C: exits 0 (got $CODE_C)"

# --- D: missing constitution file (edge case from analysis #3) ---
OUT_D="$(bash "$SCRIPT" "$TMP/does-not-exist.md" 2>&1)"; CODE_D=$?
echo "$OUT_D" | grep -qiE "not found|missing|absent" && pass "D: missing constitution handled gracefully" || fail "D: missing file graceful"
[ "$CODE_D" -eq 0 ] && pass "D: exits 0 on missing file" || fail "D: exits 0 (got $CODE_D)"

echo ""
echo "=== Results: $PASS passed, $FAIL failed ==="
[ "$FAIL" -eq 0 ] && exit 0 || exit 1
