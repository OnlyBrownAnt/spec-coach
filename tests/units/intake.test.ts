// Mechanical test for spec 005 — document intake pipeline.
// Grows task-by-task: T002 manifest store, T003 ignore store, T004 discovery, etc.
// Run: npx tsx tests/units/intake.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  readManifest,
  writeManifest,
  type Candidate,
} from "../../src/commands/intake.ts";

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
function write(root: string, rel: string, content: string): void {
  const p = path.join(root, rel);
  fs.mkdirSync(path.dirname(p), { recursive: true });
  fs.writeFileSync(p, content);
}

console.log("=== intake.test (spec 005) ===");

try {
  // ── T002: manifest store ─────────────────────────────────────────────────
  const t = mktmp("intake-man-");
  ok("T002: absent manifest -> []", readManifest(t).length === 0);
  const cands: Candidate[] = [
    { path: "docs/old.md", hash: "abc", size: 10, status: "pending" },
    { path: "design/arch.md", hash: "def", size: 20, status: "absorbed-verbatim", destination: ".spec/absorbed/arch.md" },
  ];
  writeManifest(t, cands);
  const back = readManifest(t);
  ok("T002: round-trip preserves count", back.length === 2);
  ok("T002: round-trip preserves path", back[0].path === "docs/old.md");
  ok("T002: round-trip preserves status", back[1].status === "absorbed-verbatim");
  ok("T002: round-trip preserves destination", back[1].destination === ".spec/absorbed/arch.md");
  ok("T002: manifest file written to .spec/intake/", fs.existsSync(path.join(t, ".spec/intake/manifest.json")));
} catch (e) {
  ok("intake ran without throwing", false);
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
