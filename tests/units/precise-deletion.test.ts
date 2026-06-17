// Mechanical test for spec 004 — precise deletion (only remove what spec-coach owns).
// Grows task-by-task: T006 records provenance, T007 precise skill removal, etc.
// Run: npx tsx tests/units/precise-deletion.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, runAgentsRemove } from "../../src/commands/agents.ts";
import { readState, readCreatedContextFiles } from "../../src/state.ts";

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
function mkdirCorp(root: string): void {
  fs.mkdirSync(path.join(root, ".spec"), { recursive: true });
}

console.log("=== precise-deletion.test (spec 004) ===");

try {
  // ── T006 / FR-001, FR-002: add records provenance ───────────────────────
  const t = mktmp("pd-add-");
  mkdirCorp(t);
  runAgentsAdd("claude", t);
  const claudeState = readState(t).claude;
  ok("T006: add records createdFiles (array)", Array.isArray(claudeState?.createdFiles));
  ok("T006: add records 11 createdFiles", claudeState?.createdFiles?.length === 11);
  ok("T006: createdFiles are spec-* skill dirs", claudeState?.createdFiles?.every((p) => p.startsWith(".claude/skills/spec-")));
  ok("T006: CLAUDE.md recorded as created (file was absent)", readCreatedContextFiles(t).includes("CLAUDE.md"));
  ok("T006: version still recorded", claudeState?.version === "1.0.0");
} catch (e) {
  ok("precise-deletion ran without throwing", false);
  console.log("    error:", (e as Error).message);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran assertions");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
