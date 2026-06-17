// US1 integration test — adding an AI tool is a data edit, not a code change.
// Run: npx tsx tests/units/datadriven.test.ts
// Covers FR-001/002/003 + SC-001. Demonstrates a 7th agent ("foo") that exists
// ONLY in manifest data (no corresponding code anywhere) resolves fully.
import assert from "node:assert/strict";
import * as fs from "node:fs";
import * as path from "node:path";
import * as os from "node:os";
import { loadManifest, findAgentEntry } from "../../src/manifest.ts";
import { loadAgentConfig } from "../../src/utils.ts";

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

console.log("=== datadriven.test (US1 / SC-001) ===");

// "foo" is an agent that has NO corresponding code in src/ — it exists only as
// manifest data. If the system resolves it, adding agents is data-driven.
const tmpDirs: string[] = [];
try {
  const real = JSON.parse(fs.readFileSync(path.join(process.cwd(), "agents.json"), "utf-8"));
  real.agents.foo = {
    key: "foo",
    name: "Foo Agent",
    dir: ".foo/skills",
    format: "skills",
    separator: "-",
    frontmatter: {},
    contextFile: "AGENTS.md",
    version: "0.1.0",
  };

  const tmp = fs.mkdtempSync(path.join(os.tmpdir(), "spec-datadriven-"));
  tmpDirs.push(tmp);
  const tmpManifest = path.join(tmp, "agents.json");
  fs.writeFileSync(tmpManifest, JSON.stringify(real));

  // --- loadManifest resolves the data-only 7th agent ---
  const agents = loadManifest(tmpManifest);
  ok("7th agent 'foo' loaded from manifest data (no code change)", agents.some((a) => a.key === "foo"));
  ok("manifest now has 7 agents (6 real + foo)", agents.length === 7);
  ok("original 6 agents still present", ["claude", "cursor", "copilot", "codex", "windsurf", "kiro"].every((k) => agents.some((a) => a.key === k)));

  // --- findAgentEntry resolves foo with all fields ---
  const foo = findAgentEntry("foo", tmpManifest);
  ok("findAgentEntry('foo') resolves", !!foo);
  ok("foo.name === 'Foo Agent'", foo?.name === "Foo Agent");
  ok("foo carries all required fields", !!foo && !!foo.dir && !!foo.format && !!foo.contextFile && !!foo.version);

  // --- SC-001 proof: 'foo' has zero references in src/ (it is pure data) ---
  const srcFiles = ["utils.ts", "manifest.ts", "state.ts", "cli.ts"].map((f) =>
    fs.readFileSync(path.join(process.cwd(), "src", f), "utf-8"),
  );
  const fooInCode = srcFiles.some((src) => /["']foo["']/.test(src));
  ok("no 'foo' string literal in src/ (adding it touched zero code)", !fooInCode);

  // --- the real manifest (no foo) still resolves the 6 shipped agents ---
  const shipped = loadAgentConfig("claude");
  ok("real manifest still resolves shipped claude", !!shipped && shipped.key === "claude");
} finally {
  for (const d of tmpDirs) {
    try { fs.rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ }
  }
}

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
