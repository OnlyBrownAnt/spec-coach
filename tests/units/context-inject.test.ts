// Mechanical test for src/utils.ts universal context injection (FR-010/011).
// Run: npx tsx tests/units/context-inject.test.ts
// TDD: written BEFORE upsertManagedSection/removeManagedSection.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  upsertManagedSection,
  removeManagedSection,
  COACH_MARKER_START,
  COACH_MARKER_END,
  loadAgentConfig,
} from "../../src/utils.ts";

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

const claude = loadAgentConfig("claude")!;
const cursor = loadAgentConfig("cursor")!;
const copilot = loadAgentConfig("copilot")!;

const tmpDirs: string[] = [];
function mktmp(prefix: string): string {
  const d = fs.mkdtempSync(path.join(os.tmpdir(), prefix));
  tmpDirs.push(d);
  return d;
}
function read(root: string, file: string): string {
  try { return fs.readFileSync(path.join(root, file), "utf-8"); } catch { return ""; }
}

console.log("=== context-inject.test ===");

try {
  // --- FR-010: claude → CLAUDE.md, cursor → AGENTS.md ---
  const t1 = mktmp("ctx-");
  upsertManagedSection(claude, t1);
  upsertManagedSection(cursor, t1);
  const claudeMd = read(t1, "CLAUDE.md");
  const agentsMd = read(t1, "AGENTS.md");
  ok("claude writes CLAUDE.md", claudeMd.includes(COACH_MARKER_START) && claudeMd.includes(COACH_MARKER_END));
  ok("cursor writes AGENTS.md (not CLAUDE.md)", agentsMd.includes(COACH_MARKER_START) && !fs.existsSync(path.join(t1, "cursor.md")));
  ok("claude section references show-sdd-state", claudeMd.includes("show-sdd-state"));

  // --- idempotent: upsert twice → exactly ONE block ---
  upsertManagedSection(claude, t1);
  const count = (read(t1, "CLAUDE.md").match(new RegExp(COACH_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  ok("upsert twice → single block (idempotent)", count === 1);

  // --- FR-011: remove clears the block ---
  removeManagedSection(claude, t1);
  ok("removeManagedSection clears claude block", !read(t1, "CLAUDE.md").includes(COACH_MARKER_START));

  // --- user content outside markers is preserved ---
  const t2 = mktmp("ctx-user-");
  fs.writeFileSync(path.join(t2, "AGENTS.md"), "# My Notes\n\nimportant user text\n");
  upsertManagedSection(cursor, t2);
  const withBlock = read(t2, "AGENTS.md");
  ok("user content preserved on upsert", withBlock.includes("important user text"));
  ok("block added alongside user content", withBlock.includes(COACH_MARKER_START));
  removeManagedSection(cursor, t2);
  const afterRemove = read(t2, "AGENTS.md");
  ok("user content survives remove", afterRemove.includes("important user text"));
  ok("block gone after remove", !afterRemove.includes(COACH_MARKER_START));

  // --- shared AGENTS.md: cursor + copilot → ONE block (same content, dedup) ---
  const t3 = mktmp("ctx-shared-");
  upsertManagedSection(cursor, t3);
  upsertManagedSection(copilot, t3);
  const sharedCount = (read(t3, "AGENTS.md").match(new RegExp(COACH_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || []).length;
  ok("shared AGENTS.md has a single block for cursor+copilot", sharedCount === 1);

  // --- removeManagedSection on absent file is a no-op (no throw) ---
  const t4 = mktmp("ctx-absent-");
  let threw = false;
  try { removeManagedSection(claude, t4); } catch { threw = true; }
  ok("removeManagedSection on absent file does not throw", !threw);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
