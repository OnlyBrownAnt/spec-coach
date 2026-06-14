# spec-coach Skill Tests

Behavioral and integration tests for spec-coach's 10 SDD skills. Modeled on the superpowers test system.

## Quick Start

```bash
# Run all L1 behavioral tests (~8 minutes)
npm test

# Run all tests including L2 integration (~30 minutes)
npm run test:all

# Run a specific test
bash tests/run.sh test-implement

# Verbose output
npm run test:verbose

# List available tests
bash tests/run.sh list

# View run history
bash tests/run.sh results
```

## Structure

```
tests/
├── run.sh                          # CLI test runner
├── test-helpers.sh                 # Shared assertion library
├── behavioral/                     # L1: Fast behavioral tests
│   ├── test-implement.sh           #   Implement skill knowledge
│   ├── test-specify.sh             #   Specify skill knowledge
│   ├── test-plan.sh                #   Plan skill knowledge
│   ├── test-tasks.sh               #   Tasks skill knowledge
│   └── test-analyze.sh             #   Analyze skill knowledge
├── integration/                    # L2: Slow integration + adversarial tests
│   ├── test-full-sdd-workflow.sh   #   End-to-end specify -> implement
│   ├── test-analyze-catches-bugs.sh#   Adversarial: planted inconsistencies
│   └── test-implement-adversarial.sh#  Adversarial: skip-tests pressure
└── README.md                       # This file
```

## Test Types

### L1: Behavioral Tests

Verify each skill knows its correct behavior. Tests ask Claude direct questions via `claude -p` and assert the skill describes the right workflow. **No code is written.** Fast (~1-2 min each).

### L2: Integration Tests

Full workflow execution on real test projects. **Slow** (5-15 min each), not run by default. Includes adversarial tests that plant deliberate errors and verify skills catch them.

## How Tests Work

1. Each test sources `test-helpers.sh` for assertions
2. `run_claude "prompt" [timeout]` invokes Claude Code in headless mode with `--plugin-dir` pointing to spec-coach root
3. Assertions (`assert_contains`, `assert_not_contains`, `assert_order`, `assert_count`) verify the output
4. Tests are isolated — each uses `mktemp -d` for scratch projects, cleaned via `trap EXIT`
5. Tests return 0 on success, non-zero on failure

## Writing a New Test

1. Create `tests/behavioral/test-<skill>.sh` or `tests/integration/test-<skill>.sh`
2. Source `test-helpers.sh` from parent directory
3. Use `run_claude` + assertions to verify behavior
4. Make executable: `chmod +x tests/behavioral/test-<skill>.sh`
5. Run: `bash tests/run.sh test-<skill>`

### Behavioral test template:

```bash
#!/usr/bin/env bash
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "$0")" && pwd)"
source "$SCRIPT_DIR/../test-helpers.sh"

echo "=== Test: <skill-name> skill ==="
echo ""

output=$(run_claude "What does spec-<name> do?" 60)
assert_contains "$output" "<expected>" "Skill recognized"
# ... more assertions ...

echo "=== All <skill-name> tests passed ==="
```

## Requirements

- Claude Code CLI installed (`claude --version`)
- Node.js (for L2 integration test projects)
- macOS or Linux (macOS `timeout` handled via perl fallback)

## Timeout

- Default: 300s per test
- L2 tests may need `--timeout 600` for longer workflows
- Set with: `bash tests/run.sh --timeout 900`

## CI Integration

```bash
# Quick CI check (L1 only)
bash tests/run.sh --timeout 600

# Full CI suite
bash tests/run.sh all --timeout 900
```
