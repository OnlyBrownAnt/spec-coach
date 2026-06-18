// Mechanical tests for the configurable commit convention layer (spec 010).
// T002: init seeds .spec/convention.md (TEMPLATE); init AND update never
// clobber an AUTHORED convention (the spec 009 never-clobber invariant,
// FR-007, extended to the convention — FR-001; analysis A2 locks the update
// half). Drives the TS installer from node:assert in mkdtemp repos.
// Run: npx tsx tests/units/commit-convention.test.ts
//
// Later tasks (T003–T007) append their own labeled blocks above the final
// cleanup + results at the bottom of this file.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { runInit } from "../../src/commands/init.ts";
import { runUpdate } from "../../src/commands/update.ts";
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

const REPO = path.resolve(import.meta.dirname, "..", "..");
const conv = (root: string): string => path.join(root, ".spec", "convention.md");

// An AUTHORED convention: a real rules block + no signature tokens (the
// TEMPLATE's [PROJECT_NAME]/[ALLOWED_TYPES]/[SCOPE_FORMAT] are gone).
const AUTHORED_CONVENTION = `# Project Commit Convention

We use Conventional Commits.

<!-- CONVENTION RULES START
allowed_types: feat fix docs refactor test chore
scope_required: false
task_id_footer: optional
CONVENTION RULES END -->

**Version**: 1.0.0
`;

function writeAuthoredConvention(root: string): void {
  fs.mkdirSync(path.join(root, ".spec"), { recursive: true });
  fs.writeFileSync(conv(root), AUTHORED_CONVENTION);
}

// ─── T002: seed + never-clobber ─────────────────────────────────────────────
console.log("=== commit-convention.test (T002: seed + never-clobber) ===");
try {
  // (a) init seeds .spec/convention.md in TEMPLATE state.
  const a = mktmp("cc-seed-");
  await runInit(a);
  ok("(a) init seeds .spec/convention.md", fs.existsSync(conv(a)));
  ok("(a) seeded convention is TEMPLATE (signature token present)",
    /\[ALLOWED_TYPES\]/.test(fs.readFileSync(conv(a), "utf8")));

  // (b) init never clobbers an AUTHORED convention (FR-001 never-clobber).
  const b = mktmp("cc-init-nc-");
  writeAuthoredConvention(b);
  const before = fs.readFileSync(conv(b), "utf8");
  await runInit(b);
  const after = fs.readFileSync(conv(b), "utf8");
  ok("(b) init never clobbers an AUTHORED convention", before === after);

  // (c) update never clobbers an AUTHORED convention (analysis A2).
  const c = mktmp("cc-upd-nc-");
  await runInit(c);
  writeAuthoredConvention(c);
  const beforeU = fs.readFileSync(conv(c), "utf8");
  await runUpdate(c);
  const afterU = fs.readFileSync(conv(c), "utf8");
  ok("(c) update never clobbers an AUTHORED convention", beforeU === afterU);
} catch (e) {
  ok("T002 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── (later task blocks T003–T007 are inserted here) ────────────────────────

// ─── T003: status-aware uninstall preserve (FR-001 charter-as-IP) ───────────
console.log("=== commit-convention.test (T003: uninstall preserve) ===");
try {
  // (a) AUTHORED convention PRESERVED on plain uninstall (project IP).
  const u1 = mktmp("cc-un-auth-");
  await runInit(u1);
  writeAuthoredConvention(u1);
  runUninstall(u1, { confirmed: true });
  ok("AUTHORED convention PRESERVED on plain uninstall", fs.existsSync(conv(u1)));

  // (b) TEMPLATE convention (init-seeded) removed on plain uninstall (tooling).
  const u2 = mktmp("cc-un-tpl-");
  await runInit(u2);
  runUninstall(u2, { confirmed: true });
  ok("TEMPLATE convention removed on plain uninstall (tooling)", !fs.existsSync(conv(u2)));

  // (c) --force/purge removes even an AUTHORED convention.
  const u3 = mktmp("cc-un-purge-");
  await runInit(u3);
  writeAuthoredConvention(u3);
  runUninstall(u3, { confirmed: true, purge: true });
  ok("purge removes AUTHORED convention", !fs.existsSync(conv(u3)));
} catch (e) {
  ok("T003 block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

// ─── cleanup + results ──────────────────────────────────────────────────────
for (const d of tmpDirs) {
  try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
