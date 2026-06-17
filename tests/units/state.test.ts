// Mechanical test for src/state.ts — fast, deterministic, no AI.
// Run: npx tsx tests/units/state.test.ts
// TDD: written BEFORE src/state.ts. Covers FR-007 (state read/write) + FR-018 (reconcile).
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import {
  readState,
  writeState,
  recordAgent,
  unrecordAgent,
  reconcileFromFs,
  type AgentEntry,
} from "../../src/state.ts";

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

console.log("=== state.test ===");

try {
  // --- FR-007: readState on absent file -> {} ---
  const tmp = mktmp("spec-state-");
  ok("readState absent -> {}", Object.keys(readState(tmp)).length === 0);

  // --- FR-007: round-trip preserves keys + version ---
  writeState(tmp, { claude: { version: "1.0.0" }, cursor: { version: "2.0.0" } });
  const r = readState(tmp);
  ok("round-trip preserves claude key", !!r.claude);
  ok("round-trip preserves cursor key", !!r.cursor);
  ok("round-trip preserves version", r.claude?.version === "1.0.0" && r.cursor?.version === "2.0.0");
  ok("state file at .spec/agents.json", fs.existsSync(path.join(tmp, ".spec", "agents.json")));

  // --- record / unrecord ---
  recordAgent(tmp, "kiro", "1.0.0");
  ok("recordAgent adds kiro", readState(tmp).kiro?.version === "1.0.0");
  unrecordAgent(tmp, "kiro");
  ok("unrecordAgent removes kiro", !readState(tmp).kiro);
  unrecordAgent(tmp, "never-installed"); // no error
  ok("unrecordAgent absent agent is a no-op", !readState(tmp)["never-installed"]);

  // --- FR-018: reconcileFromFs detects installed agents from the filesystem ---
  const proj = mktmp("spec-recon-");
  // skills-format agent (claude): .claude/skills/spec-specify/SKILL.md
  fs.mkdirSync(path.join(proj, ".claude", "skills", "spec-specify"), { recursive: true });
  fs.writeFileSync(path.join(proj, ".claude", "skills", "spec-specify", "SKILL.md"), "x");
  // markdown-format agent (cursor): .cursor/commands/spec/specify.md
  fs.mkdirSync(path.join(proj, ".cursor", "commands", "spec"), { recursive: true });
  fs.writeFileSync(path.join(proj, ".cursor", "commands", "spec", "specify.md"), "x");

  const manifest: AgentEntry[] = [
    { key: "claude", name: "Claude Code", dir: ".claude/skills", format: "skills", separator: "-", frontmatter: {}, contextFile: "CLAUDE.md", version: "1.0.0" },
    { key: "cursor", name: "Cursor", dir: ".cursor/commands", format: "markdown", separator: ".", frontmatter: {}, contextFile: "AGENTS.md", version: "1.0.0" },
    { key: "codex", name: "Codex", dir: ".codex/skills", format: "skills", separator: "-", frontmatter: {}, contextFile: "AGENTS.md", version: "1.0.0" },
  ];

  const recon = reconcileFromFs(proj, manifest);
  ok("reconcile detects claude (skills format)", !!recon.claude);
  ok("reconcile detects cursor (markdown format)", !!recon.cursor);
  ok("reconcile does NOT detect absent codex", !recon.codex);

  // --- reconcile empty project -> {} ---
  const empty = mktmp("spec-empty-");
  ok("reconcile empty project -> {}", Object.keys(reconcileFromFs(empty, manifest)).length === 0);

  // --- reconcile with write=true persists ---
  reconcileFromFs(proj, manifest, true);
  ok("reconcile write=true persists .spec/agents.json", fs.existsSync(path.join(proj, ".spec", "agents.json")));
  ok("persisted state matches detected", readState(proj).claude?.version === "1.0.0" && !!readState(proj).cursor);

  // --- reconcile ignores a dir with no spec content (false-positive guard) ---
  const partial = mktmp("spec-partial-");
  fs.mkdirSync(path.join(partial, ".claude", "skills", "some-other-tool"), { recursive: true }); // not spec-*
  ok("reconcile ignores non-spec-* subdir", !reconcileFromFs(partial, manifest).claude);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran assertions");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
