// Mechanical test for src/utils.ts loadAgentConfig + manifest-derived AGENTS.
// Run: npx tsx tests/units/agent-config.test.ts
// TDD: written BEFORE the AGENTS-literal removal. Covers FR-003 (runtime resolution)
//      and that AgentConfig now carries contextFile (FR-010) + version (FR-012).
import assert from "node:assert/strict";
import { loadAgentConfig, AGENTS } from "../../src/utils.ts";

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

console.log("=== agent-config.test ===");

// --- FR-003: loadAgentConfig resolves known agents at runtime ---
const claude = loadAgentConfig("claude");
ok("loadAgentConfig(claude) non-null", !!claude);
ok("claude.contextFile === CLAUDE.md", claude?.contextFile === "CLAUDE.md");
ok("claude.version present", typeof claude?.version === "string" && claude.version.length > 0);
ok("claude.format === skills", claude?.format === "skills");
ok("claude.dir === .claude/skills", claude?.dir === ".claude/skills");

const cursor = loadAgentConfig("cursor");
ok("cursor.contextFile === AGENTS.md (non-claude)", cursor?.contextFile === "AGENTS.md");

// --- unknown agent -> null ---
ok("loadAgentConfig(unknown) === null", loadAgentConfig("nonexistent-agent") === null);

// --- backward-compat AGENTS map is manifest-derived (cli.ts still uses it) ---
ok("AGENTS has 6 keys", Object.keys(AGENTS).length === 6);
ok("AGENTS.claude resolves", !!AGENTS["claude"]);
ok("AGENTS.claude.contextFile === CLAUDE.md", AGENTS["claude"]?.contextFile === "CLAUDE.md");
ok("AGENTS contains cursor/codex/windsurf/kiro/copilot", ["cursor", "copilot", "codex", "windsurf", "kiro"].every((k) => !!AGENTS[k]));

// --- every config carries contextFile + version (required by FR-010/012 downstream) ---
const all = Object.values(AGENTS);
ok("all configs have contextFile", all.every((a) => typeof a.contextFile === "string" && a.contextFile.length > 0));
ok("all configs have version", all.every((a) => typeof a.version === "string" && a.version.length > 0));

assert.ok(pass > 0, "test ran");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
