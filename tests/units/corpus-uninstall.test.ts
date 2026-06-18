// Mechanical test for src/commands/uninstall.ts (FR-014/016).
// Run: npx tsx tests/units/corpus-uninstall.test.ts
// TDD: written BEFORE uninstall.ts.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/commands/init.ts";
import { runAgentsAdd } from "../../src/commands/agents.ts";
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

console.log("=== corpus-uninstall.test ===");

try {
  // --- FR-014: refuses without confirmation ---
  const t0 = mktmp("un-nc-");
  await runInit(t0);
  runAgentsAdd("claude", t0);
  const refused = runUninstall(t0);
  ok("uninstall without confirmation -> ok:false", refused.ok === false);
  ok("refusal leaves infrastructure intact", exists(t0, ".spec/scripts/bash"));

  // --- FR-016: confirmed uninstall removes infra + bindings, preserves user content ---
  const t = mktmp("un-keep-");
  await runInit(t);
  runAgentsAdd("claude", t);
  runAgentsAdd("cursor", t);
  // user content
  fs.mkdirSync(path.join(t, "specs", "001-x"), { recursive: true });
  fs.writeFileSync(path.join(t, "specs", "001-x", "spec.md"), "# keep me\n");

  const res = runUninstall(t, { confirmed: true });
  ok("confirmed uninstall -> ok:true", res.ok === true);
  // infra removed
  ok(".spec/scripts removed", !exists(t, ".spec/scripts"));
  ok(".spec/templates removed", !exists(t, ".spec/templates"));
  ok(".spec/agents.json removed", !exists(t, ".spec/agents.json"));
  // bindings removed
  ok("claude binding removed", !exists(t, ".claude/skills"));
  ok("cursor binding removed", !exists(t, ".cursor/commands"));
  ok("CLAUDE.md removed", !exists(t, "CLAUDE.md"));
  // user content PRESERVED
  ok("specs/ PRESERVED", exists(t, "specs/001-x/spec.md"));
  ok("constitution PRESERVED", exists(t, ".spec/memory/constitution.md"));

  // --- FR-016 --force/purge: also removes user content ---
  const t2 = mktmp("un-purge-");
  await runInit(t2);
  fs.mkdirSync(path.join(t2, "specs", "001-y"), { recursive: true });
  fs.writeFileSync(path.join(t2, "specs", "001-y", "spec.md"), "# bye\n");
  runUninstall(t2, { confirmed: true, purge: true });
  ok("purge removes specs/", !exists(t2, "specs/001-y/spec.md"));
  ok("purge removes constitution", !exists(t2, ".spec/memory/constitution.md"));

  // --- T010/FR-012 (spec 004): uninstall touches only INSTALLED agents (advisory A4) ---
  const t3 = mktmp("un-installed-");
  await runInit(t3);
  runAgentsAdd("claude", t3);
  // codex is NOT installed, but a spec-coach-looking dir exists (user mimicked / partial install)
  fs.mkdirSync(path.join(t3, ".codex", "skills", "spec-specify"), { recursive: true });
  fs.writeFileSync(path.join(t3, ".codex/skills/spec-specify/SKILL.md"), "# user's own\n");
  // colliding user content in the installed agent's namespace
  fs.mkdirSync(path.join(t3, ".claude", "skills", "spec-user"), { recursive: true });
  fs.writeFileSync(path.join(t3, ".claude/skills/spec-user/README.md"), "mine");
  runUninstall(t3, { confirmed: true });
  ok("T010/FR-012: non-installed agent dir untouched", exists(t3, ".codex/skills/spec-specify/SKILL.md"));
  ok("T010/FR-012: installed claude binding removed", !exists(t3, ".claude/skills/spec-specify"));
  ok("T010: colliding user content in installed agent dir preserved", exists(t3, ".claude/skills/spec-user/README.md"));

  // --- T017/FR-016 (spec 005): .spec/intake is infra (removed); .spec/absorbed is user content (kept unless --force) ---
  const t4 = mktmp("un-intake-");
  await runInit(t4);
  fs.mkdirSync(path.join(t4, ".spec", "intake"), { recursive: true });
  fs.writeFileSync(path.join(t4, ".spec/intake/manifest.json"), '{"candidates":[]}');
  fs.writeFileSync(path.join(t4, ".spec/intake/ignore.json"), '{"patterns":[]}');
  fs.mkdirSync(path.join(t4, ".spec", "absorbed"), { recursive: true });
  fs.writeFileSync(path.join(t4, ".spec/absorbed/old.md"), "# absorbed doc\n");
  runUninstall(t4, { confirmed: true });
  ok("T017: .spec/intake removed on plain uninstall (regenerable infra)", !exists(t4, ".spec/intake"));
  ok("T017: .spec/absorbed PRESERVED on plain uninstall (user content)", exists(t4, ".spec/absorbed/old.md"));

  const t5 = mktmp("un-intake-force-");
  await runInit(t5);
  fs.mkdirSync(path.join(t5, ".spec", "absorbed"), { recursive: true });
  fs.writeFileSync(path.join(t5, ".spec/absorbed/old.md"), "# absorbed\n");
  runUninstall(t5, { confirmed: true, purge: true });
  ok("T017: --force purges .spec/absorbed", !exists(t5, ".spec/absorbed/old.md"));
} catch (e) {
  ok("uninstall ran without throwing", false);
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
