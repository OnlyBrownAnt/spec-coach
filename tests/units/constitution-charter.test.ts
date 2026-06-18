// Mechanical test for the constitution-as-charter layer (spec 009).
// T002: the status advisor (verify-constitution-sync.sh) reports
// TEMPLATE / AUTHORED / ABSENT, including the authored-shell edge case.
// Drives the shipped bash script from node:assert via child_process.execSync
// against fixture files in a mkdtemp dir. Run: npx tsx tests/units/constitution-charter.test.ts
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { execSync } from "node:child_process";
import { runInit } from "../../src/commands/init.ts";
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
const ADVISOR = path.join(REPO, ".spec", "scripts", "bash", "verify-constitution-sync.sh");
const TEMPLATE_SRC = path.join(REPO, ".spec", "templates", "constitution-template.md");

// Run the advisor against a fixture file path; return its stdout.
function advisor(fixturePath: string): string {
  try {
    return execSync(`bash "${ADVISOR}" "${fixturePath}"`, { encoding: "utf8" });
  } catch {
    return " ERR";
  }
}

// A realistic AUTHORED charter: real principle headings + real footer (no signature tokens).
const AUTHORED_CHARTER = `# Spec Coach Constitution

## Core Principles

### I. Markdown Is the Product

The skill files ARE the product.

**Why this matters**: simplicity.

### II. Coach, Not Gatekeeper

Skills guide through suggestion.

## Development Constraints

- TypeScript CLI.

## Governance

Amendments require a documented rationale.

**Version**: 1.4.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-06-18
`;

// An authored SHELL: no signature tokens AND zero \`### \` principles (the edge case).
const AUTHORED_SHELL = `# Spec Coach Constitution

## Core Principles

## Governance

Amendments require a documented rationale.

**Version**: 1.0.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-01-01
`;

function writeFixture(dir: string, name: string, content: string): string {
  const p = path.join(dir, name);
  fs.writeFileSync(p, content);
  return p;
}

console.log("=== constitution-charter.test (T002: advisor status) ===");

try {
  const tmp = mktmp("cc-adv-");

  // --- (a) TEMPLATE: the canonical template fixture (real signature tokens) ---
  const tplFixture = path.join(tmp, "template.md");
  fs.copyFileSync(TEMPLATE_SRC, tplFixture);
  const tplOut = advisor(tplFixture);
  ok("(a) canonical template -> state TEMPLATE", /Constitution state:\s*TEMPLATE/.test(tplOut));

  // --- (b) AUTHORED: real principles, real footer ---
  const authFixture = writeFixture(tmp, "authored.md", AUTHORED_CHARTER);
  const authOut = advisor(authFixture);
  ok("(b) authored charter -> state AUTHORED", /Constitution state:\s*AUTHORED/.test(authOut));

  // --- (c) AUTHORED shell: no tokens, zero principles (edge case) ---
  const shellFixture = writeFixture(tmp, "shell.md", AUTHORED_SHELL);
  const shellOut = advisor(shellFixture);
  ok("(c) authored shell (0 principles) -> state AUTHORED", /Constitution state:\s*AUTHORED/.test(shellOut));

  // --- (d) ABSENT: missing file ---
  const absentOut = advisor(path.join(tmp, "does-not-exist.md"));
  ok("(d) missing file -> state ABSENT", /Constitution state:\s*ABSENT/.test(absentOut));

  // --- (e) non-blocking: advisor always exits 0 (even on missing file) ---
  let exitCode = 0;
  try {
    execSync(`bash "${ADVISOR}" "${path.join(tmp, "nope.md")}"`, { encoding: "utf8", stdio: "ignore" });
  } catch (e: unknown) {
    exitCode = (e as { status?: number }).status ?? 1;
  }
  ok("(e) advisor exits 0 on missing file (non-blocking)", exitCode === 0);
} catch (e) {
  ok("advisor test block ran without throwing", false);
  console.log("    error:", (e as Error).message);
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

console.log("=== constitution-charter.test (T003: skill content assertions) ===");

try {
  const skill = fs.readFileSync(path.join(REPO, "skills", "constitution.md"), "utf8");

  ok("skill references 'Constitution state' (status-branch on advisor)", /Constitution state/.test(skill));
  ok("skill names the AUTHORED status", /AUTHORED/.test(skill));
  ok("skill states the amend-guard (never rewrite a settled principle)", /never rewrite a settled principle/i.test(skill));
  ok("skill documents the --reset full-rewrite escape hatch", /--reset/.test(skill));
  ok("skill seeds cold-start from repo signals (package.json + README + propose)", /package\.json/.test(skill) && /README/.test(skill) && /propose/i.test(skill));
  ok("skill frames the constitution as a charter (charter + amend never overwrite)", /charter/i.test(skill) && /amend never overwrite/i.test(skill));
} catch (e) {
  ok("skill-content block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

console.log("=== constitution-charter.test (T004: skill semvar + propagation) ===");

try {
  const skill = fs.readFileSync(path.join(REPO, "skills", "constitution.md"), "utf8");
  ok("skill codifies constitution-doc semver (MAJOR/MINOR/PATCH)", /MAJOR/.test(skill) && /MINOR/.test(skill) && /PATCH/.test(skill));
  ok("skill propagation covers spec-template + tasks-template (not only plan)", /spec-template/.test(skill) && /tasks-template/.test(skill));
} catch (e) {
  ok("semvar/propagation block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

console.log("=== constitution-charter.test (T005: status-aware uninstall) ===");

const AUTHORED_BODY = "# Proj Constitution\n\n## Core Principles\n\n### I. Real Principle\n\nReal text.\n\n**Version**: 1.0.0 | **Ratified**: 2026-01-01 | **Last Amended**: 2026-01-01\n";
function writeAuthored(root: string): void {
  fs.mkdirSync(path.join(root, ".spec", "memory"), { recursive: true });
  fs.writeFileSync(path.join(root, ".spec", "memory", "constitution.md"), AUTHORED_BODY);
}

try {
  // AUTHORED constitution (no signature tokens) -> PRESERVED on plain uninstall (IP).
  const u1 = mktmp("cc-un-auth-");
  await runInit(u1);
  writeAuthored(u1);
  runUninstall(u1, { confirmed: true });
  ok("AUTHORED constitution PRESERVED on plain uninstall", fs.existsSync(path.join(u1, ".spec", "memory", "constitution.md")));

  // TEMPLATE constitution (init copies the template) -> removed on plain uninstall (tooling).
  const u2 = mktmp("cc-un-tpl-");
  await runInit(u2);
  runUninstall(u2, { confirmed: true });
  ok("TEMPLATE constitution removed on plain uninstall (tooling)", !fs.existsSync(path.join(u2, ".spec", "memory", "constitution.md")));

  // --force/purge removes even an AUTHORED constitution.
  const u3 = mktmp("cc-un-purge-");
  await runInit(u3);
  writeAuthored(u3);
  runUninstall(u3, { confirmed: true, purge: true });
  ok("purge removes AUTHORED constitution", !fs.existsSync(path.join(u3, ".spec", "memory", "constitution.md")));
} catch (e) {
  ok("uninstall block ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
