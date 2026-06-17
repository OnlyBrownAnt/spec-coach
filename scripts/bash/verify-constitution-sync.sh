#!/usr/bin/env bash
# verify-constitution-sync.sh — narrow constitution-sync verification (non-blocking).
#
# Reports the constitution's current principle set and the status of any pending
# Sync Impact Report (recorded by /spec-constitution after an amendment). This is a
# NARROW mechanical check: it does not re-derive semantic drift (that is the AI's
# job via the Constitution Check). It only surfaces what an amendment recorded and
# whether the report is complete. See specs/002-constitution-enforcement-reach/.
#
# Usage: verify-constitution-sync.sh [path/to/constitution.md]
#   no args  → uses $REPO_ROOT/.spec/memory/constitution.md
#   --help   → usage
#
# FR-014 non-blocking: ALWAYS exits 0. Findings go to stdout.

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh" 2>/dev/null || true

REPO_ROOT="$(get_repo_root 2>/dev/null || pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: verify-constitution-sync.sh [constitution.md]

Reports the constitution's current principle set and the status of any pending
Sync Impact Report (recorded by /spec-constitution after an amendment).

Non-blocking: always exits 0. Findings go to stdout.
EOF
  exit 0
fi

CONST_FILE="${1:-$REPO_ROOT/.spec/memory/constitution.md}"

echo "Constitution: $CONST_FILE"

if [ ! -f "$CONST_FILE" ]; then
  echo "Constitution not found at the path above."
  echo "Status: CLEAN (no constitution present to check)"
  exit 0
fi

# Principles = level-3 headings; strip a leading roman-numeral prefix if present
# (constitution writes them as '### I. Markdown Is the Product').
principles="$(grep -E '^### ' "$CONST_FILE" 2>/dev/null \
  | sed -E 's/^### +[IVXivx]+\.?[[:space:]]*//' \
  | sed -E 's/^### +//')"
count="$(printf '%s\n' "$principles" | grep -c . 2>/dev/null || echo 0)"

if [ "$count" -gt 0 ]; then
  names="$(printf '%s\n' "$principles" | awk 'NR>1{printf ", "} {printf "%s", $0}')"
  echo "Principles ($count): $names"
else
  echo "Principles (0): none found (expected ### headings under Core Principles)"
fi

# Sync Impact Report block (recorded by /spec-constitution on amendment).
if grep -q '<!-- SYNC IMPACT START -->' "$CONST_FILE" 2>/dev/null; then
  block="$(sed -n '/<!-- SYNC IMPACT START -->/,/<!-- SYNC IMPACT END -->/p' "$CONST_FILE" \
    | grep -v 'SYNC IMPACT START' | grep -v 'SYNC IMPACT END' \
    | sed -E 's/[[:space:]]+$//' | grep -v '^$')"
  if [ -z "$block" ]; then
    echo "Status: AMENDMENT INCOMPLETE — a Sync Impact marker is present but the report is empty/malformed."
    echo "  Action: record the amendment (changed principles + dependent files) in the block, or remove the marker."
  else
    echo "Status: AMENDMENT PENDING — a constitution amendment is recorded; dependent artifacts may be stale:"
    printf '%s\n' "$block" | sed 's/^/  - /'
    echo "  Action: re-align the dependent artifacts named above, then remove the SYNC IMPACT block."
  fi
else
  echo "Status: CLEAN — no pending constitution amendment recorded."
fi

exit 0
