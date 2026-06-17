// Mechanical test for src/commands/agents.ts runAgentsUpdate (FR-012, advisory #4/#5).
// Run: npx tsx tests/units/agents-update.test.ts
// TDD: written BEFORE runAgentsUpdate.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, runAgentsUpdate } from "../../src/commands/agents.ts";
import { readState, writeState } from "../../src/state.ts";
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
function blockCount(root: string, file: string): number {
  try {
    const re = new RegExp(COACH_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g");
    return (fs.readFileSync(path.join(root, file), "utf-8").match(re) || []).length;
  } catch { return 0; }
}

console.log("=== agents-update.test ===");

try {
  // --- FR-012: update refreshes an installed agent ---
  const t1 = mktmp("up-");
  fs.mkdirSync(path.join(t1, ".spec"), { recursive: true });
  runAgentsAdd("cursor", t1);
  const r = runAgentsUpdate("cursor", t1);
  ok("update cursor -> ok:true", r.ok === true);
  ok("skills still present after update", fs.existsSync(path.join(t1, ".cursor/commands/spec")));
  ok("single context block after update", blockCount(t1, "AGENTS.md") === 1);

  // --- advisory #4: version drift — stale recorded version synced to manifest ---
  writeState(t1, { cursor: { version: "0.9.0" } }); // simulate stale install
  ok("stale version before update", readState(t1).cursor?.version === "0.9.0");
  runAgentsUpdate("cursor", t1);
  ok("version synced to manifest on update (drift)", readState(t1).cursor?.version === "1.0.0");

  // --- update --all refreshes every installed agent ---
  const t2 = mktmp("up-all-");
  fs.mkdirSync(path.join(t2, ".spec"), { recursive: true });
  runAgentsAdd("cursor", t2);
  runAgentsAdd("claude", t2);
  const all = runAgentsUpdate("all", t2);
  ok("update all -> ok:true", all.ok === true);
  ok("cursor still installed after update all", !!readState(t2).cursor);
  ok("claude still installed after update all", !!readState(t2).claude);

  // --- update --all with nothing installed -> ok (nothing to do) ---
  const t3 = mktmp("up-empty-");
  fs.mkdirSync(path.join(t3, ".spec"), { recursive: true });
  const empty = runAgentsUpdate("all", t3);
  ok("update all with none installed -> ok", empty.ok === true);

  // --- update a not-installed agent -> ok:false ---
  const t4 = mktmp("up-absent-");
  fs.mkdirSync(path.join(t4, ".spec"), { recursive: true });
  const absent = runAgentsUpdate("cursor", t4);
  ok("update not-installed agent -> ok:false", absent.ok === false);

  // --- advisory #5: update is idempotent (twice → no dup) ---
  runAgentsUpdate("cursor", t1);
  runAgentsUpdate("cursor", t1);
  const specFiles = fs.readdirSync(path.join(t1, ".cursor/commands", "spec")).filter((f) => f.endsWith(".md"));
  ok("update twice → no duplicate skill files", specFiles.length > 0 && new Set(specFiles).size === specFiles.length);
  ok("update twice → single context block", blockCount(t1, "AGENTS.md") === 1);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
