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

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
