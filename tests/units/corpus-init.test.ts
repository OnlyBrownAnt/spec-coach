// Mechanical test for src/commands/init.ts corpus-only scaffold (FR-013/017).
// Run: npx tsx tests/units/corpus-init.test.ts
// TDD: asserts init builds the corpus but installs NO agent bindings.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/commands/init.ts";
import { runAgentsAdd } from "../../src/commands/agents.ts";
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
function exists(root: string, rel: string): boolean {
  return fs.existsSync(path.join(root, rel));
}

console.log("=== corpus-init.test ===");

try {
  const t = mktmp("init-");
  await runInit(t);

  // --- corpus infrastructure present ---
  ok(".spec/templates present", exists(t, ".spec/templates"));
  ok(".spec/scripts/bash present", exists(t, ".spec/scripts/bash"));
  ok(".spec/memory/constitution.md seeded", exists(t, ".spec/memory/constitution.md"));
  ok("specs/ present", exists(t, "specs"));
  ok(".spec/agents.json exists (empty state)", exists(t, ".spec/agents.json"));
  ok(".spec/agents.json is empty state", Object.keys(readState(t)).length === 0);

  // --- NO agent bindings installed (FR-013/017) ---
  ok("no .claude/skills (init installs no agent)", !exists(t, ".claude/skills"));
  ok("no CLAUDE.md (no context injection)", !exists(t, "CLAUDE.md"));
  ok("no AGENTS.md (no context injection)", !exists(t, "AGENTS.md"));
  ok("no .cursor/commands (no agent)", !exists(t, ".cursor/commands"));

  // --- idempotent re-init does not duplicate constitution ---
  await runInit(t);
  ok("re-init keeps a single constitution", exists(t, ".spec/memory/constitution.md"));

  // --- US1 (spec 007): re-running init must NOT clobber installed-agent state ---
  const t2 = mktmp("init-reentry-");
  await runInit(t2); // scaffold corpus (realistic: init -> add agent -> later re-init)
  runAgentsAdd("claude", t2);
  ok(
    "US1 setup: agent recorded before re-init",
    readState(t2).claude !== undefined && (readState(t2).claude?.createdFiles?.length ?? 0) === 12,
  );
  await runInit(t2);
  const afterRe = readState(t2).claude;
  ok("US1: re-init preserves agents.json (claude still recorded)", afterRe !== undefined);
  ok("US1: re-init preserves createdFiles", (afterRe?.createdFiles?.length ?? 0) === 12);

  // --- US3 / FR-008/009 (spec 007): iron rule — init never touches user docs ---
  const t3 = mktmp("init-iron-");
  fs.mkdirSync(path.join(t3, "docs"), { recursive: true });
  fs.writeFileSync(path.join(t3, "docs/keep.md"), "# my doc\n\nFR-001 something\n");
  const beforeKeep = fs.readFileSync(path.join(t3, "docs/keep.md"), "utf-8");
  await runInit(t3);
  ok(
    "FR-008 iron rule: user doc untouched by init",
    fs.readFileSync(path.join(t3, "docs/keep.md"), "utf-8") === beforeKeep,
  );
  ok("FR-009: init creates no .spec/intake (no external scan)", !exists(t3, ".spec/intake"));
  ok("FR-009: init creates no .spec/absorbed", !exists(t3, ".spec/absorbed"));
} catch (e) {
  ok("init ran without throwing", false);
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
