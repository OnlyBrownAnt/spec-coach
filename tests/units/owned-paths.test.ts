// Mechanical test for ownedSkillUnits — the single source of truth for the
// leaf paths an agent owns (spec 004). Run: npx tsx tests/units/owned-paths.test.ts
import assert from "node:assert/strict";
import { ownedSkillUnits, SKILL_NAMES, type AgentConfig } from "../../src/utils.ts";

let pass = 0;
let fail = 0;
function ok(name: string, cond: boolean): void {
  if (cond) { pass++; console.log("  [PASS]", name); }
  else { fail++; console.log("  [FAIL]", name); }
}

const claude: AgentConfig = {
  key: "claude", name: "Claude Code", dir: ".claude/skills", format: "skills",
  separator: "-", frontmatter: {}, contextFile: "CLAUDE.md", version: "1.0.0",
};
const cursor: AgentConfig = {
  key: "cursor", name: "Cursor", dir: ".cursor/commands", format: "markdown",
  separator: ".", frontmatter: {}, contextFile: "AGENTS.md", version: "1.0.0",
};

console.log("=== owned-paths.test (spec 004) ===");

try {
  ok("SKILL_NAMES is exported as an array", Array.isArray(SKILL_NAMES));
  ok("SKILL_NAMES has 11 entries", SKILL_NAMES.length === 11);

  // skills format → spec-{name} dirs relative to project root
  const claudePaths = ownedSkillUnits(claude);
  ok("claude owns 11 units", claudePaths.length === 11);
  ok("claude units are spec-* dirs", claudePaths.every((p) => p.startsWith(".claude/skills/spec-")));
  ok("claude includes spec-specify", claudePaths.includes(".claude/skills/spec-specify"));
  ok("claude includes spec-taskstoissues", claudePaths.includes(".claude/skills/spec-taskstoissues"));

  // markdown format → spec/{name}.md files
  const cursorPaths = ownedSkillUnits(cursor);
  ok("cursor owns 11 units", cursorPaths.length === 11);
  ok("cursor units are spec/*.md files", cursorPaths.every((p) => p.startsWith(".cursor/commands/spec/") && p.endsWith(".md")));
  ok("cursor includes spec/specify.md", cursorPaths.includes(".cursor/commands/spec/specify.md"));

  // both share the same count (one unit per skill name)
  ok("claude and cursor own the same number of units", claudePaths.length === cursorPaths.length);
} catch (e) {
  ok("owned-paths ran without throwing", false);
  console.log("    error:", (e as Error).message);
}

assert.ok(pass > 0, "test ran assertions");
console.log("");
console.log(`=== Results: ${pass} passed, ${fail} failed ===`);
process.exit(fail === 0 ? 0 : 1);
