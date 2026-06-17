#!/usr/bin/env bash
# show-sdd-state.sh — surface the current SDD workflow state (non-blocking).
#
# Prints: current feature (basename of the feature directory), the last phase
# (INFERRED from which artifacts exist — not the never-maintained SDD STATE
# `Last phase` field), and decisions/skipped (read from the SDD STATE block in
# the constitution when present). See specs/002-constitution-enforcement-reach/.
#
# Usage: show-sdd-state.sh [feature-dir] [constitution.md]
#   no args  → feature dir from .spec/feature.json; constitution from repo.
#   --help   → usage.
#
# FR-014 non-blocking: ALWAYS exits 0.

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh" 2>/dev/null || true

REPO_ROOT="$(get_repo_root 2>/dev/null || pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: show-sdd-state.sh [feature-dir] [constitution.md]

Surfaces the current SDD workflow state: current feature, last phase (inferred
from artifacts), and decisions/skipped (from the constitution's SDD STATE block).

Non-blocking: always exits 0.
EOF
  exit 0
fi

FEATURE_DIR="${1:-}"
CONSTITUTION="${2:-$REPO_ROOT/.spec/memory/constitution.md}"

# Resolve feature dir from .spec/feature.json when not passed explicitly.
if [ -z "$FEATURE_DIR" ]; then
  fd="$(read_feature_json_feature_directory "$REPO_ROOT")"
  if [ -n "$fd" ]; then
    FEATURE_DIR="$fd"
    [[ "$FEATURE_DIR" != /* ]] && FEATURE_DIR="$REPO_ROOT/$FEATURE_DIR"
  fi
fi

# --- Current feature + last phase (artifact-inferred) ---
if [ -n "$FEATURE_DIR" ] && [ -d "$FEATURE_DIR" ]; then
  echo "Feature: $(basename "$FEATURE_DIR")"
  if [ -f "$FEATURE_DIR/analysis.md" ]; then phase="analyze"
  elif [ -f "$FEATURE_DIR/tasks.md" ]; then phase="tasks"
  elif [ -f "$FEATURE_DIR/plan.md" ]; then phase="plan"
  elif [ -f "$FEATURE_DIR/spec.md" ]; then phase="specify"
  else phase="constitution"; fi
  echo "Last phase: $phase (inferred from artifacts)"
else
  echo "Feature: (none — no feature directory resolved)"
  echo "Last phase: constitution (no feature started)"
fi

# --- Decisions / skipped from the SDD STATE block (best-effort, never crashes) ---
decisions="none"
skipped="none"
if [ -f "$CONSTITUTION" ] && grep -q 'SDD STATE START' "$CONSTITUTION" 2>/dev/null; then
  block="$(sed -n '/SDD STATE START/,/SDD STATE END/p' "$CONSTITUTION" 2>/dev/null)"
  d="$(printf '%s\n' "$block" | grep -iE '^\*\*Decisions\*\*' | sed -E 's/^\*\*Decisions\*\*:?[[:space:]]*//' | head -1)"
  s="$(printf '%s\n' "$block" | grep -iE '^\*\*Skipped' | sed -E 's/^\*\*Skipped[^:]*:?[[:space:]]*//' | head -1)"
  [ -n "$d" ] && [ "$d" != "none" ] && decisions="$d"
  [ -n "$s" ] && [ "$s" != "none" ] && skipped="$s"
fi
echo "Decisions: $decisions"
echo "Skipped phases: $skipped"

exit 0
