#!/usr/bin/env bash
# verify-spec.sh — scan a feature spec for unresolved placeholders & filler (non-blocking).
#
# Flags TBD/TODO, bracketed template tokens (e.g. [EMAIL_FORMAT], [NEEDS CLARIFICATION: …]),
# and the generic filler phrases from skills/plan.md's Self-Review. Bracketed tokens are
# labelled so the author can confirm they are intentionally retained (not silently dropped).
#
# Usage: verify-spec.sh [spec.md]
#   no args → resolves specs/<current-feature>/spec.md via .spec/feature.json
#   --help  → usage
#
# FR-014 non-blocking: ALWAYS exits 0. Findings go to stdout.

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh" 2>/dev/null || true

REPO_ROOT="$(get_repo_root 2>/dev/null || pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: verify-spec.sh [spec.md]

Scans a feature spec for unresolved placeholders (TBD/TODO), bracketed template
tokens, and generic filler phrases that lack specifics.

Non-blocking: always exits 0. Findings go to stdout.
EOF
  exit 0
fi

SPEC="${1:-}"
if [ -z "$SPEC" ]; then
  _pp="$(get_feature_paths 2>/dev/null)" && eval "$_pp" 2>/dev/null && SPEC="${FEATURE_SPEC:-}"
fi
SPEC="${SPEC:-$REPO_ROOT/spec.md}"

echo "Spec: $SPEC"

if [ ! -f "$SPEC" ]; then
  echo "Spec not found at the path above."
  echo "CLEAN — no spec to scan."
  exit 0
fi

found=0

report() {  # report <header> <pattern>
  local header="$1" pattern="$2" matches n
  matches="$(grep -niE "$pattern" "$SPEC" 2>/dev/null || true)"
  [ -z "$matches" ] && return 0
  n="$(printf '%s\n' "$matches" | grep -c .)"
  found=$((found + n))
  echo "[$header]"
  printf '%s\n' "$matches" | sed 's/^/  /'
}

report "Placeholders (TBD/TODO)" '(TBD|TODO)'
report "Bracketed template tokens — confirm intentional" '\[(NEEDS CLARIFICATION|[A-Z][A-Z0-9_]*)\]'
report "Filler phrases (need specifics)" 'implement later|fill in details|add appropriate error handling|add validation|handle edge cases|write tests for the above|similar to task'

if [ "$found" -eq 0 ]; then
  echo "CLEAN — no unresolved placeholder tokens found."
else
  echo "TOTAL: $found unresolved item(s). Resolve before finalizing the spec."
fi

exit 0
