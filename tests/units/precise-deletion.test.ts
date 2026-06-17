// Mechanical test for spec 004 — precise deletion (only remove what spec-coach owns).
// Grows task-by-task: T006 records provenance, T007 precise skill removal, etc.
// Run: npx tsx tests/units/precise-deletion.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, runAgentsRemove } from "../../src/commands/agents.ts";
import { readState, readCreatedContextFiles, writeState } from "../../src/state.ts";

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

  // ── T007 / FR-004/005/006/007/018: precise skill removal ────────────────

  // FR-006: skills-format collision — user's own spec-* dir survives
  const s = mktmp("pd-skill-");
  mkdirCorp(s);
  fs.mkdirSync(path.join(s, ".claude", "skills", "spec-user-own"), { recursive: true });
  fs.writeFileSync(path.join(s, ".claude/skills/spec-user-own/README.md"), "mine");
  runAgentsAdd("claude", s);
  runAgentsRemove("claude", s, { force: true });
  ok("T007/FR-006: user spec-* dir survives claude remove", exists(s, ".claude/skills/spec-user-own/README.md"));
  ok("T007/FR-004: coach skill dir removed", !exists(s, ".claude/skills/spec-specify"));

  // FR-007 (advisory A1): directory-integrity guard — coach dir with an unexpected file is preserved
  const g = mktmp("pd-guard-");
  mkdirCorp(g);
  runAgentsAdd("claude", g);
  fs.writeFileSync(path.join(g, ".claude/skills/spec-specify/EXTRA.md"), "user repurposed");
  runAgentsRemove("claude", g, { force: true });
  ok("T007/FR-007: guarded dir preserved (unexpected file)", exists(g, ".claude/skills/spec-specify/EXTRA.md"));
  ok("T007/FR-007: clean coach dir still removed", !exists(g, ".claude/skills/spec-plan"));

  // FR-005: whitelist fallback when createdFiles absent (legacy shape)
  const w = mktmp("pd-wl-");
  mkdirCorp(w);
  fs.mkdirSync(path.join(w, ".claude", "skills", "spec-specify"), { recursive: true });
  fs.writeFileSync(path.join(w, ".claude/skills/spec-specify/SKILL.md"), "# coach");
  fs.mkdirSync(path.join(w, ".claude", "skills", "spec-user-legacy"), { recursive: true });
  fs.writeFileSync(path.join(w, ".claude/skills/spec-user-legacy/x.md"), "user");
  writeState(w, { claude: { version: "1.0.0" } }); // createdFiles absent (legacy)
  runAgentsRemove("claude", w, { force: true });
  ok("T007/FR-005: whitelist fallback removes coach skill dir", !exists(w, ".claude/skills/spec-specify"));
  ok("T007/FR-005: whitelist fallback preserves user spec-* dir", exists(w, ".claude/skills/spec-user-legacy/x.md"));

  // FR-006 (advisory A2): markdown format — user file in shared spec/ survives
  const m = mktmp("pd-md-");
  mkdirCorp(m);
  runAgentsAdd("cursor", m);
  fs.writeFileSync(path.join(m, ".cursor/commands/spec/notes.md"), "user notes");
  runAgentsRemove("cursor", m, { force: true });
  ok("T007/A2: markdown — user notes.md survives", exists(m, ".cursor/commands/spec/notes.md"));
  ok("T007/A2: markdown — coach specify.md removed", !exists(m, ".cursor/commands/spec/specify.md"));

  // FR-018 (advisory A3): idempotent — a recorded path already gone does not throw
  const idem = mktmp("pd-idem-");
  mkdirCorp(idem);
  runAgentsAdd("claude", idem);
  fs.rmSync(path.join(idem, ".claude/skills/spec-plan"), { recursive: true, force: true });
  let idemThrew = false;
  try { runAgentsRemove("claude", idem, { force: true }); } catch { idemThrew = true; }
  ok("T007/FR-018: remove does not throw when a recorded path is gone", !idemThrew);
  ok("T007/FR-018: remaining coach dirs still removed", !exists(idem, ".claude/skills/spec-specify"));
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
