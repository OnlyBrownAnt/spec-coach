#!/usr/bin/env bash
# Common functions and variables for all scripts

# Find repository root by searching upward for .spec directory
# This is the primary marker for spec-coach projects
find_specify_root() {
    local dir="${1:-$(pwd)}"
    # Normalize to absolute path to prevent infinite loop with relative paths
    # Use -- to handle paths starting with - (e.g., -P, -L)
    dir="$(cd -- "$dir" 2>/dev/null && pwd)" || return 1
    local prev_dir=""
    while true; do
        if [ -d "$dir/.spec" ]; then
            echo "$dir"
            return 0
        fi
        # Stop if we've reached filesystem root or dirname stops changing
        if [ "$dir" = "/" ] || [ "$dir" = "$prev_dir" ]; then
            break
        fi
        prev_dir="$dir"
        dir="$(dirname "$dir")"
    done
    return 1
}

# Get repository root, prioritizing .spec directory
# This prevents using a parent repository when spec-coach is initialized in a subdirectory
get_repo_root() {
    # First, look for .spec directory (spec-coach's own marker)
    local specify_root
    if specify_root=$(find_specify_root); then
        echo "$specify_root"
        return
    fi

    # Final fallback to script location
    local script_dir="$(CDPATH="" cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
    (cd "$script_dir/../../.." && pwd)
}

# Derived workflow-state resolver (spec 008).
#
# resolve_feature resolves the "current feature" WITHOUT reading any stored
# state file — .spec/feature.json is ignored and the SDD STATE block is gone.
# State is derived read-only from specs/NNN-*/ artifacts.
#
# Usage: resolve_feature [--strict] [token] [repo_root]
#   --strict   strict policy (writing path): never guess among multiple features
#              — resolve only on an explicit token/env OR a single candidate.
#   token      explicit feature token: a number (007), a slug, or "@" (opt-in
#              "the feature on the current git branch"). Empty = no token.
#   repo_root  repository root (defaults to get_repo_root).
#
# Precedence (soft = default; --strict replaces the mtime tier with single-candidate):
#   1. explicit token (incl. "@")
#   2. SPECIFY_FEATURE / SPECIFY_FEATURE_DIRECTORY env (override only)
#   3. soft: most-recently-modified specs/NNN-*/  |  strict: single candidate only
#   4. none (echo empty)
#
# Always returns 0; echoes the absolute feature dir or empty. Never errors.
# Legacy .spec/feature.json is tolerated (read-ignored, never written/migrated).
resolve_feature() {
    local strict=0
    if [ "${1:-}" = "--strict" ]; then
        strict=1
        shift
    fi
    local token="${1:-}"
    local repo_root="${2:-$(get_repo_root 2>/dev/null || pwd)}"
    local specs_dir="$repo_root/specs"

    # 1. Explicit token (incl. "@").
    if [ -n "$token" ]; then
        if [ "$token" = "@" ]; then
            _resolve_at_branch "$repo_root"
        else
            _resolve_by_token "$repo_root" "$token"
        fi
        return 0
    fi

    # 2. SPECIFY_FEATURE_DIRECTORY / SPECIFY_FEATURE env (override only).
    if [ -n "${SPECIFY_FEATURE_DIRECTORY:-}" ]; then
        local fd="$SPECIFY_FEATURE_DIRECTORY"
        if [ "$fd" != /* ]; then fd="$repo_root/$fd"; fi
        if [ -d "$fd" ]; then
            printf '%s' "$fd"
            return 0
        fi
    fi
    if [ -n "${SPECIFY_FEATURE:-}" ]; then
        local via_env
        via_env="$(_resolve_by_token "$repo_root" "$SPECIFY_FEATURE")"
        if [ -n "$via_env" ]; then
            printf '%s' "$via_env"
            return 0
        fi
    fi

    # 3. No explicit input: derive from specs/ candidates.
    local -a candidates=()
    local d
    for d in "$specs_dir"/[0-9][0-9][0-9]-*/; do
        if [ -d "$d" ]; then
            candidates+=("${d%/}")
        fi
    done
    local count=${#candidates[@]}
    if [ "$count" -eq 0 ]; then
        return 0
    fi
    if [ "$count" -eq 1 ]; then
        printf '%s' "${candidates[0]}"
        return 0
    fi
    # count > 1
    if [ "$strict" -eq 1 ]; then
        return 0   # ambiguous + no explicit input: refuse to guess (writing path)
    fi
    # soft: most-recently-modified
    local newest="${candidates[0]}"
    local c
    for c in "${candidates[@]}"; do
        if [ "$c" -nt "$newest" ]; then
            newest="$c"
        fi
    done
    printf '%s' "$newest"
    return 0
}

# Map a leading NNN from the current git branch to specs/<NNN>-*/. Opt-in only
# (called by resolve_feature when token is "@"). Empty when git is absent, HEAD
# is detached, or the branch has no leading NNN (e.g. main, fix-typo).
_resolve_at_branch() {
    local repo_root="$1"
    local branch=""
    if command -v git >/dev/null 2>&1; then
        branch="$(git -C "$repo_root" branch --show-current 2>/dev/null || true)"
        if [ -z "$branch" ]; then
            branch="$(git -C "$repo_root" symbolic-ref --quiet --short HEAD 2>/dev/null || true)"
        fi
    fi
    local num
    num="$(printf '%s' "$branch" | sed -n 's/^\([0-9][0-9][0-9]\).*/\1/p')"
    if [ -z "$num" ]; then
        return 0
    fi
    _resolve_by_num "$repo_root" "$num"
}

# Resolve a numeric feature id (e.g. 007) to the first matching specs/007-*/.
_resolve_by_num() {
    local repo_root="$1" num="$2"
    local d
    for d in "$repo_root"/specs/"$num"-*/; do
        if [ -d "$d" ]; then
            printf '%s' "${d%/}"
            return 0
        fi
    done
    return 0
}

# Resolve an explicit token (number, full slug, NNN-prefixed, or slug substring)
# to a specs/ dir. Empty when nothing matches.
_resolve_by_token() {
    local repo_root="$1" token="$2"
    local specs_dir="$repo_root/specs"

    # Pure 3-digit number → specs/<num>-*/.
    if printf '%s' "$token" | grep -qE '^[0-9][0-9][0-9]$'; then
        _resolve_by_num "$repo_root" "$token"
        return 0
    fi
    # Exact dir under specs/ (full slug like "007-alpha").
    if [ -d "$specs_dir/$token" ]; then
        printf '%s' "$specs_dir/$token"
        return 0
    fi
    # Leading NNN in a composite token (e.g. "007-alpha" or a branch name).
    local num
    num="$(printf '%s' "$token" | sed -n 's/^\([0-9][0-9][0-9]\).*/\1/p')"
    if [ -n "$num" ]; then
        local via_num
        via_num="$(_resolve_by_num "$repo_root" "$num")"
        if [ -n "$via_num" ]; then
            printf '%s' "$via_num"
            return 0
        fi
    fi
    # Slug substring match (basename contains the token).
    local match=""
    local d
    for d in "$specs_dir"/*/; do
        if [ -d "$d" ]; then
            case "$(basename "$d")" in
                *"$token"*) match="${d%/}"; break ;;
            esac
        fi
    done
    if [ -n "$match" ]; then
        printf '%s' "$match"
    fi
    return 0
}

# Infer the current SDD phase of a feature from its artifacts (spec 008).
# Priority: analysis.md→analyze, tasks.md→tasks, plan.md→plan, spec.md→specify,
# else constitution. Read-only; echoes the phase string.
infer_phase() {
    local feature_dir="$1"
    if [ -f "$feature_dir/analysis.md" ]; then
        printf '%s' "analyze"
    elif [ -f "$feature_dir/tasks.md" ]; then
        printf '%s' "tasks"
    elif [ -f "$feature_dir/plan.md" ]; then
        printf '%s' "plan"
    elif [ -f "$feature_dir/spec.md" ]; then
        printf '%s' "specify"
    else
        printf '%s' "constitution"
    fi
}

# Resume breakpoint: the first unchecked task in a feature's tasks.md (spec 008).
# Echoes the trimmed task line, or "no pending task" (all checked) / "no tasks.md
# yet" (file absent). Read-only.
first_pending_task() {
    local feature_dir="$1"
    local tasks="$feature_dir/tasks.md"
    if [ ! -f "$tasks" ]; then
        printf '%s' "no tasks.md yet"
        return 0
    fi
    local line
    line="$(grep -m1 -E '^[[:space:]]*- \[ \]' "$tasks" 2>/dev/null || true)"
    if [ -n "$line" ]; then
        printf '%s' "$(printf '%s' "$line" | sed -e 's/^[[:space:]]*//')"
    else
        printf '%s' "no pending task"
    fi
    return 0
}

# List specs/NNN-*/ candidate feature dirs (one absolute path per line). Used by
# the read-only reporter to detect/list ambiguity. (spec 008)
_spec_candidates() {
    local repo_root="$1"
    local d
    for d in "$repo_root"/specs/[0-9][0-9][0-9]-*/; do
        if [ -d "$d" ]; then
            printf '%s\n' "${d%/}"
        fi
    done
}

# Get current feature name from the SPECIFY_FEATURE override (display-role only).
# Not a source of the current feature — resolve_feature is (spec 008).
get_current_branch() {
    if [[ -n "${SPECIFY_FEATURE:-}" ]]; then
        echo "$SPECIFY_FEATURE"
        return
    fi

    # Display-role only (spec 008): mirrors SPECIFY_FEATURE for the CURRENT_BRANCH
    # output var consumed by setup-plan.sh/check-prerequisites.sh. Not a source of
    # the current feature — resolve_feature is. Empty when no override is set.
    echo ""
}

# .spec/feature.json read/persist helpers removed (spec 008): workflow state is
# derived read-only from specs/ artifacts — nothing reads or writes feature.json.

get_feature_paths() {
    local repo_root=$(get_repo_root)
    local token="${1:-}"

    # Resolve the feature directory via the derived resolver (spec 008). The
    # writing path uses STRICT policy: resolve only on an explicit token/env
    # OR a single candidate — never silently guess among multiple features
    # (which would write artifacts into the wrong feature dir).
    local feature_dir
    feature_dir="$(resolve_feature --strict "$token" "$repo_root")"
    if [ -z "$feature_dir" ]; then
        echo "ERROR: Could not resolve a feature unambiguously. Pass a feature token (NNN/slug/@), set SPECIFY_FEATURE, or keep exactly one specs/NNN-*/ directory." >&2
        return 1
    fi

    local current_branch=$(get_current_branch)

    # Use printf '%q' to safely quote values, preventing shell injection
    # via crafted branch names or paths containing special characters
    printf 'REPO_ROOT=%q\n' "$repo_root"
    printf 'CURRENT_BRANCH=%q\n' "$current_branch"
    printf 'FEATURE_DIR=%q\n' "$feature_dir"
    printf 'FEATURE_SPEC=%q\n' "$feature_dir/spec.md"
    printf 'IMPL_PLAN=%q\n' "$feature_dir/plan.md"
    printf 'TASKS=%q\n' "$feature_dir/tasks.md"
    printf 'RESEARCH=%q\n' "$feature_dir/research.md"
    printf 'DATA_MODEL=%q\n' "$feature_dir/data-model.md"
    printf 'QUICKSTART=%q\n' "$feature_dir/quickstart.md"
    printf 'CONTRACTS_DIR=%q\n' "$feature_dir/contracts"
}

# Check if jq is available for safe JSON construction
has_jq() {
    command -v jq >/dev/null 2>&1
}

get_invoke_separator() {
    local repo_root="${1:-$(get_repo_root)}"
    if [[ "${_SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT:-}" == "$repo_root" && -n "${_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE:-}" ]]; then
        printf '%s\n' "$_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE"
        return 0
    fi

    local integration_json="$repo_root/.spec/integration.json"
    local separator="."
    local parsed_with_jq=0

    if [[ -f "$integration_json" ]]; then
        if command -v jq >/dev/null 2>&1; then
            local jq_separator
            if jq_separator=$(jq -r '(.default_integration // .integration // "") as $k | if $k == "" then "." else (.integration_settings[$k].invoke_separator // ".") end' "$integration_json" 2>/dev/null); then
                parsed_with_jq=1
                case "$jq_separator" in
                    "."|"-") separator="$jq_separator" ;;
                esac
            fi
        fi

        if [[ "$parsed_with_jq" -eq 0 ]] && command -v python3 >/dev/null 2>&1; then
            if separator=$(python3 - "$integration_json" <<'PY' 2>/dev/null
import json
import sys

try:
    with open(sys.argv[1], encoding="utf-8") as fh:
        state = json.load(fh)
    key = state.get("default_integration") or state.get("integration") or ""
    settings = state.get("integration_settings")
    separator = "."
    if isinstance(key, str) and isinstance(settings, dict):
        entry = settings.get(key)
        if isinstance(entry, dict) and entry.get("invoke_separator") in {".", "-"}:
            separator = entry["invoke_separator"]
    print(separator)
except Exception:
    print(".")
PY
); then
                case "$separator" in
                    "."|"-") ;;
                    *) separator="." ;;
                esac
            else
                separator="."
            fi
        fi
    fi

    _SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT="$repo_root"
    _SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE="$separator"
    printf '%s\n' "$separator"
}

format_spec_command() {
    local command_name="$1"
    local repo_root="${2:-$(get_repo_root)}"
    local separator
    if [[ "${_SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT:-}" == "$repo_root" && -n "${_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE:-}" ]]; then
        separator="$_SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE"
    else
        separator=$(get_invoke_separator "$repo_root")
        _SPECIFY_INVOKE_SEPARATOR_CACHE_REPO_ROOT="$repo_root"
        _SPECIFY_INVOKE_SEPARATOR_CACHE_VALUE="$separator"
    fi

    command_name="${command_name#/}"
    command_name="${command_name#spec.}"
    command_name="${command_name#spec-}"
    command_name="${command_name//./$separator}"

    printf '/spec%s%s\n' "$separator" "$command_name"
}

# Escape a string for safe embedding in a JSON value (fallback when jq is unavailable).
# Handles backslash, double-quote, and JSON-required control character escapes (RFC 8259).
json_escape() {
    local s="$1"
    s="${s//\\/\\\\}"
    s="${s//\"/\\\"}"
    s="${s//$'\n'/\\n}"
    s="${s//$'\t'/\\t}"
    s="${s//$'\r'/\\r}"
    s="${s//$'\b'/\\b}"
    s="${s//$'\f'/\\f}"
    # Escape any remaining U+0001-U+001F control characters as \uXXXX.
    # (U+0000/NUL cannot appear in bash strings and is excluded.)
    # LC_ALL=C ensures ${#s} counts bytes and ${s:$i:1} yields single bytes,
    # so multi-byte UTF-8 sequences (first byte >= 0xC0) pass through intact.
    local LC_ALL=C
    local i char code
    for (( i=0; i<${#s}; i++ )); do
        char="${s:$i:1}"
        printf -v code '%d' "'$char" 2>/dev/null || code=256
        if (( code >= 1 && code <= 31 )); then
            printf '\\u%04x' "$code"
        else
            printf '%s' "$char"
        fi
    done
}

check_file() { [[ -f "$1" ]] && echo "  ✓ $2" || echo "  ✗ $2"; }
check_dir() { [[ -d "$1" && -n $(ls -A "$1" 2>/dev/null) ]] && echo "  ✓ $2" || echo "  ✗ $2"; }

# Resolve a template name to a file path using the priority stack:
#   1. .spec/templates/overrides/
#   2. .spec/presets/<preset-id>/templates/ (sorted by priority from .registry)
#   3. .spec/extensions/<ext-id>/templates/
#   4. .spec/templates/ (core)
resolve_template() {
    local template_name="$1"
    local repo_root="$2"
    local base="$repo_root/.spec/templates"

    # Priority 1: Project overrides
    local override="$base/overrides/${template_name}.md"
    [ -f "$override" ] && echo "$override" && return 0

    # Priority 2: Installed presets (sorted by priority from .registry)
    local presets_dir="$repo_root/.spec/presets"
    if [ -d "$presets_dir" ]; then
        local registry_file="$presets_dir/.registry"
        if [ -f "$registry_file" ] && command -v python3 >/dev/null 2>&1; then
            # Read preset IDs sorted by priority (lower number = higher precedence).
            # The python3 call is wrapped in an if-condition so that set -e does not
            # abort the function when python3 exits non-zero (e.g. invalid JSON).
            local sorted_presets=""
            if sorted_presets=$(SPECKIT_REGISTRY="$registry_file" python3 -c "
import json, sys, os
try:
    with open(os.environ['SPECKIT_REGISTRY']) as f:
        data = json.load(f)
    presets = data.get('presets', {})
    for pid, meta in sorted(presets.items(), key=lambda x: x[1].get('priority', 10) if isinstance(x[1], dict) else 10):
        if isinstance(meta, dict) and meta.get('enabled', True) is not False:
            print(pid)
except Exception:
    sys.exit(1)
" 2>/dev/null); then
                if [ -n "$sorted_presets" ]; then
                    # python3 succeeded and returned preset IDs — search in priority order
                    while IFS= read -r preset_id; do
                        local candidate="$presets_dir/$preset_id/templates/${template_name}.md"
                        [ -f "$candidate" ] && echo "$candidate" && return 0
                    done <<< "$sorted_presets"
                fi
                # python3 succeeded but registry has no presets — nothing to search
            else
                # python3 failed (missing, or registry parse error) — fall back to unordered directory scan
                for preset in "$presets_dir"/*/; do
                    [ -d "$preset" ] || continue
                    local candidate="$preset/templates/${template_name}.md"
                    [ -f "$candidate" ] && echo "$candidate" && return 0
                done
            fi
        else
            # Fallback: alphabetical directory order (no python3 available)
            for preset in "$presets_dir"/*/; do
                [ -d "$preset" ] || continue
                local candidate="$preset/templates/${template_name}.md"
                [ -f "$candidate" ] && echo "$candidate" && return 0
            done
        fi
    fi

    # Priority 3: Extension-provided templates
    local ext_dir="$repo_root/.spec/extensions"
    if [ -d "$ext_dir" ]; then
        for ext in "$ext_dir"/*/; do
            [ -d "$ext" ] || continue
            # Skip hidden directories (e.g. .backup, .cache)
            case "$(basename "$ext")" in .*) continue;; esac
            local candidate="$ext/templates/${template_name}.md"
            [ -f "$candidate" ] && echo "$candidate" && return 0
        done
    fi

    # Priority 4: Core templates
    local core="$base/${template_name}.md"
    [ -f "$core" ] && echo "$core" && return 0

    # Template not found in any location.
    # Return 1 so callers can distinguish "not found" from "found".
    # Callers running under set -e should use: TEMPLATE=$(resolve_template ...) || true
    return 1
}

# Resolve a template name to composed content using composition strategies.
# Reads strategy metadata from preset manifests and composes content
# from multiple layers using prepend, append, or wrap strategies.
#
# Usage: CONTENT=$(resolve_template_content "template-name" "$REPO_ROOT")
# Returns composed content string on stdout; exit code 1 if not found.
resolve_template_content() {
    local template_name="$1"
    local repo_root="$2"
    local base="$repo_root/.spec/templates"

    # Collect all layers (highest priority first)
    local -a layer_paths=()
    local -a layer_strategies=()

    # Priority 1: Project overrides (always "replace")
    local override="$base/overrides/${template_name}.md"
    if [ -f "$override" ]; then
        layer_paths+=("$override")
        layer_strategies+=("replace")
    fi

    # Priority 2: Installed presets (sorted by priority from .registry)
    local presets_dir="$repo_root/.spec/presets"
    if [ -d "$presets_dir" ]; then
        local registry_file="$presets_dir/.registry"
        local sorted_presets=""
        if [ -f "$registry_file" ] && command -v python3 >/dev/null 2>&1; then
            if sorted_presets=$(SPECKIT_REGISTRY="$registry_file" python3 -c "
import json, sys, os
try:
    with open(os.environ['SPECKIT_REGISTRY']) as f:
        data = json.load(f)
    presets = data.get('presets', {})
    for pid, meta in sorted(presets.items(), key=lambda x: x[1].get('priority', 10) if isinstance(x[1], dict) else 10):
        if isinstance(meta, dict) and meta.get('enabled', True) is not False:
            print(pid)
except Exception:
    sys.exit(1)
" 2>/dev/null); then
                if [ -n "$sorted_presets" ]; then
                    local yaml_warned=false
                    while IFS= read -r preset_id; do
                        # Read strategy and file path from preset manifest
                        local strategy="replace"
                        local manifest_file=""
                        local manifest="$presets_dir/$preset_id/preset.yml"
                        if [ -f "$manifest" ] && command -v python3 >/dev/null 2>&1; then
                            # Requires PyYAML; falls back to replace/convention if unavailable
                            local result
                            local py_stderr
                            py_stderr=$(mktemp)
                            result=$(SPECKIT_MANIFEST="$manifest" SPECKIT_TMPL="$template_name" python3 -c "
import sys, os
try:
    import yaml
except ImportError:
    print('yaml_missing', file=sys.stderr)
    print('replace\t')
    sys.exit(0)
try:
    with open(os.environ['SPECKIT_MANIFEST']) as f:
        data = yaml.safe_load(f)
    for t in data.get('provides', {}).get('templates', []):
        if t.get('name') == os.environ['SPECKIT_TMPL'] and t.get('type', 'template') == 'template':
            print(t.get('strategy', 'replace') + '\t' + t.get('file', ''))
            sys.exit(0)
    print('replace\t')
except Exception:
    print('replace\t')
" 2>"$py_stderr")
                            local parse_status=$?
                            if [ $parse_status -eq 0 ] && [ -n "$result" ]; then
                                IFS=$'\t' read -r strategy manifest_file <<< "$result"
                                strategy=$(printf '%s' "$strategy" | tr '[:upper:]' '[:lower:]')
                            fi
                            if [ "$yaml_warned" = false ] && grep -q 'yaml_missing' "$py_stderr" 2>/dev/null; then
                                echo "Warning: PyYAML not available; composition strategies may be ignored" >&2
                                yaml_warned=true
                            fi
                            rm -f "$py_stderr"
                        fi
                        # Try manifest file path first, then convention path
                        local candidate=""
                        if [ -n "$manifest_file" ]; then
                            # Reject absolute paths and parent traversal
                            case "$manifest_file" in
                                /*|*../*|../*) manifest_file="" ;;
                            esac
                        fi
                        if [ -n "$manifest_file" ]; then
                            local mf="$presets_dir/$preset_id/$manifest_file"
                            [ -f "$mf" ] && candidate="$mf"
                        fi
                        if [ -z "$candidate" ]; then
                            local cf="$presets_dir/$preset_id/templates/${template_name}.md"
                            [ -f "$cf" ] && candidate="$cf"
                        fi
                        if [ -n "$candidate" ]; then
                            layer_paths+=("$candidate")
                            layer_strategies+=("$strategy")
                        fi
                    done <<< "$sorted_presets"
                fi
            else
                # python3 failed — fall back to unordered directory scan (replace only)
                for preset in "$presets_dir"/*/; do
                    [ -d "$preset" ] || continue
                    local candidate="$preset/templates/${template_name}.md"
                    if [ -f "$candidate" ]; then
                        layer_paths+=("$candidate")
                        layer_strategies+=("replace")
                    fi
                done
            fi
        else
            # No python3 or registry — fall back to unordered directory scan (replace only)
            for preset in "$presets_dir"/*/; do
                [ -d "$preset" ] || continue
                local candidate="$preset/templates/${template_name}.md"
                if [ -f "$candidate" ]; then
                    layer_paths+=("$candidate")
                    layer_strategies+=("replace")
                fi
            done
        fi
    fi

    # Priority 3: Extension-provided templates (always "replace")
    local ext_dir="$repo_root/.spec/extensions"
    if [ -d "$ext_dir" ]; then
        for ext in "$ext_dir"/*/; do
            [ -d "$ext" ] || continue
            case "$(basename "$ext")" in .*) continue;; esac
            local candidate="$ext/templates/${template_name}.md"
            if [ -f "$candidate" ]; then
                layer_paths+=("$candidate")
                layer_strategies+=("replace")
            fi
        done
    fi

    # Priority 4: Core templates (always "replace")
    local core="$base/${template_name}.md"
    if [ -f "$core" ]; then
        layer_paths+=("$core")
        layer_strategies+=("replace")
    fi

    local count=${#layer_paths[@]}
    [ "$count" -eq 0 ] && return 1

    # Check if any layer uses a non-replace strategy
    local has_composition=false
    for s in "${layer_strategies[@]}"; do
        [ "$s" != "replace" ] && has_composition=true && break
    done

    # If the top (highest-priority) layer is replace, it wins entirely —
    # lower layers are irrelevant regardless of their strategies.
    if [ "${layer_strategies[0]}" = "replace" ]; then
        cat "${layer_paths[0]}"
        return 0
    fi

    if [ "$has_composition" = false ]; then
        cat "${layer_paths[0]}"
        return 0
    fi

    # Find the effective base: scan from highest priority (index 0) downward
    # to find the nearest replace layer. Only compose layers above that base.
    local base_idx=-1
    local i
    for (( i=0; i<count; i++ )); do
        if [ "${layer_strategies[$i]}" = "replace" ]; then
            base_idx=$i
            break
        fi
    done

    if [ $base_idx -lt 0 ]; then
        return 1  # no base layer found
    fi

    # Read the base content; compose layers above the base (higher priority)
    local content
    content=$(cat "${layer_paths[$base_idx]}"; printf x)
    content="${content%x}"

    for (( i=base_idx-1; i>=0; i-- )); do
        local path="${layer_paths[$i]}"
        local strat="${layer_strategies[$i]}"
        local layer_content
        # Preserve trailing newlines
        layer_content=$(cat "$path"; printf x)
        layer_content="${layer_content%x}"

        case "$strat" in
            replace) content="$layer_content" ;;
            prepend) content="$(printf '%s\n\n%s' "$layer_content" "$content")" ;;
            append)  content="$(printf '%s\n\n%s' "$content" "$layer_content")" ;;
            wrap)
                case "$layer_content" in
                    *'{CORE_TEMPLATE}'*) ;;
                    *) echo "Error: wrap strategy missing {CORE_TEMPLATE} placeholder" >&2; return 1 ;;
                esac
                while [[ "$layer_content" == *'{CORE_TEMPLATE}'* ]]; do
                    local before="${layer_content%%\{CORE_TEMPLATE\}*}"
                    local after="${layer_content#*\{CORE_TEMPLATE\}}"
                    layer_content="${before}${content}${after}"
                done
                content="$layer_content"
                ;;
            *) echo "Error: unknown strategy '$strat'" >&2; return 1 ;;
        esac
    done

    printf '%s' "$content"
    return 0
}
