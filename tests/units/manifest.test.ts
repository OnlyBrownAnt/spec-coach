// Mechanical test for src/manifest.ts — fast, deterministic, no AI.
// Run: npx tsx tests/units/manifest.test.ts
// TDD: written BEFORE src/manifest.ts. Covers FR-001/002/003/015.
import assert from "node:assert/strict";
import {
  loadManifest,
  validateAgentEntry,
  type AgentEntry,
} from "../../src/manifest.ts";

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

console.log("=== manifest.test ===");

// --- FR-001/002/003: valid manifest loads the 6 agents with all fields ---
let agents: AgentEntry[] = [];
try {
  agents = loadManifest();
  ok("loadManifest returns 6 agents", agents.length === 6);
  ok("claude present", agents.some((a) => a.key === "claude"));
  ok("cursor present", agents.some((a) => a.key === "cursor"));
} catch (e) {
  ok("loadManifest returns 6 agents", false);
  console.log("    error:", (e as Error).message);
}
const claude = agents.find((a) => a.key === "claude");
ok("claude.contextFile === CLAUDE.md", claude?.contextFile === "CLAUDE.md");
ok("claude.format === skills", claude?.format === "skills");
ok(
  "non-claude (cursor).contextFile === AGENTS.md",
  agents.find((a) => a.key === "cursor")?.contextFile === "AGENTS.md",
);

// --- FR-015: validateAgentEntry rejects malformed entries ---
function expectReject(name: string, entry: unknown): void {
  try {
    validateAgentEntry(entry);
    ok(name, false);
  } catch {
    ok(name, true);
  }
}
expectReject("reject missing key", {
  name: "x", dir: "d", format: "skills", separator: "-", frontmatter: {}, contextFile: "f", version: "1",
});
expectReject("reject missing dir", {
  key: "x", name: "x", format: "skills", separator: "-", frontmatter: {}, contextFile: "f", version: "1",
});
expectReject("reject bad format", {
  key: "x", name: "x", dir: "d", format: "bogus", separator: "-", frontmatter: {}, contextFile: "f", version: "1",
});
expectReject("reject missing name", {
  key: "x", dir: "d", format: "skills", separator: "-", frontmatter: {}, contextFile: "f", version: "1",
});
expectReject("reject missing contextFile", {
  key: "x", name: "x", dir: "d", format: "skills", separator: "-", frontmatter: {}, version: "1",
});
expectReject("reject missing version", {
  key: "x", name: "x", dir: "d", format: "skills", separator: "-", frontmatter: {}, contextFile: "f",
});

// --- FR-015: error message names the field (specific, actionable) ---
try {
  validateAgentEntry({ key: "x", name: "x", format: "skills", separator: "-", frontmatter: {}, contextFile: "f", version: "1" });
  ok("missing-dir error mentions 'dir'", false);
} catch (e) {
  ok("missing-dir error mentions 'dir'", (e as Error).message.includes("dir"));
}
try {
  validateAgentEntry({ key: "x", name: "x", dir: "d", format: "weird", separator: "-", frontmatter: {}, contextFile: "f", version: "1" });
  ok("bad-format error mentions 'format'", false);
} catch (e) {
  ok("bad-format error mentions 'format'", (e as Error).message.includes("format"));
}

// --- valid entry passes ---
try {
  const v = validateAgentEntry({
    key: "foo", name: "Foo", dir: ".foo", format: "markdown", separator: ".",
    frontmatter: {}, contextFile: "AGENTS.md", version: "1.0.0",
  });
  ok("valid entry passes", v.key === "foo");
} catch {
  ok("valid entry passes", false);
}

// --- assert import did not silently swallow (sanity) ---
assert.ok(agents.length === 6 || fail > 0, "test ran");

console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
