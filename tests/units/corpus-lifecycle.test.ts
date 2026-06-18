// US6 capstone: the spec corpus is isolated from the agent lifecycle across the
// full cycle (init → add → remove → update → uninstall). Run:
//   npx tsx tests/units/corpus-lifecycle.test.ts
// Verification task (commands exist) — proves FR-008/013/016/017 end-to-end.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { runInit } from "../../src/commands/init.ts";
import { runUpdate } from "../../src/commands/update.ts";
import { runAgentsAdd, runAgentsRemove } from "../../src/commands/agents.ts";
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
function hash(root: string, rel: string): string {
  try { return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex").slice(0, 12); }
  catch { return "MISSING"; }
}

console.log("=== corpus-lifecycle.test (US6) ===");

try {
  const t = mktmp("lc-cycle-");

  // init — corpus present, NO agent bindings
  await runInit(t);
  ok("init: corpus templates present", exists(t, ".spec/templates"));
  ok("init: constitution present", exists(t, ".spec/memory/constitution.md"));
  ok("init: NO agent files", !exists(t, ".claude/skills") && !exists(t, "CLAUDE.md"));

  // snapshot corpus content
  const constBefore = hash(t, ".spec/memory/constitution.md");
  const tmplBefore = hash(t, ".spec/templates/spec-template.md");

  // agents add — corpus UNCHANGED (agent op never mutates corpus)
  runAgentsAdd("claude", t);
  ok("add: claude binding present", exists(t, ".claude/skills"));
  ok("add: constitution UNCHANGED (corpus isolation)", hash(t, ".spec/memory/constitution.md") === constBefore);
  ok("add: template UNCHANGED (corpus isolation)", hash(t, ".spec/templates/spec-template.md") === tmplBefore);

  // agents remove — corpus UNCHANGED
  runAgentsRemove("claude", t, { force: true });
  ok("remove: claude binding gone", !exists(t, ".claude/skills"));
  ok("remove: constitution UNCHANGED", hash(t, ".spec/memory/constitution.md") === constBefore);

  // update — corpus refreshed, still no agent bindings
  await runUpdate(t);
  ok("update: templates still present", exists(t, ".spec/templates"));
  ok("update: NO agent files appeared", !exists(t, ".claude/skills") && !exists(t, "CLAUDE.md"));

  // user spec survives the whole agent lifecycle
  fs.mkdirSync(path.join(t, "specs", "001-survivor"), { recursive: true });
  fs.writeFileSync(path.join(t, "specs/001-survivor/spec.md"), "# I persist\n");
  runAgentsAdd("cursor", t);
  runAgentsRemove("cursor", t, { force: true });
  ok("user spec survives add/remove cycle", exists(t, "specs/001-survivor/spec.md"));

  // uninstall — infra + bindings gone, user content + constitution preserved
  runAgentsAdd("claude", t);
  runUninstall(t, { confirmed: true });
  ok("uninstall: infrastructure removed", !exists(t, ".spec/scripts") && !exists(t, ".spec/templates"));
  ok("uninstall: agent bindings removed", !exists(t, ".claude/skills") && !exists(t, "CLAUDE.md"));
  ok("uninstall: specs/ PRESERVED", exists(t, "specs/001-survivor/spec.md"));
  ok("uninstall: constitution PRESERVED", exists(t, ".spec/memory/constitution.md"));
} catch (e) {
  ok("lifecycle ran without throwing", false);
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
