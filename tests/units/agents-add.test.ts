// Mechanical test for src/commands/agents.ts runAgentsAdd (FR-005/009/013).
// Run: npx tsx tests/units/agents-add.test.ts
// TDD: written BEFORE runAgentsAdd.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, getAgentsStatus } from "../../src/commands/agents.ts";
import { readState } from "../../src/state.ts";
import { COACH_MARKER_START } from "../../src/utils.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

const tmpDirs: string[] = [];
function mktmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

console.log("=== agents-add.test ===");

try {
  // --- FR-013: require-corpus guard ---
  const noCorpus = mktmp("add-nocorpus-");
  const guard = runAgentsAdd("cursor", noCorpus);
  ok("add without corpus -> ok:false", guard.ok === false);
  ok("guard reason mentions init", !guard.ok && /init/i.test(guard.reason));
  ok("guard installs nothing (no agent dir)", !exists(noCorpus, ".cursor/commands/spec"));

  // --- FR-005: add installs skills + context + records state ---
  const t = mktmp("add-ok-");
  fs.mkdirSync(path.join(t, ".spec"), { recursive: true }); // corpus present
  const res = runAgentsAdd("cursor", t);
  ok("add cursor -> ok:true", res.ok === true);
  ok("cursor skills installed (.cursor/commands/spec/*.md)", exists(t, ".cursor/commands/spec") &&
    fs.readdirSync(path.join(t, ".cursor/commands", "spec")).some((f) => f.endsWith(".md")));
  ok("cursor context injected (AGENTS.md block)", exists(t, "AGENTS.md") &&
    fs.readFileSync(path.join(t, "AGENTS.md"), "utf-8").includes(COACH_MARKER_START));
  ok("state records cursor", !!readState(t).cursor);

  // --- claude (skills format) installs into .claude/skills/spec-* ---
  const tc = mktmp("add-claude-");
  fs.mkdirSync(path.join(tc, ".spec"), { recursive: true });
  runAgentsAdd("claude", tc);
  ok("claude skills installed (.claude/skills/spec-*)", exists(tc, ".claude/skills") &&
    fs.readdirSync(path.join(tc, ".claude", "skills")).some((d) => d.startsWith("spec-")));
  ok("claude context -> CLAUDE.md", exists(tc, "CLAUDE.md"));

  // --- FR-005/SC-006: idempotent re-add (no duplicates) ---
  runAgentsAdd("cursor", t);
  const specFiles = fs.readdirSync(path.join(t, ".cursor/commands", "spec")).filter((f) => f.endsWith(".md"));
  const blockCount = (fs.readFileSync(path.join(t, "AGENTS.md"), "utf-8").match(
    new RegExp(COACH_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g"),
  ) || []).length;
  ok("re-add does not duplicate skill files", specFiles.length > 0 && new Set(specFiles).size === specFiles.length);
  ok("re-add keeps a single context block", blockCount === 1);

  // --- unknown agent ---
  const bogus = runAgentsAdd("no-such-agent", t);
  ok("unknown agent -> ok:false", bogus.ok === false);

  // --- getAgentsStatus reflects install ---
  ok("getAgentsStatus marks cursor installed after add", getAgentsStatus(t).some((a) => a.key === "cursor" && a.installed));
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
