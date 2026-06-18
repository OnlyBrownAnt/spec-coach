#!/usr/bin/env bash
# show-sdd-state.sh — read-only SDD workflow-state reporter (spec 008).
#
# Derives the current feature/phase/decisions from artifacts. It reads NO stored
# state file (.spec/feature.json and the SDD STATE block are gone) and mutates
# nothing. Always exits 0; never drives behavior — a wrong best-effort pick costs
# a glance, not corruption.
#
# Usage: show-sdd-state.sh [token]
#   token   explicit feature token: NNN, slug, or "@" (opt-in: the feature on the
#           current git branch). Omit to default to the most-recently-modified
#           specs/NNN-*/ dir (a soft guess; ambiguity is listed, not hidden).

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh" 2>/dev/null || true

REPO_ROOT="$(get_repo_root 2>/dev/null || pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: show-sdd-state.sh [token]

Read-only report of the current SDD workflow state, derived from specs/NNN-*/
artifacts (no state file is read or written). token may be a feature number
(007), a slug, or "@" (the feature on the current git branch). Omitted → the
most-recently-modified feature (ambiguity is listed).

Non-blocking: always exits 0.
EOF
  exit 0
fi

TOKEN="${1:-}"
FEATURE_DIR="$(resolve_feature "$TOKEN" "$REPO_ROOT")"

# Was the feature chosen by an explicit input (token or SPECIFY_FEATURE env)?
EXPLICIT=0
if [ -n "$TOKEN" ]; then EXPLICIT=1; fi
if [ -n "${SPECIFY_FEATURE:-}${SPECIFY_FEATURE_DIRECTORY:-}" ]; then EXPLICIT=1; fi

if [ -z "$FEATURE_DIR" ]; then
  echo "Feature: (none — no specs/NNN-*/ directories found)"
  echo "Phase: constitution (no feature started)"
else
  SLUG="$(basename "$FEATURE_DIR")"
  PHASE="$(infer_phase "$FEATURE_DIR")"
  echo "Feature: $SLUG"
  echo "Phase: $PHASE (inferred from artifacts)"

  # Ambiguity note: a soft guess among multiple candidates with no explicit input.
  if [ "$EXPLICIT" -eq 0 ]; then
    NCAND="$(_spec_candidates "$REPO_ROOT" | grep -c . || true)"
    if [ "$NCAND" -gt 1 ]; then
      echo "Note: $NCAND features found (ambiguous); showing the most-recently-modified. Pass a token (NNN/slug/@) to be specific:"
      _spec_candidates "$REPO_ROOT" | while IFS= read -r c; do
        [ -d "$c" ] || continue
        echo "  - $(basename "$c")  (phase: $(infer_phase "$c"))"
      done
    fi
  fi

  # Decisions pointer (never a stored digest).
  if [ -f "$FEATURE_DIR/decisions.md" ]; then
    echo "Decisions: see specs/$SLUG/decisions.md (+ spec.md, CHANGELOG.md)"
  else
    echo "Decisions: see specs/$SLUG/spec.md + CHANGELOG.md"
  fi
fi

exit 0
