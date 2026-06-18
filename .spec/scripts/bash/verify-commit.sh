#!/usr/bin/env bash
# verify-commit.sh — commit-convention compliance advisor (non-blocking).
#
# Reports whether the commit at <rev> (default HEAD) conforms to the commit
# convention declared in .spec/convention.md (default: Conventional Commits).
# Skips merge commits. Reports convention status ABSENT/TEMPLATE/AUTHORED and
# the allowed type set. spec 010 (FR-004).
#
# This is the first spec-coach advisor that runs git, so every git call is
# scoped to the resolved repo root via `git -C "$REPO_ROOT"` (analysis A3) —
# the advisor is safe to invoke from any cwd.
#
# Usage: verify-commit.sh [rev]
#   no args  → checks HEAD against $REPO_ROOT/.spec/convention.md
#   --help   → usage
#
# FR-004 non-blocking: ALWAYS exits 0. Findings go to stdout. Coach-Not-Gatekeeper.

SCRIPT_DIR="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
# shellcheck source=common.sh
source "$SCRIPT_DIR/common.sh" 2>/dev/null || true

REPO_ROOT="$(get_repo_root 2>/dev/null || pwd)"

if [ "${1:-}" = "--help" ] || [ "${1:-}" = "-h" ]; then
  cat <<'EOF'
Usage: verify-commit.sh [rev]

Reports whether the commit at <rev> (default HEAD) conforms to the commit
convention declared in .spec/convention.md (default: Conventional Commits).
Skips merge commits (they are not governed). Reports convention status
ABSENT / TEMPLATE / AUTHORED and the allowed type set.

Non-blocking: always exits 0. Findings go to stdout.
EOF
  exit 0
fi

REV="${1:-HEAD}"
CONV_FILE="$REPO_ROOT/.spec/convention.md"
DEFAULT_TYPES="feat fix docs refactor test chore"

# --- Convention status + allowed types ---
status="AUTHORED"
allowed_types="$DEFAULT_TYPES"
if [ ! -f "$CONV_FILE" ]; then
  status="ABSENT"
elif grep -qE '\[(PROJECT_NAME|ALLOWED_TYPES|SCOPE_FORMAT)\]' "$CONV_FILE" 2>/dev/null; then
  status="TEMPLATE"
fi
if [ "$status" = "AUTHORED" ]; then
  parsed="$(sed -n '/CONVENTION RULES START/,/CONVENTION RULES END/p' "$CONV_FILE" 2>/dev/null \
    | sed -n 's/^allowed_types:[[:space:]]*//p' | head -1)"
  [ -n "$parsed" ] && allowed_types="$parsed"
fi

echo "Convention: $CONV_FILE"
echo "Convention state: $status"
echo "Allowed types: $allowed_types"

# --- No commit at rev? ---
if ! git -C "$REPO_ROOT" rev-parse --verify "$REV^{commit}" >/dev/null 2>&1; then
  echo "No commit at $REV — nothing to check."
  echo "Status: CLEAN (no commit to check)"
  exit 0
fi

subj="$(git -C "$REPO_ROOT" log -1 --format=%s "$REV")"
echo "Commit: $subj"

# --- Skip merge commits (parents > 1) ---
parents="$(git -C "$REPO_ROOT" rev-list --parents -n 1 "$REV" 2>/dev/null | wc -w | tr -d ' ')"
if [ "$parents" -gt 2 ]; then
  echo "SKIP — merge commit (parents > 1); merges are not governed by the convention."
  echo "Status: CLEAN"
  exit 0
fi

# --- Check the subject: ^<type>(<scope>)?!?: <description> ---
type_token="$(printf '%s' "$subj" | sed -n 's/^\([A-Za-z][A-Za-z]*\).*/\1/p')"
rest="$(printf '%s' "$subj" | sed -n 's/^[A-Za-z][A-Za-z]*//p')"

conforms=0
reason=""
if [ -z "$type_token" ] || [ -z "$rest" ]; then
  reason="subject does not start with a type token (e.g. 'feat: ...')."
elif printf '%s' "$allowed_types" | grep -qw -- "$type_token"; then
  if printf '%s' "$subj" | grep -qE '^[A-Za-z]+(\([^)]*\))?!?: .+'; then
    conforms=1
  else
    reason="type is fine but the subject needs '(scope)!: ' or ': <description>' after it."
  fi
else
  reason="type '$type_token' is not in the allowed set ($allowed_types)."
fi

if [ "$conforms" -eq 1 ]; then
  echo "CONFORMING — subject matches the declared convention."
  echo "Status: CLEAN"
else
  echo "NON-CONFORMING — $reason"
  echo "  Expected: <type>(<scope>): <subject>, type in {$allowed_types}, e.g. 'feat(spec-010): seed convention.md'."
  if [ "$status" = "ABSENT" ]; then
    echo "  (No .spec/convention.md — coaching the default: Conventional Commits.)"
  elif [ "$status" = "TEMPLATE" ]; then
    echo "  (.spec/convention.md is still the TEMPLATE — author it to set your own types; using the default.)"
  fi
  echo "Status: NON-CONFORMING (non-blocking — advisor only; fix and re-run, or amend .spec/convention.md)."
fi

exit 0
