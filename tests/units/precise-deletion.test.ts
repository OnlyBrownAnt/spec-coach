// Mechanical test for spec 004 — precise deletion (only remove what spec-coach owns).
// Grows task-by-task: T006 records provenance, T007 precise skill removal, etc.
// Run: npx tsx tests/units/precise-deletion.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runAgentsAdd, runAgentsRemove, getAgentsStatus } from "../../src/commands/agents.ts";
import { runUninstall } from "../../src/commands/uninstall.ts";
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

  // ── T008 / FR-008/010/011 (SC-002): context-file preservation ───────────

  // FR-010: a USER-authored context file is never deleted, even when its residual
  // matches the auto-generated H1 (the old heuristic would delete it).
  const c = mktmp("pd-ctx-user-");
  mkdirCorp(c);
  fs.writeFileSync(path.join(c, "CLAUDE.md"), `# ${path.basename(c)}\n`); // user-authored, matches auto H1
  runAgentsAdd("claude", c); // appends block; file existed → NOT recorded as created
  ok("T008: user CLAUDE.md not recorded as created", !readCreatedContextFiles(c).includes("CLAUDE.md"));
  runAgentsRemove("claude", c, { force: true });
  ok("T008/FR-010: user-owned CLAUDE.md preserved (heuristic would have deleted it)", exists(c, "CLAUDE.md"));

  // FR-008: managed block stripped, user content survives
  const c2 = mktmp("pd-ctx-strip-");
  mkdirCorp(c2);
  fs.writeFileSync(path.join(c2, "CLAUDE.md"), "# my own notes\n");
  runAgentsAdd("claude", c2);
  runAgentsRemove("claude", c2, { force: true });
  const c2content = fs.readFileSync(path.join(c2, "CLAUDE.md"), "utf-8");
  ok("T008/FR-008: managed block stripped", !c2content.includes("COACH START"));
  ok("T008: user content survives strip", c2content.includes("my own notes"));

  // FR-011: shared AGENTS.md block preserved while another non-Claude agent is installed
  const sh = mktmp("pd-shared-");
  mkdirCorp(sh);
  runAgentsAdd("cursor", sh); // creates AGENTS.md (owned)
  runAgentsAdd("copilot", sh); // appends to existing AGENTS.md
  runAgentsRemove("cursor", sh, { force: true }); // copilot still installed
  ok("T008/FR-011: AGENTS.md block preserved while copilot installed", fs.readFileSync(path.join(sh, "AGENTS.md"), "utf-8").includes("COACH START"));

  // ── T011 / SC-001: full add→remove→uninstall cycle, zero user deletions ──
  // (integration capstone — behavior implemented in T006–T010; this is the
  //  end-to-end proof that colliding user content survives every lifecycle op.)
  const k = mktmp("pd-sc001-");
  mkdirCorp(k);
  fs.mkdirSync(path.join(k, ".claude", "skills", "spec-user"), { recursive: true });
  fs.writeFileSync(path.join(k, ".claude/skills/spec-user/keep.md"), "user skill\n");
  fs.mkdirSync(path.join(k, ".cursor", "commands", "spec"), { recursive: true });
  fs.writeFileSync(path.join(k, ".cursor/commands/spec/notes.md"), "user notes\n");
  fs.writeFileSync(path.join(k, "CLAUDE.md"), "# user claude\n");
  const userSkillBefore = fs.readFileSync(path.join(k, ".claude/skills/spec-user/keep.md"), "utf-8");
  const userNotesBefore = fs.readFileSync(path.join(k, ".cursor/commands/spec/notes.md"), "utf-8");

  runAgentsAdd("claude", k);
  runAgentsAdd("cursor", k);
  runAgentsRemove("claude", k, { force: true });
  runAgentsRemove("cursor", k, { force: true });
  ok("SC-001: user skill unchanged through add→remove", fs.readFileSync(path.join(k, ".claude/skills/spec-user/keep.md"), "utf-8") === userSkillBefore);
  ok("SC-001: user notes unchanged through add→remove", fs.readFileSync(path.join(k, ".cursor/commands/spec/notes.md"), "utf-8") === userNotesBefore);
  ok("SC-001: user CLAUDE.md text survives (block stripped)", fs.readFileSync(path.join(k, "CLAUDE.md"), "utf-8").includes("user claude"));
  ok("SC-001: coach claude skill gone after remove", !exists(k, ".claude/skills/spec-specify"));
  ok("SC-001: coach cursor md gone after remove", !exists(k, ".cursor/commands/spec/specify.md"));

  // re-add then uninstall — user content still intact, coach bindings gone
  runAgentsAdd("claude", k);
  runUninstall(k, { confirmed: true });
  ok("SC-001: user skill survives uninstall", fs.readFileSync(path.join(k, ".claude/skills/spec-user/keep.md"), "utf-8") === userSkillBefore);
  ok("SC-001: user notes survives uninstall", fs.readFileSync(path.join(k, ".cursor/commands/spec/notes.md"), "utf-8") === userNotesBefore);
  ok("SC-001: coach bindings gone after uninstall", !exists(k, ".claude/skills/spec-specify"));

  // ── T012 / US2 / SC-003: own shells cleaned ─────────────────────────────
  // (FR-009 owned-shell deletion landed in T008 — US3's precise-inverse required
  //  it. T012 adds the dedicated US2 acceptance + shared-AGENTS.md coverage.)

  // SC-003: a coach-created empty context file IS deleted on remove (+ unrecorded)
  const o = mktmp("pd-owned-");
  mkdirCorp(o);
  ok("SC-003 setup: no CLAUDE.md before add", !exists(o, "CLAUDE.md"));
  runAgentsAdd("claude", o); // creates CLAUDE.md (owned)
  ok("SC-003 setup: CLAUDE.md recorded as created", readCreatedContextFiles(o).includes("CLAUDE.md"));
  runAgentsRemove("claude", o, { force: true });
  ok("SC-003: coach-created empty CLAUDE.md deleted", !exists(o, "CLAUDE.md"));
  ok("SC-003: CLAUDE.md unrecorded after deletion", !readCreatedContextFiles(o).includes("CLAUDE.md"));

  // complement: coach-created CLAUDE.md with user content → preserved
  const o2 = mktmp("pd-owned-content-");
  mkdirCorp(o2);
  runAgentsAdd("claude", o2);
  fs.appendFileSync(path.join(o2, "CLAUDE.md"), "\n# user section\n");
  runAgentsRemove("claude", o2, { force: true });
  ok("US2: coach CLAUDE.md with user content preserved", exists(o2, "CLAUDE.md") && fs.readFileSync(path.join(o2, "CLAUDE.md"), "utf-8").includes("user section"));

  // shared AGENTS.md: remove one of two non-Claude keeps it; remove last deletes it (owned+empty)
  const ag = mktmp("pd-ag-");
  mkdirCorp(ag);
  runAgentsAdd("cursor", ag); // creates AGENTS.md (owned)
  runAgentsAdd("copilot", ag);
  runAgentsRemove("cursor", ag, { force: true }); // copilot remains → block kept
  ok("US2: AGENTS.md kept after removing one of two non-Claude", exists(ag, "AGENTS.md"));
  runAgentsRemove("copilot", ag, { force: true }); // last non-Claude → delete (owned+empty)
  ok("US2: AGENTS.md deleted after removing last non-Claude (owned+empty)", !exists(ag, "AGENTS.md"));

  // shared AGENTS.md with user content: remove last → preserved (non-empty)
  const agu = mktmp("pd-ag-user-");
  mkdirCorp(agu);
  runAgentsAdd("cursor", agu);
  fs.appendFileSync(path.join(agu, "AGENTS.md"), "\n# user agent notes\n");
  runAgentsRemove("cursor", agu, { force: true }); // last non-Claude, but user content present
  ok("US2: AGENTS.md with user content preserved on last remove", exists(agu, "AGENTS.md") && fs.readFileSync(path.join(agu, "AGENTS.md"), "utf-8").includes("user agent notes"));

  // ── T014 / US3 / SC-004: legacy v2.0.0 project gets precise deletion ─────
  // (behavior spans T007 + T013; this is the US3 end-to-end regression lock.)
  const lg = mktmp("pd-legacy-");
  fs.mkdirSync(path.join(lg, ".spec", "memory"), { recursive: true }); // corpus (pre-2.1 shape)
  fs.mkdirSync(path.join(lg, ".claude", "skills", "spec-specify"), { recursive: true });
  fs.writeFileSync(path.join(lg, ".claude/skills/spec-specify/SKILL.md"), "# legacy coach skill\n");
  fs.mkdirSync(path.join(lg, ".claude", "skills", "spec-user-docs"), { recursive: true });
  fs.writeFileSync(path.join(lg, ".claude/skills/spec-user-docs/README.md"), "user docs\n");
  ok("SC-004 setup: no state file (legacy)", !exists(lg, ".spec/agents.json"));

  const status = getAgentsStatus(lg); // first agents command → reconcile (writes createdFiles)
  ok("SC-004: legacy claude reconciled as installed", status.some((a) => a.key === "claude" && a.installed));
  ok("SC-004: reconcile wrote .spec/agents.json", exists(lg, ".spec/agents.json"));
  ok("SC-004: reconcile backfilled createdFiles (Tier 2)", (readState(lg).claude?.createdFiles?.length ?? 0) > 0);

  runAgentsRemove("claude", lg, { force: true });
  ok("SC-004: legacy coach skill dir removed", !exists(lg, ".claude/skills/spec-specify"));
  ok("SC-004: user spec-* dir preserved on legacy remove (no wildcard)", exists(lg, ".claude/skills/spec-user-docs/README.md"));
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
