// Mechanical test for src/commands/uninstall.ts (FR-014/016).
// Run: npx tsx tests/units/corpus-uninstall.test.ts
// TDD: written BEFORE uninstall.ts.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/commands/init.ts";
import { runAgentsAdd } from "../../src/commands/agents.ts";
import { runUninstall } from "../../src/commands/uninstall.ts";

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

console.log("=== corpus-uninstall.test ===");

try {
  // --- FR-014: refuses without confirmation ---
  const t0 = mktmp("un-nc-");
  await runInit(null, t0);
  runAgentsAdd("claude", t0);
  const refused = runUninstall(t0);
  ok("uninstall without confirmation -> ok:false", refused.ok === false);
  ok("refusal leaves infrastructure intact", exists(t0, ".spec/scripts/bash"));

  // --- FR-016: confirmed uninstall removes infra + bindings, preserves user content ---
  const t = mktmp("un-keep-");
  await runInit(null, t);
  runAgentsAdd("claude", t);
  runAgentsAdd("cursor", t);
  // user content
  fs.mkdirSync(path.join(t, "specs", "001-x"), { recursive: true });
  fs.writeFileSync(path.join(t, "specs", "001-x", "spec.md"), "# keep me\n");

  const res = runUninstall(t, { confirmed: true });
  ok("confirmed uninstall -> ok:true", res.ok === true);
  // infra removed
  ok(".spec/scripts removed", !exists(t, ".spec/scripts"));
  ok(".spec/templates removed", !exists(t, ".spec/templates"));
  ok(".spec/agents.json removed", !exists(t, ".spec/agents.json"));
  // bindings removed
  ok("claude binding removed", !exists(t, ".claude/skills"));
  ok("cursor binding removed", !exists(t, ".cursor/commands"));
  ok("CLAUDE.md removed", !exists(t, "CLAUDE.md"));
  // user content PRESERVED
  ok("specs/ PRESERVED", exists(t, "specs/001-x/spec.md"));
  ok("constitution PRESERVED", exists(t, ".spec/memory/constitution.md"));

  // --- FR-016 --force/purge: also removes user content ---
  const t2 = mktmp("un-purge-");
  await runInit(null, t2);
  fs.mkdirSync(path.join(t2, "specs", "001-y"), { recursive: true });
  fs.writeFileSync(path.join(t2, "specs", "001-y", "spec.md"), "# bye\n");
  runUninstall(t2, { confirmed: true, purge: true });
  ok("purge removes specs/", !exists(t2, "specs/001-y/spec.md"));
  ok("purge removes constitution", !exists(t2, ".spec/memory/constitution.md"));
} catch (e) {
  ok("uninstall ran without throwing", false);
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
