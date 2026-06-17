// Mechanical test for src/commands/agents.ts getAgentsStatus (FR-004).
// Run: npx tsx tests/units/agents-list.test.ts
// TDD: written BEFORE agents.ts.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { getAgentsStatus } from "../../src/commands/agents.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) {
    pass++;
    console.log("  [PASS]", name);
  } else {
    fail++;
    console.log("  [FAIL]", name);
  }
}

const tmpDirs: string[] = [];
function mktmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}

console.log("=== agents-list.test ===");

try {
  // --- no state file -> nothing installed, all available ---
  const t1 = mktmp("list-empty-");
  const s1 = getAgentsStatus(t1);
  ok("returns all 6 manifest agents", s1.length === 6);
  ok("none installed when no state", s1.every((a) => !a.installed));
  ok("claude present by name", s1.some((a) => a.key === "claude" && a.name === "Claude Code"));

  // --- state with claude installed -> claude marked installed ---
  const t2 = mktmp("list-installed-");
  fs.mkdirSync(path.join(t2, ".spec"), { recursive: true });
  fs.writeFileSync(
    path.join(t2, ".spec", "agents.json"),
    JSON.stringify({ agents: { claude: { version: "1.0.0" } } }),
  );
  const s2 = getAgentsStatus(t2);
  const claude = s2.find((a) => a.key === "claude");
  const cursor = s2.find((a) => a.key === "cursor");
  ok("claude marked installed", !!claude?.installed);
  ok("claude carries version", claude?.version === "1.0.0");
  ok("cursor NOT installed", !cursor?.installed);

  // --- corrupt state file -> graceful (treats as nothing installed) ---
  const t3 = mktmp("list-corrupt-");
  fs.mkdirSync(path.join(t3, ".spec"), { recursive: true });
  fs.writeFileSync(path.join(t3, ".spec", "agents.json"), "{ not valid json");
  const s3 = getAgentsStatus(t3);
  ok("corrupt state -> all available, none installed", s3.length === 6 && s3.every((a) => !a.installed));
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
