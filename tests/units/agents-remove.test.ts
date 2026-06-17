// Mechanical test for src/commands/agents.ts runAgentsRemove (FR-006/008/011/014).
// Run: npx tsx tests/units/agents-remove.test.ts
// TDD: written BEFORE runAgentsRemove. Includes advisory #1 (shared AGENTS.md).
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, runAgentsRemove } from "../../src/commands/agents.ts";
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
function hasBlock(root: string, file: string): boolean {
  try { return fs.readFileSync(path.join(root, file), "utf-8").includes(COACH_MARKER_START); }
  catch { return false; }
}

console.log("=== agents-remove.test ===");

try {
  // --- FR-014: requires --force (no delete without it) ---
  const t0 = mktmp("rm-force-");
  fs.mkdirSync(path.join(t0, ".spec"), { recursive: true });
  runAgentsAdd("cursor", t0);
  const noForce = runAgentsRemove("cursor", t0); // no force
  ok("remove without --force -> ok:false", noForce.ok === false);
  ok("no-force leaves skills installed", fs.existsSync(path.join(t0, ".cursor/commands/spec")));

  // --- FR-006: remove is precise inverse of add (cursor) ---
  const t1 = mktmp("rm-cursor-");
  fs.mkdirSync(path.join(t1, ".spec"), { recursive: true });
  runAgentsAdd("cursor", t1);
  const r = runAgentsRemove("cursor", t1, { force: true });
  ok("remove cursor --force -> ok:true", r.ok === true);
  ok("cursor skills removed", !fs.existsSync(path.join(t1, ".cursor/commands/spec")));
  ok("cursor unrecorded from state", !readState(t1).cursor);
  ok("AGENTS.md block removed (last non-claude)", !hasBlock(t1, "AGENTS.md"));

  // --- claude remove clears CLAUDE.md ---
  const t2 = mktmp("rm-claude-");
  fs.mkdirSync(path.join(t2, ".spec"), { recursive: true });
  runAgentsAdd("claude", t2);
  runAgentsRemove("claude", t2, { force: true });
  ok("claude skills removed", !fs.existsSync(path.join(t2, ".claude/skills")) ||
    !fs.readdirSync(path.join(t2, ".claude/skills")).some((d) => d.startsWith("spec-")));
  ok("CLAUDE.md block removed", !hasBlock(t2, "CLAUDE.md"));

  // --- advisory #1 / FR-011: shared AGENTS.md preserved while another non-claude remains ---
  const t3 = mktmp("rm-shared-");
  fs.mkdirSync(path.join(t3, ".spec"), { recursive: true });
  runAgentsAdd("cursor", t3);
  runAgentsAdd("copilot", t3);
  runAgentsRemove("cursor", t3, { force: true }); // copilot still installed
  ok("shared AGENTS.md block PRESERVED while copilot installed", hasBlock(t3, "AGENTS.md"));
  ok("cursor skills removed (scoped to one agent)", !fs.existsSync(path.join(t3, ".cursor/commands/spec")));
  ok("copilot skills untouched", fs.existsSync(path.join(t3, ".github/copilot/commands/spec")));
  runAgentsRemove("copilot", t3, { force: true }); // now last non-claude
  ok("shared AGENTS.md block removed after last non-claude gone", !hasBlock(t3, "AGENTS.md"));

  // --- FR-008: remove never touches the corpus ---
  const t4 = mktmp("rm-corpus-");
  fs.mkdirSync(path.join(t4, ".spec", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(t4, ".spec", "scripts", "canary.sh"), "# survives");
  fs.mkdirSync(path.join(t4, "specs"), { recursive: true });
  fs.writeFileSync(path.join(t4, "specs", "keep.md"), "x");
  runAgentsAdd("claude", t4);
  runAgentsRemove("claude", t4, { force: true });
  ok("corpus scripts survive remove", fs.existsSync(path.join(t4, ".spec/scripts/canary.sh")));
  ok("specs/ survives remove", fs.existsSync(path.join(t4, "specs/keep.md")));

  // --- not-installed agent -> ok (nothing to do), no error ---
  const t5 = mktmp("rm-absent-");
  fs.mkdirSync(path.join(t5, ".spec"), { recursive: true });
  const absent = runAgentsRemove("cursor", t5, { force: true });
  ok("remove not-installed agent -> ok (nothing to do)", absent.ok === true);

  // --- unknown agent -> ok:false ---
  const unknown = runAgentsRemove("bogus", t5, { force: true });
  ok("unknown agent -> ok:false", unknown.ok === false);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
