// Mechanical test for src/commands/update.ts corpus-scoped refresh (FR-013/017).
// Run: npx tsx tests/units/corpus-update.test.ts
// TDD: asserts update refreshes templates/scripts but installs NO agent bindings.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/commands/init.ts";
import { runUpdate } from "../../src/commands/update.ts";
import { loadAgentConfig } from "../../src/utils.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

const claude = loadAgentConfig("claude");
const tmpDirs: string[] = [];
function mktmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

console.log("=== corpus-update.test ===");

try {
  const t = mktmp("upd-");
  await runInit(t);

  // user artifact that update MUST NOT touch
  fs.mkdirSync(path.join(t, "specs", "001-thing"), { recursive: true });
  fs.writeFileSync(path.join(t, "specs", "001-thing", "spec.md"), "# my spec\n");

  const specBefore = fs.readFileSync(path.join(t, "specs/001-thing/spec.md"), "utf-8");

  await runUpdate(claude, t);

  // --- corpus infrastructure refreshed & present ---
  ok("templates present after update", exists(t, ".spec/templates"));
  ok("scripts present after update", exists(t, ".spec/scripts/bash"));

  // --- update installs NO agent bindings (FR-013/017) ---
  ok("no .claude/skills after update", !exists(t, ".claude/skills"));
  ok("no CLAUDE.md after update", !exists(t, "CLAUDE.md"));

  // --- user artifacts untouched (FR-017) ---
  ok("user spec untouched by update", fs.readFileSync(path.join(t, "specs/001-thing/spec.md"), "utf-8") === specBefore);
} catch (e) {
  ok("update ran without throwing", false);
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
