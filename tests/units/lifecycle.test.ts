// Consolidated lifecycle verification for US3 / US4 / US5.
// Run: npx tsx tests/units/lifecycle.test.ts
// US3 (FR-006/008): add→remove is a precise inverse (snapshot diff).
// US4 (FR-009):     multi-agent coexistence in one project.
// US5 (FR-010/011, SC-004): universal context injection — all 6 agents.
// Verification task: the commands already exist (T007-T010); this proves the
// cross-cutting acceptance scenarios rigorously.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import * as crypto from "node:crypto";
import { runAgentsAdd, runAgentsRemove } from "../../src/commands/agents.ts";
import { COACH_MARKER_START } from "../../src/utils.ts";

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

/** Recursive relative path listing, excluding the state bookkeeping file. */
function snapshot(root: string): string[] {
  const out: string[] = [];
  const walk = (dir: string, rel: string): void => {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); } catch { return; }
    for (const e of entries) {
      const r = rel ? `${rel}/${e.name}` : e.name;
      if (r === ".spec/agents.json") continue; // state is bookkeeping, not agent-owned content
      if (e.isDirectory()) { out.push(r + "/"); walk(path.join(dir, e.name), r); }
      else out.push(r);
    }
  };
  walk(root, "");
  return out.sort();
}

function fileHash(root: string, rel: string): string {
  try {
    return crypto.createHash("sha256").update(fs.readFileSync(path.join(root, rel))).digest("hex").slice(0, 12);
  } catch { return "MISSING"; }
}

console.log("=== lifecycle.test (US3/US4/US5) ===");

try {
  // ── US3 (FR-006/008): precise inverse ──────────────────────────────
  const t = mktmp("lc-inverse-");
  fs.mkdirSync(path.join(t, ".spec", "scripts"), { recursive: true });
  fs.writeFileSync(path.join(t, ".spec", "scripts", "canary.sh"), "# corpus\n");
  fs.mkdirSync(path.join(t, "specs"), { recursive: true });
  fs.writeFileSync(path.join(t, "specs", "feature.md"), "# feature\n");

  // spec 004 collision: user content in the shared spec/ command dir must survive.
  fs.mkdirSync(path.join(t, ".cursor", "commands", "spec"), { recursive: true });
  fs.writeFileSync(path.join(t, ".cursor/commands/spec/notes.md"), "user notes\n");

  const before = snapshot(t);
  const corpusHashBefore = fileHash(t, ".spec/scripts/canary.sh");

  runAgentsAdd("cursor", t);
  runAgentsRemove("cursor", t, { force: true });

  const after = snapshot(t);
  ok("US3: add→remove tree identical (excl. state file)", JSON.stringify(before) === JSON.stringify(after));
  ok("US3: corpus file content unchanged by add/remove", fileHash(t, ".spec/scripts/canary.sh") === corpusHashBefore);
  ok("US3: specs/ untouched", fs.existsSync(path.join(t, "specs/feature.md")));

  // ── US4 (FR-009): multi-agent coexistence ──────────────────────────
  const m = mktmp("lc-multi-");
  fs.mkdirSync(path.join(m, ".spec"), { recursive: true });
  runAgentsAdd("claude", m);
  runAgentsAdd("cursor", m);
  ok("US4: claude + cursor coexist (claude dir)", fs.existsSync(path.join(m, ".claude/skills")));
  ok("US4: claude + cursor coexist (cursor dir)", fs.existsSync(path.join(m, ".cursor/commands/spec")));
  // remove one — the other is untouched
  runAgentsRemove("cursor", m, { force: true });
  ok("US4: removing cursor leaves claude intact", fs.existsSync(path.join(m, ".claude/skills")));
  ok("US4: cursor gone after remove", !fs.existsSync(path.join(m, ".cursor/commands/spec")));

  // ── US5 (FR-010/011, SC-004): universal injection, all 6 agents ────
  const u = mktmp("lc-inject-");
  fs.mkdirSync(path.join(u, ".spec"), { recursive: true });
  for (const key of ["claude", "cursor", "copilot", "codex", "windsurf", "kiro"]) {
    runAgentsAdd(key, u);
  }
  ok("US5: claude → CLAUDE.md block", fs.readFileSync(path.join(u, "CLAUDE.md"), "utf-8").includes(COACH_MARKER_START));
  const agentsMd = fs.readFileSync(path.join(u, "AGENTS.md"), "utf-8");
  ok("US5: non-claude agents → AGENTS.md block", agentsMd.includes(COACH_MARKER_START));
  const blockMatches = agentsMd.match(new RegExp(COACH_MARKER_START.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "g")) || [];
  ok("US5: shared AGENTS.md has exactly ONE block for 5 non-claude agents", blockMatches.length === 1);
  ok("US5: all 6 agents installed (SC-004)", ["claude", "cursor", "copilot", "codex", "windsurf", "kiro"].every((k) =>
    fs.existsSync(path.join(u, { claude: ".claude/skills", cursor: ".cursor/commands", copilot: ".github/copilot/commands", codex: ".codex/skills", windsurf: ".windsurf/commands", kiro: ".kiro/skills" }[k] as string)),
  ));
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
