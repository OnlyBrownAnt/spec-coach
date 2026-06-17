// Migration test: a project created by a prior spec-coach version has agent
// bindings on disk but no .spec/agents.json. The first agents command MUST
// reconcile state from the filesystem (FR-018).
// Run: npx tsx tests/units/migration.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { getAgentsStatus } from "../../src/commands/agents.ts";
import { readState } from "../../src/state.ts";

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

console.log("=== migration.test (FR-018) ===");

try {
  // Simulate an OLD project: corpus present, claude bindings on disk, NO state file.
  const t = mktmp("mig-");
  fs.mkdirSync(path.join(t, ".spec", "memory"), { recursive: true }); // corpus exists
  fs.mkdirSync(path.join(t, ".claude", "skills", "spec-specify"), { recursive: true });
  fs.writeFileSync(path.join(t, ".claude", "skills", "spec-specify", "SKILL.md"), "# old skill\n");
  // also a markdown-format agent (cursor) installed by the old world
  fs.mkdirSync(path.join(t, ".cursor", "commands", "spec"), { recursive: true });
  fs.writeFileSync(path.join(t, ".cursor", "commands", "spec", "specify.md"), "# old\n");
  // NO .spec/agents.json — this is the pre-2.0 state.

  ok("no state file before first agents command", !fs.existsSync(path.join(t, ".spec/agents.json")));

  // First agents command → reconciles from the filesystem.
  const status = getAgentsStatus(t);
  ok("FR-018: claude reconciled as installed", status.some((a) => a.key === "claude" && a.installed));
  ok("FR-018: cursor reconciled as installed", status.some((a) => a.key === "cursor" && a.installed));
  ok("FR-018: reconcile wrote .spec/agents.json", fs.existsSync(path.join(t, ".spec/agents.json")));
  ok("reconciled state records claude + cursor", !!readState(t).claude && !!readState(t).cursor);

  // codex was NOT installed → not marked installed.
  ok("absent agent (codex) not reconciled", !status.find((a) => a.key === "codex")?.installed);

  // A project with NO corpus does not reconcile (nothing to reconcile into).
  const empty = mktmp("mig-empty-");
  const emptyStatus = getAgentsStatus(empty);
  ok("no-corpus project: nothing installed, no crash", emptyStatus.every((a) => !a.installed));
} catch (e) {
  ok("migration ran without throwing", false);
  console.log("    error:", (e as Error).message);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
