// Mechanical test for the test-harness timeout/invoker (spec 012).
// Asserts the harness bounds runtime, kills the WHOLE claude process tree,
// preserves output, and retries — NOT the skills under test (those are correct;
// tests/units/ is the gate). Constitution Principle V: assert on real behavior
// (process death, output survival), not merely "didn't throw".
// Run: npx tsx tests/units/harness-timeout.test.ts
import { execFileSync } from "node:child_process";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

const REPO = path.resolve(import.meta.dirname, "..", "..");
const HELPERS = path.join(REPO, "tests", "test-helpers.sh");
const RUN = path.join(REPO, "tests", "run.sh");
const SRC = "source " + JSON.stringify(HELPERS);
const NL = String.fromCharCode(10);   // avoid "\n" inside TS string literals

interface Res { stdout: string; stderr: string; code: number; ms: number; }
// Run a single-line bash snippet (test-helpers.sh sourced via SRC). execFileSync
// throws on non-zero with the streams attached to the error, so timeouts/non-zero
// are observable. Multi-step bash is built as lines joined by "; ".
function runBash(script: string, timeoutMs = 30000): Res {
  const t0 = Date.now();
  try {
    const stdout = execFileSync("bash", ["-c", script], {
      encoding: "utf8", timeout: timeoutMs, stdio: ["ignore", "pipe", "pipe"],
    });
    return { stdout, stderr: "", code: 0, ms: Date.now() - t0 };
  } catch (e) {
    const er = e as { stdout?: string; stderr?: string; status?: number };
    return { stdout: er.stdout ?? "", stderr: er.stderr ?? "", code: er.status ?? 1, ms: Date.now() - t0 };
  }
}

// Run _timeout over a child command; report exit code + leftover 'sleep 555' count.
// The anchored pattern '^sleep 555$' matches ONLY real sleep processes (cmdline
// exactly "sleep 555"), never this probe's own bash wrapper, so the pkill cleanup
// can't kill the test itself.
function timeoutProbe(childCmd: string, budget: number, grace: number): { rc: string; left: string; ms: number } {
  const script = [
    SRC,
    "pkill -9 -f '^sleep 555$' 2>/dev/null || true",
    "SPEC_GRACE=" + grace + " _timeout " + budget + " bash -c " + JSON.stringify(childCmd) + " >/dev/null 2>&1",
    'echo "RC=$?"',
    "LEFT=$(pgrep -f '^sleep 555$' | wc -l | tr -d ' ')",
    'echo "LEFT=$LEFT"',
    "pkill -9 -f '^sleep 555$' 2>/dev/null || true",
  ].join("; ");
  const r = runBash(script);
  return {
    rc: /RC=(\d+)/.exec(r.stdout)?.[1] ?? "?",
    left: /LEFT=(\d+)/.exec(r.stdout)?.[1] ?? "?",
    ms: r.ms,
  };
}

// Resolve a budget via _claude_budget with a clean baseline env.
function resolveBudget(envAssign: string, explicit: string, defaultVar: string, fallback: number): string {
  const script = [
    SRC,
    "unset SPEC_TIMEOUT_L1 SPEC_TIMEOUT_L2 SPEC_TIMEOUT_OVERRIDE",
    envAssign + " _claude_budget " + JSON.stringify(explicit) + " " + defaultVar + " " + fallback,
  ].join("; ");
  return runBash(script).stdout.trim();
}

// --- A stub `claude` so we can drive _invoke_claude's hang/succeed/retry paths ---
const STUB_DIR = fs.mkdtempSync(path.join(os.tmpdir(), "claude-stub-"));
const STUB_PATH = path.join(STUB_DIR, "claude");
// Behavior via $CLAUDE_STUB; call count in $CLAUDE_COUNTER. One bash line (no NL inside).
const STUB_BODY = [
  "#!/usr/bin/env bash",
  'n=$(cat "$CLAUDE_COUNTER" 2>/dev/null || echo 0); echo $((n+1)) > "$CLAUDE_COUNTER"; '
  + 'case "$CLAUDE_STUB" in '
  + 'partial-hang) echo "partial-output"; sleep 555 ;; '
  + 'empty-then-ok) if [ "$n" -eq 0 ]; then sleep 555; else echo "ok-result"; fi ;; '
  + '*) echo "default-stub" ;; '
  + "esac",
].join(NL);
fs.writeFileSync(STUB_PATH, STUB_BODY);
fs.chmodSync(STUB_PATH, 0o755);

// Run run_claude against the stub; capture stdout / stderr / exit / call count.
function invokeClaude(stubMode: string, envExports: string): { out: string; err: string; rc: string; calls: string } {
  const script = [
    SRC,
    'export PATH="' + STUB_DIR + ':$PATH"',
    "export CLAUDE_STUB=" + JSON.stringify(stubMode),
    'cnt=$(mktemp); echo 0 > "$cnt"; export CLAUDE_COUNTER="$cnt"',
    "err=$(mktemp)",
    envExports,
    'out=$(run_claude test-prompt 2>"$err"); rc=$?',
    'printf "%s\\n" "OUT=$out" "RC=$rc" "CALLS=$(cat "$cnt")" "STDERR=$(cat "$err")"',
  ].join("; ");
  const r = runBash(script, 30000);
  const grab = (k: string): string => new RegExp(k + "=(.*)").exec(r.stdout)?.[1] ?? "";
  return { out: grab("OUT"), err: grab("STDERR"), rc: grab("RC"), calls: grab("CALLS") };
}

console.log("=== harness-timeout.test (US1: _timeout kills the whole tree) ===");

// (a)(b) group-kill + no-orphan + bounded: a long-lived child must die WITH the wrapper.
{
  const p = timeoutProbe("sleep 555 & wait", 3, 4);
  ok("(a) group-kill returns 124 on timeout", p.rc === "124");
  ok("(a) bounded: returns within budget+grace+margin (<20s)", p.ms < 20000);
  ok("(b) no orphaned child survives the kill", p.left === "0");
}

// (c) TERM→KILL escalation: a child that ignores SIGTERM still dies via SIGKILL within grace.
{
  const p = timeoutProbe('trap "" TERM; sleep 555', 2, 4);
  ok("(c) TERM-ignoring child still killed (SIGKILL) -> 124", p.rc === "124" && p.left === "0");
  ok("(c) escalation bounded (<20s)", p.ms < 20000);
}

// (d) dependency-free (Constitution III): _timeout uses setpgrp and does NOT shell out to gtimeout/timeout.
{
  const body = fs.readFileSync(HELPERS, "utf8");
  const fnBody = /_timeout\(\)\s*\{([\s\S]*?)\n\}/.exec(body)?.[1] ?? "";
  ok("(d) _timeout uses setpgrp (process-group kill)", /setpgrp/.test(fnBody));
  ok("(d) _timeout is dependency-free (no gtimeout/timeout command)", !/gtimeout|command -v timeout/.test(fnBody));
}

console.log("=== harness-timeout.test (US2: --timeout/retry/grace propagation) ===");

// (e)(f)(g) _claude_budget resolution: explicit arg > SPEC_TIMEOUT_OVERRIDE > category env var > fallback.
{
  ok("(e) reads SPEC_TIMEOUT_L1 category default", resolveBudget("SPEC_TIMEOUT_L1=250", "", "SPEC_TIMEOUT_L1", 300) === "250");
  ok("(e) reads SPEC_TIMEOUT_L2 category default", resolveBudget("SPEC_TIMEOUT_L2=560", "", "SPEC_TIMEOUT_L2", 600) === "560");
  ok("(e) built-in fallback when env unset (300 / 600)", resolveBudget("", "", "SPEC_TIMEOUT_L1", 300) === "300" && resolveBudget("", "", "SPEC_TIMEOUT_L2", 600) === "600");
  ok("(f) SPEC_TIMEOUT_OVERRIDE wins over category default", resolveBudget("SPEC_TIMEOUT_L1=300 SPEC_TIMEOUT_OVERRIDE=7", "", "SPEC_TIMEOUT_L1", 300) === "7");
  ok("(g) explicit per-call arg wins over all", resolveBudget("SPEC_TIMEOUT_L1=300 SPEC_TIMEOUT_OVERRIDE=7", "99", "SPEC_TIMEOUT_L1", 300) === "99");
}

// (h) run.sh wiring: exports 300/600 defaults and threads --timeout/--retry/--grace into env.
{
  const run = fs.readFileSync(RUN, "utf8");
  ok("(h) run.sh exports SPEC_TIMEOUT_L1=300", /export SPEC_TIMEOUT_L1=300/.test(run));
  ok("(h) run.sh exports SPEC_TIMEOUT_L2=600", /export SPEC_TIMEOUT_L2=600/.test(run));
  ok("(h) run.sh threads --timeout -> SPEC_TIMEOUT_OVERRIDE", /SPEC_TIMEOUT_OVERRIDE/.test(run) && /--timeout/.test(run));
  ok("(h) run.sh threads --retry -> SPEC_RETRIES, --grace -> SPEC_GRACE", /SPEC_RETRIES/.test(run) && /SPEC_GRACE/.test(run));
}

console.log("=== harness-timeout.test (US3: preserve output + bounded retry) ===");

// (i) partial output is preserved on STDOUT when a run is killed mid-flight.
{
  const r = invokeClaude("partial-hang", "export SPEC_TIMEOUT_OVERRIDE=2 SPEC_GRACE=2");
  ok("(i) partial output preserved on stdout (never 0 bytes)", r.out.includes("partial-output"));
}
// (j) an empty-output timeout is retried and succeeds on the next attempt.
{
  const r = invokeClaude("empty-then-ok", "export SPEC_TIMEOUT_OVERRIDE=2 SPEC_GRACE=2 SPEC_RETRIES=1");
  ok("(j) empty-output timeout retried -> 2nd attempt succeeds", r.out.includes("ok-result") && r.calls === "2");
}
// (k) a terminal timeout emits a [TIMEOUT] marker to STDERR for diagnosis.
{
  const r = invokeClaude("partial-hang", "export SPEC_TIMEOUT_OVERRIDE=2 SPEC_GRACE=2");
  ok("(k) [TIMEOUT] marker emitted to stderr", r.err.includes("[TIMEOUT"));
}
// (m) a run with NON-empty output is NOT retried (only empty-output timeouts retry).
{
  const r = invokeClaude("partial-hang", "export SPEC_TIMEOUT_OVERRIDE=2 SPEC_GRACE=2 SPEC_RETRIES=3");
  ok("(m) non-empty output is not retried (single call even with retries=3)", r.calls === "1");
}

console.log("");
console.log("=== Results: " + pass + " passed, " + fail + " failed ===");
process.exit(fail === 0 ? 0 : 1);
