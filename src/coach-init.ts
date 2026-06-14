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
import * as readline from "node:readline";
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
      autopilot: "Describe the feature — AI will run the full SDD cycle autonomously",
      fix: "Describe the bug — what happened vs what should have happened. Optional: --spec specs/<id>",
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
    fm.compatibility = "Requires coach-kit project structure with .spec/ directory";
    fm.metadata = {
      author: "coach-kit",
      source: sourcePath,
    };
  }

  // Add argument hint if available
  if (agent.argumentHints) {
    const stem = skillName.replace("spec" + agent.separator, "");
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
  const skillId = `spec${agent.separator}${templateName.replace(".", agent.separator)}`;

  if (agent.format === "skills") {
    // Skills format: .claude/skills/spec-specify/SKILL.md
    const destDir = path.join(projectRoot, agent.dir, skillId);
    ensureDir(destDir);
    const destFile = path.join(destDir, "SKILL.md");
    const sourceRef = `skills/${templateName}.md`;
    const fm = buildSkillFrontmatter(agent, skillId, description, sourceRef, []);
    fs.writeFileSync(destFile, fm + body.trimStart());
  } else {
    // Markdown format: .cursor/commands/spec/specify.md
    const destDir = path.join(projectRoot, agent.dir, "spec");
    const destFile = path.join(destDir, `${templateName}.md`);
    // Markdown integrations use the original frontmatter with __SPEC_COMMAND_*__ references
    const processed = body
      .replace(/__SPEC_COMMAND_(\w+)__/g, (_m, name) => {
        const lower = name.toLowerCase().replace(/_/g, agent.separator);
        return `/spec${agent.separator}${lower}`;
      });
    ensureDir(destDir);
    fs.writeFileSync(destFile, raw); // Keep original frontmatter for markdown format
  }
}

function installAllSkills(agent: AgentConfig, projectRoot: string): string[] {
  const skillNames = [
    "specify", "plan", "tasks", "implement",
    "analyze", "clarify", "checklist", "constitution",
    "taskstoissues", "autopilot", "fix",
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
    "constitution-template", "fix-template"
  ];

  const destDir = path.join(projectRoot, ".spec", "templates");
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
    const memoryDir = path.join(projectRoot, ".spec", "memory");
    ensureDir(memoryDir);
    const constDest = path.join(memoryDir, "constitution.md");
    fs.copyFileSync(constSrc, constDest);
  }

  return installed;
}

// ── Project structure ──────────────────────────────────────────────────────

function createProjectStructure(projectRoot: string): void {
  ensureDir(path.join(projectRoot, ".spec", "templates"));
  ensureDir(path.join(projectRoot, ".spec", "memory"));
  ensureDir(path.join(projectRoot, ".spec", "scripts", "bash"));
  ensureDir(path.join(projectRoot, "specs"));
}

// ── Scripts ─────────────────────────────────────────────────────────────────

function installScripts(projectRoot: string): string[] {
  const scriptsSrc = path.join(PACKAGE_ROOT, "scripts", "bash");
  const scriptsDest = path.join(projectRoot, ".spec", "scripts", "bash");

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

function createFeatureJson(projectRoot: string): void {
  const file = path.join(projectRoot, ".spec", "feature.json");
  if (!fs.existsSync(file)) {
    fs.writeFileSync(file, JSON.stringify({
      version: "1.0.0",
      created: new Date().toISOString().split("T")[0],
      tool: "coach-kit",
    }, null, 2) + "\n");
  }
}

// ── Absorb: scan and migrate existing spec documents ─────────────────────

const MAX_CANDIDATE_SIZE = 500 * 1024; // 500KB threshold for scanning

const SCAN_EXCLUDE_DIRS = new Set([
  "node_modules", ".git", ".claude", ".spec", "specs", ".test-output",
]);

const SCAN_EXCLUDE_FILES = new Set([
  "changelog", "readme", "license", "contributing", "code_of_conduct",
]);

const FILE_KEYWORDS = [
  "spec", "requirement", "需求", "prd", "feature", "设计",
  "proposal", "方案", "plan", "任务", "story", "design",
];

const CONTENT_PATTERNS: { label: string; regex: RegExp }[] = [
  { label: "frontmatter", regex: /^---\n[\s\S]*?\n---/m },
  { label: "User Story", regex: /user\s*story|用户故事/i },
  { label: "Functional Requirement", regex: /functional\s*requirement|FR-\d|功能需求/i },
  { label: "Overview section", regex: /##\s*(overview|概述|背景|background)/i },
  { label: "Acceptance Criteria", regex: /acceptance\s*criteria|验收标准/i },
  { label: '"As a...I want" pattern', regex: /as\s+a\b.*\bi\s*want\b/i },
];

function isExcludedDir(name: string): boolean {
  return SCAN_EXCLUDE_DIRS.has(name) || name.startsWith(".");
}

function slugify(name: string): string {
  return path.basename(name, path.extname(name))
    .toLowerCase()
    .replace(/[^\w一-鿿-]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .replace(/-+/g, "-")
    .slice(0, 50);
}

interface Candidate {
  file: string;   // relative path from project root
  reason: string; // why it was flagged
  sizeKB: number; // file size in KB
}

function scanForCandidateDocs(projectRoot: string): Candidate[] {
  const candidates: Candidate[] = [];

  function walk(dir: string): void {
    let entries: fs.Dirent[];
    try { entries = fs.readdirSync(dir, { withFileTypes: true }); }
    catch { return; }

    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name);

      if (entry.isDirectory()) {
        if (isExcludedDir(entry.name)) continue;
        walk(fullPath);
        continue;
      }

      if (!entry.name.endsWith(".md") && !entry.name.endsWith(".mdx")) continue;

      const stem = entry.name.replace(/\.mdx?$/i, "").toLowerCase();
      if (SCAN_EXCLUDE_FILES.has(stem)) continue;

      let sizeKB = 0;
      try {
        const stat = fs.statSync(fullPath);
        if (stat.size > MAX_CANDIDATE_SIZE) continue;
        sizeKB = Math.round(stat.size / 1024);
      } catch { continue; }

      const relativePath = path.relative(projectRoot, fullPath);
      let reason = "";

      // Check filename keywords first
      for (const kw of FILE_KEYWORDS) {
        if (entry.name.toLowerCase().includes(kw.toLowerCase())) {
          reason = `filename matches "${kw}"`;
          break;
        }
      }

      // If filename didn't match, check content
      if (!reason) {
        let content: string;
        try { content = fs.readFileSync(fullPath, "utf-8"); }
        catch { continue; }

        for (const pattern of CONTENT_PATTERNS) {
          if (pattern.regex.test(content)) {
            reason = `content matches "${pattern.label}"`;
            break;
          }
        }
      }

      if (reason) {
        candidates.push({ file: relativePath, reason, sizeKB });
      }
    }
  }

  walk(projectRoot);
  return candidates;
}

function absorbDocument(
  sourceFile: string,
  featureId: string,
  projectRoot: string,
): void {
  const specsDir = path.join(projectRoot, "specs", featureId);
  ensureDir(specsDir);

  const sourceAbs = path.join(projectRoot, sourceFile);
  const originalContent = fs.readFileSync(sourceAbs, "utf-8");
  const [, body] = parseFrontmatter(originalContent);

  const today = new Date().toISOString().split("T")[0];

  const specContent = `# Spec: ${featureId}

**Created**: ${today} | **Status**: Draft | **Absorbed from**: ${sourceFile}

## Overview

${body.trim()}

## User Stories

[TODO: Not in original document — run /spec-specify to fill in]

## Functional Requirements

[TODO: Not in original document — run /spec-specify to fill in]

## Edge Cases

[TODO: Not in original document — run /spec-specify to fill in]

## Non-Goals

[TODO: Not in original document — run /spec-specify to fill in]

## Success Criteria

- [ ] [TODO: Not in original document — run /spec-specify to fill in]
`;

  const specFile = path.join(specsDir, "spec.md");
  fs.writeFileSync(specFile, specContent);

  // Archive original file
  const archiveDir = path.join(projectRoot, ".spec", "absorbed");
  ensureDir(archiveDir);
  const archiveName = sourceFile.replace(/\//g, "_");
  fs.copyFileSync(sourceAbs, path.join(archiveDir, archiveName));
  fs.unlinkSync(sourceAbs);
}

function prompt(rl: readline.Interface, question: string): Promise<string> {
  return new Promise((resolve) => {
    rl.question(question, (answer: string) => {
      resolve(answer.trim());
    });
  });
}

async function runAbsorbWorkflow(projectRoot: string): Promise<void> {
  const candidates = scanForCandidateDocs(projectRoot);
  if (candidates.length === 0) return;

  console.log(`\n  📄  Found ${candidates.length} candidate spec document(s):\n`);

  for (let i = 0; i < candidates.length; i++) {
    const c = candidates[i];
    console.log(`  [${i + 1}] ${c.file}  (${c.sizeKB}KB, ${c.reason})`);
  }

  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });

  console.log("");
  const raw = await prompt(rl, "  [a]bsorb all  [n]skip all  or numbers (e.g. 1,3,5): ");

  if (raw.toLowerCase() === "n" || raw === "") {
    rl.close();
    return;
  }

  let selected: Candidate[];

  if (raw.toLowerCase() === "a") {
    selected = candidates;
  } else {
    const indices = raw.split(",").map(s => parseInt(s.trim(), 10)).filter(n => n >= 1 && n <= candidates.length);
    selected = indices.map(n => candidates[n - 1]);
  }

  if (selected.length === 0) {
    rl.close();
    return;
  }

  console.log(`\n  Absorbing ${selected.length} document(s). Enter a feature ID for each:\n`);

  for (const c of selected) {
    const defaultId = slugify(path.basename(c.file));
    const id = await prompt(rl, `  Feature ID for "${c.file}" [${defaultId}]: `);
    const featureId = id || defaultId;

    if (!featureId) {
      console.log(`  ⚠  Skipping "${c.file}" — no valid feature ID\n`);
      continue;
    }

    absorbDocument(c.file, featureId, projectRoot);
  }

  rl.close();

  console.log(`\n  ✓  Absorbed ${selected.length} document(s) into specs/\n`);
  console.log("  Original files archived at .spec/absorbed/");
  console.log("  Run /spec-specify on each to fill in [TODO] sections.");
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
  ✓  11 skills → ${path.join(projectRoot, agent.dir)}
  ✓  6 document templates → ${path.join(projectRoot, ".spec/templates")}
  ✓  5 helper scripts → ${path.join(projectRoot, ".spec/scripts/bash")}

  Quick start — one command for the full cycle:
    /spec-autopilot "your feature description"

  Manual step-by-step (official order):
    1. /spec-constitution  → define project principles
    2. /spec-specify       → what & why
    3. /spec-clarify       → resolve ambiguities
    4. /spec-checklist     → validate requirements quality
    5. /spec-plan          → technical plan
    6. /spec-tasks         → task breakdown
    7. /spec-analyze       → cross-check consistency
    8. /spec-implement     → execute

  Bug fixes:
    /spec-fix "describe the bug"   → root cause analysis + fix + archive

  Lean: specify → plan → tasks → implement (skip quality gates)
`);
}

async function main(): Promise<void> {
  const args = process.argv.slice(2);
  let agentKey: AgentKey = "claude";
  let updateOnly = false;
  let skipAbsorb = false;

  for (let i = 0; i < args.length; i++) {
    if (args[i] === "--agent" || args[i] === "-a") {
      const val = args[++i];
      if (val && val in AGENTS) {
        agentKey = val as AgentKey;
      } else {
        console.error(`Unknown agent: ${val}. Supported: ${Object.keys(AGENTS).join(", ")}`);
        process.exit(1);
      }
    } else if (args[i] === "--update") {
      updateOnly = true;
    } else if (args[i] === "--skip-absorb") {
      skipAbsorb = true;
    } else if (args[i] === "--help" || args[i] === "-h") {
      console.log(`Usage: coach-init --agent <agent>

  Supported agents: ${Object.keys(AGENTS).join(", ")}

  Options:
    --agent, -a      AI coding agent to configure (default: claude)
    --update         Update skills/templates/scripts only. Preserves project
                     structure, metadata, and CLAUDE.md. Skips absorb.
    --skip-absorb    Skip scanning for existing spec documents
    --help, -h       Show this help
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
  console.log(`  Agent: ${agent.name}  |  Format: ${agent.format}  |  Project: ${path.basename(projectRoot)}`);
  if (updateOnly) console.log("  Mode: update (skills/templates/scripts only)\n");
  else console.log("");

  if (updateOnly) {
    // Update-only mode: refresh skills, templates, scripts.
    // Don't touch project structure, metadata, CLAUDE.md, or absorb.
    const skills = installAllSkills(agent, projectRoot);
    console.log(`  ✓  ${skills.length} skill templates updated`);

    const docTemplates = installDocumentTemplates(agent, projectRoot);
    console.log(`  ✓  ${docTemplates.length} document templates updated`);

    const scripts = installScripts(projectRoot);
    console.log(`  ✓  ${scripts.length} helper scripts updated\n`);

    console.log("  Done. Skills, templates, and scripts are up to date.");
    return;
  }

  // ── Full init mode ──────────────────────────────────────────────────────

  // 1. Create project structure
  createProjectStructure(projectRoot);
  console.log("  ✓  Project structure created");

  // 2. Install skill templates (10)
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
  // CLAUDE.md
  if (agent.key === "claude") {
    const claudePath = path.join(projectRoot, "CLAUDE.md");
    const claudeContent = "# " + path.basename(projectRoot) + "\n\n" +
      "<!-- COACH START -->\n" +
      "This project uses **Coach Kit** for spec-driven development.\n\n" +
      "## SDD Workflow\n\n" +
      "Run these slash commands in order:\n\n" +
      "1. /spec-constitution -- Define project principles\n" +
      "2. /spec-specify -- Create feature specification\n" +
      "3. /spec-clarify (optional) -- Clarify ambiguities\n" +
      "4. /spec-plan -- Create technical plan\n" +
      "5. /spec-tasks -- Generate task breakdown\n" +
      "6. /spec-analyze (optional) -- Cross-artifact review\n" +
      "7. /spec-implement -- Execute implementation\n\n" +
      "See .spec/templates/ for document templates and .spec/scripts/ for helper scripts.\n\n" +
      "## Bug Fixes\n\n" +
      "Run `/spec-fix \"describe the bug\"` for root-cause analysis and targeted fixes.\n\n" +
      "<!-- COACH END -->\n";
    try {
      fs.writeFileSync(claudePath, claudeContent);
    } catch (e) {
    }
  }
  console.log("  ✓  Metadata files created");

  // 6. Absorb existing spec documents (interactive)
  if (!skipAbsorb) {
    await runAbsorbWorkflow(projectRoot);
  }

  printNextSteps(agent, projectRoot);
}

main();
