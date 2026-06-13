#!/usr/bin/env -S npx tsx
/**
 * Coach Kit — Lightweight SDD project initializer.
 *
 * Usage:
 *   npx tsx coach-init.ts --agent claude
 *   npx tsx coach-init.ts --agent cursor
 *   npx tsx coach-init.ts --agent copilot
 *   npx tsx coach-init.ts --agent codex
 *
 * Or install globally:
 *   npm i -g coach-kit && coach-init --agent claude
 */

import * as fs from "node:fs";
import * as path from "node:path";
import { fileURLToPath } from "node:url";

// ── Types ──────────────────────────────────────────────────────────────────

interface AgentConfig {
  key: string;
  name: string;
  dir: string;
  format: "skills" | "markdown";
  separator: string;
  frontmatter: Record<string, string | boolean>;
  argumentHints?: Record<string, string>;
}

type AgentKey = "claude" | "cursor" | "copilot" | "codex" | "windsurf";

// ── Agent configurations ───────────────────────────────────────────────────

const AGENTS: Record<AgentKey, AgentConfig> = {
  claude: {
    key: "claude",
    name: "Claude Code",
    dir: ".claude/skills",
    format: "skills",
    separator: "-",
    frontmatter: { "user-invocable": true, "disable-model-invocation": false },
    argumentHints: {
      specify: "Describe the feature you want to specify",
      plan: "Optional guidance for the planning phase",
      tasks: "Optional task generation constraints",
      implement: "Optional implementation guidance or task filter",
      analyze: "Optional focus areas for analysis",
      clarify: "Optional areas to clarify in the spec",
      constitution: "Principles or values for the project constitution",
      checklist: "Domain or focus area for the checklist",
    },
  },
  cursor: {
    key: "cursor",
    name: "Cursor",
    dir: ".cursor/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
  copilot: {
    key: "copilot",
    name: "GitHub Copilot",
    dir: ".github/copilot/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
  codex: {
    key: "codex",
    name: "OpenAI Codex",
    dir: ".codex/skills",
    format: "skills",
    separator: "-",
    frontmatter: { "user-invocable": true, "disable-model-invocation": false },
  },
  windsurf: {
    key: "windsurf",
    name: "Windsurf",
    dir: ".windsurf/commands",
    format: "markdown",
    separator: ".",
    frontmatter: {},
  },
};

// ── File operations ────────────────────────────────────────────────────────

// Resolve package root from the script's location on disk.
// `import.meta.url` points to the source file (works with tsx, ts-node, and compiled ESM).
// Fall back to `process.argv[1]` for edge cases.
let __scriptPath: string;
try {
  __scriptPath = fileURLToPath(import.meta.url);
} catch {
  __scriptPath = process.argv[1];
}
const PACKAGE_ROOT = path.resolve(path.dirname(__scriptPath), "..");

function skillSource(name: string): string {
  return path.join(PACKAGE_ROOT, "skills", `${name}.md`);
}

function templateSource(name: string): string {
  return path.join(PACKAGE_ROOT, "templates", `${name}.md`);
}

function ensureDir(dir: string): void {
  fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src: string, dest: string): void {
  ensureDir(path.dirname(dest));
  fs.copyFileSync(src, dest);
}

// ── Template processing ────────────────────────────────────────────────────

/** Parse YAML frontmatter from a markdown file. Returns [frontmatter, body]. */
function parseFrontmatter(content: string): [Record<string, unknown>, string] {
  if (!content.startsWith("---")) return [{}, content];
  const end = content.indexOf("---", 3);
  if (end === -1) return [{}, content];
  const fm: Record<string, unknown> = {};
  for (const line of content.slice(3, end).split("\n")) {
    const colon = line.indexOf(":");
    if (colon > 0) {
      const key = line.slice(0, colon).trim();
      let value: string = line.slice(colon + 1).trim();
      if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) {
        value = value.slice(1, -1);
      }
      fm[key] = value;
    }
  }
  return [fm, content.slice(end + 3).trimStart()];
}

/** Build YAML frontmatter string from an object. */
function buildFrontmatter(obj: Record<string, unknown>): string {
  const lines = ["---"];
  for (const [key, value] of Object.entries(obj)) {
    if (typeof value === "boolean") lines.push(`${key}: ${value}`);
    else if (typeof value === "string") lines.push(`${key}: "${value.replace(/\\/g, "\\\\").replace(/"/g, '\\"')}"`);
    else lines.push(`${key}: ${JSON.stringify(value)}`);
  }
  lines.push("---");
  return lines.join("\n") + "\n\n";
}

// ── Skill installation ─────────────────────────────────────────────────────

function buildSkillFrontmatter(
  agent: AgentConfig,
  skillName: string,
  description: string,
  sourcePath: string,
  args: string[]
): string {
  const fm: Record<string, unknown> = {
    name: skillName,
    description,
    ...agent.frontmatter,
  };

  // Skills format includes metadata block
  if (agent.format === "skills") {
    fm.compatibility = "Requires coach-kit project structure with .specify/ directory";
    fm.metadata = {
      author: "coach-kit",
      source: sourcePath,
    };
  }

  // Add argument hint if available
  if (agent.argumentHints) {
    const stem = skillName.replace("speckit" + agent.separator, "");
    const hint = agent.argumentHints[stem];
    if (hint) {
      (fm as any)["argument-hint"] = hint;
    }
  }

  return buildFrontmatter(fm);
}

function installSkill(
  agent: AgentConfig,
  templateName: string,
  projectRoot: string
): void {
  const src = skillSource(templateName);
  if (!fs.existsSync(src)) {
    console.warn(`  ⚠  Skill template not found: ${templateName}.md — skipping`);
    return;
  }

  const raw = fs.readFileSync(src, "utf-8");
  const [origFm, body] = parseFrontmatter(raw);
  const description = String(origFm.description || `Coach Kit: ${templateName} workflow`);
  const skillId = `speckit${agent.separator}${templateName.replace(".", agent.separator)}`;

  if (agent.format === "skills") {
    // Skills format: .claude/skills/speckit-specify/SKILL.md
    const destDir = path.join(projectRoot, agent.dir, skillId);
    ensureDir(destDir);
    const destFile = path.join(destDir, "SKILL.md");
    const sourceRef = `skills/${templateName}.md`;
    const fm = buildSkillFrontmatter(agent, skillId, description, sourceRef, []);
    fs.writeFileSync(destFile, fm + body.trimStart());
  } else {
    // Markdown format: .cursor/commands/speckit/specify.md
    const destDir = path.join(projectRoot, agent.dir, "speckit");
    const destFile = path.join(destDir, `${templateName}.md`);
    // Markdown integrations use the original frontmatter with __SPECKIT_COMMAND_*__ references
    const processed = body
      .replace(/__SPECKIT_COMMAND_(\w+)__/g, (_m, name) => {
        const lower = name.toLowerCase().replace(/_/g, agent.separator);
        return `/speckit${agent.separator}${lower}`;
      });
    ensureDir(destDir);
    fs.writeFileSync(destFile, raw); // Keep original frontmatter for markdown format
  }
}

function installAllSkills(agent: AgentConfig, projectRoot: string): string[] {
  const skillNames = [
    "specify", "plan", "tasks", "implement",
    "analyze", "clarify", "checklist", "constitution",
    "taskstoissues",
  ];

  const installed: string[] = [];
  for (const name of skillNames) {
    installSkill(agent, name, projectRoot);
    installed.push(name);
  }
  return installed;
}

// ── Document templates ─────────────────────────────────────────────────────

function installDocumentTemplates(agent: AgentConfig, projectRoot: string): string[] {
  const templateNames = [
    "spec-template",
    "plan-template",
    "tasks-template",
    "checklist-template",
    "constitution-template",
  ];

  const destDir = path.join(projectRoot, ".specify", "templates");
  ensureDir(destDir);

  const installed: string[] = [];
  for (const name of templateNames) {
    const src = templateSource(name);
    if (fs.existsSync(src)) {
      const dest = path.join(destDir, `${name}.md`);
      fs.copyFileSync(src, dest);
      installed.push(name);
    }
  }

  // Also copy constitution to memory
  const constSrc = templateSource("constitution-template");
  if (fs.existsSync(constSrc)) {
    const memoryDir = path.join(projectRoot, ".specify", "memory");
    ensureDir(memoryDir);
    const constDest = path.join(memoryDir, "constitution.md");
    fs.copyFileSync(constSrc, constDest);
  }

  return installed;
}

// ── Project structure ──────────────────────────────────────────────────────

function createProjectStructure(projectRoot: string): void {
  ensureDir(path.join(projectRoot, ".specify", "templates"));
  ensureDir(path.join(projectRoot, ".specify", "memory"));
  ensureDir(path.join(projectRoot, ".specify", "scripts", "bash"));
  ensureDir(path.join(projectRoot, "specs"));
}

// ── Scripts ─────────────────────────────────────────────────────────────────

function installScripts(projectRoot: string): string[] {
  const scriptsSrc = path.join(PACKAGE_ROOT, "scripts", "bash");
  const scriptsDest = path.join(projectRoot, ".specify", "scripts", "bash");

  if (!fs.existsSync(scriptsSrc)) return [];

  const installed: string[] = [];
  for (const name of fs.readdirSync(scriptsSrc)) {
    if (name.endsWith(".sh")) {
      const src = path.join(scriptsSrc, name);
      const dest = path.join(scriptsDest, name);
      fs.copyFileSync(src, dest);
      fs.chmodSync(dest, 0o755);
      installed.push(name);
    }
  }
  return installed;
}

// ── Metadata files ─────────────────────────────────────────────────────────

function createIntegrationJson(projectRoot: string, agent: AgentConfig): void {
  const file = path.join(projectRoot, ".specify", "integration.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      version: "1.0.0",
      default_integration: agent.key,
      installed_integrations: [agent.key],
      integration_settings: {
        [agent.key]: {
          script: "sh",
          invoke_separator: agent.separator,
        },
      },
    }, null, 2) + "\n");
  }
}

function createInitOptionsJson(projectRoot: string, agent: AgentConfig): void {
  const file = path.join(projectRoot, ".specify", "init-options.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      ai: agent.key,
      ai_skills: agent.format === "skills",
      feature_numbering: "sequential",
      here: true,
      integration: agent.key,
      script: "sh",
      speckit_version: "1.0.0",
    }, null, 2) + "\n");
  }
}

function createFeatureJson(projectRoot: string): void {
  const file = path.join(projectRoot, ".specify", "feature.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      version: "1.0.0",
      created: new Date().toISOString().split("T")[0],
      tool: "coach-kit",
    }, null, 2) + "\n");
  }
}

// ── Main ───────────────────────────────────────────────────────────────────

function printBanner(): void {
  console.log(`
  ╔══════════════════════════════════════════╗
  ║  🏈  Coach Kit — SDD that trusts AI     ║
  ║  Guidance over gates.                    ║
  ║  Craftsmanship over compliance.          ║
  ╚══════════════════════════════════════════╝
`);
}

function printNextSteps(agent: AgentConfig, projectRoot: string): void {
  const sep = agent.separator;
  console.log(`
  ✓  Project initialized at ${projectRoot}
  ✓  AI agent: ${agent.name}
  ✓  8 skills → ${path.join(projectRoot, agent.dir)}
  ✓  5 document templates → ${path.join(projectRoot, ".specify/templates")}
  ✓  5 helper scripts → ${path.join(projectRoot, ".specify/scripts/bash")}

  Next steps:
    1. Start ${agent.name} in this directory
    2. Create a feature:  .specify/scripts/bash/create-new-feature.sh "your feature description"
    3. Run /speckit-constitution to define project principles
    4. Run /speckit-specify with your feature description
    5. Follow the SDD cycle: specify → plan → tasks → implement
`);
}

function main(): void {
  const args = process.argv.slice(2);
  let agentKey: AgentKey = "claude";

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" || args[i] === "-a") {
      const val = args[++i];
      if (val && val in AGENTS) {
        agentKey = val as AgentKey;
      } else {
        console.error(`Unknown agent: ${val}. Supported: ${Object.keys(AGENTS).join(", ")}`);
        process.exit(1);
      }
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: coach-init --agent <agent>

  Supported agents: ${Object.keys(AGENTS).join(", ")}

  Options:
    --agent, -a   AI coding agent to configure (default: claude)
    --help, -h    Show this help
`);
      process.exit(0);
    }
  }

  const projectRoot = process.cwd();
  const agent = AGENTS[agentKey];
  if (!agent) {
    process.exit(1);
  }

  printBanner();
  console.log(`  Agent: ${agent.name}  |  Format: ${agent.format}  |  Project: ${path.basename(projectRoot)}\n`);

  // 1. Create project structure
  createProjectStructure(projectRoot);
  console.log("  ✓  Project structure created");

  // 2. Install skill templates (8 core)
  const skills = installAllSkills(agent, projectRoot);
  console.log(`  ✓  ${skills.length} skill templates installed`);

  // 3. Install document templates (5)
  const docTemplates = installDocumentTemplates(agent, projectRoot);
  console.log(`  ✓  ${docTemplates.length} document templates installed`);

  // 4. Install helper scripts (5)
  const scripts = installScripts(projectRoot);
  console.log(`  ✓  ${scripts.length} helper scripts installed`);

  // 5. Metadata files
  createFeatureJson(projectRoot);
  createIntegrationJson(projectRoot, agent);
  createInitOptionsJson(projectRoot, agent);
  // CLAUDE.md
  if (agent.key === "claude") {
    const claudePath = path.join(projectRoot, "CLAUDE.md");
    const claudeContent = "# " + path.basename(projectRoot) + "\n\n" +
      "<!-- SPECKIT START -->\n" +
      "This project uses **Coach Kit** for spec-driven development.\n\n" +
      "## SDD Workflow\n\n" +
      "Run these slash commands in order:\n\n" +
      "1. /speckit-constitution -- Define project principles\n" +
      "2. /speckit-specify -- Create feature specification\n" +
      "3. /speckit-clarify (optional) -- Clarify ambiguities\n" +
      "4. /speckit-plan -- Create technical plan\n" +
      "5. /speckit-tasks -- Generate task breakdown\n" +
      "6. /speckit-analyze (optional) -- Cross-artifact review\n" +
      "7. /speckit-implement -- Execute implementation\n\n" +
      "See .specify/templates/ for document templates and .specify/scripts/ for helper scripts.\n" +
      "<!-- SPECKIT END -->\n";
    try {
      fs.writeFileSync(claudePath, claudeContent);
    } catch (e) {
    }
  }
  console.log("  ✓  Metadata files created");

  printNextSteps(agent, projectRoot);
}

main();
